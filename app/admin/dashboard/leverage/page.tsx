import type { Metadata } from 'next'
import { Shell, Panel, Tile, checkAdmin, usd } from '../ui'
import { createServiceClient } from '@/lib/supabase'

// LEVERAGE — the research desk (rebuilt 2026-09-10).
//
// This page reports on a PAPER research platform reading Kraken's public data.
// No venue is connected, no order can be placed, and no private exchange path
// exists anywhere in the collector — that is enforced by a test, not by intent.
//
// Two rules carried over from the placeholder this replaces, because both are
// about not lying to the reader:
//
//   1. A missing number renders as "—", never as 0. A zero reads as "flat" or
//      "nothing there", which is a different claim from "not measured yet".
//   2. A hypothesis goes GREEN only when it survived walk-forward testing AND
//      the Deflated Sharpe correction AND the frozen forward window. A good
//      backtest earns AMBER. Test a thousand variants and ~50 clear p<0.05 on
//      noise alone; a board that greens on backtests is a confidence machine,
//      not a research tool.
//
// Expect the board to be almost entirely grey for weeks. That is the honest
// state of four days of data in one benign regime, and watching grey turn
// amber turn green-or-red IS the research.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

const DASH = '—'
const num = (v: number | null | undefined, d = 1, suffix = '') =>
  v === null || v === undefined || Number.isNaN(v) ? DASH : `${v.toFixed(d)}${suffix}`

type Verdict = {
  id: string; family: string; name: string; hypothesis: string; status: string
  observations: number; observations_needed: number; trials_run: number
  oos_sharpe: number | null; deflated_sharpe: number | null
  net_return_annual: number | null; cost_drag_annual: number | null
  capacity_usd: number | null; evidence: string | null; sort_order: number
}

type VolRow = {
  currency: string; expiry: string; observed_at: string; days_to_expiry: number | null
  atm_iv: number | null; put_iv_25d: number | null; call_iv_25d: number | null
  skew_25d: number | null; put_call_oi_ratio: number | null; dvol: number | null
}

type RealizedVol = { symbol: string; annualized_vol: number | null; sample_bars: number }

type Position = {
  id: string; opened_at: string; market: string; contract: string | null
  side: string; leverage: number; notional_usd: number; entry_price: number
  mark_price: number | null; stop_price: number | null; thesis: string
  falsifier: string; funding_paid_usd: number; unrealized_pnl_usd: number | null
  realized_pnl_usd: number | null; status: string; is_evidence: boolean
}

