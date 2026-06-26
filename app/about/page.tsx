import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'About Lightning Mines — Mission, Affiliate Transparency, Data Policy',
  description:
    'Lightning Mines helps people avoid bad Bitcoin mining deals. Independent analysis, affiliate transparency, and a strict no-fabricated-data policy.',
  openGraph: {
    title: 'About Lightning Mines',
    description: 'Our mission, affiliate disclosure, and data policy.',
    type: 'website',
  },
}

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Lightning Mines',
  description: 'Independent Bitcoin mining profitability analysis, hosting comparisons, and deal review.',
  url: 'https://lightningmines.com',
  founder: { '@type': 'Person', name: 'Jacob H.' },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'About', item: 'https://lightningmines.com/about' },
  ],
}

export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>About</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">About Lightning Mines</h1>
      <p className="text-gray-400 text-lg mb-10 leading-relaxed">
        Bitcoin mining profitability, hosting and hardware made simple. Independent analysis you can trust.
      </p>

      {/* Mission */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-xl mb-4">Our Mission</h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          The Bitcoin mining information landscape is dominated by manufacturers selling hardware, hosting companies
          selling capacity, and review sites that collect affiliate fees while claiming independence.
          The retail miner has no neutral source of truth.
        </p>
        <p className="text-gray-400 mb-4 leading-relaxed">
          Lightning Mines exists to fix that. We provide honest ROI analysis, verified hosting comparisons,
          and free deal reviews — with full transparency about where we earn commissions and a strict
          policy against publishing numbers we cannot verify.
        </p>
        <p className="text-gray-400 leading-relaxed">
          We use every tool on this site for our own mining operation. That is the standard we hold our
          content to: would we stake our own capital on this analysis?
        </p>
      </div>

      {/* Affiliate Transparency */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-xl mb-4">Affiliate Transparency</h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          Lightning Mines earns commissions from affiliate relationships. We believe in complete transparency
          about how we make money, because it directly affects how much you can trust our recommendations.
        </p>
        <div className="space-y-3">
          {[
            {
              name: 'Abundant Mines',
              rel: 'Affiliate hosting partner',
              note: 'We earn a commission when miners sign up through our link. We recommend Abundant Mines because we have verified their pricing and facility, not because of the commission.',
            },
            {
              name: 'Kraken Exchange',
              rel: 'Affiliate exchange partner',
              note: 'We earn a commission when users sign up through our link at invite.kraken.com/JDNW/3cpjgj5j.',
            },
            {
              name: 'Koinly',
              rel: 'Affiliate software partner',
              note: 'We earn a commission when users sign up through our link at koinly.io/?via=2AB53CDA.',
            },
          ].map(a => (
            <div key={a.name} className="rounded-xl p-4" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-white font-semibold text-sm">{a.name}</span>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE }}
                >
                  {a.rel}
                </span>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">{a.note}</p>
            </div>
          ))}
        </div>
        <p className="text-gray-500 text-sm mt-4">
          Affiliate commissions fund this site. They do not determine our recommendations or rankings.
          Providers and products we do not affiliate with appear on this site where they provide genuine
          value to miners.
        </p>
      </div>

      {/* No Fabricated Data Policy */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-xl mb-4">No Fabricated Data Policy</h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          Lightning Mines publishes only data we can verify. Specifically:
        </p>
        <ul className="space-y-2 text-sm text-gray-400">
          {[
            'Hardware specs (hashrate, power, efficiency) come from manufacturer datasheets or direct testing.',
            'Hosting pricing is only marked "Verified" after direct confirmation. Unverified providers are clearly labelled.',
            'Our ROI calculator uses live BTC price and publicly available network data. We do not project future BTC prices.',
            'University articles contain educational analysis only. We do not publish future price predictions or guaranteed returns.',
            'We do not fabricate uptime statistics, testimonials, or profitability claims.',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span style={{ color: '#00d4aa' }} className="shrink-0 mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Educational Purpose */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-xl mb-4">Educational Purpose</h2>
        <p className="text-gray-400 mb-3 leading-relaxed">
          Everything on Lightning Mines — calculators, articles, comparisons, deal reviews — is educational
          in nature and intended to help miners make more informed decisions.
        </p>
        <p className="text-gray-400 leading-relaxed">
          Nothing on this site constitutes financial, legal, or tax advice. Mining profitability is subject
          to continuous change. Always conduct your own due diligence and consult qualified professionals
          before making investment decisions.
        </p>
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
        <Link href="/calculator" className="rounded-xl p-5 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="text-xl mb-2">🧮</div>
          <div className="font-semibold text-white mb-1">ROI Calculator</div>
          <div className="text-xs text-gray-500">Free. Live BTC price. No sign-up.</div>
        </Link>
        <Link href="/review" className="rounded-xl p-5 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="text-xl mb-2">🔍</div>
          <div className="font-semibold text-white mb-1">Free Deal Review</div>
          <div className="text-xs text-gray-500">Submit your deal. Get a verdict within 48hr.</div>
        </Link>
      </div>
    </div>
  )
}
