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
        Rules: every trade priced at the real market at call time · ledgers reconcile weekly · shorts and defined-risk options allowed ·
        relayed rival holdings reprice live off the same feed as Claude&apos;s · reported-cash fallback shows the week it was logged.
        Claude&apos;s calls land every Monday (sooner if the market breaks something).
      </div>
    </Shell>
  )
}
