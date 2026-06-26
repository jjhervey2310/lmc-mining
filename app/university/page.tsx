import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bitcoin Mining University — Free Guides for 2026',
  description:
    'Free Bitcoin mining education hub. 12 guides covering mining basics, hardware, hosting, profitability, pool fees, taxes, scams, and advanced strategy. Written by miners, for miners.',
  openGraph: {
    title: 'Bitcoin Mining University | Lightning Mines',
    description: 'Free Bitcoin mining education — 12 guides from basics to advanced strategy.',
    type: 'website',
  },
}

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

const CATEGORIES = [
  {
    title: 'Bitcoin Mining Basics',
    icon: '₿',
    description: 'How mining works, why it exists, and what you actually need to get started.',
    articles: [
      { slug: 'what-is-bitcoin-mining', title: 'What Is Bitcoin Mining?' },
    ],
  },
  {
    title: 'Mining Hardware',
    icon: '⚙️',
    description: 'ASIC miners explained, how to compare them, and which models are best for beginners.',
    articles: [
      { slug: 'best-bitcoin-miners-for-beginners', title: 'Best Bitcoin Miners for Beginners' },
      { slug: 'asic-miner-efficiency-explained', title: 'ASIC Miner Efficiency Explained' },
    ],
  },
  {
    title: 'Hosting and Power',
    icon: '🏗️',
    description: 'Everything about hosted mining — what it is, how to compare providers, and what to watch out for.',
    articles: [
      { slug: 'hosted-bitcoin-mining-explained', title: 'Hosted Bitcoin Mining Explained' },
      { slug: 'bitcoin-mining-electricity-costs', title: 'Bitcoin Mining Electricity Costs' },
      { slug: 'home-mining-vs-hosted-mining', title: 'Home Mining vs Hosted Mining' },
    ],
  },
  {
    title: 'Mining Profitability',
    icon: '📈',
    description: 'How to calculate real ROI, understand breakeven, and model different BTC price scenarios.',
    articles: [
      { slug: 'is-bitcoin-mining-profitable', title: 'Is Bitcoin Mining Profitable?' },
      { slug: 'how-to-calculate-bitcoin-mining-roi', title: 'How to Calculate Bitcoin Mining ROI' },
    ],
  },
  {
    title: 'Pool Fees and Payouts',
    icon: '🏊',
    description: 'How mining pools work, how fees affect your revenue, and which pools to consider.',
    articles: [
      { slug: 'mining-pool-fees-explained', title: 'Mining Pool Fees Explained' },
    ],
  },
  {
    title: 'Taxes and Business Setup',
    icon: '📋',
    description: 'How Bitcoin mining income is taxed, what you can deduct, and how to stay compliant.',
    articles: [
      { slug: 'bitcoin-mining-tax-basics', title: 'Bitcoin Mining Tax Basics' },
    ],
  },
  {
    title: 'Scams and Red Flags',
    icon: '🚩',
    description: 'How to spot bad hosting deals, hardware scams, and the warning signs every miner must know.',
    articles: [
      { slug: 'bitcoin-mining-hosting-red-flags', title: 'Bitcoin Mining Hosting Red Flags' },
      { slug: 'how-to-avoid-bad-mining-deals', title: 'How to Avoid Bad Mining Deals' },
    ],
  },
  {
    title: 'Advanced Strategy',
    icon: '🧠',
    description: 'Deep dives for experienced miners looking to optimize their operation.',
    articles: [],
    comingSoon: true,
  },
]

