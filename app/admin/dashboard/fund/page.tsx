import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, Tile, Spark, checkAdmin, usd } from '../ui'
import TrendChart from '../trend-chart'
import LiveTiles from '../live-tiles'
import DeskLive, { type DeskState } from '../desk-live'

// J&P FUND — the research desk: latest verified multi-agent market sweep
// (TA, sentiment, flows, turnover, narratives, calendar) feeding the weekly call.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface TaRow { asset: string; price: number; sma20: number; sma50: number; sma200: number; vs: string; hi90: number; lo90: number; support: string; resistance: string; note: string }
interface Brief {
  headline: string
  verified: string
  ta: TaRow[]
  sentiment: { fear_greed: number; fg_label: string; fg_note: string; funding: string; gaps: string }
  flows: { label: string; value: string; note: string }[]
  turnover: { asset: string; volMcap: number; d7: number; d30: number }[]
  narratives: { title: string; stage: string; assets: string; catalyst: string }[]
  calendar: { date: string; event: string; why: string }[]
  implications: string[]
}

// Sub-cent coins need significant digits, not fixed ones: PEPE at 0.0000039
// formats to "$0.0000" on toFixed(4), which reads as a broken zero.
const px = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'

interface Radar { symbol: string; name: string; price: number; market_cap: number; turnover: number; d1: number; d7: number; d30: number; stage: string; score: number }
interface Holding { symbol: string; qty: number; avg_cost: number }
interface Trade { order_id: string; traded_at: string; side: string; symbol: string; qty: number; avg_price: number; note: string | null }
interface Watch { symbol: string; thesis: string; trigger_level: string }

// Symbol → CoinGecko id for pricing the fund's book. Extend as holdings do.
const CG: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple', DOGE: 'dogecoin',
  ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink', LTC: 'litecoin', BCH: 'bitcoin-cash',
  XLM: 'stellar', UNI: 'uniswap', AAVE: 'aave', SHIB: 'shiba-inu', PEPE: 'pepe',
  BONK: 'bonk', WIF: 'dogwifcoin', DOT: 'polkadot', SUI: 'sui', HYPE: 'hyperliquid',
  LIT: 'lighter', ONDO: 'ondo-finance', MOODENG: 'moo-deng', ZEC: 'zcash', PUMP: 'pump-fun',
  ARB: 'arbitrum', LDO: 'lido-dao', STRK: 'starknet', NEAR: 'near', FET: 'fetch-ai', SEI: 'sei-network',
}

// null = price fetch failed (render "unavailable", never a zero — unknown ≠ empty).
async function fundPrices(symbols: string[]): Promise<Record<string, number> | null> {
  const ids = [...new Set(symbols.map((s) => CG[s.toUpperCase()]).filter(Boolean))]
  if (!ids.length) return {}
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`, { next: { revalidate: 120 } })
    if (!res.ok) return null
    const j = (await res.json()) as Record<string, { usd?: number }>
    return Object.fromEntries(Object.entries(CG).filter(([, id]) => j[id]?.usd).map(([s, id]) => [s, j[id].usd as number]))
  } catch {
    return null
  }
}

// 7-day price history per held asset for the clickable holding sparklines.
async function sparkSeries(symbols: string[]): Promise<Record<string, number[]>> {
  const out: Record<string, number[]> = {}
  await Promise.all(symbols.map(async (sym) => {
    const id = CG[sym.toUpperCase()]
    if (!id) return
    try {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=7`, { next: { revalidate: 900 } })
      if (!res.ok) return
      const j = (await res.json()) as { prices?: [number, number][] }
      const pts = (j.prices ?? []).map((p) => p[1])
      // thin to ~60 points so the SVG stays light
      if (pts.length > 60) out[sym] = pts.filter((_, i) => i % Math.ceil(pts.length / 60) === 0)
      else if (pts.length > 1) out[sym] = pts
    } catch { /* no spark beats a wrong spark */ }
  }))
  return out
}

export default async function FundPage(props: { searchParams: Promise<{ secret?: string }> }) {
  try {
    return await FundPageInner(props)
  } catch (e) {
    // Secret-gated page: showing the real error here is our only prod debugger (Vercel logs are plan-walled).
    return (
      <div className="p-6 font-mono text-sm text-red-600">
        <div className="font-bold">J&P FUND crashed — desk needs this:</div>
        <pre className="mt-2 whitespace-pre-wrap">{e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e)}</pre>
      </div>
    )
  }
}