const STATUS = {
  green:      { dot: 'bg-emerald-500', chip: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', label: 'WORKS' },
  amber:      { dot: 'bg-amber-500',   chip: 'border-amber-500/50 bg-amber-400/10 text-amber-700 dark:text-amber-300',        label: 'PROMISING' },
  red:        { dot: 'bg-rose-500',    chip: 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300',            label: 'DEAD' },
  collecting: { dot: 'bg-neutral-400', chip: 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400', label: 'COLLECTING' },
  untested:   { dot: 'bg-neutral-300', chip: 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-neutral-500', label: 'QUEUED' },
} as const

// Ordered the way the research is actually gated, not alphabetically: the families that
// can produce answers soonest come first. Volatility, carry and microstructure are not
// directional, so they are not hostage to the market doing something new — which is what
// blocks every trend and reversion hypothesis today.
const FAMILY_LABEL: Record<string, string> = {
  volatility: 'Volatility & implied vol',
  carry: 'Funding & carry',
  microstructure: 'Order book & tape',
  positioning: 'Positioning & crowding',
  structure: 'Return structure',
  execution: 'Execution & cost',
  risk: 'Risk & sizing',
  trend: 'Trend & momentum',
  reversion: 'Mean reversion',
  'cross-section': 'Cross-sectional',
  seasonality: 'Seasonality',
  'cross-venue': 'Cross-venue',
  macro: 'Macro & cross-asset',
  onchain: 'On-chain & fundamentals',
  validation: 'How results are judged',
}
const FAMILY_ORDER = Object.keys(FAMILY_LABEL)

/** Minutes since a timestamp, or null when there is nothing to measure from. */
function staleness(iso: string | null | undefined): number | null {
  if (!iso) return null
  return (Date.now() - new Date(iso).getTime()) / 60000
}

async function load() {
  const sb = createServiceClient()
  if (!sb) return null

  // kr_* tables are RLS-on-with-no-policies, so this needs the service client.
  // Every query is wrapped: one missing table must not blank the whole page.
  const q = async <T,>(fn: () => PromiseLike<{ data: T | null }>): Promise<T | null> => {
    try { return (await fn()).data } catch { return null }
  }

  const [verdicts, positions, candle, funding, book, tape, carry, capacity, vol, realized] = await Promise.all([
    q<Verdict[]>(() => sb.from('kr_research_verdicts').select('*').order('sort_order')),
    q<Position[]>(() => sb.from('kr_paper_positions').select('*').order('opened_at', { ascending: false }).limit(25)),
    q<{ bar_time: string }[]>(() => sb.from('kr_ohlcv').select('bar_time').order('bar_time', { ascending: false }).limit(1)),
    q<{ observed_at: string }[]>(() => sb.from('kr_funding').select('observed_at').order('observed_at', { ascending: false }).limit(1)),
    q<{ observed_at: string }[]>(() => sb.from('kr_book').select('observed_at').order('observed_at', { ascending: false }).limit(1)),
    q<{ window_start: string }[]>(() => sb.from('kr_tape').select('window_start').order('window_start', { ascending: false }).limit(1)),
    q<{ symbol: string; funding_rate_annualized: number | null; open_interest_usd: number | null; observed_at: string }[]>(
      () => sb.from('kr_funding').select('symbol, funding_rate_annualized, open_interest_usd, observed_at').order('observed_at', { ascending: false }).limit(275)),
    q<{ pair: string; capacity_usd: number | null; round_trip_10k_bps: number | null; observed_at: string }[]>(
      () => sb.from('kr_book').select('pair, capacity_usd, round_trip_10k_bps, observed_at').order('observed_at', { ascending: false }).limit(60)),
    q<VolRow[]>(() => sb.from('kr_vol_surface')
      .select('currency, expiry, observed_at, days_to_expiry, atm_iv, put_iv_25d, call_iv_25d, skew_25d, put_call_oi_ratio, dvol')
      .order('observed_at', { ascending: false }).limit(120)),
    q<RealizedVol[]>(() => sb.from('kr_realized_vol').select('symbol, annualized_vol, sample_bars')),
  ])

  // Row counts come back on `count`, not `data` — a head:true request has no rows at
  // all, so reading .data here would have silently rendered a dash forever.
  const countOf = async (table: string): Promise<number | null> => {
    try {
      const { count } = await sb.from(table).select('*', { count: 'exact', head: true })
      return count ?? null
    } catch { return null }
  }
  const [candles, fundingRows, bookRows, tapeRows, volRows] = await Promise.all(
    ['kr_ohlcv', 'kr_funding', 'kr_book', 'kr_tape', 'kr_vol_surface'].map(countOf))
  const collected = [candles, fundingRows, bookRows, tapeRows, volRows]
    .reduce<number | null>((sum, n) => (n === null ? sum : (sum ?? 0) + n), null)

  return {
    verdicts: verdicts ?? [],
    positions: positions ?? [],
    streams: [
      { name: 'Candles, 5-minute',    table: 'kr_ohlcv', key: 'candles' as const,  minutes: staleness(candle?.[0]?.bar_time),      budget: 15,  note: '20 markets. Kraken serves only 60 hours of history, so a long outage is permanent.' },
      { name: 'Funding, OI & basis',  table: 'kr_funding', key: 'funding' as const, minutes: staleness(funding?.[0]?.observed_at), budget: 15,  note: '275 perpetuals. NOTHING public returns a past hour’s funding rate — a gap here can never be filled.' },
      { name: 'Order book capacity',  table: 'kr_book', key: 'book' as const,    minutes: staleness(book?.[0]?.observed_at),    budget: 15,  note: 'Real cost of real size, walked through the book. Not the quoted spread.' },
      { name: 'Trade tape & flow',    table: 'kr_tape', key: 'tape' as const,    minutes: staleness(tape?.[0]?.window_start),   budget: 20,  note: 'Aggressor side, print sizes, tick volatility. None of it survives into a candle.' },
      { name: 'Implied volatility',   table: 'kr_vol_surface', key: 'vol' as const, minutes: staleness(vol?.[0]?.observed_at),  budget: 20,  note: 'What the market EXPECTS, from ~1,800 Deribit options. A snapshot with no history endpoint behind it, so a gap is permanent.' },
    ],
    carry: dedupe(carry ?? [], (r) => r.symbol),
    capacity: dedupe(capacity ?? [], (r) => r.pair),
    vol: dedupe(vol ?? [], (r) => `${r.currency}|${r.expiry}`)
      .sort((a, b) => (a.days_to_expiry ?? 0) - (b.days_to_expiry ?? 0)),
    realized: Object.fromEntries((realized ?? []).map((r) => [r.symbol, r])) as Record<string, RealizedVol>,
    collected,
    counts: { candles, funding: fundingRows, book: bookRows, tape: tapeRows, vol: volRows },
  }
}

/** Newest row per key, from a newest-first list. */
function dedupe<T>(rows: T[], key: (r: T) => string): T[] {
  const seen = new Map<string, T>()
  for (const row of rows) if (!seen.has(key(row))) seen.set(key(row), row)
  return [...seen.values()]
}

export default async function LeveragePage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const data = await load()

  if (!data) {
    return (
      <Shell secret={secret} active="leverage">
        <Panel accent="rose" title="⚠️ Cannot reach the research store">
          <div className="text-[13px] text-neutral-700 dark:text-neutral-300">
            SUPABASE_SERVICE_ROLE_KEY is not set for this deployment, so the
            research tables cannot be read. Showing nothing rather than zeros.
          </div>
        </Panel>
      </Shell>
    )
  }

  const { verdicts, positions, streams, carry, capacity, collected, counts, vol, realized } = data
  const live = streams.filter((s) => s.minutes !== null && s.minutes <= s.budget).length
  const running = verdicts.filter((v) => v.status === 'collecting').length
  const proven = verdicts.filter((v) => v.status === 'green').length
  const promising = verdicts.filter((v) => v.status === 'amber').length
  const open = positions.filter((p) => p.status === 'open')

  // Known families in the deliberate order above; anything unrecognised still renders,
  // appended rather than dropped — a hypothesis silently missing from the board is worse
  // than one in the wrong place.
  const present = new Set(verdicts.map((v) => v.family))
  const families = [
    ...FAMILY_ORDER.filter((f) => present.has(f)),
    ...[...present].filter((f) => !FAMILY_ORDER.includes(f)).sort(),
  ]
  const withFunding = carry
    .filter((c) => c.funding_rate_annualized !== null)
    .sort((a, b) => Math.abs(b.funding_rate_annualized!) - Math.abs(a.funding_rate_annualized!))

  return (
    <Shell secret={secret} active="leverage">
      {/* ── what this page is, stated before any number ─────────────────── */}
      <div className="mb-3 rounded-xl border border-sky-500/40 bg-sky-400/10 px-4 py-3">
        <div className="text-[13px] font-bold uppercase tracking-widest text-sky-700 dark:text-sky-300">
          Paper research · no venue connected · no order can be placed
        </div>
        <div className="mt-1 text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          Everything here reads Kraken&apos;s <b>public</b> endpoints. No API key, no account,
          and no private exchange path exists in the collector — enforced by a test, not
          by intention. This is separate from the real book on the ROBINHOOD tab and can
          never touch it. A missing number shows as &ldquo;—&rdquo;, never as 0.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile i={0} accent="cyan"   label="Observations archived" value={collected === null ? DASH : collected.toLocaleString()} sub={`${live}/${streams.length} streams live`} tone={live === streams.length ? 'pos' : 'neg'} />
        <Tile i={1} accent="purple" label="Hypotheses running" value={String(running)} sub={`${verdicts.length} on the agenda`} />
        <Tile i={2} accent="amber"  label="Promising" value={promising ? String(promising) : DASH} sub="beat costs, not yet deflated" />
        <Tile i={3} accent="green"  label="Proven" value={proven ? String(proven) : DASH} sub="survived every correction" tone={proven ? 'pos' : 'dim'} />
      </div>

      {/* ── is the data actually arriving ───────────────────────────────── */}
      <div className="mt-3">
        <Panel accent="cyan" title="📡 Collection health">
          <div className="space-y-2">
            {streams.map((s) => {
              const ok = s.minutes !== null && s.minutes <= s.budget
              const rows = counts[s.key]
              return (
                <div key={s.table} className="flex items-start gap-3 border-b border-neutral-100 pb-2 last:border-0 last:pb-0 dark:border-white/5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                      <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">{s.name}</span>
                      <span className={`font-mono text-[12px] ${ok ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                        {s.minutes === null ? 'no data yet' : `${s.minutes.toFixed(0)}m ago`}
                        {rows !== null && <span className="ml-2 text-neutral-400 dark:text-neutral-500">{rows.toLocaleString()} rows</span>}
                      </span>
                    </div>
                    <div className="text-[12px] leading-snug text-neutral-500 dark:text-neutral-400">{s.note}</div>
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* ── the scoreboard ──────────────────────────────────────────────── */}
      <div className="mt-3">
        <Panel
          accent="purple"
          title="🔬 Research scoreboard"
          right={
            <span className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
              {(['green', 'amber', 'red', 'collecting'] as const).map((k) => (
                <span key={k} className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                  <span className={`h-1.5 w-1.5 rounded-full ${STATUS[k].dot}`} />{STATUS[k].label}
                </span>
              ))}
            </span>
          }
        >
          <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] leading-relaxed text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
            <b className="text-neutral-800 dark:text-neutral-200">Why almost everything is grey.</b>{' '}
            Green means a hypothesis beat real costs out-of-sample, <i>and</i> survived the
            Deflated Sharpe correction for how many variants were tried, <i>and</i> held up
            through a frozen forward window. A pretty backtest earns amber. With days of
            data in a single calm regime, nothing has honestly earned more than grey — and
            a board showing green in week one would be lying to you.
          </div>

          <div className="space-y-3">
            {families.map((family) => (
              <div key={family}>
                <div className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-neutral-500 dark:text-neutral-400">
                  {FAMILY_LABEL[family] ?? family}
                </div>
                <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {verdicts.filter((v) => v.family === family).map((v) => {
                    const s = STATUS[(v.status as keyof typeof STATUS)] ?? STATUS.untested
                    const pct = v.observations_needed > 0
                      ? Math.min(100, (v.observations / v.observations_needed) * 100) : 0
                    return (
                      <div key={v.id} className={`rounded-lg border px-2.5 py-2 ${s.chip}`}>
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-[13px] font-semibold">{v.name}</span>
                          <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider opacity-70">{s.label}</span>
                        </div>
                        <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug opacity-80">{v.hypothesis}</div>
                        <div className="mt-1.5 flex items-center gap-2">
                          <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                            <div className={`h-full ${s.dot}`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="shrink-0 font-mono text-[10px] opacity-70">
                            {v.observations}/{v.observations_needed}
                          </span>
                        </div>
                        {(v.oos_sharpe !== null || v.net_return_annual !== null) && (
                          <div className="mt-1 flex gap-3 font-mono text-[10px] opacity-80">
                            <span>OOS SR {num(v.oos_sharpe, 2)}</span>
                            <span>defl {num(v.deflated_sharpe, 2)}</span>
                            <span>net {num(v.net_return_annual !== null ? v.net_return_annual * 100 : null, 0, '%')}</span>
                          </div>
                        )}
                        {v.evidence && <div className="mt-1 text-[11px] italic opacity-75">{v.evidence}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ── paper book ──────────────────────────────────────────────────── */}
      <div className="mt-3">
        <Panel accent="teal" title="📓 Paper book" right={<span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">{open.length} open</span>}>
          <div className="mb-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] leading-relaxed text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
            <b className="text-neutral-800 dark:text-neutral-200">Demonstration, not evidence.</b>{' '}
            These are hand-picked paper positions, charged real slippage walked through the
            order book at this size and real funding at the published hourly rate. A handful
            of trades proves nothing statistically — a good month at this sample size is luck.
            They exist to force real end-to-end decisions and to date the reasoning, and they
            never feed a verdict above.
          </div>
          {open.length === 0 ? (
            <div className="py-6 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
              No positions open yet. The first book will be carry trades, where the edge is
              <i> observed</i> rather than forecast — funding paid right now is a fact on the
              tape, not a prediction about direction.
            </div>
          ) : (
            <div className="space-y-2">
              {open.map((p) => {
                const up = (p.unrealized_pnl_usd ?? 0) >= 0
                return (
                  <div key={p.id} className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-white/10">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13px] font-bold text-neutral-800 dark:text-neutral-200">
                        <span className={p.side === 'long' ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}>
                          {p.side.toUpperCase()}
                        </span>{' '}{p.market} · {p.leverage}× · {usd(p.notional_usd, 0)}
                      </span>
                      <span className={`font-mono text-[13px] font-bold ${up ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                        {p.unrealized_pnl_usd === null ? DASH : `${up ? '+' : ''}${usd(p.unrealized_pnl_usd)}`}
                      </span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                      <span>entry {p.entry_price}</span>
                      <span>mark {p.mark_price ?? DASH}</span>
                      <span>stop {p.stop_price ?? DASH}</span>
                      <span>funding {usd(p.funding_paid_usd)}</span>
                    </div>
                    <div className="mt-1.5 text-[12px] leading-snug text-neutral-700 dark:text-neutral-300"><b>Why:</b> {p.thesis}</div>
                    <div className="mt-0.5 text-[12px] leading-snug text-neutral-500 dark:text-neutral-400"><b>Wrong if:</b> {p.falsifier}</div>
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── what the market expects, versus what it delivered ───────────── */}
      <div className="mt-3">
        <Panel accent="blue" title="🌪️ What the market expects — implied volatility"
          right={<span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">Deribit</span>}>
          {vol.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
              No option data collected yet.
            </div>
          ) : (
            <>
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                {['BTC', 'ETH'].map((ccy) => {
                  const rows = vol.filter((v) => v.currency === ccy)
                  const dvol = rows.find((r) => r.dvol !== null)?.dvol ?? null
                  const rv = realized[`${ccy}/USD`]?.annualized_vol ?? null
                  const premium = dvol !== null && rv !== null ? dvol - rv * 100 : null
                  return (
                    <div key={ccy} className="rounded-lg border border-neutral-200 px-3 py-2 dark:border-white/10">
                      <div className="text-[11px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400">{ccy} variance risk premium</div>
                      <div className={`font-mono text-2xl font-bold ${premium === null ? 'text-neutral-500' : premium > 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                        {premium === null ? DASH : `${premium > 0 ? '+' : ''}${premium.toFixed(1)} pts`}
                      </div>
                      <div className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                        implied {num(dvol, 1, '%')} · realised {num(rv !== null ? rv * 100 : null, 1, '%')}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    <tr><th className="pb-1">expiry</th><th className="pb-1 text-right">days</th><th className="pb-1 text-right">ATM IV</th><th className="pb-1 text-right">25d put</th><th className="pb-1 text-right">25d call</th><th className="pb-1 text-right">skew</th><th className="pb-1 text-right">P/C OI</th></tr>
                  </thead>
                  <tbody className="font-mono">
                    {vol.slice(0, 14).map((v) => (
                      <tr key={`${v.currency}|${v.expiry}`} className="border-t border-neutral-100 dark:border-white/5">
                        <td className="py-0.5 font-sans">{v.currency} {new Date(v.expiry).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</td>
                        <td className="py-0.5 text-right text-neutral-500 dark:text-neutral-400">{num(v.days_to_expiry, 0)}</td>
                        <td className="py-0.5 text-right">{num(v.atm_iv, 1, '%')}</td>
                        <td className="py-0.5 text-right text-neutral-500 dark:text-neutral-400">{num(v.put_iv_25d, 1, '%')}</td>
                        <td className="py-0.5 text-right text-neutral-500 dark:text-neutral-400">{num(v.call_iv_25d, 1, '%')}</td>
                        <td className={`py-0.5 text-right ${v.skew_25d === null ? '' : v.skew_25d < 0 ? 'font-bold text-amber-600 dark:text-amber-300' : ''}`}>
                          {v.skew_25d === null ? DASH : `${v.skew_25d > 0 ? '+' : ''}${v.skew_25d.toFixed(1)}`}
                        </td>
                        <td className="py-0.5 text-right text-neutral-500 dark:text-neutral-400">{num(v.put_call_oi_ratio, 2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 border-t border-neutral-200 pt-2 text-[12px] leading-relaxed text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                Implied volatility sits above realised more often than not, because someone is
                paid to carry the risk of it not doing so — that gap is the <b>variance risk
                premium</b>, and unlike a price forecast it does not need direction to be right.
                <b> Skew</b> is 25-delta put minus call: positive means downside protection costs
                more, the normal state. <b className="text-amber-600 dark:text-amber-300">Negative
                skew is highlighted</b> — calls richer than puts is unusual and means the market is
                paying for upside rather than hedging downside.
              </div>
            </>
          )}
        </Panel>
      </div>

      {/* ── what the collected data already says ────────────────────────── */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel accent="amber" title="💸 What leverage costs right now">
          {withFunding.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-neutral-500 dark:text-neutral-400">No funding collected yet.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    <tr><th className="pb-1">contract</th><th className="pb-1 text-right">carry %/yr</th><th className="pb-1 text-right">a long pays</th><th className="pb-1 text-right">a short pays</th><th className="pb-1 text-right">OI $m</th></tr>
                  </thead>
                  <tbody className="font-mono">
                    {withFunding.slice(0, 12).map((c) => {
                      const pct = c.funding_rate_annualized! * 100
                      return (
                        <tr key={c.symbol} className="border-t border-neutral-100 dark:border-white/5">
                          <td className="py-0.5 font-sans">{c.symbol.replace('PF_', '').replace('USD', '')}</td>
                          <td className={`py-0.5 text-right ${Math.abs(pct) >= 20 ? 'font-bold text-amber-600 dark:text-amber-300' : ''}`}>{pct.toFixed(1)}%</td>
                          <td className={`py-0.5 text-right ${pct > 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{pct > 0 ? '' : '+'}{(-pct).toFixed(1)}%</td>
                          <td className={`py-0.5 text-right ${pct < 0 ? 'text-rose-600 dark:text-rose-300' : 'text-emerald-600 dark:text-emerald-300'}`}>{pct < 0 ? '' : '+'}{pct.toFixed(1)}%</td>
                          <td className="py-0.5 text-right text-neutral-500 dark:text-neutral-400">{c.open_interest_usd ? (c.open_interest_usd / 1e6).toFixed(1) : DASH}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 border-t border-neutral-200 pt-2 text-[12px] leading-relaxed text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                Positive carry means longs pay shorts. <b>The same rate is a cost to one side
                and income to the other</b> — which is why a cost model charging both sides one
                constant is wrong twice over. Bold is above ±20%/yr, where financing rivals a
                whole plausible edge.
              </div>
            </>
          )}
        </Panel>

        <Panel accent="rose" title="🪣 How much money each market can hold">
          {capacity.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-neutral-500 dark:text-neutral-400">No order books collected yet.</div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                    <tr><th className="pb-1">market</th><th className="pb-1 text-right">$10k round trip</th><th className="pb-1 text-right">capacity</th></tr>
                  </thead>
                  <tbody className="font-mono">
                    {capacity.sort((a, b) => (b.capacity_usd ?? 0) - (a.capacity_usd ?? 0)).slice(0, 12).map((c) => (
                      <tr key={c.pair} className="border-t border-neutral-100 dark:border-white/5">
                        <td className="py-0.5 font-sans">{c.pair}</td>
                        <td className={`py-0.5 text-right ${c.round_trip_10k_bps === null ? 'font-bold text-rose-600 dark:text-rose-300' : c.round_trip_10k_bps > 25 ? 'text-amber-600 dark:text-amber-300' : ''}`}>
                          {c.round_trip_10k_bps === null ? 'CANNOT FILL' : `${c.round_trip_10k_bps.toFixed(1)} bps`}
                        </td>
                        <td className="py-0.5 text-right">{c.capacity_usd ? usd(c.capacity_usd, 0) : `< ${usd(1000, 0)}`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 border-t border-neutral-200 pt-2 text-[12px] leading-relaxed text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                Measured by walking the real book, not from the quoted spread — BTC quotes
                0.01 bps at the touch while holding 0.001 BTC there. <b>The markets paying the
                fattest funding are the ones that cannot hold money.</b> At $1,000 that does not
                bind; for anything sellable it is the whole question.
              </div>
            </>
          )}
        </Panel>
      </div>
    </Shell>
  )
}
