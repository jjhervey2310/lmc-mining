'use client'

import { useEffect, useState } from 'react'

// Wall-street-style marquee across the top of the terminal: BTC ETH SOL SUI,
// SPX and the Mag 7, live from /api/markets (refreshes every 60s). Reuses the
// public site's .animate-ticker keyframes; hover pauses the scroll.

interface Quote {
  symbol: string
  price: number
  changePct: number
  kind: 'crypto' | 'index' | 'equity'
}

const fmtPrice = (q: Quote) =>
  q.price >= 1000
    ? q.price.toLocaleString('en-US', { maximumFractionDigits: 0 })
    : q.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function MarketTicker() {
  const [quotes, setQuotes] = useState<Quote[]>([])

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch('/api/markets')
        if (!res.ok) return
        const d = await res.json()
        if (!cancelled && Array.isArray(d.quotes) && d.quotes.length) setQuotes(d.quotes)
      } catch {
        // keep showing the last snapshot
      }
    }
    load()
    const iv = setInterval(load, 60_000)
    return () => { cancelled = true; clearInterval(iv) }
  }, [])

  // Reserve the bar height pre-data so the header below never jumps.
  if (!quotes.length) {
    return <div className="h-8 border-b border-neutral-800 bg-neutral-950" aria-hidden="true" />
  }

  const doubled = [...quotes, ...quotes]

  return (
    <div className="h-8 overflow-hidden border-b border-neutral-800 bg-neutral-950" aria-hidden="true">
      <div className="animate-ticker flex h-full items-center gap-7 whitespace-nowrap" style={{ width: 'max-content' }}>
        {doubled.map((q, i) => {
          const up = q.changePct >= 0
          return (
            <span key={`${q.symbol}${i}`} className="flex items-center gap-2 font-mono text-[12px]">
              <span className="text-neutral-400">{q.symbol}</span>
              <span className="text-amber-400">{fmtPrice(q)}</span>
              <span className={up ? 'text-green-500' : 'text-red-500'}>
                {up ? '▲' : '▼'} {Math.abs(q.changePct).toFixed(2)}%
              </span>
            </span>
          )
        })}
      </div>
    </div>
  )
}
