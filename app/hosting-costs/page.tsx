import type { Metadata } from 'next'
import Link from 'next/link'
import { PROVIDERS_DATA } from '@/lib/data'
import type { HostingProvider } from '@/lib/types'

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

const AS_OF = 'August 2026'
const DATE_MODIFIED = '2026-08-11'
const SITE = 'https://www.lightningmines.com'

// ── Data (build-time, same source as /hosting) ──────────────────────────────

const activeProviders = PROVIDERS_DATA.filter(p => p.listingStatus === 'active')

const US_HINTS = [
  'united states', 'usa', 'texas', 'wyoming', 'nebraska', 'iowa', 'oregon',
  'kentucky', 'georgia', 'ohio', 'oklahoma', 'north dakota', 'tennessee',
  'washington', 'new york', 'pennsylvania',
]

function isUS(p: HostingProvider): boolean {
  return p.facilityLocations.some(loc => {
    const l = loc.toLowerCase()
    return US_HINTS.some(h => l.includes(h))
  })
}

// Midpoint of a provider's published per-kWh range (single data point per provider)
function kwhMidpoint(p: HostingProvider): number | null {
  if (p.billingType !== 'kwh' || p.rateMin === null) return null
  return p.rateMax !== null ? (p.rateMin + p.rateMax) / 2 : p.rateMin
}

function median(nums: number[]): number {
  const s = [...nums].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid]
}

const kwhPriced = activeProviders.filter(p => kwhMidpoint(p) !== null)
const usKwhPriced = kwhPriced.filter(isUS)
const flatPriced = activeProviders.filter(p => p.billingType === 'flat' && p.flatMonthly !== null)
const pricedCount = kwhPriced.length + flatPriced.length

const usMedianKwh = median(usKwhPriced.map(p => kwhMidpoint(p) as number))
const allRates = kwhPriced.flatMap(p => [p.rateMin as number, p.rateMax ?? (p.rateMin as number)])
const rateFloor = Math.min(...allRates)
const rateCeil = Math.max(...allRates)
const typicalFlat = flatPriced.length > 0 ? median(flatPriced.map(p => p.flatMonthly as number)) : null

// Latest last-reviewed date among providers with published pricing
const latestReview = [...kwhPriced, ...flatPriced]
  .map(p => new Date(p.lastVerified).getTime())
  .filter(t => !isNaN(t))
  .reduce((a, b) => Math.max(a, b), 0)
const ratesReviewed = latestReview
  ? new Date(latestReview).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  : 'Pending'

// Example bill math for a ~3.6 kW machine (matches the /calculator billing modes)
const MACHINE_KW = 3.6
const HOURS_PER_MONTH = 730
const EXAMPLE_RATE = 0.077
const exampleKwh = MACHINE_KW * HOURS_PER_MONTH // 2,628 kWh
const exampleKwhBill = exampleKwh * EXAMPLE_RATE // ≈ $202

const fmtRate = (n: number) => `$${n.toFixed(3).replace(/0$/, '')}`
const usMedianLabel = `$${usMedianKwh.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')}`

function priceLabel(p: HostingProvider): string {
  if (p.billingType === 'flat' && p.flatMonthly !== null) return `$${p.flatMonthly}/mo flat`
  if (p.billingType === 'revenue_share') return 'Revenue share'
  if (p.billingType === 'kwh' && p.rateMin !== null) {
    if (p.rateMax !== null && p.rateMax !== p.rateMin) return `$${p.rateMin}–$${p.rateMax}/kWh`
    return `$${p.rateMin}/kWh`
  }
  return 'Contact for pricing'
}

function coolingLabel(p: HostingProvider): string {
  return p.cooling.map(c => c[0].toUpperCase() + c.slice(1)).join(' + ')
}

function minLabel(p: HostingProvider): string {
  if (p.minMachines === null) return '—'
  return `${p.minMachines}`
}

// Priced providers first (they carry the index), then contact-for-pricing
const tableProviders = [
  ...activeProviders.filter(p => p.rateMin !== null || p.flatMonthly !== null),
  ...activeProviders.filter(p => p.rateMin === null && p.flatMonthly === null),
]

// ── Metadata ────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  alternates: { canonical: '/hosting-costs' },
  title: `Bitcoin Mining Hosting Cost Index (${AS_OF}) — Real Rates From ${activeProviders.length} Providers`,
  description: `The median published US bitcoin mining hosting rate is ${usMedianLabel}/kWh as of ${AS_OF}, with published rates ranging ${fmtRate(rateFloor)}–${fmtRate(rateCeil)}/kWh across ${activeProviders.length} tracked providers. Real rate data, flat-fee comparison, and billing math.`,
  openGraph: {
    title: `Bitcoin Mining Hosting Cost Index (${AS_OF}) | Lightning Mines`,
    description: `Median published US hosting rate: ${usMedianLabel}/kWh. Published range ${fmtRate(rateFloor)}–${fmtRate(rateCeil)}/kWh across ${activeProviders.length} tracked providers. No fabricated numbers.`,
    type: 'website',
  },
}