const ALL_ARTICLES = [
  { slug: 'what-is-bitcoin-mining', title: 'What Is Bitcoin Mining?', time: '8 min' },
  { slug: 'is-bitcoin-mining-profitable', title: 'Is Bitcoin Mining Profitable?', time: '12 min' },
  { slug: 'hosted-bitcoin-mining-explained', title: 'Hosted Bitcoin Mining Explained', time: '10 min' },
  { slug: 'how-to-calculate-bitcoin-mining-roi', title: 'How to Calculate Bitcoin Mining ROI', time: '8 min' },
  { slug: 'bitcoin-mining-electricity-costs', title: 'Bitcoin Mining Electricity Costs', time: '9 min' },
  { slug: 'best-bitcoin-miners-for-beginners', title: 'Best Bitcoin Miners for Beginners', time: '10 min' },
  { slug: 'bitcoin-mining-hosting-red-flags', title: 'Bitcoin Mining Hosting Red Flags', time: '9 min' },
  { slug: 'asic-miner-efficiency-explained', title: 'ASIC Miner Efficiency Explained', time: '8 min' },
  { slug: 'mining-pool-fees-explained', title: 'Mining Pool Fees Explained', time: '7 min' },
  { slug: 'home-mining-vs-hosted-mining', title: 'Home Mining vs Hosted Mining', time: '9 min' },
  { slug: 'bitcoin-mining-tax-basics', title: 'Bitcoin Mining Tax Basics', time: '10 min' },
  { slug: 'how-to-avoid-bad-mining-deals', title: 'How to Avoid Bad Mining Deals', time: '9 min' },
]

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'EducationalOrganization',
  name: 'Lightning Mines University',
  description: 'Free Bitcoin mining education covering profitability, hardware, hosting, taxes, and strategy.',
  url: 'https://lightningmines.com/university',
  hasCourse: ALL_ARTICLES.map(a => ({
    '@type': 'Course',
    name: a.title,
    url: `https://lightningmines.com/university/${a.slug}`,
  })),
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'University', item: 'https://lightningmines.com/university' },
  ],
}

export default function UniversityPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>University</span>
      </div>

      {/* Header */}
      <div className="mb-10">
        <div
          className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4"
          style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE }}
        >
          FREE EDUCATION
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Bitcoin Mining University</h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          Everything you need to mine Bitcoin profitably. From basics to advanced strategy —
          written by miners, for miners.
        </p>
        <div className="flex items-center gap-6 mt-5 text-sm text-gray-500">
          <span>12 free guides</span>
          <span>·</span>
          <span>Updated 2026</span>
          <span>·</span>
          <span>No sign-up required</span>
        </div>
      </div>

      {/* Category cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-14">
        {CATEGORIES.map(cat => (
          <div
            key={cat.title}
            className="rounded-2xl p-6"
            style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
          >
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">{cat.icon}</span>
              <h2 className="text-white font-bold text-lg">{cat.title}</h2>
            </div>
            <p className="text-gray-500 text-sm mb-4 leading-relaxed">{cat.description}</p>

            {cat.comingSoon ? (
              <div className="text-xs text-gray-600 italic">Advanced guides coming soon</div>
            ) : (
              <ul className="space-y-2">
                {cat.articles.map(a => (
                  <li key={a.slug}>
                    <Link
                      href={`/university/${a.slug}`}
                      className="flex items-center gap-2 text-sm group"
                    >
                      <span style={{ color: ORANGE }} className="text-xs">→</span>
                      <span className="text-gray-400 group-hover:text-white transition-colors">{a.title}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* All Articles list */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white mb-6">All 12 Articles</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {ALL_ARTICLES.map(a => (
            <Link
              key={a.slug}
              href={`/university/${a.slug}`}
              className="group flex items-center justify-between rounded-xl px-4 py-3 transition-colors"
              style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
            >
              <span className="text-sm text-gray-400 group-hover:text-white transition-colors">{a.title}</span>
              <span className="text-xs text-gray-600 shrink-0 ml-4">{a.time}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl p-8 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-xl font-bold text-white mb-2">Ready to Run the Numbers?</h2>
        <p className="text-gray-400 mb-6 text-sm">
          Use our free tools to calculate ROI, compare hosting, and get a deal review before you commit.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/calculator" className="text-sm font-bold px-6 py-3 rounded-lg" style={{ background: ORANGE, color: '#000' }}>
            Calculate Mining ROI →
          </Link>
          <Link href="/review" className="text-sm font-semibold px-6 py-3 rounded-lg border text-gray-300 hover:text-white transition-colors" style={{ borderColor: BORDER }}>
            Free Deal Review →
          </Link>
        </div>
      </div>
    </div>
  )
}
