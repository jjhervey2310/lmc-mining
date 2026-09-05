import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, checkAdmin, usd } from '../ui'
import TrendChart from '../trend-chart'
import DeskLive, { type DeskState, type Realized } from '../desk-live'

// ROBINHOOD — the live agentic account. v3 layout (build request #6):
// holdings → pole + watch (live numbers) → portfolio chart + realized line → armed lines →
// collapsed (watcher feed, rules, ledger, research + raw scanner). Read-only; service client behind checkAdmin.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'
export const revalidate = 0

interface TaRow { asset: string; price: number; sma20: number; sma50: number; sma200: number; vs: string; hi90: number; lo90: number; support: string; resistance: string; note: string }
interface Brief {
  headline: string; verified: string; ta: TaRow[]
  sentiment: { fear_greed: number; fg_label: string; fg_note: string; funding: string; gaps: string }
  flows: { label: string; value: string; note: string }[]
  turnover: { asset: string; volMcap: number; d7: number; d30: number }[]
  narratives: { title: string; stage: string; assets: string; catalyst: string }[]
  calendar: { date: string; event: string; why: string }[]
  implications: string[]
}
interface Radar { symbol: string; name: string; price: number; market_cap: number; turnover: number; d1: number; d7: number; d30: number; stage: string; score: number; scan_date: string }

const px = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'

