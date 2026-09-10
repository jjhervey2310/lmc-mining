import type { Metadata } from 'next'
import { Shell, Panel, Tile, checkAdmin } from '../ui'
import ReadinessBrain, { type Gate } from './brain'

// LEVERAGE — the leveraged desk Jacob and Claude are building (2026-09-10).
//
// Nothing is wired to a venue yet, and this page deliberately shows dashes
// rather than zeros: a zero here would read as "flat", which is a different
// claim from "not built". Every tile below is a slot waiting for a real feed.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

// The five gates. This array is the single source of truth for the readiness
// brain — flip a status to 'locked' here and the green rises on its own.
//
// Answered by Jacob 2026-09-10. The leverage desk session owns these decisions;
// if one is re-opened there, it gets re-opened here too.
const GATES: Gate[] = [
  { key: 'venue', status: 'open', label: 'Venue',
    detail: 'Not chosen. Must be legal in Colorado and expose a real API the trader can hook into.' },
  { key: 'size', status: 'locked', label: 'Starting size',
    detail: '$1,000 — the number Jacob is willing to lose to zero, not the number that sounds good.' },
  { key: 'leverage', status: 'locked', label: 'Max leverage',
    detail: '3x hard ceiling. Roughly a 33% adverse move to liquidation, well outside the stop.' },
  { key: 'liquidation', status: 'locked', label: 'Liquidation rule',
    detail: 'A hard stop on every entry, placed well inside the venue liquidation price.' },
  { key: 'killswitch', status: 'open', label: 'Kill switch',
    detail: 'No agreed drawdown figure that flattens the book. The last gate, and the one that protects the other four.' },
]

export default async function LeveragePage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  return (
    <Shell secret={secret} active="leverage">
      <div className="mb-3 rounded-xl border border-amber-500/40 bg-amber-400/10 px-4 py-3">
        <div className="text-[13px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">Under construction</div>
        <div className="mt-1 text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          No venue is connected and no capital is at risk. The tiles read
          &ldquo;&mdash;&rdquo; rather than &ldquo;0&rdquo; on purpose &mdash; a zero would look like a flat
          book instead of an unbuilt one. Numbers appear here only once a real
          account is wired in.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile accent="amber" label="Account equity" value="—" sub="not connected" />
        <Tile accent="cyan" label="Margin used" value="—" sub="no venue wired" />
        <Tile accent="purple" label="Open positions" value="—" sub="none to report" />
        <Tile accent="rose" label="Nearest liquidation" value="—" sub="the number that matters most" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel accent="amber" title="🧠 What this desk needs before it trades">
          <ReadinessBrain gates={GATES} />
          <div className="mt-3 border-t border-neutral-200 pt-2 text-[12px] text-neutral-500 dark:border-white/10">
            Leverage turns a bad week into a closed account. The rules go in
            before the money does, which is why this page exists before the desk does.
          </div>
        </Panel>

        <Panel accent="cyan" title="📋 Slots reserved on this page">
          <ul className="ml-4 list-disc space-y-1.5 text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">
            <li>Live positions with entry, mark, leverage and liquidation price</li>
            <li>Margin health, with a warning band well before the venue&apos;s own</li>
            <li>Realised and unrealised P&amp;L, separated the way the ROBINHOOD tab does it</li>
            <li>Every fill logged, so the record is the ledger and not a memory</li>
            <li>An equity curve from day one of the desk</li>
          </ul>
          <div className="mt-3 border-t border-neutral-200 pt-2 text-[12px] text-neutral-500 dark:border-white/10">
            Same rule as the rest of the terminal: a failed fetch renders as a dash and says so, never as a zero.
          </div>
        </Panel>
      </div>
    </Shell>
  )
}
