import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'

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
  rate: string
  location: string
  cooling: string
  minCommitment: string
  status: 'verified' | 'pending'
  affiliate: boolean
  notes: string
  affiliateUrl?: string
  pick?: boolean
}

interface QuoteProvider {
  name: string
  location: string
  cooling: string
  notes: string
}

// Providers with known all-in rates — suitable for ROI modelling
const PRICED_PROVIDERS: Provider[] = [
  {
    name: 'Abundant Mines',
    rate: '$225/mo flat',
    location: 'US',
    cooling: 'Air',
    minCommitment: '1 machine',
    status: 'verified',
    affiliate: true,
    affiliateUrl: 'https://abundantmines.com/ref/72/',
    notes: 'Flat $225/month all-inclusive — electricity, cooling, maintenance, insurance, internet. No surprise bills. 12-month rate lock.',
    pick: true,
  },
  {
    name: 'Simple Mining',
    rate: '$0.075/kWh',
    location: 'Iowa',
    cooling: 'Air + Hydro',
    minCommitment: '1 machine',
    status: 'verified',
    affiliate: false,
    notes: 'Iowa facility with air and hydro cooling. $0.075/kWh all-in rate — one of the few mid-market providers supporting both cooling types.',
  },
  {
    name: 'EZ Blockchain',
    rate: '$0.07/kWh',
    location: 'TX / WY / NE',
    cooling: 'Air',
    minCommitment: 'Contact',
    status: 'verified',
    affiliate: false,
    notes: '$0.07/kWh all-in across Texas, Wyoming, and Nebraska facilities. Natural gas and grid power. Air cooling only.',
  },
  {
    name: 'Sazmining',
    rate: '~$0.048/kWh',
    location: 'Paraguay',
    cooling: 'Air',
    minCommitment: '1 machine',
    status: 'verified',
    affiliate: false,
    notes: 'Lowest published rate available to retail miners using Paraguayan hydroelectric power. International — weigh jurisdictional risk against cost savings.',
  },
]

// Providers requiring a custom quote — not suitable for direct ROI modelling
const QUOTE_PROVIDERS: QuoteProvider[] = [
  {
    name: 'Compass Mining',
    location: 'Multi-site US',
    cooling: 'Air / Immersion',
    notes: 'Large US marketplace with many facility options. Pricing and terms vary by site — request quote for your specific facility.',
  },
  {
    name: 'Blockware Solutions',
    location: 'US',
    cooling: 'Air',
    notes: 'Hardware + hosting bundles. Known for mining intelligence research. Custom pricing — contact for current rates.',
  },
  {
    name: 'Hut 8',
    location: '15 US sites',
    cooling: 'Air / Immersion',
    notes: 'Publicly traded (NASDAQ: HUT) with 15 US locations. Institutional minimums apply. Best for large fleet operators.',
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
      name: 'What does "Verify Direct" mean on this page?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Lightning Mines only marks providers "Verified" after direct confirmation of pricing, terms, and facility details. "Verify Direct" means we have not independently confirmed the provider\'s current terms. Contact this provider directly to confirm current pricing and terms before committing capital.',
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
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Full-width hero banner */}
      <div className="relative h-56 sm:h-80 overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1639762681057-408b52e7a954?w=1920&q=80"
          alt="Bitcoin mining rigs in server racks"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        <div className="absolute inset-0" style={{ background: 'rgba(10,10,10,0.68)' }} />
        <div className="absolute inset-0 flex flex-col justify-center px-6 sm:px-10 max-w-6xl mx-auto left-0 right-0">
          <div className="text-xs text-gray-500 mb-4">
            <Link href="/" className="hover:text-white transition-colors">Home</Link>
            <span className="mx-2">/</span>
            <span>Hosting</span>
          </div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
            Bitcoin Mining Hosting Comparison
          </h1>
          <p className="text-sm sm:text-base max-w-xl leading-relaxed" style={{ color: 'rgba(226,232,240,0.8)' }}>
            Find the best hosted mining deal with verified pricing and honest reviews.
          </p>
        </div>
      </div>

    <div className="max-w-6xl mx-auto px-4 py-10">

      {/* Verification notice */}
      <div className="mb-8">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(247,147,26,0.1)', color: ORANGE, border: '1px solid rgba(247,147,26,0.2)' }}
        >
          ⚠️ Providers marked &quot;Verify Direct&quot; have not been independently confirmed. Contact each provider to confirm current pricing and terms before committing capital.
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

      {/* Priced providers — desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
              {['Provider', 'Rate', 'Location', 'Cooling', 'Min. Commitment', 'Status', 'Affiliate'].map(h => (
                <th key={h} className="text-left text-xs text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PRICED_PROVIDERS.map((p) => (
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
                <td className="py-4 pr-4 text-gray-300 whitespace-nowrap font-mono text-xs">{p.rate}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs whitespace-nowrap">{p.location}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{p.cooling}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{p.minCommitment}</td>
                <td className="py-4 pr-4 text-xs whitespace-nowrap">
                  {p.status === 'verified' ? (
                    <span className="px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa' }}>
                      ✓ Verified
                    </span>
                  ) : (
                    <span
                      className="px-2 py-0.5 rounded-full font-medium cursor-help"
                      style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                      title="Contact this provider directly to confirm current pricing and terms before committing capital."
                    >
                      Verify Direct
                    </span>
                  )}
                </td>
                <td className="py-4 pr-4 text-xs">
                  {p.affiliate && p.affiliateUrl ? (
                    <a href={p.affiliateUrl} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE }}>
                      Yes ↗
                    </a>
                  ) : (
                    <span className="text-gray-600">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Priced providers — mobile cards */}
      <div className="md:hidden space-y-4">
        {PRICED_PROVIDERS.map(p => (
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
                    : { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                >
                  {p.status === 'verified' ? '✓ Verified' : 'Verify Direct'}
                </span>
              </div>
              {p.affiliate && p.affiliateUrl && (
                <a href={p.affiliateUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: ORANGE, color: '#000' }}>
                  Visit ↗
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div><span className="text-gray-500">Rate: </span><span className="text-gray-300 font-mono">{p.rate}</span></div>
              <div><span className="text-gray-500">Cooling: </span><span className="text-gray-300">{p.cooling}</span></div>
              <div><span className="text-gray-500">Location: </span><span className="text-gray-300">{p.location}</span></div>
              <div><span className="text-gray-500">Min: </span><span className="text-gray-300">{p.minCommitment}</span></div>
            </div>
            <p className="text-xs text-gray-500">{p.notes}</p>
          </div>
        ))}
      </div>

      {/* Request a Quote — contact-for-pricing providers */}
      <div className="mt-10">
        <h2 className="text-base font-semibold text-white mb-1">Request a Quote</h2>
        <p className="text-xs text-gray-500 mb-4">
          These providers do not publish a rate card. Contact them directly for custom pricing — they are not included in the ROI calculator above.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {QUOTE_PROVIDERS.map(p => (
            <div key={p.name} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="text-white font-semibold text-sm mb-1">{p.name}</div>
              <div className="flex gap-3 text-xs text-gray-500 mb-2">
                <span>{p.location}</span>
                <span>·</span>
                <span>{p.cooling}</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">{p.notes}</p>
              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                Contact for Pricing
              </span>
            </div>
          ))}
        </div>
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
    </>
  )
}