// Symbol → CoinGecko id. Hand map for the majors; everything else resolves from the top-500 by cap (cached a day).
const CG: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple', DOGE: 'dogecoin',
  ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink', LTC: 'litecoin', BCH: 'bitcoin-cash',
  XLM: 'stellar', UNI: 'uniswap', AAVE: 'aave', SHIB: 'shiba-inu', PEPE: 'pepe',
  BONK: 'bonk', WIF: 'dogwifcoin', DOT: 'polkadot', SUI: 'sui', HYPE: 'hyperliquid',
  LIT: 'lighter', ONDO: 'ondo-finance', MOODENG: 'moo-deng', ZEC: 'zcash', PUMP: 'pump-fun',
  ARB: 'arbitrum', LDO: 'lido-dao', STRK: 'starknet', NEAR: 'near', FET: 'fetch-ai', SEI: 'sei-network',
  OP: 'optimism', XPL: 'plasma', ZRO: 'layerzero', ENA: 'ethena', AERO: 'aerodrome-finance', JTO: 'jito-governance-token',
}
async function resolveIds(symbols: string[]): Promise<Record<string, string>> {
  const out = { ...CG }
  const missing = symbols.filter((s) => !out[s.toUpperCase()])
  if (!missing.length) return out
  try {
    for (const page of [1, 2]) {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`, { next: { revalidate: 86400 } })
      if (!res.ok) break
      const rows = (await res.json()) as { id: string; symbol: string }[]
      for (const r of rows) { const s = r.symbol.toUpperCase(); if (missing.includes(s) && !out[s]) out[s] = r.id }
    }
  } catch { /* unmapped symbols show "…" for price, never a zero */ }
  return out
}

export default async function FundPage(props: { searchParams: Promise<{ secret?: string }> }) {
  try {
    return await FundPageInner(props)
  } catch (e) {
    // Secret-gated page: the real error is our only prod debugger (Vercel logs are plan-walled).
    return (
      <div className="p-6 font-mono text-sm text-red-600">
        <div className="font-bold">ROBINHOOD tab crashed — desk needs this:</div>
        <pre className="mt-2 whitespace-pre-wrap">{e instanceof Error ? `${e.name}: ${e.message}\n${e.stack}` : String(e)}</pre>
      </div>
    )
  }
}

async function FundPageInner({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  const supabase = createServiceClient()
  const [research, holdingsQ, snapsQ, radarQ, flowsQ, trigQ, alertQ, taxQ, loopQ, notesQ, thesesQ] = await Promise.all([
    supabase?.from('fund_research').select('brief_date, content').order('brief_date', { ascending: false }).limit(1).maybeSingle() ?? { data: null },
    supabase?.from('live_holdings').select('symbol, qty, avg_cost, synced_at').order('symbol') ?? { data: null, error: true },
    supabase?.from('fund_snapshots').select('snapshot_date, total').order('snapshot_date') ?? { data: null },
    supabase?.from('fund_radar').select('symbol, name, price, market_cap, turnover, d1, d7, d30, stage, score, scan_date')
      .order('scan_date', { ascending: false }).order('score', { ascending: false }).limit(90) ?? { data: null, error: true },
    supabase?.from('fund_flows').select('flow_date, amount').order('flow_date') ?? { data: null },
    supabase?.from('desk_triggers').select('symbol, kind, level, band_pct, spec, active, last_alert_at').eq('active', true).order('symbol') ?? { data: null, error: true },
    supabase?.from('desk_alert_log').select('at, symbol, kind, level, price, sent, queued, note').order('at', { ascending: false }).limit(20) ?? { data: null, error: true },
    // ALL realized events — the ledger must be complete (winners AND losers), never a top-N.
    supabase?.from('tax_events').select('event_date, tax_year, asset, event_type, quantity, proceeds_usd, basis_usd, realized_pnl_usd, note').order('event_date', { ascending: false }) ?? { data: null, error: true },
    supabase?.from('desk_config').select('value').eq('key', 'loop_enabled').maybeSingle() ?? { data: null },
    supabase?.from('pa_memory').select('topic, fact, updated_at').in('topic', ['dashboard', 'house-strategy']).eq('active', true) ?? { data: null, error: true },
    supabase?.from('desk_theses').select('symbol, status, thesis, gate, updated_at').order('symbol') ?? { data: null, error: true },
  ])

  const snaps = (snapsQ.data ?? []) as { snapshot_date: string; total: number }[]
  const radarAll = (radarQ.data ?? null) as Radar[] | null
  const latestScan = radarAll?.[0]?.scan_date ?? null
  const radar = radarAll && latestScan ? radarAll.filter((r) => r.scan_date === latestScan) : radarAll
  const byStage = (s: string) => (radar ?? []).filter((r) => r.stage === s)
  const flows = ((flowsQ.data ?? []) as { flow_date: string; amount: number }[])
  const contributions = flows.reduce((a, f) => a + Number(f.amount), 0)
  // Deposit-adjusted curve: book value minus every deposit dated on or before that snapshot = true P&L to date.
  const depositedBy = (d: string) => flows.filter((f) => f.flow_date <= d).reduce((a, f) => a + Number(f.amount), 0)
  const pnlSeries = snaps.map((s) => Number(s.total) - depositedBy(s.snapshot_date))
  const notes = (notesQ.data ?? []) as { topic: string; fact: string; updated_at: string }[]
  const note = (t: string) => notes.find((n) => n.topic === t)
  const boardNote = note('dashboard'); const stratNote = note('house-strategy')
  const taxRows = (taxQ.data ?? null) as { event_date: string; tax_year: number; asset: string; event_type: string; quantity: number; proceeds_usd: number; basis_usd: number; realized_pnl_usd: number; note: string | null }[] | null
  const realized: Realized | null = taxRows ? (() => {
    const closed = taxRows.filter((t) => t.realized_pnl_usd != null)
    return { pnl: closed.reduce((a, t) => a + Number(t.realized_pnl_usd), 0), wins: closed.filter((t) => Number(t.realized_pnl_usd) > 0).length, losses: closed.filter((t) => Number(t.realized_pnl_usd) <= 0).length, n: closed.length }
  })() : null

  const holdings = (holdingsQ.data ?? []) as { symbol: string; qty: number }[]
  const theses = (thesesQ.data ?? []) as { symbol: string; status: string }[]
  const ids = await resolveIds([...holdings.map((h) => h.symbol), ...theses.map((t) => t.symbol)].filter((s) => s !== 'USD'))

  // Header figure is snapshot-derived; live pricing happens client-side.
  const total = snaps.length ? Number(snaps[snaps.length - 1].total) : null

  // Research brief — sanitized field by field so a partial brief can never 500 the page.
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

  const chart = (
    <Panel accent="purple" title="Portfolio — book value & TRUE P&L"
      right={<span className="text-[11px] text-neutral-500">{total !== null && contributions > 0 ? (() => { const pnl = total - contributions; return `deposited $${usd(contributions)} · P&L ${pnl >= 0 ? '+' : '−'}$${usd(Math.abs(pnl))} (${((pnl / contributions) * 100).toFixed(1)}%) at last close` })() : 'daily close'}</span>}>
      {snaps.length > 1 ? (
        <>
          <TrendChart hidePct h={170}
            series={[
              { key: 'fund', label: 'BOOK VALUE', color: '#fda4af', format: 'usd2' as const, points: snaps.map((s) => Number(s.total)) },
              { key: 'pnl', label: 'P&L vs deposits', color: '#5eead4', format: 'usd2' as const, points: pnlSeries },
            ]}
            labels={snaps.map((s) => s.snapshot_date)} />
          <div className="mt-1 text-[11px] text-neutral-500">Daily closes from <code>fund_snapshots</code>; P&L subtracts every deposit in <code>fund_flows</code> dated on or before that day. Deposits: {flows.map((f) => `${f.flow_date.slice(5)} +$${Number(f.amount).toFixed(0)}`).join(' · ') || 'none recorded'}.</div>
        </>
      ) : (
        <span className="text-[13px] text-neutral-500">Curve starts at two daily snapshots.</span>
      )}
    </Panel>
  )

  const bottom = (
    <>
      {/* Ledger — collapsed, COMPLETE (all realized events, winners and losers; a winners-only list is survivorship) */}
      <details className="rounded-xl border border-neutral-200 px-3 py-1.5 dark:border-white/10">
        <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-wider text-neutral-500">🧾 Ledger — every realized trade ({taxRows ? taxRows.length : '?'})</summary>
        {taxRows === null ? (
          <span className="text-[13px] text-red-600">Tax ledger unreachable — fetch failed, not empty.</span>
        ) : taxRows.length === 0 ? (
          <span className="text-[12px] text-neutral-500">No realized events yet.</span>
        ) : (
          <div className="mt-1 overflow-x-auto">
            <table className="w-full min-w-[640px] text-[12px] tabular-nums">
              <thead><tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="py-1 pr-2">Date</th><th className="pr-2">Yr</th><th className="pr-2">Asset</th><th className="pr-2">Event</th><th className="pr-2">Qty</th><th className="pr-2">Proceeds</th><th className="pr-2">Basis</th><th className="pr-2">Realized</th><th>Note</th>
              </tr></thead>
              <tbody>
                {taxRows.map((t, i) => (
                  <tr key={i} className="border-t border-neutral-100 dark:border-white/5">
                    <td className="py-1 pr-2 text-neutral-500">{t.event_date}</td>
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
      </details>

      {/* Raw scanner — collapsed; research input, never picks */}
      <details className="rounded-xl border border-neutral-200 px-3 py-1.5 dark:border-white/10">
        <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-wider text-neutral-500">📡 Raw scanner — unscreened, not picks{latestScan ? ` (${latestScan})` : ''}</summary>
        {radar === null ? (
          <span className="text-[13px] text-red-600">Radar unreachable — fetch failed, not empty.</span>
        ) : radar.length === 0 ? (
          <span className="text-[12px] text-neutral-500">No scan banked yet.</span>
        ) : (
          <div className="mt-1 space-y-2">
            {([
              ['EARLY', 'research input only — 39% next-day win rate in the stage study', 'text-green-700 dark:text-emerald-300', 'border-green-300 dark:border-emerald-400/30'],
              ['RUNNING', 'NO-ENTRY zone (A4 §2) — worst bucket', 'text-amber-700 dark:text-amber-300', 'border-amber-300 dark:border-amber-400/30'],
              ['EXTENDED', 'late — enterable only via the A1/A4 revenue or sleeve rules', 'text-red-600 dark:text-rose-300', 'border-red-300 dark:border-rose-400/30'],
            ] as const).map(([stage, blurb, tone, bd]) => {
              const list = byStage(stage)
              if (!list.length) return null
              return (
                <div key={stage}>
                  <div className={`text-[11px] font-bold uppercase tracking-widest ${tone}`}>{stage} <span className="font-normal normal-case tracking-normal text-neutral-500">— {blurb}</span></div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {list.map((r) => (
                      <div key={r.symbol} className={`rounded-lg border ${bd} px-1.5 py-0.5 text-[11px]`}>
                        <span className={`font-bold ${tone}`}>{r.symbol}</span>
                        <span className="ml-1 font-mono text-neutral-500">{px(Number(r.price))}</span>
                        <span className="ml-1 font-mono text-pink-600 dark:text-pink-300">{Number(r.turnover).toFixed(0)}%t</span>
                        <span className={`ml-1 font-mono ${Number(r.d7) >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{Number(r.d7) >= 0 ? '+' : ''}{Number(r.d7).toFixed(0)}%7d</span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </details>

      {/* Research desk — collapsed */}
      <details className="rounded-xl border border-neutral-200 px-3 py-1.5 dark:border-white/10">
        <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-wider text-neutral-500">Research desk{briefDate ? ` — brief ${briefDate}` : ''}</summary>
        {!brief ? (
          <span className="text-[12px] text-red-600">No research brief reachable — table empty or fetch failed.</span>
        ) : (
          <div className="mt-1 space-y-2 text-[12px]">
            <p className="leading-relaxed text-neutral-700 dark:text-neutral-300">{brief.headline}</p>
            <p className="text-[11px] text-neutral-500">{brief.verified} · Fear &amp; Greed {brief.sentiment.fear_greed} ({brief.sentiment.fg_label})</p>
            {brief.ta.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-[11px]">
                  <thead><tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500"><th className="py-1 pr-2">Asset</th><th className="pr-2">Price</th><th className="pr-2">20d</th><th className="pr-2">50d</th><th className="pr-2">200d</th><th className="pr-2">Support</th><th className="pr-2">Resistance</th><th>Read</th></tr></thead>
                  <tbody>{brief.ta.map((r) => (
                    <tr key={r.asset} className="border-t border-neutral-100 dark:border-white/5">
                      <td className="py-1 pr-2 font-bold text-amber-600 dark:text-amber-300">{r.asset}</td><td className="pr-2 font-mono">{px(r.price)}</td>
                      <td className="pr-2 font-mono text-neutral-500">{px(r.sma20)}</td><td className="pr-2 font-mono text-neutral-500">{px(r.sma50)}</td><td className="pr-2 font-mono text-neutral-500">{px(r.sma200)}</td>
                      <td className="pr-2 text-green-700 dark:text-emerald-300">{r.support}</td><td className="pr-2 text-red-600 dark:text-rose-300">{r.resistance}</td><td className="text-neutral-600 dark:text-neutral-400">{r.note}</td>
                    </tr>))}</tbody>
                </table>
              </div>
            )}
            {brief.flows.length > 0 && <div>{brief.flows.map((f) => <div key={f.label}><span className="font-bold text-cyan-700 dark:text-cyan-200">{f.label}:</span> {f.value} <span className="text-neutral-500">{f.note}</span></div>)}</div>}
            {brief.narratives.length > 0 && <div>{brief.narratives.map((n) => <div key={n.title}><span className="mr-1 rounded bg-neutral-100 px-1 text-[9px] uppercase dark:bg-white/10">{n.stage}</span>{n.title} <span className="text-neutral-500">· {n.assets} · {n.catalyst}</span></div>)}</div>}
            {brief.calendar.length > 0 && <div>{brief.calendar.map((c) => <div key={c.date + c.event}><span className="font-bold text-rose-600 dark:text-rose-300">{c.date}</span> {c.event} <span className="text-neutral-500">— {c.why}</span></div>)}</div>}
            {brief.implications.length > 0 && <ul className="list-disc pl-4">{brief.implications.filter(Boolean).map((s) => <li key={String(s).slice(0, 40)}>{String(s)}</li>)}</ul>}
          </div>
        )}
      </details>
    </>
  )

  return (
    <Shell secret={secret} active="fund">
      <DeskLive
        secret={secret}
        cg={ids}
        chart={chart}
        realized={realized}
        bottom={bottom}
        initial={{
          holdings: (holdingsQ.data ?? null) as DeskState['holdings'],
          triggers: (trigQ.data ?? null) as DeskState['triggers'],
          alerts: (alertQ.data ?? null) as DeskState['alerts'],
          board: boardNote ? { fact: boardNote.fact, updated_at: boardNote.updated_at } : null,
          strategy: stratNote ? { fact: stratNote.fact, updated_at: stratNote.updated_at } : null,
          theses: (thesesQ.data ?? null) as DeskState['theses'],
          radar: (radar ?? null) as DeskState['radar'],
          loop_enabled: loopQ.data ? String((loopQ.data as { value: string }).value).toLowerCase() === 'true' : null,
          at: new Date().toISOString(),
        }}
      />
    </Shell>
  )
}
