'use client'

import { useEffect, useState } from 'react'
import { Spark } from './ui'

// Live position tiles for the ROBINHOOD tab: entry vs live price with a 60s
// client-side CoinGecko refresh, tabular numerals, expandable 7d chart.

export interface TileData {
  symbol: string
  qty: number
  avgCost: number
  price: number | null   // server-rendered starting price
  cgId: string | null
  spark: number[] | null
  stop: string | null    // resting stop level as text, if the desk note carries one
}

const fmt = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'

export default function LiveTiles({ tiles, cash }: { tiles: TileData[]; cash: number }) {
  const [live, setLive] = useState<Record<string, number>>({})

  useEffect(() => {
    const ids = tiles.map((t) => t.cgId).filter(Boolean) as string[]
    if (!ids.length) return
    let dead = false
    const pull = async () => {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${[...new Set(ids)].join(',')}&vs_currencies=usd`)
        if (!r.ok) return // keep last good numbers — never blank a price on a failed poll
        const j = (await r.json()) as Record<string, { usd?: number }>
        if (dead) return
        setLive((prev) => {
          const next = { ...prev }
          for (const t of tiles) if (t.cgId && j[t.cgId]?.usd) next[t.symbol] = j[t.cgId].usd as number
          return next
        })
      } catch { /* offline poll — keep last good */ }
    }
    pull()
    const iv = setInterval(pull, 60_000)
    return () => { dead = true; clearInterval(iv) }
  }, [tiles])

  const priced = tiles.map((t) => {
    const now = live[t.symbol] ?? t.price
    const value = now !== null ? t.qty * now : null
    const pct = now !== null && t.avgCost > 0 ? ((now - t.avgCost) / t.avgCost) * 100 : null
    return { ...t, now, value, pct }
  })
  const total = priced.every((p) => p.value !== null) ? priced.reduce((s, p) => s + (p.value ?? 0), 0) + cash : null

  return (
    <div>
      <div className="grid gap-2 sm:grid-cols-2">
        {priced.map((p) => (
          <details key={p.symbol} className="group rounded-xl border border-neutral-200 dark:border-white/10">
            <summary className="flex cursor-pointer list-none items-baseline gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
              <span className="text-[15px] font-bold text-rose-600 dark:text-rose-300">{p.symbol}</span>
              <span className="font-mono text-[15px] font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{p.now !== null ? fmt(p.now) : 'n/a'}</span>
              {p.pct !== null && (
                <span className={`font-mono text-[13px] tabular-nums ${p.pct >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>
                  {p.pct >= 0 ? '▲' : '▼'}{Math.abs(p.pct).toFixed(1)}%
                </span>
              )}
              <span className="ml-auto font-mono text-[13px] tabular-nums text-neutral-600 dark:text-neutral-400">{p.value !== null ? `$${p.value.toFixed(2)}` : ''}</span>
              <span className="text-[11px] text-neutral-400 transition-transform group-open:rotate-90">▶</span>
            </summary>
            <div className="border-t border-neutral-100 px-3 py-2 text-[12px] text-neutral-600 dark:border-white/5 dark:text-neutral-400">
              <div className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
                <span>qty <b className="font-mono text-neutral-800 dark:text-neutral-200">{p.qty}</b></span>
                <span>entry <b className="font-mono text-neutral-800 dark:text-neutral-200">{p.avgCost > 0 ? fmt(p.avgCost) : 'n/a'}</b></span>
                {p.stop && <span>stop <b className="font-mono text-amber-700 dark:text-amber-300">{p.stop}</b></span>}
              </div>
              {p.spark && p.spark.length > 1 ? (
                <div className="mt-2 overflow-x-auto"><Spark points={p.spark} w={620} h={140} /></div>
              ) : null}
              <div className="mt-1 text-[11px] text-neutral-500">7 days · price refreshes every 60s</div>
            </div>
          </details>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-between px-1 text-[13px] tabular-nums">
        <span><span className="font-bold text-neutral-600 dark:text-neutral-400">CASH</span> <span className="font-mono">${cash.toFixed(2)}</span></span>
        <span className="font-mono font-bold text-rose-600 dark:text-rose-300">{total !== null ? `total $${total.toFixed(2)}` : ''}</span>
      </div>
    </div>
  )
}
