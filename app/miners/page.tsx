import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { MINERS_DATA } from '@/lib/data'

export const metadata: Metadata = {
  title: 'Bitcoin ASIC Miner Comparison 2025 — Hashrate, Power, and ROI',
  description:
    'Compare every major Bitcoin ASIC miner by hashrate, power consumption, efficiency (J/TH), and estimated ROI. Updated 2025 data for Antminer, Whatsminer, and Canaan.',
  openGraph: {
    title: 'Bitcoin ASIC Miner Comparison 2025 | Lightning Mines',
    description: 'Side-by-side comparison of every major Bitcoin ASIC. Hashrate, efficiency, price, and ROI calculator links. Updated 2025.',
    type: 'website',
  },
}

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

const COOLING_COLORS: Record<string, string> = { air: '#3d7aed', hydro: '#00d4aa', immersion: '#a855f7' }
const COOLING_LABELS: Record<string, string> = { air: 'Air', hydro: 'Hydro', immersion: 'Immersion' }

const MINER_IMAGES: Record<string, string> = {
  // Bitmain — real photos (Bitmain CDN) + copies for variants
  'antminer-s21-xp':                    '/miners/antminer-s21-xp.jpg',
  'antminer-s21-pro':                   '/miners/antminer-s21-pro.jpg',
  'antminer-s21':                       '/miners/antminer-s21.jpg',
  'antminer-s23':                       '/miners/antminer-s23.jpg',
  'antminer-s19-xp':                    '/miners/antminer-s19-xp.jpg',
  'antminer-s19j-pro-plus':             '/miners/antminer-s19j-pro-plus.jpg',
  'antminer-s19j-pro':                  '/miners/antminer-s19j-pro.jpg',
  'antminer-s19-pro':                   '/miners/antminer-s19-pro.jpg',
  'antminer-s21-xp-hydro':              '/miners/antminer-s21-xp-hydro.jpg',
  'antminer-s21-pro-hydro':             '/miners/antminer-s21-pro-hydro.jpg',
  'antminer-s21-hydro':                 '/miners/antminer-s21-hydro.jpg',
  'antminer-s23-hydro':                 '/miners/antminer-s23-hydro.jpg',
  'antminer-s19-xp-hydro':              '/miners/antminer-s19-xp-hydro.jpg',
  'antminer-s19-pro-plus-hydro':        '/miners/antminer-s19-pro-plus-hydro.jpg',
  'antminer-s19-xp-immersion':          '/miners/antminer-s19-xp-immersion.jpg',
  'antminer-s21-pro-immersion':         '/miners/antminer-s21-pro-immersion.jpg',
  // MicroBT — real photos (MicroBT AWS S3) + copies for variants
  'whatsminer-m70s':                    '/miners/whatsminer-m70s.jpg',
  'whatsminer-m70':                     '/miners/whatsminer-m70.jpg',
  'whatsminer-m60s-plus':               '/miners/whatsminer-m60s-plus.jpg',
  'whatsminer-m60s':                    '/miners/whatsminer-m60s.jpg',
  'whatsminer-m50s':                    '/miners/whatsminer-m50s.jpg',
  'whatsminer-m53s':                    '/miners/whatsminer-m53s.jpg',
  'whatsminer-m63s-hydro':              '/miners/whatsminer-m63s-hydro.jpg',
  'whatsminer-m50s-plus-plus-immersion': '/miners/whatsminer-m50s-plus-plus-immersion.jpg',
  // Canaan
  'canaan-avalon-a1566':                '/miners/canaan-avalon-a1566.jpg',
  'canaan-avalon-a1466':                '/miners/canaan-avalon-a1466.jpg',
  'canaan-avalon-a1366':                '/miners/canaan-avalon-a1366.jpg',
}

function minerImageSrc(slug: string | null | undefined): string {
  return MINER_IMAGES[slug ?? ''] ?? '/miners/asic-miner.jpg'
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'Miners', item: 'https://lightningmines.com/miners' },
  ],
}

