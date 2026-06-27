import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { MINERS_DATA } from '@/lib/data'

export const metadata: Metadata = {
  title: 'Bitcoin ASIC Miner Comparison 2026 â Hashrate, Efficiency, Price',
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

function getMinerImage(name: string): string {
  // Bitmain Antminer S21 series
  if (name.includes('S21 XP'))  return 'https://shop.bitmain.com/photo/product/2024062616064630218.png'
  if (name.includes('S21 Pro')) return 'https://shop.bitmain.com/photo/product/2023120516064630218.png'
  if (name.includes('S21'))     return 'https://shop.bitmain.com/photo/product/2023092716064630218.png'
  // Bitmain Antminer S19 series
  if (name.includes('S19 XP'))  return 'https://shop.bitmain.com/photo/product/2022081816064630218.png'
  if (name.includes('S19'))     return 'https://shop.bitmain.com/photo/product/2023080316064630218.png'
  // MicroBT Whatsminer — official AWS images
  if (name.includes('M70S'))    return 'https://aws-microbt-com-bucket.s3.us-west-2.amazonaws.com/whatsminerm70s_1766047627885.png'
  if (name.includes('M70'))     return 'https://aws-microbt-com-bucket.s3.us-west-2.amazonaws.com/whatsmineronlinem70_1766046886397.png'
  if (name.includes('M60'))     return 'https://aws-microbt-com-bucket.s3.us-west-2.amazonaws.com/1698130453138whatsmineronlinem60s.png'
  if (name.includes('M53'))     return '/miners/whatsminer-m53s.png'
  if (name.includes('M50'))     return 'https://aws-microbt-com-bucket.s3.us-west-2.amazonaws.com/WhatsMineronlineM50S.png'
  // Canaan Avalon
  if (name.includes('Avalon'))  return 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Antminer_S19_Pro.jpg/320px-Antminer_S19_Pro.jpg'
  // Generic fallback
  return 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4c/Antminer_S19_Pro.jpg/320px-Antminer_S19_Pro.jpg'
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

      {/* Miner cards â image left, specs right */}
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
              {/* Miner image â product shot on neutral background */}
              <div className="relative w-28 sm:w-44 shrink-0 self-stretch min-h-[120px]" style={{ background: '#1a1a1a' }}>
                <Image
                  src={getMinerImage(m.name)}
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
                    <div className="text-white font-mono">{m.market_price_usd ? `$${m.market_price_usd.toLocaleString()}` : 'â'}</div>
                  </div>
                </div>

                <Link
                  href={`/calculator?miner=${m.id}`}
                  className="inline-flex text-xs font-semibold px-3 py-1.5 rounded-lg whitespace-nowrap"
                  style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE, border: '1px solid rgba(247,147,26,0.25)' }}
                >
                  Calculate ROI â
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      {/* Efficiency legend */}
      <div className="mt-6 flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5"><span style={{ color: '#00d4aa' }}>â</span> Under 18 J/TH â highly efficient</div>
        <div className="flex items-center gap-1.5"><span style={{ color: '#fbbf24' }}>â</span> 18â25 J/TH â competitive</div>
        <div className="flex items-center gap-1.5"><span style={{ color: '#ff4757' }}>â</span> Over 25 J/TH â thin margins at standard hosting</div>
      </div>

      {/* CTAs */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h3 className="text-white font-bold mb-2">Calculate ROI for Any Miner</h3>
          <p className="text-gray-500 text-sm mb-4">
            Click ROI next to any miner to prefill the calculator with its specs. Add your hosting cost and BTC price to see exact numbers.
          </p>
          <Link href="/calculator" className="text-sm font-bold px-5 py-2.5 rounded-lg inline-block" style={{ background: ORANGE, color: '#000' }}>
            Open Calculator â
          </Link>
        </div>
        <div className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h3 className="text-white font-bold mb-2">Not Sure Which Miner to Buy?</h3>
          <p className="text-gray-500 text-sm mb-4">
            Submit your budget and goals for a free deal review. We&apos;ll recommend the right hardware for your specific situation.
          </p>
          <Link href="/review" className="text-sm font-bold px-5 py-2.5 rounded-lg inline-block" style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE, border: '1px solid rgba(247,147,26,0.25)' }}>
            Get Free Recommendation â
          </Link>
        </div>
      </div>

      {/* University link */}
      <div className="mt-8 text-center text-sm text-gray-500">
        Learn more:{' '}
        <Link href="/university/best-bitcoin-miners-for-beginners" className="hover:text-white transition-colors" style={{ color: ORANGE }}>
          Best Bitcoin Miners for Beginners
        </Link>
        {' Â· '}
        <Link href="/university/asic-miner-efficiency-explained" className="hover:text-white transition-colors" style={{ color: ORANGE }}>
          ASIC Miner Efficiency Explained
        </Link>
      </div>
    </div>
  )
}
