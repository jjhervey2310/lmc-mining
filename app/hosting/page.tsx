import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Hosting Comparison 2026 — Verified Providers',
  description:
    'Compare Bitcoin mining hosting providers side by side. Real pricing, power sources, cooling types, minimum commitments, setup fees, and verification status. Abundant Mines is our top pick.',
  openGraph: {
    title: 'Bitcoin Mining Hosting Comparison | Lightning Mines',
    description: 'Verified hosting providers compared side by side. Real pricing. No fabricated numbers.',
    type: 'website',
  },
}

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

interface Provider {
  name: string
  pricePerKwh: string
  powerSource: string
  cooling: string
  minCommitment: string
  setupFee: string
  financing: string
  status: 'verified' | 'pending'
  affiliate: boolean
  notes: string
  affiliateUrl?: string
  pick?: boolean
}

const PROVIDERS: Provider[] = [
  {
    name: 'Abundant Mines',
    pricePerKwh: '$225/mo flat',
    powerSource: 'Grid (US)',
    cooling: 'Air',
    minCommitment: '1 machine',
    setupFee: '$500 deposit',
    financing: 'No',
    status: 'verified',
    affiliate: true,
    affiliateUrl: 'https://abundantmines.com',
    notes: 'Flat monthly fee per machine — no per-kWh billing surprises. US-based air-cooled facility. $500 refundable deposit.',
    pick: true,
  },
  {
    name: 'Compass Mining',
    pricePerKwh: 'Varies by site',
    powerSource: 'Mixed (US/intl)',
    cooling: 'Air / Immersion',
    minCommitment: '1 machine',
    setupFee: 'Varies',
    financing: 'Yes',
    status: 'pending',
    affiliate: false,
    notes: 'Large marketplace model across many facilities. Pricing and terms vary significantly by site. Verify your specific facility contract carefully.',
  },
  {
    name: 'Luxor Mining',
    pricePerKwh: 'Varies',
    powerSource: 'Mixed',
    cooling: 'Air',
    minCommitment: 'Varies',
    setupFee: 'Varies',
    financing: 'No',
    status: 'pending',
    affiliate: false,
    notes: 'Known primarily for their Hashrate Index data and pool. Hosting availability and terms require direct inquiry.',
  },
  {
    name: 'Core Scientific',
    pricePerKwh: 'Custom quote',
    powerSource: 'Grid (US)',
    cooling: 'Air',
    minCommitment: 'Large scale',
    setupFee: 'Custom',
    financing: 'Yes',
    status: 'pending',
    affiliate: false,
    notes: 'Institutional-scale hosting. Primarily targets large fleet operators. Not practical for retail miners with fewer than 50+ machines.',
  },
  {
    name: 'Mawson Infrastructure',
    pricePerKwh: 'Custom quote',
    powerSource: 'Mixed (US/AU)',
    cooling: 'Air',
    minCommitment: 'Varies',
    setupFee: 'Varies',
    financing: 'No',
    status: 'pending',
    affiliate: false,
    notes: 'Publicly traded hosting company. US and Australia facilities. Primarily institutional. Verify terms directly before committing.',
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'What should I look for in a Bitcoin mining hosting provider?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Key factors: total effective cost (per-kWh vs flat fee), power source reliability, uptime guarantees with SLA, contract length and exit clauses, setup fees and deposits, cooling type compatibility with your hardware, and the provider\'s verifiable track record. Always get all terms in writing before committing.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does "Pending Verification" mean on this page?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Lightning Mines only marks providers "Verified" after direct confirmation of pricing, terms, and facility details. "Pending Verification" means we have not independently confirmed the provider\'s current terms. Always verify directly with the provider before committing capital.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is per-kWh or flat monthly hosting better?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Flat monthly fee hosting (like Abundant Mines at $225/month) is generally preferable for budgeting because your cost is fixed regardless of your miner\'s power draw. Per-kWh billing is variable and can be harder to model accurately in advance.',
      },
    },
  ],
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'Hosting', item: 'https://lightningmines.com/hosting' },
  ],
}

