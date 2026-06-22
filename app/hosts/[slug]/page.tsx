import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getProviderBySlug, PROVIDERS_DATA, MINERS_DATA } from '@/lib/data'
import type { Metadata } from 'next'

export async function generateStaticParams() {
  return PROVIDERS_DATA.filter(p => p.slug).map(p => ({ slug: p.slug! }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const p = getProviderBySlug(slug)
  if (!p) return { title: 'Provider Not Found' }
  return {
    title: `${p.name} Review 2026 — Bitcoin Mining Hosting`,
    description: `${p.name} hosting review: pricing, locations, cooling types, contracts, and independent ratings. Is ${p.name} right for your mining operation?`,
  }
}

function CheckIcon({ yes }: { yes: boolean }) {
  return <span style={{ color: yes ? '#00d4aa' : '#ff4757' }}>{yes ? '✓' : '✗'}</span>
}

export default async function HostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const p = getProviderBySlug(slug)
  if (!p) notFound()

  const compatibleMiners = MINERS_DATA.filter(m =>
    m.is_active && p.supported_cooling?.includes(m.cooling_type)
  ).sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)).slice(0, 6)

  const faqs = [
    {
      q: `Is ${p.name} reliable for Bitcoin mining hosting?`,
      a: `${p.name} has a verification status of "${p.verification_status}" with a rating of ${p.rating ?? p.user_rating ?? 'N/A'}/5${p.review_count ? ` based on ${p.review_count} reviews` : ''}. ${p.uptime_guarantee ? `They guarantee ${p.uptime_guarantee}% uptime.` : ''} ${p.description ?? ''}`,
    },
    {
      q: `How much does ${p.name} charge for hosting?`,
      a: p.monthly_fee_air
        ? `${p.name} charges a flat $${p.monthly_fee_air}/month per machine for air-cooled miners. This all-inclusive rate covers electricity, cooling, maintenance, insurance, and internet. ${p.deposit_description ?? ''}`
        : p.electricity_rate_kwh
        ? `${p.name} charges approximately $${p.electricity_rate_kwh}/kWh for electricity. Your monthly cost depends on your miner's power consumption. Contact ${p.name} for exact current pricing.`
        : `${p.name} requires direct contact for pricing. This typically means they negotiate rates based on the scale of your deployment.`,
    },
    {
      q: `What miners does ${p.name} support?`,
      a: `${p.name} supports ${p.supported_cooling?.join(' and ')} cooled miners. Compatible models include ${compatibleMiners.slice(0, 4).map(m => m.name).join(', ')}${compatibleMiners.length > 4 ? ', and others' : ''}.`,
    },
    {
      q: `Does ${p.name} offer financing?`,
      a: p.financing_available
        ? `Yes, ${p.name} offers financing options for hardware and hosting. Contact them directly for current terms.`
        : `${p.name} does not currently list financing options. Consider Abundant Miners if financing is important — they offer up to $140k at 10% APR over 36 months.`,
    },
  ]

  const isAbundant = p.slug === 'abundant-miners'

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        {
          '@context': 'https://schema.org', '@type': 'LocalBusiness',
          name: p.name,
          url: p.website,
          description: p.description,
          aggregateRating: p.user_rating ? { '@type': 'AggregateRating', ratingValue: p.user_rating, bestRating: 5, reviewCount: p.review_count ?? 1 } : undefined,
        },
        {
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        },
        {
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lmc-mining.vercel.app' },
            { '@type': 'ListItem', position: 2, name: 'Hosting Providers', item: 'https://lmc-mining.vercel.app/hosts' },
            { '@type': 'ListItem', position: 3, name: p.name },
          ],
        },
      ]) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / <Link href="/hosts" className="hover:text-white">Hosting</Link> / {p.name}
      </div>

      {/* Hero */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
        <div>
          {p.is_primary && (
            <div className="text-xs font-semibold mb-2 px-2 py-1 rounded inline-block" style={{ background: '#00d4aa20', color: '#00d4aa' }}>
              #1 RATED HOSTING PROVIDER
            </div>
          )}
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{p.name}</h1>
          <div className="flex flex-wrap gap-2">
            {p.supported_cooling?.map(c => (
              <span key={c} className="text-xs px-2.5 py-1 rounded-full capitalize" style={{ background: '#1f2937', color: '#9ca3af' }}>{c} cooling</span>
            ))}
            {p.verification_status === 'verified' && <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#00d4aa15', color: '#00d4aa' }}>✓ Verified</span>}
          </div>
        </div>
        {p.website && (
          <a href={p.affiliate_url ?? p.website} target="_blank" rel="noopener noreferrer"
            className="text-sm font-semibold px-6 py-3 rounded-xl"
            style={{ background: '#00d4aa', color: '#0a0e17' }}>
            {p.is_primary ? 'Get Started with Abundant Miners →' : `Visit ${p.name} →`}
          </a>
        )}
      </div>

      {/* Rating bar */}
      {(p.user_rating || p.rating) && (
        <div className="flex items-center gap-3 mb-8">
          <div className="flex gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="text-xl" style={{ color: i < (p.rating ?? 0) ? '#fbbf24' : '#374151' }}>★</span>
            ))}
          </div>
          <span className="text-lg font-bold text-white">{p.user_rating ?? p.rating}/5</span>
          {p.review_count ? <span className="text-sm text-gray-500">({p.review_count} reviews)</span> : null}
        </div>
      )}

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
                  ['Pricing Model', p.monthly_fee_air ? `Flat $${p.monthly_fee_air}/month all-in` : p.electricity_rate_kwh ? `$${p.electricity_rate_kwh}/kWh` : 'Contact required'],
                  ['Locations', p.locations?.join(', ') ?? '—'],
                  ['Cooling Supported', p.supported_cooling?.join(', ') ?? '—'],
                  ['Contract Terms', p.contract_terms ?? '—'],
                  ['Min. Units', p.min_units ?? '—'],
                  ['Deposit Required', p.deposit_amount ? `$${p.deposit_amount.toLocaleString()}` : '—'],
                  ['Insurance Included', p.insurance_included ? 'Yes' : 'No'],
                  ['Pool Flexibility', p.pool_flexibility ? 'Yes — use any pool' : 'Pool may be assigned'],
                  ['Firmware Flexibility', p.firmware_flexibility ? 'Yes — custom firmware allowed' : 'Limited'],
                  ['Financing Available', p.financing_available ? 'Yes' : 'No'],
                  ['Uptime Guarantee', p.uptime_guarantee ? `${p.uptime_guarantee}%` : '—'],
                  ['Verification Status', p.verification_status === 'verified' ? '✓ Verified' : '⚠ Pending'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-2.5 pr-4 text-gray-500 w-44">{k}</td>
                    <td className="py-2.5 text-white">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Abundant Miners specific section */}
          {isAbundant && (
            <section className="rounded-2xl p-6" style={{ background: '#00d4aa10', border: '1px solid #00d4aa30' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Why Abundant Miners is Rated #1</h2>
              <div className="space-y-4 text-sm text-gray-300">
                <div>
                  <h3 className="font-medium text-white mb-1">The $225/Month Flat Fee — What It Includes</h3>
                  <p>Abundant Miners charges a flat $225/month per air-cooled miner. This covers electricity (no matter how much your miner draws), cooling infrastructure, routine maintenance, insurance on your equipment, and internet connectivity. No surprise bills, no electricity rate fluctuations.</p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">The $500 Deposit Structure</h3>
                  <p>A $500 deposit is required to start. This deposit covers months 11 and 12 of your 12-month contract — essentially a security deposit that comes back to you as prepaid hosting at the end of your first year. It is not a fee you lose.</p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">Financing Up to $140,000</h3>
                  <p>Abundant Miners offers vendor financing for hardware purchases up to $140,000 at 10% APR over 36 months with 10% down. This allows operators to deploy at scale without full upfront capital. Monthly payments are structured alongside hosting fees.</p>
                </div>
                <div>
                  <h3 className="font-medium text-white mb-1">Hydro & Immersion Timeline (2027/2028)</h3>
                  <p>Abundant Miners is currently air-cooled only. Hydro cooling infrastructure is expected in development for deployment around 2027. Immersion cooling is projected for 2028. They reference a "Sunrise Program" targeting 40% cost reduction by 2028 as cooling technology scales.</p>
                </div>
              </div>
            </section>
          )}

          {/* Pros and cons */}
          {(p.pros?.length || p.cons?.length) && (
            <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Pros & Cons</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {p.pros?.length ? (
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#00d4aa' }}>Pros</h3>
                    <ul className="space-y-2">
                      {p.pros.map((pro, i) => <li key={i} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#00d4aa' }}>+</span>{pro}</li>)}
                    </ul>
                  </div>
                ) : null}
                {p.cons?.length ? (
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#ff4757' }}>Cons</h3>
                    <ul className="space-y-2">
                      {p.cons.map((con, i) => <li key={i} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#ff4757' }}>−</span>{con}</li>)}
                    </ul>
                  </div>
                ) : null}
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
          <div className="rounded-2xl p-5" style={{ background: p.is_primary ? '#00d4aa15' : '#111827', border: `1px solid ${p.is_primary ? '#00d4aa30' : '#1f2937'}` }}>
            <h3 className="font-semibold text-white mb-3">Get Started</h3>
            <div className="space-y-2 text-sm mb-4">
              {[
                p.monthly_fee_air && `$${p.monthly_fee_air}/month flat rate`,
                p.electricity_rate_kwh && `$${p.electricity_rate_kwh}/kWh electricity`,
                p.deposit_amount && `$${p.deposit_amount.toLocaleString()} deposit to start`,
                p.insurance_included && 'Equipment insurance included',
                p.financing_available && 'Financing available',
              ].filter(Boolean).map((item, i) => (
                <div key={i} className="flex items-center gap-2 text-gray-300">
                  <span style={{ color: '#00d4aa' }}>✓</span> {item}
                </div>
              ))}
            </div>
            {p.website && (
              <a href={p.affiliate_url ?? p.website} target="_blank" rel="noopener noreferrer"
                className="block text-center text-sm font-semibold py-2.5 rounded-lg"
                style={{ background: '#00d4aa', color: '#0a0e17' }}>
                {p.is_primary ? 'Get Started with Abundant Miners →' : `Visit ${p.name} →`}
              </a>
            )}
            {p.is_primary && (
              <p className="text-xs text-gray-500 mt-2 text-center">Affiliate link — we earn a commission at no cost to you</p>
            )}
          </div>

          <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h3 className="font-semibold text-white mb-2">Not sure this is right for you?</h3>
            <p className="text-sm text-gray-400 mb-3">Answer 3 questions and we'll find the best hosting match for your miner and budget.</p>
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
