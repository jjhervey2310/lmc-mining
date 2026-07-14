import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProviderBySlug, PROVIDERS_DATA, MINERS_DATA } from '@/lib/data'
import type { Metadata } from 'next'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'

export async function generateStaticParams() {
  return PROVIDERS_DATA.map(p => ({ slug: p.id }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = getProviderBySlug(slug)
  if (!p) return { title: 'Provider Not Found' }
  const pageTitle = `${p.name} Review 2026 — Bitcoin Mining Hosting`
  return {
    title: pageTitle,
    description: `${p.name} hosting review: pricing, locations, cooling types, contracts, and independent ratings. Is ${p.name} right for your mining operation?`,
    alternates: { canonical: `/hosts/${slug}` },
    openGraph: {
      images: [{ url: `/api/og?title=${encodeURIComponent(pageTitle)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      images: [`/api/og?title=${encodeURIComponent(pageTitle)}`],
    },
  }
}

function priceLabel(p: ReturnType<typeof getProviderBySlug>): string {
  if (!p) return '—'
  if (p.flatMonthly) return `$${p.flatMonthly}/month flat all-in`
  if (p.rateMin && p.rateMax && p.rateMin !== p.rateMax) return `$${p.rateMin}–$${p.rateMax}/kWh`
  if (p.rateMin) return `$${p.rateMin}/kWh`
  return 'Contact required'
}

export default async function HostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = getProviderBySlug(slug)
  if (!p) notFound()

  const compatibleMiners = MINERS_DATA.filter(m =>
    m.is_active && p.cooling.includes(m.cooling_type)
  ).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6)

  const faqs = [
    {
      q: `Is ${p.name} reliable for Bitcoin mining hosting?`,
      a: `${p.name} has a verification status of "${p.verificationStatus}" with a Lightning Score of ${p.lightningScore}/100. ${p.uptimePercent ? `They target ${p.uptimePercent}% uptime.` : ''} ${p.description}`,
    },
    {
      q: `How much does ${p.name} charge for hosting?`,
      a: p.flatMonthly
        ? `${p.name} charges a flat $${p.flatMonthly}/month per air-cooled miner. This all-inclusive rate covers electricity, cooling, maintenance, insurance, and internet. ${p.setupFee ? `A $${p.setupFee.toLocaleString()} deposit is required to start.` : ''}`
        : p.rateMin
        ? `${p.name} charges approximately $${p.rateMin}/kWh${p.rateMax && p.rateMax !== p.rateMin ? `–$${p.rateMax}/kWh` : ''} for electricity. Your monthly cost depends on your miner's power consumption. Contact ${p.name} directly to confirm current pricing.`
        : `${p.name} requires direct contact for pricing. Rates are typically negotiated based on fleet size and contract length.`,
    },
    {
      q: `What miners does ${p.name} support?`,
      a: `${p.name} supports ${p.cooling.join(' and ')} cooled miners. Compatible models include ${compatibleMiners.slice(0, 4).map(m => m.name).join(', ')}${compatibleMiners.length > 4 ? ', and others' : ''}.`,
    },
    {
      q: `Does ${p.name} offer financing?`,
      a: p.financingAvailable
        ? `Yes, ${p.name} offers financing options. Contact them directly for current terms.`
        : `${p.name} does not currently list financing options. Consider Abundant Mines if financing is important — they offer up to $140k at 10% APR over 36 months.`,
    },
  ]

  const isAbundant = p.id === 'abundant-miners'

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        {
          '@context': 'https://schema.org', '@type': 'LocalBusiness',
          name: p.name,
          url: p.website,
          description: p.description,
        },
        {
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        },
        {
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lightningmines.com' },
            { '@type': 'ListItem', position: 2, name: 'Hosting Providers', item: 'https://www.lightningmines.com/hosts' },
            { '@type': 'ListItem', position: 3, name: p.name },
          ],
        },
      ]) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / <Link href="/hosts" className="hover:text-white">Hosting</Link> / {p.name}
      </div>

      {p.affiliateLink && <AffiliateDisclosure />}

      {/* Hero */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          {p.tier === 1 && (
            <div className="text-xs font-semibold mb-2 px-2 py-1 rounded inline-block" style={{ background: '#00d4aa20', color: '#00d4aa' }}>
              #1 RATED HOSTING PROVIDER
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{p.name}</h1>
          <div className="flex flex-wrap gap-2 items-center">
            {p.cooling.map(c => (
              <span key={c} className="text-xs px-2.5 py-1 rounded-full capitalize" style={{ background: '#1f2937', color: '#9ca3af' }}>{c} cooling</span>
            ))}
            {p.verificationStatus === 'verified' && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#f7931a15', color: '#f7931a' }}>ⓘ Listed — verify direct</span>}
            {p.verificationStatus === 'pending' && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>⏳ Pending</span>}
            {p.verificationStatus === 'contact_only' && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: 'rgba(96,165,250,0.15)', color: '#60a5fa' }}>✉ Contact for Pricing</span>}
            <Link href="/how-we-verify" className="text-xs hover:text-white transition-colors" style={{ color: '#6b7280' }}>
              What does this mean?
            </Link>
          </div>
        </div>
        {p.website && (
          <a href={p.affiliateLink ?? p.website} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold px-6 py-3 rounded-xl"
            style={{ background: '#00d4aa', color: '#0a0e17' }}>
            {p.tier === 1 ? 'Get Started with Abundant Mines →' : `Visit ${p.name} →`}
          </a>
        )}
      </div>

      {/* Lightning Score bar */}
      <div className="flex items-center gap-4 mb-8 p-4 rounded-xl" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="text-2xl font-bold text-white">{p.lightningScore}<span className="text-sm text-gray-500">/100</span></div>
        <div className="flex-1">
          <div className="text-xs text-gray-500 mb-1">Lightning Score</div>
          <div className="h-2 rounded-full" style={{ background: '#1f2937' }}>
            <div className="h-2 rounded-full transition-all" style={{ width: `${p.lightningScore}%`, background: p.lightningScore >= 80 ? '#00d4aa' : p.lightningScore >= 60 ? '#f59e0b' : '#ff4757' }} />
          </div>
        </div>
        <div className="text-xs text-gray-500 text-right">
          <div>Reviewed {p.lastVerified ? new Date(p.lastVerified).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : ''}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* Description */}
          {p.description && (
            <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h2 className="text-lg font-semibold text-white mb-3">About {p.name}</h2>
              <p className="text-gray-300">{p.description}</p>
            </section>
          )}

          {/* Full specs */}
          <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h2 className="text-lg font-semibold text-white mb-4">Hosting Details</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-800">
                {[
                  ['Pricing Model', priceLabel(p)],
                  ['Billing Type', p.billingType === 'flat' ? 'Flat monthly' : p.billingType === 'kwh' ? 'Per kWh' : 'Revenue share'],
                  ['Locations', p.facilityLocations.join(', ') || '—'],
                  ['Country', p.country],
                  ['Power Source', p.powerSource],
                  ['Cooling Supported', p.cooling.join(', ')],
                  ['Contract Length', p.contractLength],
                  ['Min. Machines', p.minMachines ?? '—'],
                  ['Setup Fee', p.setupFee ? `$${p.setupFee.toLocaleString()}` : '—'],
                  ['Insurance Included', p.insuranceAvailable ? 'Yes' : 'No'],
                  ['Pool Options', p.poolOptions.join(', ') || '—'],
                  ['Financing Available', p.financingAvailable ? 'Yes' : 'No'],
                  ['KYC Required', p.kycRequired ? 'Yes' : 'No'],
                  ['Uptime', p.uptimePercent ? `${p.uptimePercent}%` : '—'],
                  ['Hidden Fees', p.hiddenFees ?? 'None noted'],
                  ['Repair Policy', p.repairPolicy],
                  ['Verification', p.verificationStatus === 'verified' ? 'Listed — verify direct' : p.verificationStatus === 'contact_only' ? '✉ Contact for Pricing' : '⚠ Pending'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-2.5 pr-4 text-gray-500 w-44">{k}</td>
                    <td className="py-2.5 text-white">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Abundant Mines specific section */}
          {isAbundant && (
            <section className="rounded-2xl p-6" style={{ background: '#00d4aa10', border: '1px solid #00d4aa30' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Why Abundant Mines is Rated #1</h2>
              <div className="space-y-4 text-sm text-gray-300">
                <div>
                  <h3 className="font-medium text-white mb-1">The $225/Month Flat Fee — What It Includes</h3>
                  <p>Abundant Mines charges a flat $225/month per air-cooled miner. This covers electricity (no matter how much your miner draws), cooling infrastructure, routine maintenance, insurance on your equipment, and internet connectivity. No surprise bills, no electricity rate fluctuations.</p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">The $500 Deposit Structure</h3>
                  <p>A $500 deposit is required to start. This deposit covers months 11 and 12 of your 12-month contract — essentially a security deposit that comes back to you as prepaid hosting at the end of your first year. It is not a fee you lose.</p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">Financing Up to $140,000</h3>
                  <p>Abundant Mines offers vendor financing for hardware purchases up to $140,000 at 10% APR over 36 months with 10% down. This allows operators to deploy at scale without full upfront capital.</p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">Hydro & Immersion Timeline (~2027)</h3>
                  <p>Abundant Mines is currently air-cooled only. Hydro cooling infrastructure is in development targeting approximately 2027.</p>
                </div>
              </div>
            </section>
          )}

          {/* Pros and cons */}
          {(p.pros.length > 0 || p.cons.length > 0) && (
            <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Pros & Cons</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {p.pros.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#00d4aa' }}>Pros</h3>
                    <ul className="space-y-2">
                      {p.pros.map((pro, i) => <li key={i} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#00d4aa' }}>+</span>{pro}</li>)}
                    </ul>
                  </div>
                )}
                {p.cons.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#ff4757' }}>Cons</h3>
                    <ul className="space-y-2">
                      {p.cons.map((con, i) => <li key={i} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#ff4757' }}>−</span>{con}</li>)}
                    </ul>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Compatible miners */}
          {compatibleMiners.length > 0 && (
            <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Compatible Miners</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {compatibleMiners.map(m => (
                  <Link key={m.slug} href={`/miners/${m.slug}`} className="flex items-center justify-between p-3 rounded-xl hover:border-[#00d4aa] transition-colors" style={{ background: '#0a0e17', border: '1px solid #1f2937' }}>
                    <div>
                      <div className="text-sm text-white">{m.name}</div>
                      <div className="text-xs text-gray-500">{(m.efficiency_j_per_th ?? m.power_watts / m.default_hashrate_th).toFixed(1)} J/TH · {m.default_hashrate_th} TH/s</div>
                    </div>
                    {m.rating && <span className="text-xs text-gray-500">{m.rating}/10</span>}
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* FAQ */}
          <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h2 className="text-lg font-semibold text-white mb-4">FAQ</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="border-b border-gray-800 pb-4 last:border-0 last:pb-0">
                  <h3 className="text-sm font-medium text-white mb-2">{faq.q}</h3>
                  <p className="text-sm text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl p-5" style={{ background: p.tier === 1 ? '#00d4aa15' : '#111827', border: `1px solid ${p.tier === 1 ? '#00d4aa30' : '#1f2937'}` }}>
            <h3 className="font-semibold text-white mb-3">Get Started</h3>
            <div className="space-y-2 text-sm mb-4">
              {[
                p.flatMonthly && `$${p.flatMonthly}/month flat rate`,
                p.rateMin && `$${p.rateMin}/kWh electricity`,
                p.setupFee && `$${p.setupFee.toLocaleString()} deposit to start`,
                p.insuranceAvailable && 'Equipment insurance included',
                p.financingAvailable && 'Financing available',
              ].filter(Boolean).map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-300">
                  <span style={{ color: '#00d4aa' }}>✓</span> {item}
                </div>
              ))}
            </div>
            {p.website && (
              <a href={p.affiliateLink ?? p.website} target="_blank" rel="noopener noreferrer"
                className="block text-center text-sm font-semibold py-2.5 rounded-lg"
                style={{ background: '#00d4aa', color: '#0a0e17' }}>
                {p.tier === 1 ? 'Get Started with Abundant Mines →' : `Visit ${p.name} →`}
              </a>
            )}
            {p.affiliateProgram && (
              <p className="text-xs text-gray-500 mt-2 text-center">Affiliate link — we earn a commission at no cost to you</p>
            )}
          </div>

          <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h3 className="font-semibold text-white mb-2">Not sure this is right for you?</h3>
            <p className="text-sm text-gray-400 mb-3">Answer 3 questions and we&apos;ll find the best hosting match for your miner and budget.</p>
            <Link href="/hosting-match" className="block text-center text-sm py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-[#00d4aa] hover:text-white transition-colors">
              Get Free Hosting Match →
            </Link>
          </div>

          <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h3 className="font-semibold text-white mb-2">Reviewing a deal?</h3>
            <p className="text-sm text-gray-400 mb-3">Score your deal instantly — hardware price, this hosting rate, and full ROI analysis.</p>
            <Link href="/deal-analyzer" className="block text-center text-sm py-2 rounded-lg border border-gray-600 text-gray-300 hover:border-[#00d4aa] hover:text-white transition-colors">
              Analyze My Deal →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
