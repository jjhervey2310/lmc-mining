import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getMinerBySlug, MINERS_DATA, getCompatibleProviders, getRelatedMiners } from '@/lib/data'
import { SITE_NAME } from '@/lib/constants'
import type { Metadata } from 'next'

export async function generateStaticParams() {
  return MINERS_DATA.filter(m => m.slug).map(m => ({ slug: m.slug! }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const miner = getMinerBySlug(slug)
  if (!miner) return { title: 'Miner Not Found' }
  const eff = miner.efficiency_j_per_th ?? (miner.power_watts / miner.default_hashrate_th)
  const isS21XP = slug === 'antminer-s21-xp'
  const pageTitle = isS21XP
    ? 'Antminer S21 XP Review & Profitability 2026'
    : `${miner.name} Review & Specs 2026 — Is It Profitable?`
  return {
    title: pageTitle,
    description: `${miner.name} specs, efficiency (${eff.toFixed(1)} J/TH), hashrate (${miner.default_hashrate_th} TH/s), profitability analysis, and hosting provider recommendations. Independent review 2026.`,
    openGraph: {
      images: [{ url: `/api/og?title=${encodeURIComponent(pageTitle)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      images: [`/api/og?title=${encodeURIComponent(pageTitle)}`],
    },
  }
}

const COOLING_COLORS: Record<string, string> = { air: '#3d7aed', hydro: '#00d4aa', immersion: '#a855f7' }
const COOLING_LABELS: Record<string, string> = { air: 'Air Cooling', hydro: 'Hydro Cooling', immersion: 'Immersion Cooling' }

function formatUSD(n: number) { return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n) }

function calcDailyBTC(hashrate: number, difficulty: number) {
  return (hashrate * 1e12 * 86400 * 3.125) / (difficulty * Math.pow(2, 32))
}

export default async function MinerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const miner = getMinerBySlug(slug)
  if (!miner) notFound()

  const eff = miner.efficiency_j_per_th ?? Number((miner.power_watts / miner.default_hashrate_th).toFixed(1))
  const compatibleProviders = getCompatibleProviders(miner.cooling_type)
  const relatedMiners = getRelatedMiners(miner)

  // ROI analysis at three BTC price scenarios
  const difficulty = 113_757_508_517_000 // approximate current difficulty
  const dailyBTC = calcDailyBTC(miner.default_hashrate_th, difficulty)
  const dailyPower_kWh = (miner.power_watts / 1000) * 24
  const hostingCostPerDay = compatibleProviders[0]?.flatMonthly ? compatibleProviders[0].flatMonthly / 30 : null

  const scenarios = [
    { label: '$75k BTC', btc: 75000 },
    { label: '$100k BTC', btc: 100000 },
    { label: '$150k BTC', btc: 150000 },
  ]

  const faqs = [
    {
      q: `Is the ${miner.name} profitable in 2026?`,
      a: `Profitability depends on live BTC price and network difficulty. At $100,000 BTC the ${miner.name} generates approximately ${(dailyBTC * 100000).toFixed(2)} USD per day gross revenue at ${miner.default_hashrate_th} TH/s. With typical hosted electricity costs, net daily profit depends heavily on your hosting rate. Use our calculator above for your specific scenario.`,
    },
    {
      q: `How much does the ${miner.name} earn per day?`,
      a: `The ${miner.name} mines approximately ${dailyBTC.toFixed(8)} BTC per day at current network difficulty (~113.7 EH). At $100,000 per BTC that's roughly ${formatUSD(dailyBTC * 100000)} gross per day before electricity and hosting costs. Check the live calculator above for current BTC price.`,
    },
    {
      q: `What hosting providers support the ${miner.name}?`,
      a: `The ${miner.name} uses ${COOLING_LABELS[miner.cooling_type]}. Compatible hosting providers include ${compatibleProviders.slice(0, 3).map(p => p.name).join(', ')}. Abundant Miners is recommended for air-cooled miners at a flat $225/month all-in rate.`,
    },
    {
      q: `What is the efficiency of the ${miner.name}?`,
      a: `The ${miner.name} achieves ${eff} J/TH (joules per terahash), meaning it uses ${eff} joules of energy for every terahash of mining power. ${eff < 18 ? 'This is excellent efficiency — among the best available.' : eff < 25 ? 'This is competitive efficiency for its generation.' : 'Newer generation hardware offers better efficiency.'}`,
    },
  ]

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        {
          '@context': 'https://schema.org', '@type': 'Product',
          name: miner.name,
          description: `${miner.name} Bitcoin ASIC miner — ${miner.default_hashrate_th} TH/s, ${eff} J/TH, ${COOLING_LABELS[miner.cooling_type]}`,
          brand: { '@type': 'Brand', name: miner.manufacturer },
          offers: miner.market_price_usd ? { '@type': 'Offer', price: miner.market_price_usd, priceCurrency: 'USD', availability: 'https://schema.org/InStock' } : undefined,
          aggregateRating: miner.rating ? { '@type': 'AggregateRating', ratingValue: miner.rating, bestRating: 10, reviewCount: 1 } : undefined,
        },
        {
          '@context': 'https://schema.org', '@type': 'FAQPage',
          mainEntity: faqs.map(f => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
        },
        {
          '@context': 'https://schema.org', '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lmc-mining.vercel.app' },
            { '@type': 'ListItem', position: 2, name: 'Hardware Database', item: 'https://lmc-mining.vercel.app/miners' },
            { '@type': 'ListItem', position: 3, name: miner.name },
          ],
        },
      ]) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link>
        {' / '}
        <Link href="/miners" className="hover:text-white">Hardware Database</Link>
        {' / '}{miner.name}
      </div>

      {/* Hero */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <span className="text-xs px-2.5 py-1 rounded-full font-medium" style={{ background: COOLING_COLORS[miner.cooling_type] + '22', color: COOLING_COLORS[miner.cooling_type] }}>
            {COOLING_LABELS[miner.cooling_type]}
          </span>
          {miner.spec_confidence === 'pending_verification' && (
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#fbbf2415', color: '#fbbf24' }}>Specs Pending Verification</span>
          )}
          {miner.spec_confidence === 'verified' && (
            <span className="text-xs px-2.5 py-1 rounded-full" style={{ background: '#00d4aa15', color: '#00d4aa' }}>✓ Verified Specs</span>
          )}
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">{miner.name} Review and Specs 2026</h1>
        <p className="text-gray-400">{miner.manufacturer} · Released {miner.release_date?.slice(0, 7) ?? 'N/A'} · {miner.cooling_type.charAt(0).toUpperCase() + miner.cooling_type.slice(1)}-cooled Bitcoin ASIC</p>
      </div>

      {/* Hero stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-10">
        {[
          { label: 'Hashrate', value: `${miner.default_hashrate_th} TH/s`, highlight: true },
          { label: 'Power Draw', value: `${miner.power_watts.toLocaleString()} W` },
          { label: 'Efficiency', value: `${eff.toFixed(1)} J/TH`, highlight: eff < 18 },
          { label: 'Cooling', value: COOLING_LABELS[miner.cooling_type] },
          { label: 'Rating', value: miner.rating ? `${miner.rating}/10` : '—', highlight: (miner.rating ?? 0) >= 8 },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className="font-bold font-mono text-lg" style={{ color: s.highlight ? '#00d4aa' : '#fff' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">

          {/* Full specs table */}
          <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h2 className="text-lg font-semibold text-white mb-4">Full Specifications</h2>
            <table className="w-full text-sm">
              <tbody className="divide-y divide-gray-800">
                {[
                  ['Manufacturer', miner.manufacturer ?? '—'],
                  ['Model', miner.name],
                  ['Algorithm', 'SHA-256'],
                  ['Cooling Type', COOLING_LABELS[miner.cooling_type]],
                  ['Hashrate', `${miner.default_hashrate_th} TH/s`],
                  ['Power Consumption', `${miner.power_watts.toLocaleString()} W`],
                  ['Efficiency', `${eff.toFixed(1)} J/TH`],
                  ['Noise Level', miner.noise_db ? `${miner.noise_db} dB` : '—'],
                  ['Dimensions', miner.dimensions ?? '—'],
                  ['Weight', miner.weight_kg ? `${miner.weight_kg} kg` : '—'],
                  ['Est. Market Price', miner.market_price_usd ? formatUSD(miner.market_price_usd) : '—'],
                  ['Release Date', miner.release_date?.slice(0, 7) ?? '—'],
                  ['Spec Confidence', miner.spec_confidence === 'verified' ? '✓ Verified' : '⚠ Pending Verification'],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <td className="py-2.5 pr-4 text-gray-500 w-44">{k}</td>
                    <td className="py-2.5 text-white">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Where to Buy */}
          <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h2 className="text-lg font-semibold text-white mb-1">Where to Buy {miner.name}</h2>
            <p className="text-xs text-gray-500 mb-4">Compare prices across trusted ASIC marketplaces. Prices vary — check each source for current availability.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  name: 'Kaboomracks',
                  type: 'Used Market',
                  color: '#00d4aa',
                  desc: 'Large used ASIC inventory. Good for budget buyers.',
                  href: 'https://kaboomracks.com',
                },
                {
                  name: 'ASIC Marketplace',
                  type: 'New + Used',
                  color: '#a855f7',
                  desc: 'Curated new and refurbished hardware with verified specs.',
                  href: 'https://asicmarketplace.com',
                },
                {
                  name: miner.manufacturer === 'Bitmain' ? 'Bitmain Official' : miner.manufacturer === 'MicroBT' ? 'MicroBT Official' : `${miner.manufacturer ?? 'Manufacturer'} Official`,
                  type: 'Manufacturer',
                  color: '#f59e0b',
                  desc: 'Direct from manufacturer. Warranty included. Lead times vary.',
                  href: miner.manufacturer === 'Bitmain' ? 'https://shop.bitmain.com' : miner.manufacturer === 'MicroBT' ? 'https://www.microbt.com' : '#',
                },
              ].map(src => (
                <a
                  key={src.name}
                  href={src.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col gap-2 rounded-xl p-4 transition-colors hover:opacity-90"
                  style={{ background: '#0a0e17', border: `1px solid ${src.color}33` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-white">{src.name}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: src.color + '22', color: src.color }}>{src.type}</span>
                  </div>
                  <p className="text-xs text-gray-400">{src.desc}</p>
                  <span className="text-xs font-semibold mt-auto" style={{ color: src.color }}>Shop now →</span>
                </a>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-3">
              Affiliate disclosure: LMC Mining may earn a commission on purchases through some links. This does not affect our reviews or recommendations.
            </p>
          </section>

          {/* ROI analysis */}
          <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h2 className="text-lg font-semibold text-white mb-1">ROI Analysis</h2>
            <p className="text-xs text-gray-500 mb-4">Based on current network difficulty. Assumes Abundant Miners hosting at $225/month flat fee.</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {scenarios.map(s => {
                const dailyGross = dailyBTC * s.btc
                const dailyHosting = hostingCostPerDay ?? 7.5
                const dailyNet = dailyGross - dailyHosting
                const breakevenDays = miner.market_price_usd && dailyNet > 0 ? Math.round(miner.market_price_usd / dailyNet) : null
                return (
                  <div key={s.btc} className="rounded-xl p-4" style={{ background: '#0a0e17', border: '1px solid #1f2937' }}>
                    <div className="text-xs text-gray-400 mb-2 font-medium">{s.label}</div>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Daily gross</span>
                        <span className="text-white font-mono">{formatUSD(dailyGross)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Daily hosting</span>
                        <span className="text-white font-mono">-{formatUSD(dailyHosting)}</span>
                      </div>
                      <div className="flex justify-between border-t border-gray-800 pt-1">
                        <span className="text-gray-400 font-medium">Daily net</span>
                        <span className="font-mono font-semibold" style={{ color: dailyNet > 0 ? '#00d4aa' : '#ff4757' }}>{formatUSD(dailyNet)}</span>
                      </div>
                      {breakevenDays && (
                        <div className="flex justify-between">
                          <span className="text-gray-500">Breakeven</span>
                          <span className="text-white font-mono">{breakevenDays} days</span>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Pros and cons */}
          {(miner.pros?.length || miner.cons?.length) && (
            <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Pros & Cons</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {miner.pros?.length ? (
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#00d4aa' }}>Pros</h3>
                    <ul className="space-y-2">
                      {miner.pros.map((p, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#00d4aa' }}>+</span>{p}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {miner.cons?.length ? (
                  <div>
                    <h3 className="text-sm font-medium mb-3" style={{ color: '#ff4757' }}>Cons</h3>
                    <ul className="space-y-2">
                      {miner.cons.map((c, i) => (
                        <li key={i} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#ff4757' }}>−</span>{c}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </section>
          )}

          {/* Best For / Worst For */}
          {(miner.best_for || miner.worst_for) && (
            <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h2 className="text-lg font-semibold text-white mb-4">Best For / Worst For</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {miner.best_for && (
                  <div className="rounded-xl p-4" style={{ background: '#00d4aa10', border: '1px solid #00d4aa30' }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: '#00d4aa' }}>BEST FOR</div>
                    <p className="text-sm text-gray-300">{miner.best_for}</p>
                  </div>
                )}
                {miner.worst_for && (
                  <div className="rounded-xl p-4" style={{ background: '#ff475710', border: '1px solid #ff475730' }}>
                    <div className="text-xs font-semibold mb-2" style={{ color: '#ff4757' }}>WORST FOR</div>
                    <p className="text-sm text-gray-300">{miner.worst_for}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* FAQ */}
          <section className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h2 className="text-lg font-semibold text-white mb-4">Frequently Asked Questions</h2>
            <div className="space-y-4">
              {faqs.map((faq, i) => (
                <div key={i} className="border-b border-gray-800 pb-4 last:border-0 last:pb-0">
                  <h3 className="text-sm font-medium text-white mb-2">{faq.q}</h3>
                  <p className="text-sm text-gray-400">{faq.a}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Bottom Deal Analyzer CTA */}
          <section className="rounded-2xl p-6 flex flex-col md:flex-row items-center gap-5" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-white mb-1">Running the numbers on {miner.name}?</h2>
              <p className="text-sm text-gray-400">Use our Deal Analyzer to see real monthly profit at your hosting rate. Pre-filled with {miner.name} specs.</p>
            </div>
            <Link href={`/deal-analyzer?miner=${miner.slug}`} className="shrink-0 btn-gold text-sm font-bold px-6 py-3 rounded-xl whitespace-nowrap">
              Open Deal Analyzer →
            </Link>
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick CTA */}
          <div className="rounded-2xl p-5" style={{ background: '#00d4aa15', border: '1px solid #00d4aa30' }}>
            <h3 className="font-semibold text-white mb-2">Run the Numbers</h3>
            <p className="text-sm text-gray-400 mb-4">Use our full profitability calculator pre-filled with {miner.name} specs.</p>
            <Link href={`/?miner=${miner.slug}`} className="block text-center text-sm font-semibold py-2.5 rounded-lg mb-2" style={{ background: '#00d4aa', color: '#0a0e17' }}>
              Calculate ROI
            </Link>
            <a
              href="https://www.kaboomracks.com/?ref=lightningmines"
              target="_blank"
              rel="noopener noreferrer"
              className="block text-center text-sm font-semibold py-2.5 rounded-lg transition-opacity hover:opacity-80"
              style={{ background: 'transparent', color: '#f7931a', border: '1px solid rgba(247,147,26,0.4)' }}
            >
              Buy This Miner →
            </a>
          </div>

          {/* Compatible Hosts */}
          <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h3 className="font-semibold text-white mb-3">Compatible Hosting Providers</h3>
            <p className="text-xs text-gray-500 mb-3">Providers that support {COOLING_LABELS[miner.cooling_type]}</p>
            <div className="space-y-2 mb-3">
              {compatibleProviders.slice(0, 4).map(p => (
                <Link key={p.id} href={`/hosts/${p.id}`} className="flex items-center justify-between p-2.5 rounded-lg hover:border-[#00d4aa] transition-colors" style={{ background: '#0a0e17', border: '1px solid #1f2937' }}>
                  <div>
                    <div className="text-sm text-white">{p.name}</div>
                    <div className="text-xs text-gray-500">
                      {p.flatMonthly ? `$${p.flatMonthly}/mo flat` : p.rateMin ? `$${p.rateMin}/kWh` : 'Contact for pricing'}
                    </div>
                  </div>
                  {p.tier === 1 && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: '#00d4aa20', color: '#00d4aa' }}>#1</span>}
                </Link>
              ))}
            </div>
            {miner.cooling_type === 'air' && (
              <div className="mt-3 pt-3 border-t border-gray-800">
                <div className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>Our #1 recommended host for this miner</div>
                <Link
                  href="/hosts/abundant-miners"
                  className="block text-center text-sm font-bold py-2.5 rounded-lg btn-gold mb-2"
                >
                  Get Started — $225/mo →
                </Link>
              </div>
            )}
            <Link href="/hosts" className="block text-center text-xs mt-1 text-gray-500 hover:text-white">Compare all hosts →</Link>
          </div>

          {/* Deal Analyzer CTA */}
          <div className="rounded-2xl p-5" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <h3 className="font-semibold text-white mb-2">Got a Deal on {miner.name}?</h3>
            <p className="text-sm text-gray-400 mb-4">Score your deal in 60 seconds — hardware price, hosting rate, and ROI all analyzed.</p>
            <Link href={`/deal-analyzer?miner=${miner.slug}`} className="block text-center text-sm font-semibold py-2.5 rounded-lg btn-gold">
              Analyze My Deal →
            </Link>
          </div>

          {/* Related miners */}
          {relatedMiners.length > 0 && (
            <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h3 className="font-semibold text-white mb-3">Related Miners</h3>
              <div className="space-y-2">
                {relatedMiners.map(m => (
                  <Link key={m.slug} href={`/miners/${m.slug}`} className="flex items-center justify-between p-2.5 rounded-lg hover:border-[#00d4aa] transition-colors" style={{ background: '#0a0e17', border: '1px solid #1f2937' }}>
                    <div>
                      <div className="text-sm text-white">{m.name}</div>
                      <div className="text-xs text-gray-500">{m.efficiency_j_per_th?.toFixed(1)} J/TH · {m.default_hashrate_th} TH/s</div>
                    </div>
                  </Link>
                ))}
              </div>
              <Link href={`/miners/compare?a=${miner.slug}&b=${relatedMiners[0]?.slug}`} className="block text-center text-xs mt-3 text-gray-500 hover:text-white">Compare side by side →</Link>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
