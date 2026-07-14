'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { daysToHalving } from '@/lib/constants'

const STATIC_ITEMS = [
  'Block Reward: 3.125 BTC',
  'Best Efficiency: 13.5 J/TH (S21 XP)',
  'Abundant Mines: $225/mo flat all-in rate',
  'S21 XP Hydro: 473 TH/s · 12 J/TH',
  'Independent Bitcoin Mining Intelligence',
  'No Paid Rankings · No Sponsored Content',
]

function calcHashprice(price: number, difficulty: number): number {
  return (2.7e20 * price) / (difficulty * 4294967296)
}

export default function TickerBar() {
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const [btcPrice, setBtcPrice] = useState<string | null>(null)
  const [hashprice, setHashprice] = useState<string | null>(null)
  const [networkEH, setNetworkEH] = useState<string | null>(null)
  const [halvingDays, setHalvingDays] = useState<number | null>(null)

  // Populate the ticker only after mount. This keeps the decorative live-data
  // marquee out of the server-rendered HTML so the first crawlable text on every
  // page is the real H1/value prop — not "BTC: Loading..." (SEO/AEO), while the
  // empty bar below still reserves its height to avoid any layout shift.
  useEffect(() => { setMounted(true) }, [])

  // Compute halving countdown on the client so every page shows the same live
  // number (static pages would otherwise bake a stale build-time value).
  useEffect(() => { setHalvingDays(daysToHalving()) }, [])

  useEffect(() => {
    let cancelled = false
    async function fetchPrice() {
      try {
        const r = await fetch('/api/btc-price')
        const d = await r.json()
        if (!cancelled && d.price) {
          const price = Number(d.price)
          setBtcPrice(`$${price.toLocaleString()}`)
          if (d.difficulty) {
            const diff = Number(d.difficulty)
            const hp = calcHashprice(price, diff)
            setHashprice(`$${hp.toFixed(2)}/PH/day`)
            const eh = diff * 4294967296 / 600 / 1e18
            setNetworkEH(`${eh.toFixed(0)} EH/s`)
          }
        }
      } catch {
        // silent — show items without price
      }
    }
    fetchPrice()
    const iv = setInterval(fetchPrice, 60_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  if (pathname === '/') return null

  // Pre-mount / server render: reserve the bar's 32px height with no text content
  // (no "BTC: Loading...") so the ticker is never the first crawlable text on the
  // page and there is no layout shift when it populates.
  if (!mounted) {
    return (
      <div
        className="border-b"
        style={{ height: '32px', background: '#0a0a0a', borderColor: '#1a2332' }}
        aria-hidden="true"
      />
    )
  }

  const items = [
    btcPrice ? `BTC: ${btcPrice}` : 'BTC: Loading...',
    hashprice ? `Hashprice: ${hashprice}` : null,
    networkEH ? `Network Hashrate: ${networkEH}` : null,
    halvingDays !== null ? `Days to Halving: ${halvingDays}` : null,
    ...STATIC_ITEMS,
  ].filter(Boolean) as string[]

  const all = [...items, ...items]

  return (
    <div
      className="overflow-hidden border-b"
      style={{ height: '32px', background: '#0a0a0a', borderColor: '#1a2332' }}
      aria-hidden="true"
      suppressHydrationWarning
    >
      <div
        className="flex items-center gap-8 whitespace-nowrap animate-ticker h-full"
        style={{ width: 'max-content' }}
      >
        {all.map((item, i) => (
          <span key={i} className="flex items-center gap-2">
            <span style={{ color: '#f59e0b', opacity: 0.5, fontSize: '8px' }}>◆</span>
            <span className="text-xs font-mono" style={{ color: '#64748b' }}>
              {item.includes(':') ? (
                <>
                  <span style={{ color: '#94a3b8' }}>{item.split(':')[0]}:</span>
                  <span style={{ color: '#f59e0b' }}>{item.split(':').slice(1).join(':')}</span>
                </>
              ) : (
                <span style={{ color: '#64748b' }}>{item}</span>
              )}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
