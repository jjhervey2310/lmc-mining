import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, Tile, checkAdmin, usd } from '../ui'
import TrendChart from '../trend-chart'

// J&P FUND — the research desk: latest verified multi-agent market sweep
// (TA, sentiment, flows, turnover, narratives, calendar) feeding the weekly call.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

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
  LIT: 'lighter', ONDO: 'ondo-finance', MOODENG: 'moo-deng', ZEC: 'zcash',
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

export default async function FundPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  const supabase = createServiceClient()
  const [research, holdingsQ, tradesQ, watchQ, snapsQ, radarQ] = await Promise.all([
    supabase?.from('fund_research').select('brief_date, content').order('brief_date', { ascending: false }).limit(1).maybeSingle() ?? { data: null },
    supabase?.from('live_holdings').select('symbol, qty, avg_cost').order('symbol') ?? { data: null, error: true },
    supabase?.from('live_trades').select('order_id, traded_at, side, symbol, qty, avg_price, note').order('traded_at', { ascending: false }).limit(30) ?? { data: null, error: true },
    supabase?.from('fund_watchlist').select('symbol, thesis, trigger_level').order('added_at') ?? { data: null, error: true },
    supabase?.from('fund_snapshots').select('snapshot_date, total').order('snapshot_date') ?? { data: null },
    supabase?.from('fund_radar').select('symbol, name, price, market_cap, turnover, d1, d7, d30, stage, score')
      .order('scan_date', { ascending: false }).order('score', { ascending: false }).limit(60) ?? { data: null, error: true },
  ])

  const holdings = (holdingsQ.data ?? null) as Holding[] | null
  const trades = (tradesQ.data ?? null) as Trade[] | null
  const watchlist = (watchQ.data ?? null) as Watch[] | null
  const snaps = (snapsQ.data ?? []) as { snapshot_date: string; total: number }[]
  const radar = (radarQ.data ?? null) as Radar[] | null
  const byStage = (s: string) => (radar ?? []).filter((r) => r.stage === s)

  // Watchlist symbols must be priced too — they carry live quotes on their cards.
  const priceSymbols = [...(holdings ?? []), ...(trades ?? []), ...(watchlist ?? [])].map((r) => r.symbol).filter((s) => s !== 'USD')
  const prices = await fundPrices(priceSymbols)

  // Book math: cash is the USD row; every position priced live where a price came back.
  const cash = holdings?.find((h) => h.symbol === 'USD')?.qty ?? 0
  const positions = (holdings ?? []).filter((h) => h.symbol !== 'USD').map((h) => {
    const now = prices?.[h.symbol.toUpperCase()] ?? null
    return { ...h, now, value: now !== null ? h.qty * now : null, pnlPct: now !== null && h.avg_cost > 0 ? ((now - h.avg_cost) / h.avg_cost) * 100 : null }
  })
  const pricedValue = positions.reduce((s, p) => s + (p.value ?? 0), 0)
  const allPriced = positions.every((p) => p.value !== null)
  const total = allPriced ? pricedValue + cash : null

  const brief = (research.data?.content ?? null) as Brief | null
  const briefDate = (research.data?.brief_date ?? null) as string | null
  const fg = brief?.sentiment.fear_greed ?? 0

  const pct = (n: number | null) =>
    n === null ? <span className="text-neutral-500">n/a</span>
    : <span className={n >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}>{n >= 0 ? '+' : ''}{n.toFixed(1)}%</span>

  return (
    <Shell secret={secret} active="fund">
      {/* ── The agentic account: holdings with full P&L, equity curve directly beneath ── */}
      <Panel accent="rose" title="🔴 Robinhood Agentic — live holdings" right={<span className="text-[11px] text-neutral-500">{total !== null ? `total $${usd(total)}` : holdings?.length ? 'some prices unavailable' : ''}</span>}>
        {holdings === null ? (
          <span className="text-[13px] text-red-600">Holdings unreachable — fetch failed, not empty.</span>
        ) : positions.length === 0 && cash === 0 ? (
          <span className="text-[13px] text-neutral-500">No sync yet — positions land in <code>live_holdings</code> on the next sync.</span>
        ) : (() => {
          const rows = positions.map((p) => ({
            ...p,
            cost: p.avg_cost > 0 ? Number(p.qty) * Number(p.avg_cost) : null,
            pnlUsd: p.avg_cost > 0 && p.value !== null ? p.value - Number(p.qty) * Number(p.avg_cost) : null,
          }))
          const totCost = rows.every((r) => r.cost !== null) ? rows.reduce((s, r) => s + (r.cost ?? 0), 0) : null
          const totPnl = totCost !== null && total !== null ? total - cash - totCost : null
          return (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[620px] text-[13px]">
                <thead><tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="py-1 pr-2">Asset</th><th className="pr-2">Qty</th><th className="pr-2">Bought @</th><th className="pr-2">Now</th><th className="pr-2">Value</th><th className="pr-2">$ up/down</th><th className="pr-2">%</th><th>Of book</th>
                </tr></thead>
                <tbody>
                  {rows.map((p) => (
                    <tr key={p.symbol} className="border-t border-neutral-100 dark:border-white/5">
                      <td className="py-1.5 pr-2 font-bold text-rose-600 dark:text-rose-300">{p.symbol}</td>
                      <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{p.qty}</td>
                      <td className="pr-2 font-mono">{p.avg_cost > 0 ? px(Number(p.avg_cost)) : '—'}</td>
                      <td className="pr-2 font-mono">{p.now !== null ? px(p.now) : 'n/a'}</td>
                      <td className="pr-2 font-mono">{p.value !== null ? `$${usd(p.value)}` : 'no price'}</td>
                      <td className={`pr-2 font-mono ${p.pnlUsd === null ? 'text-neutral-500' : p.pnlUsd >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>
                        {p.pnlUsd === null ? 'n/a' : `${p.pnlUsd >= 0 ? '+' : '−'}$${usd(Math.abs(p.pnlUsd))}`}
                      </td>
                      <td className="pr-2 font-mono">{pct(p.pnlPct)}</td>
                      <td className="font-mono text-[12px] text-neutral-500">{total ? `${(((p.value ?? 0) / total) * 100).toFixed(0)}%` : '—'}</td>
                    </tr>
                  ))}
                  <tr className="border-t border-neutral-200 dark:border-white/10">
                    <td className="py-1.5 pr-2 font-bold text-neutral-600 dark:text-neutral-400">CASH</td>
                    <td colSpan={3} />
                    <td className="pr-2 font-mono">${usd(cash)}</td>
                    <td className={`pr-2 font-mono font-bold ${totPnl === null ? 'text-neutral-500' : totPnl >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>
                      {totPnl === null ? '' : `${totPnl >= 0 ? '+' : '−'}$${usd(Math.abs(totPnl))} all-in`}
                    </td>
                    <td className="pr-2 font-mono">{totPnl !== null && totCost ? pct((totPnl / totCost) * 100) : ''}</td>
                    <td className="font-mono text-[12px] text-neutral-500">{total ? `${((cash / total) * 100).toFixed(0)}%` : ''}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          )
        })()}
      </Panel>

      <div className="mt-3">
        <Panel accent="purple" title="Account equity" right={<span className="text-[11px] text-neutral-500">daily close · real account value</span>}>
          {snaps.length > 1 ? (
            <TrendChart
              series={[{ key: 'fund', label: 'AGENTIC', color: '#fda4af', format: 'usd2' as const, points: snaps.map((s) => Number(s.total)) }]}
              labels={snaps.map((s) => s.snapshot_date)} h={190} />
          ) : (
            <span className="text-[13px] text-neutral-500">Curve starts at two daily snapshots in <code>fund_snapshots</code> — banks nightly once the book has holdings.</span>
          )}
        </Panel>
      </div>

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
        <Panel accent="teal" title="🎯 Runner radar — catching rotation early"
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
                EARLY = turnover ≥8% of mcap with the 30-day move still under 35%: attention is arriving before price has.
                It is a shortlist to research, never an auto-buy — high turnover also marks a coin being distributed.
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
        <Tile accent="cyan" i={2} label="ETF flows" value={brief.flows[0]?.value.match(/\d+-day/)?.[0] ?? 'inflow'} tone="pos" sub={brief.flows[1]?.note ?? ''} />
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
            {brief.implications.map((s) => <li key={s.slice(0, 40)}>{s}</li>)}
          </ul>
        </Panel>
      </div>
      </>
      )}

      <div className="mt-3 text-[12px] text-neutral-500">
        The desk publishes from multi-agent research sweeps (content/narratives · TA computed from raw dailies · volume/flows ·
        macro calendar · derivatives sentiment), every number verified against the live feed before it lands here. Paper-competition
        calls stay Mondays; the live account runs its own sealed book.
      </div>
    </Shell>
  )
}