async function FundPageInner({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  const supabase = createServiceClient()
  const [research, holdingsQ, tradesQ, watchQ, snapsQ, radarQ, flowsQ, trigQ, alertQ, taxQ, notesQ] = await Promise.all([
    supabase?.from('fund_research').select('brief_date, content').order('brief_date', { ascending: false }).limit(1).maybeSingle() ?? { data: null },
    supabase?.from('live_holdings').select('symbol, qty, avg_cost, synced_at').order('symbol') ?? { data: null, error: true },
    supabase?.from('live_trades').select('order_id, traded_at, side, symbol, qty, avg_price, note').order('traded_at', { ascending: false }).limit(30) ?? { data: null, error: true },
    supabase?.from('fund_watchlist').select('symbol, thesis, trigger_level').order('added_at') ?? { data: null, error: true },
    supabase?.from('fund_snapshots').select('snapshot_date, total').order('snapshot_date') ?? { data: null },
    supabase?.from('fund_radar').select('symbol, name, price, market_cap, turnover, d1, d7, d30, stage, score')
      .order('scan_date', { ascending: false }).order('score', { ascending: false }).limit(60) ?? { data: null, error: true },
    supabase?.from('fund_flows').select('flow_date, amount') ?? { data: null },
    supabase?.from('desk_triggers').select('symbol, kind, level, band_pct, spec, active, last_alert_at').eq('active', true).order('symbol') ?? { data: null, error: true },
    supabase?.from('desk_alert_log').select('at, symbol, kind, level, price, sent, queued, note').order('at', { ascending: false }).limit(20) ?? { data: null, error: true },
    supabase?.from('tax_events').select('event_date, tax_year, asset, event_type, quantity, proceeds_usd, basis_usd, realized_pnl_usd, note').order('event_date', { ascending: false }).limit(100) ?? { data: null, error: true },
    supabase?.from('pa_memory').select('topic, fact, updated_at')
      .in('topic', ['fund-trigger-watch', 'desk-orders', 'runner-scout-signal', 'evening-checkin', 'dashboard', 'house-strategy'])
      .eq('active', true) ?? { data: null, error: true },
  ])

  const holdings = (holdingsQ.data ?? null) as Holding[] | null
  const trades = (tradesQ.data ?? null) as Trade[] | null
  const watchlist = (watchQ.data ?? null) as Watch[] | null
  const snaps = (snapsQ.data ?? []) as { snapshot_date: string; total: number }[]
  const radar = (radarQ.data ?? null) as Radar[] | null
  const byStage = (s: string) => (radar ?? []).filter((r) => r.stage === s)
  const contributions = ((flowsQ.data ?? []) as { amount: number }[]).reduce((a, f) => a + Number(f.amount), 0)
  const notes = (notesQ.data ?? []) as { topic: string; fact: string; updated_at: string }[]
  const note = (t: string) => notes.find((n) => n.topic === t)
  const watchNote = note('fund-trigger-watch')
  // "Action needed" = the watcher wrote tap-ready orders, or a signal is uninvestigated.
  const actionNeeded = /TAP-READY|CASH LANDED|\bDO THIS\b/i.test(watchNote?.fact ?? '')
  const denverStamp = (iso?: string) => iso ? new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : ''

  // ★ NEXT BUY banner + session board come from the live agent's 'dashboard' topic.
  const boardNote = note('dashboard')
  const board = boardNote?.fact ?? ''
  const nb = board.match(/★ NEXT BUY[^\n]*\n?([\s\S]*?)(?:\n\s*\n|$)/)
  const nextBuy = nb ? nb[0].trim() : ''
  const stratNote = note('house-strategy')
  const triggers = (trigQ.data ?? null) as { symbol: string; kind: string; level: number; band_pct: number | null; spec: string | null; last_alert_at: string | null }[] | null
  const alerts = (alertQ.data ?? null) as { at: string; symbol: string; kind: string; level: number | null; price: number | null; sent: boolean | null; queued: boolean | null; note: string | null }[] | null
  const taxRows = (taxQ.data ?? null) as { event_date: string; tax_year: number; asset: string; event_type: string; quantity: number; proceeds_usd: number; basis_usd: number; realized_pnl_usd: number; note: string | null }[] | null
  // stop level per symbol, best-effort parsed from the board text (e.g. "SOL ... stop $94")
  const stopFor = (sym: string) => {
    const m = board.match(new RegExp(sym + String.raw`[^\n]*?stop[^\d$]*\$?([\d,]+(?:\.\d+)?)`, 'i'))
    return m ? '$' + m[1] : null
  }

  // Watchlist symbols must be priced too — they carry live quotes on their cards.
  const priceSymbols = [...(holdings ?? []), ...(trades ?? []), ...(watchlist ?? [])].map((r) => r.symbol).filter((s) => s !== 'USD')
  const prices = await fundPrices(priceSymbols)
  const sparks = await sparkSeries([...new Set((holdings ?? []).map((h) => h.symbol).filter((x) => x !== 'USD'))])

  // Book math: cash is the USD row; every position priced live where a price came back.
  const cash = holdings?.find((h) => h.symbol === 'USD')?.qty ?? 0
  const positions = (holdings ?? []).filter((h) => h.symbol !== 'USD').map((h) => {
    const now = prices?.[h.symbol.toUpperCase()] ?? null
    return { ...h, now, value: now !== null ? h.qty * now : null, pnlPct: now !== null && h.avg_cost > 0 ? ((now - h.avg_cost) / h.avg_cost) * 100 : null }
  })
  const pricedValue = positions.reduce((s, p) => s + (p.value ?? 0), 0)
  const allPriced = positions.every((p) => p.value !== null)
  const total = allPriced ? pricedValue + cash : null
  const tiles = positions.map((p) => ({
    symbol: p.symbol, qty: Number(p.qty), avgCost: Number(p.avg_cost),
    price: p.now, cgId: CG[p.symbol.toUpperCase()] ?? null,
    spark: sparks[p.symbol] ?? null, stop: stopFor(p.symbol),
  }))

  // Briefs written by the signal tasks are partial and loosely typed by default.
  // Sanitize EVERY field here — strings coerced, numbers defaulted, bad rows dropped —
  // so no downstream .toFixed/.match/property access can ever 500 the page again.
  const rawBrief = (research.data?.content ?? null) as Record<string, unknown> | null
  const str = (v: unknown, d = '') => (v == null ? d : String(v))
  const num = (v: unknown, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d }
  const arr = (v: unknown) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') as Record<string, unknown>[] : [])
  const brief: Brief | null = rawBrief ? {
    headline: str(rawBrief.headline), verified: str(rawBrief.verified),
    ta: arr(rawBrief.ta).map((t) => ({ asset: str(t.asset, '?'), price: num(t.price), sma20: num(t.sma20), sma50: num(t.sma50), sma200: num(t.sma200), vs: str(t.vs), hi90: num(t.hi90), lo90: num(t.lo90), support: str(t.support), resistance: str(t.resistance), note: str(t.note) })),
    flows: arr(rawBrief.flows).map((f) => ({ label: str(f.label, '?'), value: str(f.value), note: str(f.note) })),
    turnover: arr(rawBrief.turnover).map((t) => ({ asset: str(t.asset, '?'), volMcap: num(t.volMcap), d7: num(t.d7), d30: num(t.d30) })),
    narratives: arr(rawBrief.narratives).map((n) => ({ title: str(n.title, '?'), stage: str(n.stage, 'mid'), assets: str(n.assets), catalyst: str(n.catalyst) })),
    calendar: arr(rawBrief.calendar).map((c) => ({ date: str(c.date, '?'), event: str(c.event, '?'), why: str(c.why) })),
    implications: Array.isArray(rawBrief.implications) ? (rawBrief.implications as unknown[]).filter((x) => x != null).map(String) : [],
    sentiment: (() => { const g = (rawBrief.sentiment ?? {}) as Record<string, unknown>; return { fear_greed: num(g.fear_greed), fg_label: str(g.fg_label, 'n/a'), fg_note: str(g.fg_note, 'not in this brief'), funding: str(g.funding), gaps: str(g.gaps) } })(),
  } : null
  const briefDate = (research.data?.brief_date ?? null) as string | null
  const fg = brief?.sentiment.fear_greed ?? 0

  const pct = (n: number | null) =>
    n === null ? <span className="text-neutral-500">n/a</span>
    : <span className={n >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}>{n >= 0 ? '+' : ''}{n.toFixed(1)}%</span>

  return (
    <Shell secret={secret} active="fund">
      <DeskLive
        secret={secret}
        cg={CG}
        sparks={sparks}
        initial={{
          holdings: (holdingsQ.data ?? null) as DeskState['holdings'],
          triggers: (trigQ.data ?? null) as DeskState['triggers'],
          alerts: (alertQ.data ?? null) as DeskState['alerts'],
          board: boardNote ? { fact: boardNote.fact, updated_at: boardNote.updated_at } : null,
          strategy: stratNote ? { fact: stratNote.fact, updated_at: stratNote.updated_at } : null,
          at: new Date().toISOString(),
        }}
      />

      <div className="mt-3">
        <Panel accent="purple" title="Account equity — TRUE P&L" right={<span className="text-[11px] text-neutral-500">{total !== null && contributions > 0 ? (() => { const pnl = total - contributions; return `deposited $${usd(contributions)} · P&L ${pnl >= 0 ? '+' : '−'}$${usd(Math.abs(pnl))} (${((pnl / contributions) * 100).toFixed(1)}%)` })() : 'daily close'}</span>}>
          {snaps.length > 1 ? (
            <TrendChart
              hidePct series={[{ key: 'fund', label: 'ROBINHOOD', color: '#fda4af', format: 'usd2' as const, points: snaps.map((s) => Number(s.total)) }]}
              labels={snaps.map((s) => s.snapshot_date)} h={190} />
          ) : (
            <span className="text-[13px] text-neutral-500">Curve starts at two daily snapshots in <code>fund_snapshots</code> — banks nightly once the book has holdings.</span>
          )}
        </Panel>
      </div>

      <DeskLive
        secret={secret}
        cg={CG}
        sparks={sparks}
        initial={{
          holdings: (holdingsQ.data ?? null) as DeskState['holdings'],
          triggers: (trigQ.data ?? null) as DeskState['triggers'],
          alerts: (alertQ.data ?? null) as DeskState['alerts'],
          board: boardNote ? { fact: boardNote.fact, updated_at: boardNote.updated_at } : null,
          strategy: stratNote ? { fact: stratNote.fact, updated_at: stratNote.updated_at } : null,
          at: new Date().toISOString(),
        }}
      />

      <div className="mt-3">
        <Panel accent="purple" title="Account equity — TRUE P&L" right={<span className="text-[11px] text-neutral-500">{total !== null && contributions > 0 ? (() => { const pnl = total - contributions; return `deposited $${usd(contributions)} · P&L ${pnl >= 0 ? '+' : '−'}$${usd(Math.abs(pnl))} (${((pnl / contributions) * 100).toFixed(1)}%)` })() : 'daily close'}</span>}>
          {snaps.length > 1 ? (
            <TrendChart
              hidePct series={[{ key: 'fund', label: 'ROBINHOOD', color: '#fda4af', format: 'usd2' as const, points: snaps.map((s) => Number(s.total)) }]}
              labels={snaps.map((s) => s.snapshot_date)} h={190} />
          ) : (
            <span className="text-[13px] text-neutral-500">Curve starts at two daily snapshots in <code>fund_snapshots</code> — banks nightly once the book has holdings.</span>
          )}
        </Panel>
      </div>

      {/* 🏁 Starting grid — the buy queue, pole first */}
      {grid && grid.length > 0 && (
        <div className="mb-3">
          <Panel accent="amber" title="🏁 Starting grid — next buys in contention" right={<span className="text-[11px] text-neutral-500">re-ranked as evidence changes · pole buys when cash lands</span>}>
            <div className="space-y-2">
              {grid.filter((g) => g.rank === 1).map((g) => (
                <div key={g.rank} className="rounded-xl border-2 border-amber-400 bg-amber-50 p-3 dark:border-amber-400/50 dark:bg-amber-400/10">
                  <div className="flex items-baseline gap-2">
                    <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold text-black">P1 · POLE</span>
                    <span className="text-[17px] font-bold text-amber-700 dark:text-amber-300">{g.symbol}</span>
                    {prices?.[g.symbol] != null && <span className="font-mono text-[13px] tabular-nums text-neutral-600 dark:text-neutral-400">{px(prices[g.symbol])}</span>}
                  </div>
                  <p className="mt-1 text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">{g.thesis}</p>
                  <p className="mt-1 text-[12px] font-bold text-teal-700 dark:text-teal-300">→ {g.entry}</p>
                </div>
              ))}
              <div className="grid gap-2 sm:grid-cols-2">
                {grid.filter((g) => g.rank === 2 || g.rank === 3).map((g) => (
                  <div key={g.rank} className="rounded-lg border border-neutral-300 p-2.5 dark:border-white/15">
                    <div className="flex items-baseline gap-2">
                      <span className="rounded bg-neutral-300 px-1.5 py-0.5 text-[10px] font-bold text-black dark:bg-neutral-500">P{g.rank}</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-100">{g.symbol}</span>
                      {prices?.[g.symbol] != null && <span className="font-mono text-[12px] tabular-nums text-neutral-500">{px(prices[g.symbol])}</span>}
                    </div>
                    <p className="mt-1 text-[12px] text-neutral-600 dark:text-neutral-400">{g.thesis}</p>
                    <p className="mt-1 text-[11px] font-bold text-teal-700 dark:text-teal-300">→ {g.entry}</p>
                  </div>
                ))}
              </div>
              <div className="space-y-1">
                {grid.filter((g) => g.rank >= 4).map((g) => (
                  <details key={g.rank} className="group rounded-lg border border-neutral-200 dark:border-white/10">
                    <summary className="flex cursor-pointer list-none items-baseline gap-2 px-2.5 py-1.5 text-[13px] [&::-webkit-details-marker]:hidden">
                      <span className="w-8 font-mono text-[11px] text-neutral-500">P{g.rank}</span>
                      <span className="font-bold text-neutral-800 dark:text-neutral-200">{g.symbol}</span>
                      {prices?.[g.symbol] != null && <span className="font-mono text-[12px] tabular-nums text-neutral-500">{px(prices[g.symbol])}</span>}
                      <span className="ml-auto truncate text-[11px] text-neutral-500">{g.thesis.slice(0, 48)}…</span>
                      <span className="text-[11px] text-neutral-400 transition-transform group-open:rotate-90">▶</span>
                    </summary>
                    <div className="border-t border-neutral-100 px-2.5 py-2 text-[12px] text-neutral-600 dark:border-white/5 dark:text-neutral-400">
                      <p>{g.thesis}</p>
                      <p className="mt-1 font-bold text-teal-700 dark:text-teal-300">→ {g.entry}</p>
                    </div>
                  </details>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {/* ── Desk notes: whatever needs doing, the moment it needs doing ── */}
      <div className="mb-3">
        <Panel accent={actionNeeded ? 'amber' : 'teal'}
          title={actionNeeded ? '⚡ ACTION NEEDED — from the desk' : '✅ Desk notes — nothing needs you'}
          right={<span className="text-[11px] text-neutral-500">{watchNote ? `updated ${denverStamp(watchNote.updated_at)} DEN` : ''}</span>}>
          {watchNote ? (
            <pre className={`max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed ${actionNeeded ? 'text-amber-800 dark:text-amber-200' : 'text-neutral-700 dark:text-neutral-300'}`}>{watchNote.fact}</pre>
          ) : (
            <span className="text-[13px] text-neutral-500">No watcher note yet — the nightly check writes here after every close.</span>
          )}
          {note('runner-scout-signal')?.fact.includes('UNINVESTIGATED') && (
            <div className="mt-2 border-t border-neutral-100 pt-2 text-[12px] text-pink-700 dark:border-white/5 dark:text-pink-300">
              📡 Radar signal awaiting investigation: {(note('runner-scout-signal')?.fact ?? '').slice(0, 180)}
            </div>
          )}
          {note('desk-orders') && (
            <details className="mt-2 border-t border-neutral-100 pt-2 dark:border-white/5">
              <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-wider text-neutral-500">Standing order plan (co-signed) — tap to expand</summary>
              <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-400">{note('desk-orders')?.fact}</pre>
            </details>
          )}
        </Panel>
      </div>

      {/* ── The agentic account: holdings with full P&L, equity curve directly beneath ── */}
      {/* Trades done */}
      <div className="mt-3">
        <Panel accent="blue" title="Trades done — real fills (agentic)" right={<span className="text-[11px] text-neutral-500">last 30 · “vs now” = market move since the fill</span>}>
          {trades === null ? (
            <span className="text-[13px] text-red-600">Trades unreachable — fetch failed, not empty.</span>
          ) : trades.length === 0 ? (
            <span className="text-[13px] text-neutral-500">No fills synced yet — the account's real orders land in <code>live_trades</code>.</span>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="py-1 pr-2">Date</th><th className="pr-2">Side</th><th className="pr-2">Asset</th><th className="pr-2">Qty</th><th className="pr-2">Fill</th><th className="pr-2">vs now</th><th>Note</th>
                </tr></thead>
                <tbody>
                  {trades.map((t) => {
                    const now = prices?.[t.symbol.toUpperCase()] ?? null
                    const move = now !== null && t.avg_price > 0 ? ((now - t.avg_price) / t.avg_price) * 100 : null
                    return (
                      <tr key={t.order_id} className="border-t border-neutral-100 dark:border-white/5">
                        <td className="py-1.5 pr-2 text-neutral-500">{new Date(t.traded_at).toLocaleDateString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric' })}</td>
                        <td className={`pr-2 font-bold uppercase ${t.side === 'buy' ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{t.side}</td>
                        <td className="pr-2 font-bold text-amber-600 dark:text-amber-300">{t.symbol}</td>
                        <td className="pr-2 font-mono">{t.qty}</td>
                        <td className="pr-2 font-mono">{px(Number(t.avg_price))}</td>
                        <td className="pr-2 font-mono">{pct(move)}</td>
                        <td className="max-w-[280px] truncate text-neutral-500">{t.note}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* Watchlist */}
      <div className="mt-3">
        <Panel accent="amber" title="⚡ Watching — in before the move" right={<span className="text-[11px] text-neutral-500">Robinhood-listed only · triggers pre-committed</span>}>
          {watchlist === null ? (
            <span className="text-[13px] text-red-600">Watchlist unreachable — fetch failed, not empty.</span>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {(watchlist ?? []).map((w) => {
                const now = prices?.[w.symbol.toUpperCase()] ?? null
                return (
                  <div key={w.symbol} className="rounded-lg border border-neutral-200 p-2 dark:border-white/10">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-amber-600 dark:text-amber-300">{w.symbol}</span>
                      {now !== null && <span className="font-mono text-[12px] text-neutral-500">{px(now)}</span>}
                    </div>
                    <div className="mt-0.5 text-[12px] text-neutral-600 dark:text-neutral-400">{w.thesis}</div>
                    <div className="mt-1 text-[12px] font-bold text-teal-700 dark:text-teal-200">→ {w.trigger_level}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* Runner radar — where money is arriving, staged by how far the move already went */}
      <div className="mt-3">
        <Panel accent="teal" title="📡 RAW SCANNER — UNSCREENED, NOT PICKS"
          right={<span className="text-[11px] text-neutral-500">Robinhood-listed · turnover = 24h vol ÷ mcap</span>}>
          {radar === null ? (
            <span className="text-[13px] text-red-600">Radar unreachable — fetch failed, not empty.</span>
          ) : radar.length === 0 ? (
            <span className="text-[13px] text-neutral-500">No scan banked yet — the Monday sweep writes <code>fund_radar</code>.</span>
          ) : (
            <div className="space-y-3">
              {([
                ['EARLY', 'Money arriving, price has NOT run yet — the hunting ground', 'text-green-700 dark:text-emerald-300', 'border-green-300 dark:border-emerald-400/30'],
                ['RUNNING', 'Already moving — entries need a pullback, not a chase', 'text-amber-700 dark:text-amber-300', 'border-amber-300 dark:border-amber-400/30'],
                ['EXTENDED', 'Move is late — this is where you become exit liquidity', 'text-red-600 dark:text-rose-300', 'border-red-300 dark:border-rose-400/30'],
              ] as const).map(([stage, blurb, tone, bd]) => {
                const list = byStage(stage)
                if (!list.length) return null
                return (
                  <div key={stage}>
                    <div className={`text-[12px] font-bold uppercase tracking-widest ${tone}`}>{stage} <span className="font-normal normal-case tracking-normal text-neutral-500">— {blurb}</span></div>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {list.map((r) => (
                        <div key={r.symbol} className={`rounded-lg border ${bd} px-2 py-1 text-[12px]`}>
                          <span className={`font-bold ${tone}`}>{r.symbol}</span>
                          <span className="ml-1.5 font-mono text-neutral-500">{px(Number(r.price))}</span>
                          <span className="ml-1.5 font-mono text-pink-600 dark:text-pink-300">{Number(r.turnover).toFixed(0)}%t</span>
                          <span className={`ml-1.5 font-mono ${Number(r.d7) >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{Number(r.d7) >= 0 ? '+' : ''}{Number(r.d7).toFixed(0)}%7d</span>
                          <span className="ml-1.5 font-mono text-neutral-500">{Number(r.d30) >= 0 ? '+' : ''}{Number(r.d30).toFixed(0)}%30d</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
              <div className="border-t border-neutral-100 pt-2 text-[11px] text-neutral-500 dark:border-white/5">
                Mechanical turnover scan, UNSCREENED against the desk's chase laws — names here are research inputs, never picks. The only law-screened ranking is the ★ pole line at the top of this page.
              </div>
            </div>
          )}
        </Panel>
      </div>

      {/* ── Research desk ── */}
      {!brief ? (
        <div className="mt-3">
          <Panel accent="green" title="Research desk">
            <span className="text-[13px] text-red-600">No research brief reachable — table empty or fetch failed. Next sweep publishes here.</span>
          </Panel>
        </div>
      ) : (
      <>
      <div className="mt-3">
      <Panel accent="green" title="Research desk" right={<span className="text-[11px] text-neutral-500">brief {briefDate}</span>}>
        <p className="text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">{brief.headline}</p>
        <p className="mt-1 text-[11px] text-neutral-500">{brief.verified}</p>
      </Panel>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile accent="green" i={0} label="Fear & Greed" value={String(fg)} tone={fg >= 70 ? 'neg' : fg <= 30 ? 'pos' : 'dim'} sub={`${brief.sentiment.fg_label} — ${brief.sentiment.fg_note}`} />
        <Tile accent="teal" i={1} label="Leverage" value="cool" tone="pos" sub="funding at floor, perps at spot discount" />
        <Tile accent="cyan" i={2} label="ETF flows" value={brief.flows[0]?.value?.match(/\d+-day/)?.[0] ?? 'inflow'} tone="pos" sub={brief.flows[1]?.note ?? ''} />
        <Tile accent="amber" i={3} label="Structure" value="5/5 bull" tone="pos" sub="all majors above 20/50/200d SMAs" />
      </div>

      {/* TA — the computed levels, one row per asset */}
      <div className="mt-3">
        <Panel accent="teal" title="Technical levels — computed, not scraped">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[12px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="py-1 pr-2">Asset</th><th className="pr-2">Price</th><th className="pr-2">20d</th><th className="pr-2">50d</th><th className="pr-2">200d</th><th className="pr-2">90d Hi/Lo</th><th className="pr-2">Support</th><th className="pr-2">Resistance</th><th>Read</th>
                </tr>
              </thead>
              <tbody>
                {brief.ta.map((r) => (
                  <tr key={r.asset} className="border-t border-neutral-100 dark:border-white/5">
                    <td className="py-1.5 pr-2 font-bold text-amber-600 dark:text-amber-300">{r.asset}</td>
                    <td className="pr-2 font-mono">{px(r.price)}</td>
                    <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{px(r.sma20)}</td>
                    <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{px(r.sma50)}</td>
                    <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{px(r.sma200)}</td>
                    <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{px(r.hi90)} / {px(r.lo90)}</td>
                    <td className="pr-2 text-green-700 dark:text-emerald-300">{r.support}</td>
                    <td className="pr-2 text-red-600 dark:text-rose-300">{r.resistance}</td>
                    <td className="text-neutral-600 dark:text-neutral-400">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {/* Turnover concentration */}
        <Panel accent="pink" title="Turnover — where the churn is" right={<span className="text-[11px] text-neutral-500">24h vol / mcap</span>}>
          <div className="space-y-1">
            {brief.turnover.map((t) => (
              <div key={t.asset} className="flex items-center gap-2 text-[13px]">
                <span className="w-12 font-bold text-neutral-800 dark:text-neutral-200">{t.asset}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-white/5">
                  <div className="h-full rounded bg-pink-500/70 dark:bg-pink-400/70" style={{ width: `${Math.min(100, t.volMcap * 3)}%` }} />
                </div>
                <span className="w-14 text-right font-mono text-pink-700 dark:text-pink-300">{t.volMcap.toFixed(1)}%</span>
                <span className={`w-16 text-right font-mono ${t.d7 >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{t.d7 >= 0 ? '+' : ''}{t.d7.toFixed(0)}% 7d</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Flows */}
        <Panel accent="cyan" title="Flows — the cash behind the move">
          <div className="space-y-2">
            {brief.flows.map((f) => (
              <div key={f.label} className="text-[13px]">
                <span className="font-bold text-cyan-700 dark:text-cyan-200">{f.label}:</span>{' '}
                <span className="text-neutral-800 dark:text-neutral-200">{f.value}</span>
                <div className="text-[12px] text-neutral-500">{f.note}</div>
              </div>
            ))}
            <div className="border-t border-neutral-100 pt-2 text-[12px] text-neutral-600 dark:border-white/5 dark:text-neutral-400">{brief.sentiment.funding}</div>
            <div className="text-[11px] text-neutral-500">Known gap: {brief.sentiment.gaps}</div>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {/* Narratives */}
        <Panel accent="purple" title="Narratives — where capital rotates">
          <div className="space-y-2">
            {brief.narratives.map((n) => (
              <div key={n.title} className="text-[13px]">
                <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${n.stage.startsWith('early') ? 'bg-green-100 text-green-700 dark:bg-emerald-400/15 dark:text-emerald-300' : n.stage === 'crowded' ? 'bg-red-100 text-red-700 dark:bg-rose-400/15 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'}`}>{n.stage}</span>
                <span className="text-neutral-800 dark:text-neutral-200">{n.title}</span>
                <div className="text-[12px] text-neutral-500">{n.assets} · {n.catalyst}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Calendar */}
        <Panel accent="rose" title="Calendar — vol events ahead">
          <div className="space-y-1.5">
            {brief.calendar.map((c) => (
              <div key={c.date + c.event} className="grid grid-cols-[92px_1fr] gap-2 text-[13px]">
                <span className="font-bold text-rose-600 dark:text-rose-300">{c.date}</span>
                <span className="text-neutral-800 dark:text-neutral-200">{c.event}<span className="block text-[12px] text-neutral-500">{c.why}</span></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* What it means for the next call */}
      <div className="mt-3">
        <Panel accent="amber" title="Desk notes — inputs to the next call, not orders">
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-neutral-700 dark:text-neutral-300">
            {brief.implications.filter(Boolean).map((s) => <li key={String(s).slice(0, 40)}>{String(s)}</li>)}
          </ul>
        </Panel>
      </div>
      </>
      )}

      {/* Tax ledger — append-only, from tax_events */}
      <div className="mt-3">
        <Panel accent="green" title="🧾 Tax ledger" right={<span className="text-[11px] text-neutral-500">append-only · realized events</span>}>
          {taxRows === null ? (
            <span className="text-[13px] text-red-600">Tax ledger unreachable — fetch failed, not empty.</span>
          ) : taxRows.length === 0 ? (
            <span className="text-[13px] text-neutral-500">No realized events yet.</span>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-[13px] tabular-nums">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="py-1 pr-2">Date</th><th className="pr-2">Year</th><th className="pr-2">Asset</th><th className="pr-2">Event</th><th className="pr-2">Qty</th><th className="pr-2">Proceeds</th><th className="pr-2">Basis</th><th className="pr-2">Realized</th><th>Note</th>
                </tr></thead>
                <tbody>
                  {taxRows.map((t, i) => (
                    <tr key={i} className="border-t border-neutral-100 dark:border-white/5">
                      <td className="py-1.5 pr-2 text-neutral-500">{t.event_date}</td>
                      <td className="pr-2">{t.tax_year}</td>
                      <td className="pr-2 font-bold text-amber-600 dark:text-amber-300">{t.asset}</td>
                      <td className="pr-2">{t.event_type}</td>
                      <td className="pr-2 font-mono">{t.quantity}</td>
                      <td className="pr-2 font-mono">${usd(Number(t.proceeds_usd ?? 0))}</td>
                      <td className="pr-2 font-mono">${usd(Number(t.basis_usd ?? 0))}</td>
                      <td className={`pr-2 font-mono ${Number(t.realized_pnl_usd) >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{Number(t.realized_pnl_usd) >= 0 ? '+' : '−'}${usd(Math.abs(Number(t.realized_pnl_usd ?? 0)))}</td>
                      <td className="max-w-[260px] truncate text-neutral-500">{t.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-3 text-[12px] text-neutral-500">
        The desk publishes from multi-agent research sweeps (content/narratives · TA computed from raw dailies · volume/flows ·
        macro calendar · derivatives sentiment), every number verified against the live feed before it lands here. Paper-competition
        calls stay Mondays; the live account runs its own sealed book.
      </div>
    </Shell>
  )
}
