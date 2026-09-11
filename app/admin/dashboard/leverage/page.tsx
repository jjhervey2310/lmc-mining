import type { Metadata } from 'next'
import { Shell, Panel, Tile, checkAdmin, usd } from '../ui'
import { createServiceClient } from '@/lib/supabase'
import ReadinessBrain, { type Track } from './brain'
import ResearchPulse from './pulse'
import ScoreboardPulse from './scoreboard-pulse'

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
  markets: string[] | null
}

type VolRow = {
  currency: string; expiry: string; observed_at: string; days_to_expiry: number | null
  atm_iv: number | null; put_iv_25d: number | null; call_iv_25d: number | null
  skew_25d: number | null; put_call_oi_ratio: number | null; dvol: number | null
}

type RealizedVol = { symbol: string; annualized_vol: number | null; sample_bars: number }

type StableRow = {
  llama_id: string; symbol: string; observed_at: string; circulating_usd: number | null
  change_1d: number | null; change_7d: number | null; change_30d: number | null
  price: number | null; depegged: boolean | null; total_supply_usd: number | null
}

type ChainRow = { chain: string; observed_at: string; tvl_usd: number | null }

type SpecRow = {
  contract: string; observed_at: string
  maintenance_rate: number | null; leverage_max: number | null
}

type VenueFundingRow = {
  coin: string; venue: string; observed_at: string
  funding_rate_annualized: number | null; interval_hours: number | null
}

type ForwardRow = {
  rule: string | null; market: string; side: string
  realized_pnl_usd: number | null; notional_usd: number | null
  opened_at: string; status: string
}

type FindingRow = {
  test_id: string; verdict_id: string | null; at: string; episodes: number
  markets: number; trials: number; mean_excess: number | null
  median_excess: number | null; t_corrected: number | null; beat_market: number | null
  horizon_hours: number | null; status: string; detail: string | null
}

type DepthRow = { interval_minutes: number; markets: number; bars: number
                  oldest: string | null; newest: string | null }

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

// Declared here rather than imported from ./brain, which carries 'use client'. A server
// component importing a plain value from a client module receives undefined, not the
// value — so this multiplied into every track as undefined and the brain read NaN%. The
// component still renders, and the family lines beneath it still read correctly, which is
// what let it sit there looking merely unfinished rather than broken.
/** How far one question has been researched, from 0 to 1.
 *
 *  A question that came back DEAD is fully researched — a ruled-out idea is information
 *  gathered, not information missing — so it counts the same as one that worked. An open
 *  question counts the share of the observations it asked for that have actually arrived,
 *  capped at one so an over-supplied hypothesis cannot lend credit to a starved one. */
function completionOf(v: Verdict): number {
  if (v.status === 'green' || v.status === 'red') return 1
  if (!v.observations_needed) return 0
  return Math.min(1, (v.observations ?? 0) / v.observations_needed)
}

/** Where a leveraged position is closed out, as a fraction of the entry price.
 *  Derived from the venue's maintenance rate rather than the 1/L rule, which is
 *  optimistic in every case: at 5x on BTC the true distance is 19.76%, not 20%. */
function liquidationDistance(leverage: number, maintenanceRate: number): number {
  return Math.abs((1 - 1 / leverage) / (1 - maintenanceRate) - 1)
}

function normalCdf(x: number): number {
  // Abramowitz & Stegun 7.1.26 — plenty for a display figure.
  const t = 1 / (1 + 0.2316419 * Math.abs(x))
  const d = 0.3989422804014327 * Math.exp(-x * x / 2)
  const p = d * t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 +
            t * (-1.821255978 + t * 1.330274429))))
  return x >= 0 ? 1 - p : p
}

/** Odds the path TOUCHES the liquidation level before the horizon — first passage,
 *  not where price ends up. A position dies at the lowest point on the path, and using
 *  the terminal distribution instead understates the risk by roughly half.
 *  Drift is zero: assuming a market rises while computing the odds of a fall is how a
 *  plan gets talked into surviving on paper. */
