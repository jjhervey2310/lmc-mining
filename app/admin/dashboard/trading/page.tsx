import type { Metadata } from 'next'
import { Shell, Panel, checkAdmin } from '../ui'
import CompPanel from '../comp-panel'
import { getCompBooks, COMP_START_CASH } from '../comp-data'

// TRADING — the competition page: Claude vs GPT vs Gemini, $1,000 each,
// every book priced live. Winner keeps the membership.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function TradingPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const books = await getCompBooks()

  return (
    <Shell secret={secret} active="trading">
      <Panel accent="purple" title="🏆 Trading competition — $1,000 each" right={<span className="text-[11px] text-neutral-500">winner keeps the membership</span>}>
        <CompPanel books={books} start={COMP_START_CASH} secret={secret} />
      </Panel>
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
