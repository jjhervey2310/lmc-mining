import type { Metadata } from 'next'
import Link from 'next/link'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'

export const metadata: Metadata = {
  title: 'Best Places to Buy Bitcoin 2026 — Exchange Comparison',
  description: 'Compare the best Bitcoin exchanges in 2026. Coinbase, Kraken, River Financial — fees, features, and which is right for Bitcoin miners selling mined BTC.',
}

const EXCHANGES = [
  {
    name: 'River Financial',
    badge: 'Best for Miners',
    badgeColor: '#00d4aa',
    tagline: 'Bitcoin-only. No altcoins. Built for serious Bitcoin holders.',
    pros: ['Bitcoin-only exchange — no distractions', 'Recurring buys with low fees', 'Excellent for stacking mined BTC', 'Phone support available'],
    cons: ['Bitcoin only — no altcoin trading', 'Not available in all states'],
    fee: '~1.3% all-in',
    best: 'Miners who want to accumulate and stack BTC long-term',
    href: 'https://river.com',
    highlight: true,
  },
  {
    name: 'Coinbase',
    badge: 'Most Beginner Friendly',
    badgeColor: '#3d7aed',
    tagline: 'Largest US exchange. Simple interface, insured custodial wallet.',
    pros: ['FDIC-insured USD balances', 'Easy mobile app', 'Widely trusted and regulated', 'Large liquidity — easy to sell large amounts'],
    cons: ['Higher fees on simple buy/sell', 'Has had customer service issues at scale', 'KYC required'],
    fee: '1.5–3.99% (standard) / ~0.6% (Advanced Trade)',
    best: 'First-time buyers and those who prefer name recognition',
    href: 'https://coinbase.com',
    highlight: false,
  },
  {
    name: 'Kraken',
    badge: 'Best for Low Fees',
    badgeColor: '#a855f7',
    tagline: 'Professional-grade exchange with low trading fees and strong security record.',
    pros: ['Very low fees on Pro (maker: 0.16%)', 'Strong security track record', 'Wide range of pairs', 'Staking options available'],
    cons: ['Interface can be complex for beginners', 'Occasional verification delays'],
    fee: '0.16%–1.5% depending on tier',
    best: 'Experienced traders and miners moving larger volumes',
    href: 'https://kraken.com',
    highlight: false,
  },
]