function liquidationOdds(distance: number, annualVol: number, days: number): number {
  if (distance <= 0 || distance >= 1 || annualVol <= 0 || days <= 0) return 0
  const years = days / 365
  const sigma = annualVol * Math.sqrt(years)
  const barrier = Math.log(1 - distance)
  const nu = (-(annualVol ** 2) / 2) * years
  const first = normalCdf((barrier - nu) / sigma)
  const exponent = (2 * nu * barrier) / (sigma ** 2)
  if (exponent > 700) return 1
  return Math.min(1, Math.max(0, first + Math.exp(exponent) * normalCdf((barrier + nu) / sigma)))
}

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

  const [verdicts, positions, candle, funding, book, tape, carry, capacity, vol, realized, stables, chains,
         liq, deep, venueFunding, specs, forward, wallets, findings] = await Promise.all([
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
    q<StableRow[]>(() => sb.from('kr_stablecoins')
      .select('llama_id, symbol, observed_at, circulating_usd, change_1d, change_7d, change_30d, price, depegged, total_supply_usd')
      .order('observed_at', { ascending: false }).limit(150)),
    q<ChainRow[]>(() => sb.from('kr_chain_tvl').select('chain, observed_at, tvl_usd')
      .order('observed_at', { ascending: false }).limit(60)),
    q<{ at: string }[]>(() => sb.from('kr_market_stats').select('at')
      .order('at', { ascending: false }).limit(1)),
    q<DepthRow[]>(() => sb.from('kr_deep_candle_depth')
      .select('interval_minutes, markets, bars, oldest, newest')),
    q<VenueFundingRow[]>(() => sb.from('kr_venue_funding')
      .select('coin, venue, observed_at, funding_rate_annualized, interval_hours')
      .order('observed_at', { ascending: false }).limit(700)),
    q<SpecRow[]>(() => sb.from('kr_contract_specs')
      .select('contract, observed_at, maintenance_rate, leverage_max')
      .order('observed_at', { ascending: false }).limit(80)),
    q<ForwardRow[]>(() => sb.from('kr_paper_positions')
      .select('rule, market, side, realized_pnl_usd, notional_usd, opened_at, status')
      .not('rule', 'is', null).order('opened_at', { ascending: false }).limit(2000)),
    q<{ observed_at: string }[]>(() => sb.from('kr_traders').select('observed_at')
      .order('observed_at', { ascending: false }).limit(1)),
    // Written by the collector itself, six-hourly, with nobody at the keyboard. Deliberately
    // a different table from kr_research_verdicts: the two will disagree, and an automated
    // writer that could overwrite a person's reasoning would do so at the worst moment.
    q<FindingRow[]>(() => sb.from('kr_findings')
      .select('test_id, verdict_id, at, episodes, markets, trials, mean_excess, median_excess, t_corrected, beat_market, horizon_hours, status, detail')
      .order('at', { ascending: false }).limit(400)),
  ])

  // Row counts come back on `count`, not `data` — a head:true request has no rows at
  // all, so reading .data here would have silently rendered a dash forever.
  const countOf = async (table: string): Promise<number | null> => {
    try {
      const { count } = await sb.from(table).select('*', { count: 'exact', head: true })
      return count ?? null
    } catch { return null }
  }
  const [candles, fundingRows, bookRows, tapeRows, volRows, stableRows,
         liqRows, deepRows, venueRows, fillRows, forwardRows] = await Promise.all(
    ['kr_ohlcv', 'kr_funding', 'kr_book', 'kr_tape', 'kr_vol_surface', 'kr_stablecoins',
     'kr_market_stats', 'kr_deep_candles', 'kr_venue_funding', 'kr_wallet_fills',
     'kr_paper_positions'].map(countOf))
  const collected = [candles, fundingRows, bookRows, tapeRows, volRows, stableRows,
                     liqRows, deepRows, venueRows, fillRows]
    .reduce<number | null>((sum, n) => (n === null ? sum : (sum ?? 0) + n), null)

  // Oldest deep candle per interval — the answer to "how much history do we have",
  // which is the number that was actually blocking every hypothesis.
  const deepRowsList = deep ?? []
  const deepNewestRow = deepRowsList.reduce<DepthRow | null>(
    (best, row) => (row.newest && (!best?.newest || row.newest > best.newest) ? row : best), null)
  const depth = [60, 240, 1440].map((interval) => {
    const row = deepRowsList.find((r) => r.interval_minutes === interval)
    return { interval, oldest: row?.oldest ?? null, markets: row?.markets ?? 0 }
  })

  // Forward record, grouped by preregistered variant. Net only — a gross figure quoted
  // without its cost is the commonest way a paper record flatters itself.
  const byRule = new Map<string, { trades: number; net: number; wins: number }>()
  for (const row of forward ?? []) {
    if (!row.rule || row.realized_pnl_usd === null) continue
    const seen = byRule.get(row.rule) ?? { trades: 0, net: 0, wins: 0 }
    seen.trades += 1
    seen.net += row.realized_pnl_usd
    if (row.realized_pnl_usd > 0) seen.wins += 1
    byRule.set(row.rule, seen)
  }
  const notional = (forward ?? []).find((r) => r.notional_usd)?.notional_usd ?? 1000
  const forwardBoard = [...byRule.entries()]
    .map(([rule, v]) => ({ rule, ...v, bps: (v.net / v.trades) / notional * 10000 }))
    .sort((a, b) => b.bps - a.bps)

  // Only the newest run. Every earlier run is kept in the table so a drifting result can
  // be caught by comparing a test against its own past, but showing them all at once would
  // read as many findings where there is one, measured repeatedly.
  const allFindings = findings ?? []
  const newestRun = allFindings.length ? allFindings[0].at : null
  const latestFindings = allFindings.filter((f) => f.at === newestRun)

  return {
    findings: latestFindings,
    findingRuns: new Set(allFindings.map((f) => f.at)).size,
    verdicts: verdicts ?? [],
    positions: positions ?? [],
    depth,
    forwardBoard,
    specs: dedupe(specs ?? [], (r) => r.contract),
    venueFunding: dedupe(venueFunding ?? [], (r) => `${r.coin}|${r.venue}`),
    streams: [
      { name: 'Candles, 5-minute',    table: 'kr_ohlcv', key: 'candles' as const,  minutes: staleness(candle?.[0]?.bar_time),      budget: 15,  note: '20 markets. Kraken serves only 60 hours of history, so a long outage is permanent.' },
      { name: 'Funding, OI & basis',  table: 'kr_funding', key: 'funding' as const, minutes: staleness(funding?.[0]?.observed_at), budget: 15,  note: '275 perpetuals. NOTHING public returns a past hour’s funding rate — a gap here can never be filled.' },
      { name: 'Order book capacity',  table: 'kr_book', key: 'book' as const,    minutes: staleness(book?.[0]?.observed_at),    budget: 15,  note: 'Real cost of real size, walked through the book. Not the quoted spread.' },
      { name: 'Trade tape & flow',    table: 'kr_tape', key: 'tape' as const,    minutes: staleness(tape?.[0]?.window_start),   budget: 20,  note: 'Aggressor side, print sizes, tick volatility. None of it survives into a candle.' },
      { name: 'Implied volatility',   table: 'kr_vol_surface', key: 'vol' as const, minutes: staleness(vol?.[0]?.observed_at),  budget: 20,  note: 'What the market EXPECTS, from ~1,800 Deribit options. A snapshot with no history endpoint behind it, so a gap is permanent.' },
      { name: 'Capital flows',        table: 'kr_stablecoins', key: 'stables' as const, minutes: staleness(stables?.[0]?.observed_at), budget: 1500, note: 'Stablecoin supply and chain TVL. Daily resolution — dollars entering crypto before they reach a price.' },
      { name: 'Liquidations & positioning', table: 'kr_market_stats', key: 'liq' as const, minutes: staleness(liq?.[0]?.at), budget: 180, note: '180 days across 17 markets. Who got CLOSED OUT versus who chose to sell — opposite trades that price alone cannot distinguish.' },
      { name: 'Deep candle history', table: 'kr_deep_candles', key: 'deep' as const, minutes: staleness(deepNewestRow?.newest), budget: 180, note: 'Hourly, 4-hour and daily back to 2021. The horizons these hypotheses actually use; 5-minute bars were never the right resolution for them.' },
      { name: 'Binance & Bybit funding', table: 'kr_venue_funding', key: 'venue' as const, minutes: staleness(venueFunding?.[0]?.observed_at), budget: 30, note: 'Read through Hyperliquid because both geo-block us. Annualised only — settlement intervals differ per venue AND per coin.' },
      { name: 'Winning & losing wallets', table: 'kr_traders', key: 'wallets' as const, minutes: staleness(wallets?.[0]?.observed_at), budget: 1500, note: 'Hyperliquid leaderboard with an equally sized LOSER arm. A condition found only among winners explains nothing.' },
    ],
    carry: dedupe(carry ?? [], (r) => r.symbol),
    capacity: dedupe(capacity ?? [], (r) => r.pair),
    stables: dedupe(stables ?? [], (r) => r.llama_id)
      .sort((a, b) => (b.circulating_usd ?? 0) - (a.circulating_usd ?? 0)),
    chains: dedupe(chains ?? [], (r) => r.chain)
      .sort((a, b) => (b.tvl_usd ?? 0) - (a.tvl_usd ?? 0)),
    vol: dedupe(vol ?? [], (r) => `${r.currency}|${r.expiry}`)
      .sort((a, b) => (a.days_to_expiry ?? 0) - (b.days_to_expiry ?? 0)),
    realized: Object.fromEntries((realized ?? []).map((r) => [r.symbol, r])) as Record<string, RealizedVol>,
    collected,
    counts: { candles, funding: fundingRows, book: bookRows, tape: tapeRows, vol: volRows,
              stables: stableRows, liq: liqRows, deep: deepRows, venue: venueRows,
              wallets: fillRows, forward: forwardRows },
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

  const { verdicts, positions, streams, carry, capacity, collected, counts, vol, realized, stables, chains,
          depth, forwardBoard, specs, venueFunding, findings, findingRuns } = data
  const live = streams.filter((s) => s.minutes !== null && s.minutes <= s.budget).length
  const running = verdicts.filter((v) => v.status === 'collecting').length
  const proven = verdicts.filter((v) => v.status === 'green').length
  const amber = verdicts.filter((v) => v.status === 'amber')
  const green = verdicts.filter((v) => v.status === 'green')
  const promising = amber.length
  // A scoreboard that loaded and found nothing promising is a RESULT. Rendering that as a
  // dash the way an unreadable table is rendered conflates "none" with "unknown", and the
  // two are opposite claims. The dash is kept for the case it was meant for: no verdicts
  // could be read at all.
  const boardRead = verdicts.length > 0
  const nameList = (rows: Verdict[], limit = 2) =>
    rows.slice(0, limit).map((v) => v.name).join(', ')
      + (rows.length > limit ? ` +${rows.length - limit}` : '')
  const open = positions.filter((p) => p.status === 'open')

  // Known families in the deliberate order declared above — soonest-answerable first;
  // anything unrecognised still renders, appended rather than dropped, because a
  // hypothesis silently missing from the board is worse than one in the wrong place.
  const present = new Set(verdicts.map((v) => v.family))
  const families = [
    ...FAMILY_ORDER.filter((f) => present.has(f)),
    ...[...present].filter((f) => !FAMILY_ORDER.includes(f)).sort(),
  ]

  // Readiness brain: one track per hypothesis family, answered / asked.
  // RESOLVED means the question has an answer either way — green (it works) or
  // red (it is dead). A ruled-out idea is information gathered, so it counts.
  // COLLECTING and QUEUED do not: those are still open questions.
  // Built from `families` above, so the tracks inherit the same soonest-first ordering
  // rather than re-deriving one and disagreeing with the board underneath them.
  const RESOLVED = new Set(['green', 'red'])
  const tracks: Track[] = families.map((family) => {
    const rows = verdicts.filter((v) => v.family === family)
    const answered = rows.filter((v) => RESOLVED.has(v.status)).length
    const dead = rows.filter((v) => v.status === 'red').length
    const works = rows.filter((v) => v.status === 'green').length

    // How much of THIS family is researched. One question is worth one question: answered
    // counts as fully done whichever way it came out, and an open one counts the share of
    // its own data that has arrived. Weighting by observation counts instead would let a
    // single hypothesis needing 2,000 rows drown out ninety needing 200, and the figure
    // would then describe the collector's workload rather than the board's progress.
    const open = rows.filter((v) => !RESOLVED.has(v.status))
    const needed = open.reduce((n, v) => n + (v.observations_needed ?? 0), 0)
    const held = open.reduce(
      (n, v) => n + Math.min(v.observations ?? 0, v.observations_needed ?? 0), 0)
    const evidence = needed > 0 ? held / needed : 0
    const credit = rows.reduce((n, v) => n + completionOf(v), 0)

    const detail = answered === 0
      ? `${rows.length} still open — ${Math.round(evidence * 100)}% of the data they need`
      : `${works} works, ${dead} ruled out, ${rows.length - answered} open`
    return { key: family, label: FAMILY_LABEL[family] ?? family,
             credit, answered, total: rows.length, evidence, detail }
  })
  // How much of the RESEARCH ITSELF is done, as distinct from how many questions have an
  // answer. Answered-questions moves in whole steps and sits still for days; this moves
  // every time a row lands, which is what "is the work progressing" actually asks.
  // Observations are capped at what each hypothesis needs, so an over-supplied one cannot
  // borrow credit for a starved one and hide that the starved one is stuck.
  const fullyDone = verdicts.filter((v) => completionOf(v) >= 1).length
  const inProgress = verdicts.filter((v) => {
    const c = completionOf(v)
    return c > 0 && c < 1
  }).length
  const notStarted = verdicts.filter((v) => completionOf(v) === 0).length

  const withFunding = carry
    .filter((c) => c.funding_rate_annualized !== null)
    .sort((a, b) => Math.abs(b.funding_rate_annualized!) - Math.abs(a.funding_rate_annualized!))

  return (
    <Shell secret={secret} active="leverage">
      {/* ── is it running, right now ────────────────────────────────────── */}
      <ResearchPulse secret={secret} />

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
        <Tile i={2} accent="amber" label="Promising"
              value={boardRead ? String(promising) : DASH}
              sub={promising ? nameList(amber) : 'large effect, not yet significant'} />
        <Tile i={3} accent="green" label="Proven"
              value={boardRead ? String(proven) : DASH}
              sub={proven ? nameList(green) : 'survived every correction'}
              tone={proven ? 'pos' : 'dim'} />
      </div>

      {/* ── how much of the research question has an answer yet ─────────── */}
      <div className="mt-3">
        <Panel accent="green" title="🧠 Research readiness">
          <ReadinessBrain tracks={tracks} fullyDone={fullyDone}
                          inProgress={inProgress} notStarted={notStarted} />
          <div className="mt-3 border-t border-neutral-200 pt-2 text-[12px] text-neutral-500 dark:border-white/10">
            This is the honest completion bar for the research, not a confidence
            score: it measures how many hypotheses have an answer, not how many
            of them worked. Expect it to sit near zero for weeks — that is what
            four days of data in one benign regime is worth.
          </div>
        </Panel>
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

      {/* ── how much history each horizon actually has ──────────────────── */}
      <div className="mt-3">
        <Panel accent="cyan" title="📚 History depth — what the hypotheses are being fed">
          <div className="mb-3 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
            Every directional hypothesis needs 150&ndash;500 independent observations. For
            five days they were fed a <strong>2.5-day window</strong>, because 5-minute was
            the only interval ever requested — and the same Kraken endpoint returns 721 bars
            at <em>any</em> interval, two years of them when asked for daily. Gate serves
            2,000 a call back to March 2021. That was the constraint, and it was self-inflicted.
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            {depth.map((row) => {
              const label = row.interval === 1440 ? 'Daily' : row.interval === 240 ? '4-hour' : 'Hourly'
              const days = row.oldest ? Math.round((Date.now() - new Date(row.oldest).getTime()) / 86400000) : null
              return (
                <div key={row.interval} className="rounded-lg border border-neutral-200/70 bg-neutral-50/60 px-3 py-2 dark:border-neutral-800 dark:bg-neutral-900/40">
                  <div className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{label}</div>
                  <div className="font-mono text-[18px] font-bold text-neutral-900 dark:text-neutral-100">
                    {days === null ? DASH : `${days.toLocaleString()}d`}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400">
                    {row.markets === 0 ? 'not collected yet' : `${row.markets} markets · back to ${row.oldest!.slice(0, 10)}`}
                  </div>
                </div>
              )
            })}
          </div>
        </Panel>
      </div>

      {/* ── funding on the venues that matter ───────────────────────────── */}
      <div className="mt-3">
        <Panel accent="amber" title="🌍 Binance & Bybit funding — read through Hyperliquid">
          <div className="mb-3 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
            Both geo-block us directly and would from Colorado too, yet Binance is where the
            marginal leveraged dollar sits. <strong>Annualised only.</strong> Settlement
            intervals differ per venue <em>and</em> per coin, so the published rates are not
            comparable: on BTC the raw numbers make Binance look 4.6&times; Hyperliquid when
            annualising puts Hyperliquid 1.7&times; higher.
          </div>
          {venueFunding.length === 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
              Not collected yet — the collector needs the latest build.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-left text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th className="py-1 pr-3 font-medium">coin</th>
                    <th className="py-1 pr-3 text-right font-medium">binance</th>
                    <th className="py-1 pr-3 text-right font-medium">bybit</th>
                    <th className="py-1 pr-3 text-right font-medium">hyperliquid</th>
                    <th className="py-1 text-right font-medium">spread</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {Object.entries(
                    venueFunding.reduce<Record<string, Record<string, number | null>>>((acc, r) => {
                      acc[r.coin] = acc[r.coin] ?? {}
                      acc[r.coin][r.venue] = r.funding_rate_annualized
                      return acc
                    }, {}))
                    .map(([coin, byVenue]) => {
                      const values = Object.values(byVenue).filter((v): v is number => v !== null && v !== undefined)
                      // Only coins where EVERY venue annualised — a spread against a rate
                      // that could not be annualised is the exact error to avoid.
                      const complete = values.length === Object.keys(byVenue).length && values.length >= 2
                      return { coin, byVenue, spread: complete ? Math.max(...values) - Math.min(...values) : null }
                    })
                    .filter((r) => r.spread !== null)
                    .sort((a, b) => b.spread! - a.spread!)
                    .slice(0, 12)
                    .map(({ coin, byVenue, spread }) => (
                      <tr key={coin} className="border-t border-neutral-200/60 dark:border-neutral-800">
                        <td className="py-1 pr-3">{coin}</td>
                        {['binance', 'bybit', 'hyperliquid'].map((venue) => {
                          const v = byVenue[venue]
                          return (
                            <td key={venue} className={`py-1 pr-3 text-right ${v == null ? 'text-neutral-400' : v < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                              {v == null ? DASH : `${(v * 100).toFixed(1)}%`}
                            </td>
                          )
                        })}
                        <td className="py-1 text-right font-bold">{(spread! * 100).toFixed(1)} pts</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ── the forward record: the one thing that cannot be backfilled ──── */}
      <div className="mt-3">
        <Panel
          accent="green"
          title="📈 Forward paper record — out of sample, costs charged"
          right={<span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
            {counts.forward === null ? DASH : `${counts.forward.toLocaleString()} decisions`}
          </span>}
        >
          <div className="mb-3 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
            Six preregistered rules at four horizons — <strong>24 trials</strong>, and that
            count feeds the deflated Sharpe. Decisions use closed bars only, entry and exit
            at a bar close, costs from our own measured round trip charged at both ends.
            Read every row against <strong>benchmark-long</strong>, which is simply always
            long: over a falling stretch a rule that merely loses less is still winning.
          </div>
          {forwardBoard.length === 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
              No decisions resolved yet. The collector needs the latest build, and the
              newest bars deliberately resolve nothing until their exit bar has closed —
              scoring a position whose exit has not happened is how an open loser gets
              left out of a record.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-left text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th className="py-1 pr-3 font-medium">rule @ horizon</th>
                    <th className="py-1 pr-3 text-right font-medium">trades</th>
                    <th className="py-1 pr-3 text-right font-medium">net / trade</th>
                    <th className="py-1 pr-3 text-right font-medium">vs benchmark</th>
                    <th className="py-1 text-right font-medium">winners</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {forwardBoard.map((row) => {
                    const horizon = row.rule.split('@')[1] ?? ''
                    const control = forwardBoard.find((r) => r.rule === `benchmark-long@${horizon}`)
                    const edge = control && control.rule !== row.rule ? row.bps - control.bps : null
                    const isControl = row.rule.startsWith('benchmark-long@')
                    return (
                      <tr key={row.rule} className={`border-t border-neutral-200/60 dark:border-neutral-800 ${isControl ? 'text-neutral-500 dark:text-neutral-400' : ''}`}>
                        <td className="py-1 pr-3">{row.rule}{isControl ? ' · control' : ''}</td>
                        <td className="py-1 pr-3 text-right">{row.trades}</td>
                        <td className={`py-1 pr-3 text-right ${row.bps >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {row.bps >= 0 ? '+' : ''}{row.bps.toFixed(1)} bps
                        </td>
                        <td className={`py-1 pr-3 text-right ${edge === null ? '' : edge >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                          {edge === null ? DASH : `${edge >= 0 ? '+' : ''}${edge.toFixed(1)} bps`}
                        </td>
                        <td className="py-1 text-right">{row.wins}/{row.trades}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ── leverage survivability ──────────────────────────────────────── */}
      <div className="mt-3">
        <Panel accent="rose" title="💀 Where leverage dies — odds of being closed out">
          <div className="mb-3 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
            From the venue&rsquo;s published maintenance rate and our own measured
            volatility, <strong>assuming zero drift</strong>. These are first-passage odds:
            a position is closed by the <em>lowest point on the path</em>, not by where
            price ends up, and asking the terminal question understates the risk by roughly
            half. If you believe a bull run is starting, the numbers improve sharply — but
            that is a bet on the drift and belongs stated out loud, not buried in a default.
          </div>
          {specs.length === 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
              No margin parameters collected yet — the collector needs the latest build.
              Showing nothing rather than the 1/L approximation, which is optimistic in
              every case.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead className="text-left text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th className="py-1 pr-3 font-medium">market</th>
                    <th className="py-1 pr-3 text-right font-medium">vol</th>
                    <th className="py-1 pr-3 text-right font-medium">maint.</th>
                    <th className="py-1 pr-3 text-right font-medium">3x / 30d</th>
                    <th className="py-1 pr-3 text-right font-medium">5x / 30d</th>
                    <th className="py-1 pr-3 text-right font-medium">3x / 180d</th>
                    <th className="py-1 pr-3 text-right font-medium">5x / 180d</th>
                    <th className="py-1 text-right font-medium">max under 20% / 180d</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {specs.map((spec) => {
                    const base = spec.contract.replace('_USDT', '')
                    const rv = realized[`${base}/USD`]
                    const mr = spec.maintenance_rate
                    if (!rv?.annualized_vol || mr === null) return null
                    const v = rv.annualized_vol
                    const odds = (lev: number, days: number) =>
                      liquidationOdds(liquidationDistance(lev, mr), v, days)
                    let safest: number | null = null
                    for (let lev = 20; lev > 1; lev -= 1) {
                      if (odds(lev, 180) < 0.20) { safest = lev; break }
                    }
                    const cell = (p: number) => (
                      <td className={`py-1 pr-3 text-right ${p >= 0.5 ? 'text-rose-600 dark:text-rose-400' : p >= 0.2 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                        {(p * 100).toFixed(1)}%
                      </td>
                    )
                    return (
                      <tr key={spec.contract} className="border-t border-neutral-200/60 dark:border-neutral-800">
                        <td className="py-1 pr-3">{base}</td>
                        <td className="py-1 pr-3 text-right">{(v * 100).toFixed(0)}%</td>
                        <td className="py-1 pr-3 text-right">{(mr * 100).toFixed(2)}%</td>
                        {cell(odds(3, 30))}{cell(odds(5, 30))}{cell(odds(3, 180))}{cell(odds(5, 180))}
                        <td className={`py-1 text-right ${safest === null ? 'text-rose-600 dark:text-rose-400' : ''}`}>
                          {safest === null ? 'none' : `${safest}x`}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {/* ── what the collector measured on its own ──────────────────────── */}
      {findings.length > 0 && (() => {
        // Grouped by test so one row is one question, with its horizons side by side.
        // The horizon is where the answer lives: the same trigger can be worth holding
        // for two days and worthless at twenty, and a single averaged number hides that.
        const byTest = new Map<string, FindingRow[]>()
        for (const f of findings) {
          const rows = byTest.get(f.test_id) ?? []
          rows.push(f)
          byTest.set(f.test_id, rows)
        }
        const peak = (rows: FindingRow[]) =>
          Math.max(...rows.map((r) => Math.abs(r.t_corrected ?? 0)))
        const tests = [...byTest.entries()].sort((a, b) => peak(b[1]) - peak(a[1]))
        const horizons = [...new Set(findings.map((f) => f.horizon_hours ?? 0))].sort((a, b) => a - b)
        const trials = findings[0]?.trials ?? 0
        // Bonferroni, honestly applied: with this many trials, |t| >= 2 turns up several
        // times by luck alone. Quoting the 2.0 bar against a grid this wide is how a
        // fitted number gets called a finding.
        const bar = trials > 1 ? Math.sqrt(2 * Math.log(2 * trials / 0.05)) : 2
        const best = tests[0]
        return (
          <div className="mt-3">
            <Panel
              accent="cyan"
              title="🤖 What the collector measured on its own"
              right={
                <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  {findings.length} results · {findingRuns} run{findingRuns === 1 ? '' : 's'}
                </span>
              }
            >
              <div className="mb-3 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-[12px] leading-relaxed text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
                <b className="text-neutral-800 dark:text-neutral-200">This table moves without anyone here.</b>{' '}
                The collector re-runs every test six-hourly against the daily bars already on
                disk and writes the results itself. Numbers are excess over each market&rsquo;s
                own return, so a market that simply rose cannot make a rule look able, and a
                positive figure means the trade made money <i>whichever way it faced</i> —
                short results are already mirrored.{' '}
                <b className="text-neutral-800 dark:text-neutral-200">
                  Nothing here can turn green.
                </b>{' '}
                Green needs out-of-sample survival and a Deflated Sharpe correction, which one
                backtest cannot supply. Across {trials} trials the honest significance bar is
                |t| ≥ {bar.toFixed(2)}, not 2.00
                {best && peak(best[1]) < bar
                  ? `, and the strongest thing measured is ${best[0]} at t = ${peak(best[1]).toFixed(2)}.`
                  : '.'}
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-[12px]">
                  <thead>
                    <tr className="border-b border-neutral-200 text-left text-[10px] uppercase tracking-wider text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                      <th className="py-1.5 pr-3 font-semibold">Test</th>
                      <th className="py-1.5 pr-3 font-semibold">Way</th>
                      {horizons.map((h) => (
                        <th key={h} className="py-1.5 pr-3 text-right font-semibold">
                          {h >= 24 ? `${Math.round(h / 24)}d` : `${h}h`}
                        </th>
                      ))}
                      <th className="py-1.5 text-right font-semibold">Peak t</th>
                    </tr>
                  </thead>
                  <tbody className="font-mono">
                    {tests.map(([testId, rows]) => {
                      const way = rows[0].detail?.startsWith('short') ? 'short' : 'long'
                      const thin = rows.every((r) => r.episodes < 30)
                      return (
                        <tr key={testId}
                            className="border-b border-neutral-100 last:border-0 dark:border-white/5">
                          <td className="py-1.5 pr-3 font-sans">
                            <span className="font-semibold">{testId}</span>
                            {thin && (
                              <span className="ml-1.5 text-[10px] uppercase tracking-wider text-neutral-400">
                                too few
                              </span>
                            )}
                          </td>
                          <td className={`py-1.5 pr-3 text-[10px] uppercase tracking-wider ${
                            way === 'short' ? 'text-rose-600 dark:text-rose-400'
                                            : 'text-emerald-600 dark:text-emerald-400'}`}>
                            {way}
                          </td>
                          {horizons.map((h) => {
                            const cell = rows.find((r) => (r.horizon_hours ?? 0) === h)
                            if (!cell) return <td key={h} className="py-1.5 pr-3 text-right text-neutral-300">–</td>
                            const t = cell.t_corrected ?? 0
                            // Shaded by evidence, not by whether the number is pleasing:
                            // a large excess on a t of 0.4 is noise and must not look warm.
                            const strong = Math.abs(t) >= bar
                            const notable = Math.abs(t) >= 1.2
                            return (
                              <td key={h} className={`py-1.5 pr-3 text-right ${
                                strong ? 'font-bold text-emerald-600 dark:text-emerald-400'
                                       : notable ? 'text-neutral-800 dark:text-neutral-200'
                                                 : 'text-neutral-400 dark:text-neutral-500'}`}>
                                {((cell.median_excess ?? 0) * 100).toFixed(2)}%
                                <span className="ml-1 text-[10px] opacity-60">t{t.toFixed(2)}</span>
                              </td>
                            )
                          })}
                          <td className="py-1.5 text-right font-semibold">
                            {peak(rows).toFixed(2)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
                Each cell is the median excess at that holding period, with its
                correlation-corrected t beside it. Median rather than mean deliberately: these
                payoffs are heavily right-skewed, so a mean can be positive while most trades
                lose, and the mean is the number that talks a plan into existence.
              </div>
            </Panel>
          </div>
        )
      })()}

      {/* ── the scoreboard ──────────────────────────────────────────────── */}
      <ScoreboardPulse secret={secret} />
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
                    const settled = v.status === 'green' || v.status === 'red'
                    return (
                      <details key={v.id} data-family={v.family}
                               className={`group rounded-lg border px-2.5 py-2 ${s.chip}`}>
                        <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                          <div className="flex items-baseline justify-between gap-2">
                            <span className="truncate text-[13px] font-semibold">{v.name}</span>
                            <span className="flex shrink-0 items-center gap-1.5">
                              <span className="researching-tag hidden font-mono text-[9px] uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                                collecting now
                              </span>
                              <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">{s.label}</span>
                            </span>
                          </div>
                          <div className="mt-0.5 line-clamp-2 text-[11px] leading-snug opacity-80 group-open:line-clamp-none">
                            {v.hypothesis}
                          </div>
                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-1 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
                              <div className={`h-full ${s.dot}`} style={{ width: `${pct}%` }} />
                            </div>
                            <span className="shrink-0 font-mono text-[10px] opacity-70">
                              {v.observations}/{v.observations_needed}
                            </span>
                          </div>
                          {v.evidence && (
                            <div className="mt-1 text-[10px] uppercase tracking-wider opacity-60 group-open:hidden">
                              {settled ? 'click for the finding and what it means' : 'click for what has been measured so far'}
                            </div>
                          )}
                          {!v.evidence && (
                            <div className="mt-1 text-[10px] uppercase tracking-wider opacity-50 group-open:hidden">
                              not yet tested
                            </div>
                          )}
                        </summary>

                        {(v.oos_sharpe !== null || v.net_return_annual !== null) && (
                          <div className="mt-2 flex gap-3 font-mono text-[10px] opacity-80">
                            <span>OOS SR {num(v.oos_sharpe, 2)}</span>
                            <span>defl {num(v.deflated_sharpe, 2)}</span>
                            <span>net {num(v.net_return_annual !== null ? v.net_return_annual * 100 : null, 0, '%')}</span>
                          </div>
                        )}

                        {v.evidence ? (
                          <div className="mt-2 border-t border-current/15 pt-2">
                            {v.status === 'green' && (
                              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest opacity-70">
                                What this means for trading
                              </div>
                            )}
                            {v.status === 'red' && (
                              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-widest opacity-70">
                                Why it was ruled out
                              </div>
                            )}
                            <div className="whitespace-pre-line text-[11.5px] leading-relaxed opacity-90">
                              {v.evidence}
                            </div>
                            {(v.markets?.length ?? 0) > 0 && (
                              <div className="mt-2 font-mono text-[10px] opacity-60">
                                measured on: {v.markets!.join(' · ')}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="mt-2 border-t border-current/15 pt-2 text-[11.5px] leading-relaxed opacity-75">
                            Nothing measured yet. This question is on the board so that it
                            cannot be quietly dropped, and so that the readiness figure
                            counts it against what still has to be answered.
                          </div>
                        )}
                      </details>
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

      {/* ── capital arriving, before it reaches a price ──────────────────── */}
      <div className="mt-3">
        <Panel accent="green" title="💵 Capital flows — money arriving at the market"
          right={<span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">DefiLlama</span>}>
          {stables.length === 0 ? (
            <div className="py-4 text-center text-[13px] text-neutral-500 dark:text-neutral-400">
              No capital-flow data collected yet.
            </div>
          ) : (
            <>
              {(() => {
                const total = stables[0]?.total_supply_usd ?? null
                const usde = stables.find((c) => c.symbol === 'USDe')
                const depegs = stables.filter((c) => c.depegged)
                const weekly = stables.reduce((sum, c) => sum + (c.circulating_usd ?? 0) * (c.change_7d ?? 0), 0)
                return (
                  <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
                    <Tile accent="green" label="Stablecoin supply" tone="dim"
                      value={total === null ? DASH : `$${(total / 1e9).toFixed(1)}b`}
                      sub="dollars inside crypto" />
                    <Tile accent="teal" label="Arrived this week"
                      tone={weekly >= 0 ? 'pos' : 'neg'}
                      value={`${weekly >= 0 ? '+' : ''}$${(weekly / 1e9).toFixed(2)}b`}
                      sub="net of redemptions" />
                    <Tile accent="purple" label="USDe 30-day"
                      tone={(usde?.change_30d ?? 0) >= 0 ? 'pos' : 'neg'}
                      value={num(usde?.change_30d != null ? usde.change_30d * 100 : null, 1, '%')}
                      sub="capital chasing the carry" />
                    <Tile accent="rose" label="Below peg"
                      tone={depegs.length ? 'neg' : 'dim'}
                      value={depegs.length ? String(depegs.length) : DASH}
                      sub={depegs.length ? depegs.slice(0, 2).map((d) => d.symbol).join(', ') : 'none over $10m'} />
                  </div>
                )
              })()}
              <div className="grid gap-3 md:grid-cols-2">
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Largest stablecoins</div>
                  <table className="w-full text-left text-[12px]">
                    <thead className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <tr><th className="pb-1">coin</th><th className="pb-1 text-right">supply</th><th className="pb-1 text-right">7d</th><th className="pb-1 text-right">30d</th></tr>
                    </thead>
                    <tbody className="font-mono">
                      {stables.slice(0, 6).map((c) => (
                        <tr key={c.llama_id} className="border-t border-neutral-100 dark:border-white/5">
                          <td className="py-0.5 font-sans">{c.symbol}</td>
                          <td className="py-0.5 text-right">${((c.circulating_usd ?? 0) / 1e9).toFixed(2)}b</td>
                          <td className={`py-0.5 text-right ${(c.change_7d ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{num(c.change_7d != null ? c.change_7d * 100 : null, 2, '%')}</td>
                          <td className={`py-0.5 text-right ${(c.change_30d ?? 0) >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{num(c.change_30d != null ? c.change_30d * 100 : null, 2, '%')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-neutral-500 dark:text-neutral-400">Capital committed by chain</div>
                  <table className="w-full text-left text-[12px]">
                    <thead className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                      <tr><th className="pb-1">chain</th><th className="pb-1 text-right">TVL</th></tr>
                    </thead>
                    <tbody className="font-mono">
                      {chains.slice(0, 6).map((c) => (
                        <tr key={c.chain} className="border-t border-neutral-100 dark:border-white/5">
                          <td className="py-0.5 font-sans">{c.chain}</td>
                          <td className="py-0.5 text-right">${((c.tvl_usd ?? 0) / 1e9).toFixed(2)}b</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="mt-2 border-t border-neutral-200 pt-2 text-[12px] leading-relaxed text-neutral-500 dark:border-white/10 dark:text-neutral-400">
                Stablecoin supply is dollars entering crypto, visible before they reach a
                price. <b>USDe is the one to watch:</b> it earns its yield by shorting perpetuals
                to collect funding, so its growth measures capital chasing the carry — and more
                capital harvesting funding should compress funding rates. Only coins trading
                <i> below</i> peg count as depegged; tokenised treasuries trade above $1 by design.
                <b> Token unlock schedules are not here</b> — DefiLlama paywalls them, and a known
                gap is cheaper than data of unknown provenance.
              </div>
            </>
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
