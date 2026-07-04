import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { PROVIDERS_DATA } from '@/lib/data'
import type { HostingProvider } from '@/lib/types'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'
import MethodologyCallout from '@/components/MethodologyCallout'

export const metadata: Metadata = {
  alternates: { canonical: '/hosting' },
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

function priceLabel(p: HostingProvider): string {
  if (p.billingType === 'flat' && p.flatMonthly !== null) {
    return `$${p.flatMonthly}/mo flat`
  }
  if (p.billingType === 'kwh' && p.rateMin !== null) {
    if (p.rateMax !== null && p.rateMax !== p.rateMin) {
      return `$${p.rateMin}–$${p.rateMax}/kWh`
    }
    return `$${p.rateMin}/kWh`
  }
  return 'Contact for pricing'
}

function coolingLabel(p: HostingProvider): string {
  return p.cooling.map(c => c[0].toUpperCase() + c.slice(1)).join(' + ')
}

function minLabel(p: HostingProvider): string {
  if (p.minMachines === null) return 'Contact'
  return `${p.minMachines} machine${p.minMachines !== 1 ? 's' : ''}`
}

const activeProviders = PROVIDERS_DATA.filter(p => p.listingStatus === 'active')
const pricedProviders = activeProviders.filter(p => p.rateMin !== null || p.flatMonthly !== null)
const quoteProviders = activeProviders.filter(p => p.rateMin === null && p.flatMonthly === null)

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
  const topPick = pricedProviders.find(p => p.tier === 1)

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Bitcoin Mining Hosting Providers 2026',
    description: 'Verified Bitcoin mining hosting providers compared by price, location, and cooling type',
    numberOfItems: activeProviders.length,
    itemListElement: activeProviders.map((p, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: p.name,
      url: `https://lightningmines.com/hosts/${p.id}`,
    })),
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />

      {/* Full-width hero banner */}
      <div className="relative h-56 sm:h-80 overflow-hidden">
        <Image
          src="/hosting-hero.jpg"
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

      <MethodologyCallout context="hosting" />
      <AffiliateDisclosure />

      {/* Verification notice */}
      <div className="mb-8 mt-4">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(247,147,26,0.1)', color: ORANGE, border: '1px solid rgba(247,147,26,0.2)' }}
        >
          ⚠️ Providers marked &quot;Verify Direct&quot; have not been independently confirmed. Contact each provider to confirm current pricing and terms before committing capital.
        </div>
      </div>

      {/* Top Pick highlight */}
      {topPick && (
        <div className="mb-6 rounded-2xl p-6" style={{ background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.2)' }}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <div
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-2"
                style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE, border: '1px solid rgba(247,147,26,0.3)' }}
              >
                ⚡ OUR #1 PICK
              </div>
              <h2 className="text-white text-xl font-bold">{topPick.name}</h2>
              <p className="text-gray-400 text-sm mt-1">
                Verified · {topPick.facilityLocations.join(', ')} · {coolingLabel(topPick)}-cooled · {priceLabel(topPick)}{topPick.setupFee ? ` · $${topPick.setupFee} deposit` : ''}
              </p>
              {topPick.affiliateProgram && (
                <p className="text-xs text-gray-600 mt-2">
                  Affiliate disclosure: Lightning Mines earns a commission when you sign up through our link.
                  This does not affect our recommendation.
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <a
                href={topPick.affiliateLink || topPick.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold px-6 py-3 rounded-xl text-center"
                style={{ background: ORANGE, color: '#000' }}
              >
                Visit {topPick.name} ↗
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
      )}

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
            {pricedProviders.map((p) => (
              <tr
                key={p.id}
                style={{
                  borderBottom: `1px solid ${BORDER}`,
                  background: p.tier === 1 ? 'rgba(247,147,26,0.04)' : 'transparent',
                }}
              >
                <td className="py-4 pr-4">
                  <div className="flex items-center gap-2">
                    {p.tier === 1 && (
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE }}>
                        #1
                      </span>
                    )}
                    <span className="text-white font-semibold">{p.name}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5 max-w-xs">{p.bestFor}</div>
                </td>
                <td className="py-4 pr-4 text-gray-300 whitespace-nowrap font-mono text-xs">{priceLabel(p)}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs whitespace-nowrap">{p.facilityLocations.join(', ')}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{coolingLabel(p)}</td>
                <td className="py-4 pr-4 text-gray-400 text-xs">{minLabel(p)}</td>
                <td className="py-4 pr-4 text-xs whitespace-nowrap">
                  {p.verificationStatus === 'verified' ? (
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
                  {p.affiliateProgram && p.affiliateLink ? (
                    <a href={p.affiliateLink} target="_blank" rel="noopener noreferrer" style={{ color: ORANGE }}>
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
        {pricedProviders.map(p => (
          <div key={p.id} className="rounded-xl p-5" style={{ background: CARD_BG, border: p.tier === 1 ? `1px solid rgba(247,147,26,0.3)` : `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  {p.tier === 1 && (
                    <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE }}>
                      #1
                    </span>
                  )}
                  <span className="text-white font-semibold">{p.name}</span>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={p.verificationStatus === 'verified'
                    ? { background: 'rgba(0,212,170,0.15)', color: '#00d4aa' }
                    : { background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}
                >
                  {p.verificationStatus === 'verified' ? '✓ Verified' : 'Verify Direct'}
                </span>
              </div>
              {p.affiliateProgram && p.affiliateLink && (
                <a href={p.affiliateLink} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{ background: ORANGE, color: '#000' }}>
                  Visit ↗
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs mb-3">
              <div><span className="text-gray-500">Rate: </span><span className="text-gray-300 font-mono">{priceLabel(p)}</span></div>
              <div><span className="text-gray-500">Cooling: </span><span className="text-gray-300">{coolingLabel(p)}</span></div>
              <div><span className="text-gray-500">Location: </span><span className="text-gray-300">{p.facilityLocations.join(', ')}</span></div>
              <div><span className="text-gray-500">Min: </span><span className="text-gray-300">{minLabel(p)}</span></div>
            </div>
            <p className="text-xs text-gray-500">{p.bestFor}</p>
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
          {quoteProviders.map(p => (
            <div key={p.id} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="text-white font-semibold text-sm mb-1">{p.name}</div>
              <div className="flex gap-3 text-xs text-gray-500 mb-2">
                <span>{p.facilityLocations.join(', ')}</span>
                <span>·</span>
                <span>{coolingLabel(p)}</span>
              </div>
              <p className="text-xs text-gray-400 mb-3">{p.bestFor}</p>
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
