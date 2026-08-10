import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, checkAdmin } from '../ui'
import CompPanel from '../comp-panel'
import TrendChart from '../trend-chart'
import { getCompBooks, COMP_START_CASH } from '../comp-data'
import { getMarketQuotes, isStale, marketClosed } from '@/lib/markets'

// Brand colours match the leaderboard chips: Claude amber, ChatGPT emerald,
// Gemini Google-blue.
const LINE: Record<string, string> = { claude: '#fbbf24', gpt: '#34d399', gemini: '#60a5fa' }

// TRADING — the competition page: Claude vs GPT vs Gemini, $1,000 each,
// every book priced live. Winner keeps the membership.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function TradingPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const books = await getCompBooks()

  // Price provenance: when the feed was actually read, and whether anything is
  // being served from a stale cache. Presenting old ticks as live is how MSFT
  // showed $487.46 against a $499.99 close (2026-08-08).
  const quotes = await getMarketQuotes().catch(() => [])
  const newest = quotes.length ? Math.max(...quotes.map((q) => q.fetchedAt)) : null
  const staleCount = quotes.filter((q) => isStale(q)).length
  const closed = marketClosed()
  const asOf = newest
    ? new Date(newest).toLocaleTimeString('en-US', { timeZone: 'America/Denver', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null

  // Equity curve: one point per contestant per day from comp_snapshots, plus a
  // live "now" endpoint from the same books that price the tiles — so the line
  // always ends where the boxes are (Jacob, 2026-08-10).
  const supabase = createServiceClient()
  const { data: snaps } = (await supabase?.from('comp_snapshots')
    .select('snapshot_date, contestant, total')
    .order('snapshot_date')) ?? { data: null }
  const days = [...new Set((snaps ?? []).map((r) => r.snapshot_date as string))]
  const liveTotal = Object.fromEntries(books.map((b) => [b.key, b.total]))
  const bankedPoints = (k: string) =>
    days.reduce<number[]>((acc, d) => {
      const hit = (snaps ?? []).find((r) => r.snapshot_date === d && r.contestant === k)
      acc.push(hit ? Number(hit.total) : acc[acc.length - 1] ?? COMP_START_CASH)
      return acc
    }, [])
  // Live endpoint; a book with no report carries its last banked value forward.
  const withNow = (k: string) => {
    const pts = bankedPoints(k)
    pts.push(liveTotal[k] ?? pts[pts.length - 1] ?? COMP_START_CASH)
    return pts
  }
  const chartDays = [...days, 'now']
  const curve = ['claude', 'gpt', 'gemini'].map((k) => ({
    key: k,
    label: k.toUpperCase(),
    color: LINE[k],
    format: 'usd2' as const,
    points: withNow(k),
  })).filter((s) => s.points.length > 1)

  // Same data keyed for the per-contestant chart inside the panel.
  const daily = {
    days: chartDays,
    totals: Object.fromEntries(['claude', 'gpt', 'gemini'].map((k) => [k, withNow(k)])),
  }

  return (
    <Shell secret={secret} active="trading">
      <div className="mb-2 flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400">
        <span>prices as of <b className="font-mono">{asOf ?? 'unavailable'}</b> DEN</span>
        {closed && <span className="rounded bg-neutral-200 px-1.5 py-0.5 uppercase tracking-wide dark:bg-white/10">equities: last session close</span>}
        {staleCount > 0 && (
          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300">
            {staleCount} quote{staleCount === 1 ? '' : 's'} older than 10 min — marked stale, not live
          </span>
        )}
      </div>
      <Panel accent="purple" title="🏆 Trading competition — $1,000 each" right={<span className="text-[11px] text-neutral-500">winner keeps the membership</span>}>
        <CompPanel books={books} start={COMP_START_CASH} secret={secret} daily={daily} />
      </Panel>
      {curve.length > 0 && (
        <div className="mt-3">
          <Panel accent="purple" title="Equity curves — every book, one axis"
            right={<span className="text-[11px] text-neutral-500">daily close, ending at live now · slide to compare any day</span>}>
            <TrendChart series={curve} labels={chartDays} sharedScale h={240} />
          </Panel>
        </div>
      )}
      {curve.length === 0 && (
        <div className="mt-3 rounded-lg border border-dashed border-neutral-300 p-3 text-[12px] text-neutral-500 dark:border-white/15">
          Equity curves start once there are two daily snapshots — the first is banked tonight, so the chart appears tomorrow.
        </div>
      )}
      <div className="mt-3 text-[12px] text-neutral-500">
        Rules: #1 — independence: no contestant sees or reacts to another&apos;s picks; every call is made as if rival books don&apos;t exist ·
        every trade priced at the real market at call time · full universe — any stock or any crypto · ledgers reconcile weekly ·
        shorts and defined-risk options allowed · relayed rival holdings reprice live off the same feed as Claude&apos;s ·
        reported-cash fallback shows the week it was logged. Check-ins land every Monday (sooner if the market breaks something).
      </div>
      <div className="mt-1 text-[12px] text-neutral-500">
        Mandate: aggressive but safe — target as close to 3x in one year as the market allows · full research expected before every call
        (news, X/social sentiment, economics &amp; macro, technical analysis, on-chain whale-wallet flows) · guardrail: a 20% drawdown on
        any position forces a cut-or-justify review at the next check-in — no silent bag-holding.
      </div>
      <div className="mt-1 text-[12px] text-neutral-500">
        Stakes: graded on final total at the 1-year mark · elimination — the last-place platform is dropped at month 6 and its
        subscription is gone forever.
      </div>
    </Shell>
  )
}
