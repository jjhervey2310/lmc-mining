import Link from 'next/link'
import Terminal from '@/components/terminal/Terminal'

export default function TerminalPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-white sm:text-3xl">Mining Terminal</h1>
          <p className="mt-2 max-w-3xl text-sm text-gray-400">
            Charting for the numbers that actually decide whether a rig makes money. Hashprice,
            network difficulty and hashrate sit next to crypto and mining equities — with
            candlesticks, indicators and Fibonacci drawing tools on every one of them.
          </p>
        </header>

        <Terminal />

        <section className="mt-8 grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-[#222] bg-[#111] p-5">
            <h2 className="mb-2 text-sm font-bold text-white">How hashprice is calculated</h2>
            <p className="text-xs leading-relaxed text-gray-400">
              Hashprice is derived, not bought. Network hashrate comes from difficulty
              (<span className="font-mono text-gray-300">difficulty × 2³² ÷ 600</span>), the block
              subsidy from actual block height, and average fees per block from mempool.space.
              Daily network revenue is <span className="font-mono text-gray-300">144 × (subsidy + fees)</span>,
              converted at the BTC close and divided by network PH/s.
            </p>
          </article>

          <article className="rounded-2xl border border-[#222] bg-[#111] p-5">
            <h2 className="mb-2 text-sm font-bold text-white">Where the data comes from</h2>
            <p className="text-xs leading-relaxed text-gray-400">
              Difficulty and fee history: mempool.space. Crypto bars and BTC price history:
              Kraken. Equities: Yahoo Finance. Every feed is public and free — nothing here is
              behind a paid data licence, and nothing is estimated where it could be measured.
            </p>
          </article>

          <article className="rounded-2xl border border-[#222] bg-[#111] p-5">
            <h2 className="mb-2 text-sm font-bold text-white">Using the drawing tools</h2>
            <p className="text-xs leading-relaxed text-gray-400">
              Pick a tool and drag on the chart. Fibonacci retracements label each level with its
              actual price. Switch to Select to move or reshape a drawing, or press Delete to
              remove it. Drawings anchor to bars and are saved per symbol in your browser.
            </p>
          </article>
        </section>

        <p className="mt-6 text-xs text-gray-600">
          Charts are for research, not investment advice. Prices can be delayed and derived
          metrics are estimates — see{' '}
          <Link href="/how-we-verify" className="text-[#f7931a] hover:underline">
            how we verify
          </Link>
          . Rendering uses TradingView&apos;s open-source Lightweight Charts library (Apache 2.0);
          this terminal is not affiliated with TradingView.
        </p>
      </div>
    </main>
  )
}