// ── Structured data ─────────────────────────────────────────────────────────

const faqEntries = [
  {
    q: 'How much does bitcoin mining hosting cost?',
    a: `As of ${AS_OF}, the median published US bitcoin mining hosting rate tracked by Lightning Mines is ${usMedianLabel}/kWh, with published per-kWh rates ranging from ${fmtRate(rateFloor)} to ${fmtRate(rateCeil)}/kWh globally. For a modern ~3.6 kW machine like an Antminer S21, that works out to roughly $${Math.round(exampleKwh * rateFloor)}–$${Math.round(exampleKwh * rateCeil)} per month in hosting fees. Some providers instead charge a flat monthly fee per machine${typicalFlat !== null ? ` (typically $${typicalFlat}/month)` : ''}.`,
  },
  {
    q: 'Is a flat monthly fee better than per-kWh billing?',
    a: `A flat monthly fee${typicalFlat !== null ? ` (e.g. $${typicalFlat}/month per machine)` : ''} is fixed regardless of power draw, which makes budgeting simple. Per-kWh billing scales with your machine's actual consumption: a 3.6 kW machine running 24/7 uses about ${Math.round(exampleKwh).toLocaleString()} kWh/month, so at $${EXAMPLE_RATE}/kWh you would pay roughly $${Math.round(exampleKwhBill)}/month. Neither is inherently better — compare the flat fee against your machine's kW draw × 730 hours × the per-kWh rate and take the lower all-in number, after confirming what each fee includes.`,
  },
  {
    q: 'What is a good hosting rate for bitcoin mining in 2026?',
    a: `US facilities typically land between $0.055 and $0.095/kWh all-in. Published rates in the Lightning Mines index run ${fmtRate(rateFloor)}–${fmtRate(rateCeil)}/kWh, and the median published US rate is ${usMedianLabel}/kWh as of ${AS_OF}. Anything at or below roughly $0.08/kWh all-in (including fees) is competitive; always confirm whether quoted rates include pool fees, management fees, and setup charges.`,
  },
  {
    q: 'Why do most hosting providers not publish their rates?',
    a: `Of the ${activeProviders.length} active providers Lightning Mines tracks, only ${pricedCount} publish a rate card; the rest quote custom pricing based on machine count, contract length, and current power costs. Unpublished pricing is not automatically a red flag, but it makes comparison harder — get every quote in writing, and check the total effective cost including deposits, setup fees, and minimum terms before committing.`,
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqEntries.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

const datasetSchema = {
  '@context': 'https://schema.org',
  '@type': 'Dataset',
  name: 'Bitcoin Mining Hosting Cost Index',
  description: `Tracked bitcoin mining hosting rates from ${activeProviders.length} providers as of ${AS_OF}. Median published US rate ${usMedianLabel}/kWh; published per-kWh range ${fmtRate(rateFloor)}–${fmtRate(rateCeil)}. Includes billing type (per-kWh vs flat monthly fee), cooling type, facility locations, and minimum machine commitments.`,
  url: `${SITE}/hosting-costs`,
  dateModified: DATE_MODIFIED,
  creator: {
    '@type': 'Organization',
    name: 'Lightning Mines',
    url: SITE,
  },
  license: `${SITE}/terms`,
  keywords: ['bitcoin mining hosting cost', 'mining hosting rates', 'per-kWh hosting', 'ASIC hosting pricing'],
  distribution: {
    '@type': 'DataDownload',
    encodingFormat: 'application/json',
    contentUrl: `${SITE}/ai-data.json`,
  },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
    { '@type': 'ListItem', position: 2, name: 'Hosting Cost Index', item: `${SITE}/hosting-costs` },
  ],
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function HostingCostsPage() {
  const stats = [
    { label: 'Median US rate (published)', value: `${usMedianLabel}/kWh`, note: `as of ${AS_OF}` },
    { label: 'Published rate range', value: `${fmtRate(rateFloor)}–${fmtRate(rateCeil)}/kWh`, note: `rates last reviewed ${ratesReviewed}` },
    { label: 'Providers tracked', value: `${activeProviders.length}`, note: `${pricedCount} publish pricing` },
    ...(typicalFlat !== null
      ? [{ label: 'Typical flat fee', value: `$${typicalFlat}/mo`, note: 'per machine, power included' }]
      : []),
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(datasetSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-xs text-gray-500 mb-4">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span>Hosting Cost Index</span>
        </div>

        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
          Bitcoin Mining Hosting Cost Index
        </h1>
        <p className="text-sm sm:text-base text-gray-400 max-w-3xl leading-relaxed mb-8">
          The Bitcoin Mining Hosting Cost Index tracks real published hosting rates across{' '}
          {activeProviders.length} providers as of {AS_OF}: the median published US rate is{' '}
          <span className="text-white font-semibold">{usMedianLabel}/kWh</span>, with published
          per-kWh rates ranging {fmtRate(rateFloor)}–{fmtRate(rateCeil)}/kWh globally.
        </p>

        {/* Headline stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map(s => (
            <div key={s.label} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="text-xs text-gray-500 mb-1">{s.label}</div>
              <div className="text-lg sm:text-xl font-bold font-mono" style={{ color: ORANGE }}>{s.value}</div>
              <div className="text-[11px] text-gray-500 mt-1">{s.note}</div>
            </div>
          ))}
        </div>

        {/* Full rate table */}
        <h2 className="text-xl font-bold text-white mb-2">Hosting rates by provider ({AS_OF})</h2>
        <p className="text-xs text-gray-500 mb-4 max-w-3xl">
          All {activeProviders.length} active providers tracked by Lightning Mines. Providers with a
          published rate card are listed first. &quot;Contact for pricing&quot; means the provider
          quotes custom rates — confirm current terms directly before committing capital.
        </p>
        <div className="overflow-x-auto mb-10">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {['Provider', 'Hosting Rate', 'Cooling', 'Location', 'Min. Machines'].map(h => (
                  <th key={h} className="text-left text-xs text-gray-500 font-medium pb-3 pr-4 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tableProviders.map(p => (
                <tr key={p.id} style={{ borderBottom: `1px solid ${BORDER}` }}>
                  <td className="py-3 pr-4">
                    <Link href={`/hosts/${p.id}`} className="text-white font-semibold hover:underline">
                      {p.name}
                    </Link>
                  </td>
                  <td className="py-3 pr-4 text-gray-300 whitespace-nowrap font-mono text-xs">{priceLabel(p)}</td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">{coolingLabel(p)}</td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">{p.facilityLocations.join(', ')}</td>
                  <td className="py-3 pr-4 text-gray-400 text-xs">{minLabel(p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* How hosting is billed */}
        <div className="rounded-2xl p-6 mb-10" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h2 className="text-xl font-bold text-white mb-4">How bitcoin mining hosting is billed</h2>
          <p className="text-sm text-gray-400 leading-relaxed mb-4 max-w-3xl">
            Hosting providers bill one of two ways — per-kWh or a flat monthly fee per machine —
            never both. The Lightning Mines <Link href="/calculator" className="hover:text-white transition-colors" style={{ color: ORANGE }}>ROI calculator</Link>{' '}
            models both modes.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl p-5" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
              <h3 className="text-white font-semibold text-sm mb-2">Per-kWh billing</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                You pay for the electricity your machine actually draws. A ~{MACHINE_KW} kW machine
                (e.g. Antminer S21) running 24/7 uses about {MACHINE_KW} kW × {HOURS_PER_MONTH} h ≈{' '}
                {Math.round(exampleKwh).toLocaleString()} kWh/month. At ${EXAMPLE_RATE}/kWh that is{' '}
                <span className="text-white font-semibold font-mono">≈ ${Math.round(exampleKwhBill)}/month</span>.
                US facilities typically charge $0.055–$0.095/kWh all-in.
              </p>
            </div>
            <div className="rounded-xl p-5" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
              <h3 className="text-white font-semibold text-sm mb-2">Flat monthly fee</h3>
              <p className="text-xs text-gray-400 leading-relaxed">
                One fixed price per machine per month, power included
                {typicalFlat !== null ? (
                  <> — typically <span className="text-white font-semibold font-mono">${typicalFlat}/month</span> among tracked providers</>
                ) : null}.
                Your cost never changes with power draw, which makes ROI easy to model. Compare the
                flat fee against your machine&apos;s expected per-kWh bill: for the ~{MACHINE_KW} kW example
                above, ${EXAMPLE_RATE}/kWh ≈ ${Math.round(exampleKwhBill)}/month, so a flat fee near that
                number is equivalent — and cheaper if your machine draws more.
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Always confirm what a quoted rate includes: pool fees, management fees, setup fees, and
            deposits can change the true all-in cost. See{' '}
            <Link href="/how-we-verify" className="hover:text-white transition-colors" style={{ color: ORANGE }}>how we verify</Link>.
          </p>
        </div>

        {/* FAQ */}
        <h2 className="text-xl font-bold text-white mb-6">Hosting cost FAQ</h2>
        <div className="space-y-4 mb-12">
          {faqEntries.map(f => (
            <div key={f.q} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <h3 className="text-white font-semibold text-sm mb-2">{f.q}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>

        {/* Cross-links */}
        <div className="rounded-2xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h2 className="text-lg font-bold text-white mb-2">Run the numbers on a real quote</h2>
          <p className="text-gray-500 text-sm mb-5">
            Plug any rate from this index into the ROI calculator, or compare providers side by side.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/calculator" className="text-sm font-bold px-6 py-3 rounded-lg" style={{ background: ORANGE, color: '#000' }}>
              ROI Calculator →
            </Link>
            <Link href="/hosting" className="text-sm font-semibold px-6 py-3 rounded-lg border text-gray-300 hover:text-white transition-colors" style={{ borderColor: BORDER }}>
              Compare Hosting Providers →
            </Link>
          </div>
        </div>
      </div>
    </>
  )
}