export default function MinersPage() {
  const miners = MINERS_DATA
    .filter(m => m.is_active)
    .sort((a, b) => {
      const effA = a.efficiency_j_per_th ?? (a.power_watts / a.default_hashrate_th)
      const effB = b.efficiency_j_per_th ?? (b.power_watts / b.default_hashrate_th)
      return effA - effB
    })

  const itemListSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'Bitcoin ASIC Miner Comparison 2025',
    description: 'Complete comparison of Bitcoin ASIC miners sorted by efficiency',
    numberOfItems: miners.length,
    itemListElement: miners.map((m, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: m.name,
      url: `https://lightningmines.com/miners/${m.slug}`,
    })),
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(itemListSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>Miners</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Bitcoin ASIC Miner Comparison 2025</h1>
        <p className="text-gray-400 max-w-2xl">
          Compare every major Bitcoin ASIC by hashrate, power draw, efficiency, cooling type, and estimated price.
          Sorted best-to-worst efficiency. Click ROI to prefill our calculator with any miner&apos;s specs.
        </p>
      </div>

      {/* Miner cards — image left, specs right */}
      <div className="space-y-4">
        {miners.map((m, i) => {
          const eff = m.efficiency_j_per_th ?? (m.power_watts / m.default_hashrate_th)
          const effColor = eff < 18 ? '#00d4aa' : eff < 25 ? '#fbbf24' : '#ff4757'
          return (
            <div
              key={m.id}
              className="miner-card rounded-xl overflow-hidden flex"
              style={{ background: CARD_BG, border: i === 0 ? '1px solid rgba(247,147,26,0.3)' : `1px solid ${BORDER}` }}
            >
              {/* Miner image */}
              <div className="relative w-28 sm:w-44 shrink-0 self-stretch min-h-[120px]" style={{ background: '#1a1a1a' }}>
                <Image
                  src={minerImageSrc(m.slug)}
                  alt={m.name}
                  fill
                  className="object-contain p-3"
                  sizes="(max-width: 640px) 112px, 176px"
                />
                {i === 0 && (
                  <div
                    className="absolute top-2 left-2 text-xs px-1.5 py-0.5 rounded font-bold z-10"
                    style={{ background: 'rgba(247,147,26,0.92)', color: '#000' }}
                  >
                    TOP
                  </div>
                )}
              </div>

              {/* Specs */}
              <div className="flex-1 p-4 min-w-0">
                <div className="flex items-start justify-between gap-2 mb-2 flex-wrap">
                  <div>
                    <Link
                      href={`/miners/${m.slug}`}
                      className="font-semibold text-white hover:underline text-sm sm:text-base"
                      style={{ textDecorationColor: ORANGE }}
                    >
                      {m.name}
                    </Link>
                    <div className="text-xs text-gray-500 mt-0.5">{m.manufacturer}</div>
                  </div>
                  <span
                    className="text-xs px-2 py-0.5 rounded-full shrink-0"
                    style={{ background: COOLING_COLORS[m.cooling_type] + '22', color: COOLING_COLORS[m.cooling_type] }}
                  >
                    {COOLING_LABELS[m.cooling_type]}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs mb-3">
                  <div>
                    <div className="text-gray-500">Hashrate</div>
                    <div className="text-white font-mono font-semibold">{m.default_hashrate_th} TH/s</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Power</div>
                    <div className="text-white font-mono">{m.power_watts.toLocaleString()}W</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Efficiency</div>
                    <div className="font-mono font-semibold" style={{ color: effColor }}>{eff.toFixed(1)} J/TH</div>
                  </div>
                  <div>
                    <div className="text-gray-500">Est. Price</div>
                    <div className="text-white font-mono">{m.market_price_usd ? `$${m.market_price_usd.toLocaleString()}` : '—'}</div>
                  </div>
                </div>

                <Link
                  href={`/calculator?miner=${m.id}`}
                  className="inline-flex text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
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
