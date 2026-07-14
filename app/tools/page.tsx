import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  alternates: { canonical: '/tools' },
  title: 'Bitcoin Mining Tools & Resources — Exchange, Tax Software',
  description:
    'Recommended tools for Bitcoin miners: Kraken exchange for buying and selling BTC, Koinly for crypto tax reporting. All affiliate links clearly disclosed.',
}

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

const TOOLS = [
  {
    name: 'Kraken Exchange',
    category: 'Buy / Sell Bitcoin',
    url: 'https://invite.kraken.com/JDNW/3cpjgj5j',
    icon: '⚡',
    description:
      'One of the most trusted cryptocurrency exchanges. Competitive fees, strong security, and reliable USD withdrawal — the go-to for miners converting BTC to cash or buying hardware.',
    pros: ['Low trading fees', 'Strong security record', 'Fast fiat withdrawal', 'Staking options'],
    affiliate: true,
    disclosure: 'Lightning Mines earns a commission when you sign up through this link.',
    cta: 'Open Kraken Account',
  },
  {
    name: 'Koinly',
    category: 'Crypto Tax Software',
    url: 'https://koinly.io/?via=2AB53CDA',
    icon: '📊',
    description:
      'The simplest way to handle Bitcoin mining taxes. Koinly imports your mining income automatically, calculates your cost basis, and generates IRS-ready tax reports. Essential for any miner with meaningful income.',
    pros: ['Mining income tracking', 'Auto-imports from exchanges', 'IRS Form 8949 & Schedule D', 'CPA-ready export'],
    affiliate: true,
    disclosure: 'Lightning Mines earns a commission when you sign up through this link.',
    cta: 'Get Koinly',
  },
]

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'Tools', item: 'https://lightningmines.com/tools' },
  ],
}

export default function ToolsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>Tools</span>
      </div>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Bitcoin Mining Tools</h1>
        <p className="text-gray-400 max-w-xl">
          Tools we recommend to Bitcoin miners for managing their BTC and taxes.
          All affiliate links are clearly labelled — we only recommend tools we believe provide genuine value.
        </p>
        <div
          className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(247,147,26,0.1)', color: ORANGE, border: '1px solid rgba(247,147,26,0.2)' }}
        >
          ⚡ Affiliate Disclosure: Lightning Mines earns commissions from the links on this page. See individual disclosures below.
        </div>
      </div>

      {/* Tool cards */}
      <div className="space-y-6">
        {TOOLS.map(tool => (
          <div key={tool.name} className="rounded-2xl p-6 md:p-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between flex-wrap gap-4 mb-5">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-2xl">{tool.icon}</span>
                  <h2 className="text-white text-xl font-bold">{tool.name}</h2>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full font-medium"
                    style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE, border: '1px solid rgba(247,147,26,0.2)' }}
                  >
                    Affiliate Link
                  </span>
                </div>
                <div className="text-xs text-gray-500">{tool.category}</div>
              </div>
              <a
                href={tool.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold px-6 py-3 rounded-xl"
                style={{ background: ORANGE, color: '#000' }}
              >
                {tool.cta} ↗
              </a>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed mb-5">{tool.description}</p>

            <div className="grid grid-cols-2 gap-2 mb-5">
              {tool.pros.map(pro => (
                <div key={pro} className="flex items-center gap-2 text-xs text-gray-400">
                  <span style={{ color: '#00d4aa' }}>✓</span>
                  {pro}
                </div>
              ))}
            </div>

            <div
              className="rounded-lg px-4 py-2 text-xs"
              style={{ background: 'rgba(107,114,128,0.08)', border: '1px solid rgba(107,114,128,0.15)', color: '#6b7280' }}
            >
              <span className="font-semibold text-gray-500">Affiliate Disclosure: </span>
              {tool.disclosure}
            </div>
          </div>
        ))}
      </div>

      {/* Separator + internal links */}
      <div className="mt-12 pt-8 border-t" style={{ borderColor: BORDER }}>
        <h2 className="text-lg font-bold text-white mb-4">More from Lightning Mines</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link href="/calculator" className="rounded-xl p-4 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="text-lg mb-1">🧮</div>
            <div className="text-sm font-semibold text-white mb-1">ROI Calculator</div>
            <div className="text-xs text-gray-500">Run your exact profitability numbers</div>
          </Link>
          <Link href="/hosting" className="rounded-xl p-4 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="text-lg mb-1">🏗️</div>
            <div className="text-sm font-semibold text-white mb-1">Hosting Comparison</div>
            <div className="text-xs text-gray-500">Compare listed hosting providers</div>
          </Link>
          <Link href="/review" className="rounded-xl p-4 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="text-lg mb-1">🔍</div>
            <div className="text-sm font-semibold text-white mb-1">Free Deal Review</div>
            <div className="text-xs text-gray-500">Get an expert review of your deal</div>
          </Link>
          <Link href="/mining-pools" className="rounded-xl p-4 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="text-lg mb-1">⛏️</div>
            <div className="text-sm font-semibold text-white mb-1">Best Mining Pools</div>
            <div className="text-xs text-gray-500">Compare pool fees and payout methods</div>
          </Link>
          <Link href="/buy-bitcoin" className="rounded-xl p-4 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="text-lg mb-1">💱</div>
            <div className="text-sm font-semibold text-white mb-1">Where to Buy Bitcoin</div>
            <div className="text-xs text-gray-500">Compare exchanges for cashing out</div>
          </Link>
          <Link href="/wallet" className="rounded-xl p-4 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="text-lg mb-1">🔒</div>
            <div className="text-sm font-semibold text-white mb-1">Secure Your Mining Rewards</div>
            <div className="text-xs text-gray-500">Hardware wallets for mined Bitcoin</div>
          </Link>
        </div>
      </div>
    </div>
  )
}
