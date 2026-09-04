'use client'

import { useEffect, useState } from 'react'

// Click-a-holding chart (build request #4): the coin's price history up to a year
// back, fetched client-side from CoinGecko, with the ENTRY and STOP drawn as
// horizontal lines so the position's risk is visible at a glance. Read-only.

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
] as const

const fmt = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'

export default function HoldingChart({ symbol, cgId, entry, stop, onClose }: {
  symbol: string
  cgId: string | null
  entry: number | null
  stop: number | null
  onClose: () => void
}) {
  const [days, setDays] = useState<number>(90)
  const [pts, setPts] = useState<[number, number][] | null | undefined>(undefined) // undefined = loading, null = failed
  const [cursor, setCursor] = useState<number | null>(null)

  useEffect(() => {
    if (!cgId) { setPts(null); return }
    let dead = false
    setPts(undefined)
    ;(async () => {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=${days}`)
        if (!r.ok) { if (!dead) setPts(null); return }
        const j = (await r.json()) as { prices?: [number, number][] }
        const raw = j.prices ?? []
        // thin to ~240 points so the SVG stays light on a phone
        const step = Math.max(1, Math.ceil(raw.length / 240))
        const thin = raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
        if (!dead) setPts(thin.length > 1 ? thin : null)
      } catch { if (!dead) setPts(null) }
    })()
    return () => { dead = true }
  }, [cgId, days])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const w = 900, h = 300
  const pad = { l: 8, r: 8, t: 12, b: 20 }
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b
  const vals = (pts ?? []).map((p) => p[1])
  // Scale includes entry and stop so the lines are always on-canvas.
  const lo = vals.length ? Math.min(...vals, ...(entry ? [entry] : []), ...(stop ? [stop] : [])) : 0
  const hi = vals.length ? Math.max(...vals, ...(entry ? [entry] : [])) : 1
  const span = hi - lo || 1
  const y = (v: number) => pad.t + ih - ((v - lo) / span) * ih
  const x = (i: number) => pad.l + (i / Math.max(1, vals.length - 1)) * iw
  const path = vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = vals[vals.length - 1]
  const first = vals[0]
  const pct = first ? ((last - first) / first) * 100 : 0
  const dateOf = (i: number) => pts?.[i] ? new Date(pts[i][0]).toLocaleDateString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', ...(days > 90 ? { year: '2-digit' } : {}) }) : ''

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-[#0f0f16]" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[17px] font-bold text-rose-600 dark:text-rose-300">{symbol}</span>
          {last != null && <span className="font-mono text-[15px] font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{fmt(last)}</span>}
          {vals.length > 1 && (
            <span className={`font-mono text-[12px] tabular-nums ${pct >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}% over {days}d</span>
          )}
          <div className="ml-auto flex gap-1">
            {RANGES.map((r) => (
              <button key={r.days} onClick={() => setDays(r.days)}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${days === r.days ? 'bg-rose-600 text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'}`}>{r.label}</button>
            ))}
            <button onClick={onClose} aria-label="close" className="ml-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-[12px] font-bold text-neutral-600 dark:bg-white/10 dark:text-neutral-300">✕</button>
          </div>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] tabular-nums">
          {entry != null && <span className="text-teal-700 dark:text-teal-300">— entry <b className="font-mono">{fmt(entry)}</b></span>}
          {stop != null && <span className="text-amber-700 dark:text-amber-300">— stop <b className="font-mono">{fmt(stop)}</b>{entry ? <span className="text-neutral-500"> ({(((stop - entry) / entry) * 100).toFixed(1)}% from entry)</span> : null}</span>}
          {entry != null && last != null && <span className={last >= entry ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}>position {last >= entry ? '+' : ''}{(((last - entry) / entry) * 100).toFixed(1)}%</span>}
        </div>

        {pts === undefined ? (
          <div className="py-16 text-center text-[13px] text-neutral-500">loading {days}d of prices…</div>
        ) : pts === null ? (
          <div className="py-16 text-center text-[13px] text-red-600">Price history unavailable — CoinGecko fetch failed{cgId ? '' : ' (no CoinGecko id mapped for this symbol)'}. Not a zero.</div>
        ) : (
          <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full touch-none select-none" style={{ maxHeight: h }}
            onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const f = Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width * w - pad.l) / iw)); setCursor(Math.round(f * (vals.length - 1))) }}
            onPointerLeave={() => setCursor(null)}>
            <defs>
              <linearGradient id={`hg-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity="0.25" /><stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f} className="stroke-neutral-200 dark:stroke-white/10" strokeWidth="1" strokeDasharray="3 5" />
            ))}
            <path d={`${path} L${x(vals.length - 1)},${pad.t + ih} L${pad.l},${pad.t + ih} Z`} fill={`url(#hg-${symbol})`} />
            <path d={path} fill="none" stroke="#fb7185" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
            {entry != null && (<g>
              <line x1={pad.l} x2={w - pad.r} y1={y(entry)} y2={y(entry)} stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x={w - pad.r - 4} y={y(entry) - 4} textAnchor="end" fontSize="11" fontFamily="monospace" fill="#14b8a6">entry {fmt(entry)}</text>
            </g>)}
            {stop != null && (<g>
              <line x1={pad.l} x2={w - pad.r} y1={y(stop)} y2={y(stop)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x={w - pad.r - 4} y={y(stop) + 13} textAnchor="end" fontSize="11" fontFamily="monospace" fill="#f59e0b">stop {fmt(stop)}</text>
            </g>)}
            {cursor !== null && vals[cursor] != null && (<g>
              <line x1={x(cursor)} x2={x(cursor)} y1={pad.t} y2={pad.t + ih} className="stroke-neutral-400 dark:stroke-white/40" strokeWidth="1" strokeDasharray="3 3" />
              <circle cx={x(cursor)} cy={y(vals[cursor])} r="4.5" fill="#fb7185" stroke="#000" strokeWidth="1.5" />
            </g>)}
            {[0, Math.floor((vals.length - 1) / 2), vals.length - 1].map((i) => (
              <text key={i} x={x(i)} y={h - 5} textAnchor={i === 0 ? 'start' : i === vals.length - 1 ? 'end' : 'middle'} className="fill-neutral-500 dark:fill-white/40" fontSize="10" fontFamily="monospace">{dateOf(i)}</text>
            ))}
          </svg>
        )}
        <div className="mt-1 font-mono text-[12px] text-neutral-600 dark:text-neutral-400">
          {cursor !== null && vals[cursor] != null ? `${dateOf(cursor)} · ${fmt(vals[cursor])}` : 'slide across the chart to read any day · Esc or tap outside to close'}
        </div>
      </div>
    </div>
  )
}
