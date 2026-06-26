import type { Metadata } from 'next'
import Link from 'next/link'
import { MINERS_DATA } from '@/lib/data'

export const metadata: Metadata = {
  title: 'Bitcoin ASIC Miner Comparison 2026 — Hashrate, Efficiency, Price',
  description:
    'Compare Bitcoin ASIC miners by hashrate, power consumption, efficiency (J/TH), cooling type, and estimated price. Click ROI to prefill our calculator with any miner.',
  openGraph: {
    title: 'Bitcoin ASIC Miner Comparison | Lightning Mines',
    description: 'Side-by-side comparison of every major Bitcoin ASIC miner. Hashrate, efficiency, price, ROI calculator links.',
    type: 'website',
  },
}

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

const COOLING_COLORS: Record<string, string> = { air: '#3d7aed', hydro: '#00d4aa', immersion: '#a855f7' }
const COOLING_LABELS: Record<string, string> = { air: 'Air', hydro: 'Hydro', immersion: 'Immersion' }

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'Miners', item: 'https://lightningmines.com/miners' },
  ],
}

export default function MinersPage() {
  const miners = MINERS_DATA.filter(m => m.is_active)

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>Miners</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Bitcoin ASIC Miner Comparison</h1>
        <p className="text-gray-400 max-w-2xl">
          Compare every major Bitcoin ASIC by hashrate, power draw, efficiency, cooling type, and estimated price.
          Click the ROI button to prefill our calculator with any miner&apos;s specs.
        </p>
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-2xl" style={{ border: `1px solid ${BORDER}` }}>
        <table className="w-full text-sm">
          <thead style={{ background: '#0a0a0a' }}>
            <tr>
              {['Name', 'Manufacturer', 'Hashrate', 'Power', 'Efficiency', 'Cooling', 'Est. Price', 'ROI'].map(h => (
                <th key={h} className="text-left text-xs text-gray-500 font-medium px-4 py-3 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {miners.map((m, i) => {
              const eff = m.efficiency_j_per_th ?? (m.power_watts / m.default_hashrate_th)
              const effColor = eff < 18 ? '#00d4aa' : eff < 25 ? '#fbbf24' : '#ff4757'
              return (
                <tr
                  key={m.id}
                  style={{
                    borderTop: `1px solid ${BORDER}`,
                    background: i === 0 ? 'rgba(247,147,26,0.03)' : 'transparent',
                  }}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {i === 0 && (
                        <span className="text-xs px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE }}>
                          TOP
                        </span>
                      )}
                      <Link href={`/miners/${m.slug}`} className="text-white font-semibold hover:underline" style={{ textDecorationColor: ORANGE }}>
                        {m.name}
                      </Link>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-xs">{m.manufacturer}</td>
                  <td className="px-4 py-3 text-white font-mono text-xs">{m.default_hashrate_th} TH/s</td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">{m.power_watts.toLocaleString()}W</td>
                  <td className="px-4 py-3 font-mono text-xs font-semibold" style={{ color: effColor }}>{eff.toFixed(1)} J/TH</td>
                  <td className="px-4 py-3 text-xs">
                    <span
                      className="px-2 py-0.5 rounded-full"
                      style={{ background: COOLING_COLORS[m.cooling_type] + '22', color: COOLING_COLORS[m.cooling_type] }}
                    >
                      {COOLING_LABELS[m.cooling_type]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-300 font-mono text-xs">
                    {m.market_price_usd ? `$${m.market_price_usd.toLocaleString()}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/calculator?miner=${m.id}`}
                      className="text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
                      style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE, border: '1px solid rgba(247,147,26,0.25)' }}
                    >
                      ROI →
                    </Link>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-4">
        {miners.map((m, i) => {
          const eff = m.efficiency_j_per_th ?? (m.power_watts / m.default_hashrate_th)
          const effColor = eff < 18 ? '#00d4aa' : eff < 25 ? '#fbbf24' : '#ff4757'
          return (
            <div key={m.id} className="rounded-xl p-4" style={{ background: CARD_BG, border: i === 0 ? '1px solid rgba(247,147,26,0.3)' : `1px solid ${BORDER}` }}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  {i === 0 && (
                    <div className="text-xs px-2 py-0.5 rounded font-bold mb-1 inline-block" style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE }}>
                      TOP PICK
                    </div>
                  )}
                  <Link href={`/miners/${m.slug}`} className="font-semibold text-white text-sm block">{m.name}</Link>
                  <div className="text-xs text-gray-500">{m.manufacturer}</div>
                </div>
                <span
                  className="text-xs px-2 py-0.5 rounded-full"
                  style={{ background: COOLING_COLORS[m.cooling_type] + '22', color: COOLING_COLORS[m.cooling_type] }}
                >
                  {COOLING_LABELS[m.cooling_type]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-xs mb-3">
                <div>
                  <div className="text-gray-500">Hashrate</div>
                  <div className="text-white font-mono">{m.default_hashrate_th} TH/s</div>
                </div>
                <div>
                  <div className="text-gray-500">Power</div>
                  <div className="text-white font-mono">{m.power_watts.toLocaleString()}W</div>
                </div>
                <div>
                  <div className="text-gray-500">Efficiency</div>
                  <div className="font-mono font-semibold" style={{ color: effColor }}>{eff.toFixed(1)} J/TH</div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-xs text-gray-500">
                  {m.market_price_usd ? `Est. $${m.market_price_usd.toLocaleString()}` : '—'}
                </div>
                <Link
                  href={`/calculator?miner=${m.id}`}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE, border: '1px solid rgba(247,147,26,0.25)' }}
                >
                  Calculate ROI →
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Efficiency legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><span style={{ color: '#00d4aa' }}>●</span> Under 18 J/TH — highly efficient</div>
        <div className="flex items-center gap-1.5"><span style={{ color: '#fbbf24' }}>●</span> 18–25 J/TH — competitive</div>
        <div className="flex items-center gap-1.5"><span style={{ color: '#ff4757' }}>●</span> Over 25 J/TH — thin margins at standard hosting</div>
      </div>

      {/* CTAs */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h3 className="text-white font-bold mb-2">Calculate ROI for Any Miner</h3>
          <p className="text-gray-500 text-sm mb-4">
            Click ROI next to any miner to prefill the calculator with its specs. Add your hosting cost and BTC price to see exact numbers.
          </p>
          <Link href="/calculator" className="text-sm font-bold px-5 py-2.5 rounded-lg inline-block" style={{ background: ORANGE, color: '#000' }}>
            Open Calculator →
          </Link>
        </div>
        <div className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h3 className="text-white font-bold mb-2">Not Sure Which Miner to Buy?</h3>
          <p className="text-gray-500 text-sm mb-4">
            Submit your budget and goals for a free deal review. We&apos;ll recommend the right hardware for your specific situation.
          </p>
          <Link href="/review" className="text-sm font-bold px-5 py-2.5 rounded-lg inline-block" style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE, border: '1px solid rgba(247,147,26,0.25)' }}>
            Get Free Recommendation →
          </Link>
        </div>
      </div>

      {/* University link */}
      <div className="mt-8 text-center text-sm text-gray-500">
        Learn more:{' '}
        <Link href="/university/best-bitcoin-miners-for-beginners" className="hover:text-white transition-colors" style={{ color: ORANGE }}>
          Best Bitcoin Miners for Beginners
        </Link>
        {' · '}
        <Link href="/university/asic-miner-efficiency-explained" className="hover:text-white transition-colors" style={{ color: ORANGE }}>
          ASIC Miner Efficiency Explained
        </Link>
      </div>
    </div>
  )
}