export default function HostingPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>Hosting</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Bitcoin Mining Hosting Comparison
        </h1>
        <p className="text-gray-400 max-w-2xl mb-4">
          Compare verified Bitcoin mining hosting providers side by side. Real pricing, power sources,
          cooling types, minimums, and setup fees — no fabricated numbers.
        </p>
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(247,147,26,0.1)', color: ORANGE, border: '1px solid rgba(247,147,26,0.2)' }}
        >
          ⚠️ Providers marked "Pending Verification" have not been independently confirmed. Verify all terms directly before committing capital.
        </div>
      </div>

      {/* Top Pick highlight */}
      <div className="mb-6 rounded-2xl p-6" style={{ background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.2)' }}>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <div
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2"
              style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE, border: '1px solid rgba(247,147,26,0.3)' }}
            >
              ⚡ OUR #1 PICK
            </div>
            <h2 className="text-white text-xl font-bold">Abundant Mines</h2>
            <p className="text-gray-400 text-sm mt-1">
              Verified · US-based · Air-cooled · $225/month flat fee · $500 deposit
            </p>
            <p className="text-xs text-gray-600 mt-2">
              Affiliate disclosure: Lightning Mines earns a commission when you sign up through our link.
              This does not affect our recommendation.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <a
              href="https://abundantmines.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-bold px-6 py-3 rounded-xl text-center"
              style={{ background: ORANGE, color: '#000' }}
            >
              Visit Abundant Mines ↗
            </a>
            <Link
              href="/calculator"
              className="text-xs text-center py-2 rounded-lg"
              style={{ color: ORANGE }}
            >
              Calculate ROI with this price →
            </Link>
          </div>
        </div>
      </div>

      {/* Table — desktop */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['Provider', 'Price', 'Power Source', 'Cooling', 'Min. Commitment', 'Setup Fee', 'Financing', 'Status', 'Affiliate'].map(h => (
                <th key={h} className="text-left text-xs text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PROVIDERS.map((p, i) => (
              <tr
                key={p.name}
                style={{
                  borderBottom: `1px solid ${BORDER}`,
                  background: p.pick ? 'rgba(247,147,26,0.04)' : 'transparent',
                }}
              >
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    {p.pick && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE }}>
                        #1
                      </span>
                    )}
                    <span className="text-white font-semibold">{p.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 max-w-xs">{p.notes}</div>
                </td>
                <td className="py-4 pr-4 text-gray-300 whitespace-nowrap font-mono text-xs">{p.pricePerKwh}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{p.powerSource}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{p.cooling}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{p.minCommitment}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{p.setupFee}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{p.financing}</td>
                <td className="py-4 pr-4 text-xs whitespace-nowrap">
                  {p.status === 'verified' ? (
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa' }}>
                      ✓ Verified
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(107,114,128,0.15)', color: '#6b7280' }}>
                      Pending Verification
                    </span>
                  )}
                </td>
                <td className="py-4 pr-4 text-xs">
                  {p.affiliate ? (
                    <span style={{ color: ORANGE }}>Yes ↗</span>
                  ) : (
                    <span className="text-gray-600">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cards — mobile */}
      <div className="md:hidden space-y-4">
        {PROVIDERS.map(p => (
          <div key={p.name} className="rounded-xl p-5" style={{ background: CARD_BG, border: p.pick ? `1px solid rgba(247,147,26,0.3)` : `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {p.pick && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE }}>
                      #1
                    </span>
                  )}
                  <span className="text-white font-semibold">{p.name}</span>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={p.status === 'verified'
                    ? { background: 'rgba(0,212,170,0.15)', color: '#00d4aa' }
                    : { background: 'rgba(107,114,128,0.15)', color: '#6b7280' }}
                >
                  {p.status === 'verified' ? '✓ Verified' : 'Pending Verification'}
                </span>
              </div>
              {p.affiliate && p.affiliateUrl && (
                <a href={p.affiliateUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: ORANGE, color: '#000' }}>
                  Visit ↗
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div><span className="text-gray-500">Price: </span><span className="text-gray-300">{p.pricePerKwh}</span></div>
              <div><span className="text-gray-500">Cooling: </span><span className="text-gray-300">{p.cooling}</span></div>
              <div><span className="text-gray-500">Min: </span><span className="text-gray-300">{p.minCommitment}</span></div>
              <div><span className="text-gray-500">Setup: </span><span className="text-gray-300">{p.setupFee}</span></div>
            </div>
            <p className="text-xs text-gray-500">{p.notes}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="mt-12 rounded-2xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-lg font-bold text-white mb-2">Not sure which provider is right for you?</h2>
        <p className="text-gray-500 text-sm mb-5">Submit your setup for a free deal review and we will recommend the best fit.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/review" className="text-sm font-bold px-6 py-3 rounded-lg" style={{ background: ORANGE, color: '#000' }}>
            Get a Free Deal Review →
          </Link>
          <Link href="/calculator" className="text-sm font-semibold px-6 py-3 rounded-lg border text-gray-300 hover:text-white transition-colors" style={{ borderColor: BORDER }}>
            Run ROI with These Prices →
          </Link>
        </div>
      </div>

      {/* FAQ */}
      <div className="mt-12">
        <h2 className="text-xl font-bold text-white mb-6">Hosting FAQ</h2>
        <div className="space-y-4">
          {faqSchema.mainEntity.map((faq, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <h3 className="text-white font-semibold text-sm mb-2">{faq.name}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{faq.acceptedAnswer.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* University link */}
      <div className="mt-8 text-center">
        <p className="text-gray-500 text-sm">
          Learn more:{' '}
          <Link href="/university/bitcoin-mining-hosting-red-flags" className="hover:text-white transition-colors" style={{ color: ORANGE }}>
            Bitcoin Mining Hosting Red Flags
          </Link>
          {' · '}
          <Link href="/university/hosted-bitcoin-mining-explained" className="hover:text-white transition-colors" style={{ color: ORANGE }}>
            Hosted Mining Explained
          </Link>
        </p>
      </div>
    </div>
  )
}
