'use client'

import { useEffect, useState } from 'react'

const HALVING_DATE = new Date('2028-04-15T00:00:00Z')

function getDaysToHalving() {
  return Math.max(0, Math.ceil((HALVING_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

const STATIC_ITEMS = [
  'Network Hashrate: ~800 EH/s',
  `Days to Halving: ${getDaysToHalving()}`,
  'Block Reward: 3.125 BTC',
  'Best Efficiency: 13.5 J/TH (S21 XP)',
  'Abundant Mines: $225/mo flat rate — Cascade Locks, OR',
  'S21 XP Hydro: 473 TH/s · 12 J/TH',
  'Independent Bitcoin Mining Intelligence',
  'No Paid Rankings · No Sponsored Content',
]

function calcHashprice(price: number, difficulty: number): number {
  return (2.7e20 * price) / (difficulty * 4294967296)
}

export default function TickerBar() {
  const [btcPrice, setBtcPrice] = useState<string | null>(null)
  const [hashprice, setHashprice] = useState<string | null>(null)

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
            const hp = calcHashprice(price, Number(d.difficulty))
            setHashprice(`$${hp.toFixed(2)}/PH/day`)
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

  const items = [
    btcPrice ? `BTC: ${btcPrice}` : 'BTC: Loading...',
    hashprice ? `Hashprice: ${hashprice}` : null,
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