const FAQ = [
  {
    q: 'Should I buy Bitcoin or just mine it?',
    a: 'Mining and buying serve different goals. Mining gives you exposure to Bitcoin with an ongoing revenue stream but requires capital, management, and hosting. Buying is simpler but gives you no operational upside. Many serious Bitcoin holders do both — mine for accumulation and buy on dips.',
  },
  {
    q: 'Which exchange is best for selling mined Bitcoin?',
    a: 'River Financial is popular with miners for its clean interface and low fees on recurring transactions. Coinbase Advanced Trade and Kraken Pro both offer competitive fees for larger volume sells. The key factors are fee structure, withdrawal limits, and KYC requirements.',
  },
  {
    q: 'How do I transfer mined Bitcoin to an exchange?',
    a: 'Your mining pool pays out to a Bitcoin address you control. To sell on an exchange, generate a deposit address in your exchange account and set that as your payout address in your pool dashboard, or transfer from your wallet. Always start with a small test transaction first.',
  },
  {
    q: 'Do I pay taxes when I sell mined Bitcoin?',
    a: 'In the United States, mined Bitcoin is generally taxable as ordinary income at the time of receipt (based on market value at receipt). When you sell, you may owe capital gains tax on any appreciation since the mining date. Consult a tax professional familiar with cryptocurrency.',
  },
  {
    q: 'Is it better to hold mined Bitcoin or sell immediately?',
    a: 'This is a personal decision based on your cost basis, BTC price outlook, and cash flow needs. Many miners sell enough to cover hosting costs and hold the rest. Our Deal Analyzer can model different sell strategies.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function BuyBitcoinPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full mb-4 font-semibold" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
          UPDATED JUNE 2026
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Best Places to Buy Bitcoin in 2026</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Whether you&apos;re selling mined BTC or buying directly, here are the exchanges we recommend — ranked by what matters to miners.
        </p>
        <div className="mt-4 text-xs text-gray-500 max-w-xl mx-auto">
          Affiliate disclosure: LMC Mining may earn a commission if you open an account through our links. This does not affect our rankings or reviews.
        </div>
      </div>

      <AffiliateDisclosure />

      {/* Exchange cards */}
      <div className="space-y-6 mb-16 mt-6">
        {EXCHANGES.map((ex, i) => (
          <div
            key={ex.name}
            className="rounded-2xl p-6"
            style={{
              background: ex.highlight ? 'rgba(0,212,170,0.06)' : '#111827',
              border: `1px solid ${ex.highlight ? '#00d4aa40' : '#1f2937'}`,
            }}
          >
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-xl font-bold text-white">#{i + 1} {ex.name}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: ex.badgeColor + '22', color: ex.badgeColor }}>
                    {ex.badge}
                  </span>
                </div>
                <p className="text-sm text-gray-400">{ex.tagline}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs text-gray-500 mb-0.5">Trading fee</div>
                <div className="font-mono font-semibold text-white">{ex.fee}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: '#00d4aa' }}>PROS</div>
                <ul className="space-y-1">
                  {ex.pros.map((p, j) => (
                    <li key={j} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#00d4aa' }}>+</span>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: '#ff4757' }}>CONS</div>
                <ul className="space-y-1">
                  {ex.cons.map((c, j) => (
                    <li key={j} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#ff4757' }}>−</span>{c}</li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-gray-800">
              <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Best for:</span> {ex.best}</p>
              <a
                href={ex.href}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-sm font-bold px-5 py-2.5 rounded-xl transition-colors"
                style={{ background: ex.highlight ? '#00d4aa' : '#1f2937', color: ex.highlight ? '#0a0e17' : '#fff' }}
              >
                Open Account →
              </a>
            </div>
          </div>
        ))}
      </div>

      {/* Mining connection section */}
      <section className="rounded-2xl p-6 mb-12" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <h2 className="text-xl font-bold text-white mb-2">Mining and Selling BTC: The Smart Approach</h2>
        <p className="text-gray-400 mb-4">Most miners sell a portion of their BTC monthly to cover hosting costs and hold the rest. Here&apos;s how the math typically works:</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'Sell to cover costs', desc: 'Sell ~30–40% of monthly mining output to cover your $225/month hosting fee. This keeps you cash-flow neutral.' },
            { label: 'Stack the rest', desc: 'Hold the remaining BTC for long-term appreciation. Your cost basis is your hosting rate — potentially far below market.' },
            { label: 'Model first', desc: 'Use our Deal Analyzer to see your exact break-even, payback period, and monthly BTC accumulation rate before mining.' },
          ].map(item => (
            <div key={item.label} className="rounded-xl p-4" style={{ background: '#0a0e17' }}>
              <div className="font-semibold text-white text-sm mb-1">{item.label}</div>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <Link href="/deal-analyzer" className="inline-flex items-center gap-2 text-sm font-semibold" style={{ color: '#f59e0b' }}>
            Model your mining economics in the Deal Analyzer →
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <section>
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQ.map((f, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h3 className="font-semibold text-white mb-2">{f.q}</h3>
              <p className="text-sm text-gray-400">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Internal links */}
      <div className="mt-12 pt-8 border-t border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">Related Resources</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { href: '/deal-analyzer', label: 'Deal Analyzer' },
            { href: '/miners', label: 'Hardware Database' },
            { href: '/hosts', label: 'Hosting Providers' },
            { href: '/university/bitcoin-mining-profitability', label: 'Profitability Guide' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="text-sm px-4 py-2 rounded-lg transition-colors" style={{ background: '#111827', border: '1px solid #1f2937', color: '#9ca3af' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
