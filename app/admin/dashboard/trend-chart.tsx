'use client'

import { useState } from 'react'

// The snapshot chart: BTC, hashprice and difficulty on one canvas (Jacob asked
// for "a line for the other two"). Each series is normalised to its own min/max
// so three very different units share one plot — the shape is what matters, and
// each legend chip carries the real current value. Click a chip to isolate.

export interface Series { key: string; label: string; color: string; points: number[]; format: (n: number) => string }

export default function TrendChart({ series, labels, w = 900, h = 220 }: {
  series: Series[]
  labels: string[]
  w?: number
  h?: number
}) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  // Scrub index: slide across the chart to read every series on that date.
  const [cursor, setCursor] = useState<number | null>(null)
  const shown = series.filter((s) => !hidden[s.key] && s.points.length > 1)
  const pad = { l: 8, r: 8, t: 14, b: 18 }
  const iw = w - pad.l - pad.r
  const ih = h - pad.t - pad.b
  const n = Math.max(...series.map((s) => s.points.length), 2)

  /** Normalise each series to its own range so three units share one plot. */
  const path = (pts: number[]) => {
    const lo = Math.min(...pts), hi = Math.max(...pts)
    const span = hi - lo || 1
    return pts.map((v, i) => {
      const x = pad.l + (i / (pts.length - 1)) * iw
      const y = pad.t + ih - ((v - lo) / span) * ih
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`
    }).join(' ')
  }

  return (
    <div>
      {/* Legend — each chip shows the live value and toggles its line */}
      <div className="mb-2 flex flex-wrap gap-2">
        {series.map((s) => {
          const last = s.points[s.points.length - 1]
          const first = s.points[0]
          const pct = first ? ((last - first) / Math.abs(first)) * 100 : 0
          const off = hidden[s.key]
          return (
            <button key={s.key} onClick={() => setHidden((h) => ({ ...h, [s.key]: !h[s.key] }))}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-1 text-[12px] transition-all ${off ? 'opacity-40' : ''} border-neutral-200 bg-white hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10`}>
              <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: s.color, boxShadow: `0 0 10px ${s.color}` }} />
              <span className="text-neutral-600 dark:text-neutral-400">{s.label}</span>
              <span className="font-mono font-bold" style={{ color: s.color }}>{s.format(last)}</span>
              <span className={`font-mono text-[11px] ${pct >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>
                {pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
              </span>
            </button>
          )
        })}
      </div>

      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full touch-none select-none"
        style={{ maxHeight: h }}
        onPointerMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const rel = ((e.clientX - r.left) / r.width) * w
          const f = Math.min(1, Math.max(0, (rel - pad.l) / iw))
          setCursor(Math.round(f * (n - 1)))
        }}
        onPointerLeave={() => setCursor(null)}
      >
        <defs>
          {shown.map((s) => (
            <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity="0.28" />
              <stop offset="100%" stopColor={s.color} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {/* horizon grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f}
            className="stroke-neutral-200 dark:stroke-white/10" strokeWidth="1" strokeDasharray="3 5" />
        ))}

        {shown.map((s, si) => {
          const d = path(s.points)
          const lo = Math.min(...s.points), hi = Math.max(...s.points)
          const span = hi - lo || 1
          const lastX = pad.l + iw
          const lastY = pad.t + ih - ((s.points[s.points.length - 1] - lo) / span) * ih
          return (
            <g key={s.key}>
              <path d={`${d} L${lastX},${pad.t + ih} L${pad.l},${pad.t + ih} Z`} fill={`url(#grad-${s.key})`} opacity="0.9" />
              <path d={d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                className="lmc-draw" style={{ ['--lmc-dash' as string]: 2600, animationDelay: `${si * 160}ms`, filter: `drop-shadow(0 0 6px ${s.color}66)` }} />
              {/* live end-point */}
              <circle cx={lastX} cy={lastY} r="4" fill={s.color} />
              <circle cx={lastX} cy={lastY} r="7" fill={s.color} opacity="0.25" className="lmc-pulse" />
            </g>
          )
        })}

        {/* scrub crosshair + per-series dots at the cursor */}
        {cursor !== null && (() => {
          const cx = pad.l + (cursor / (n - 1)) * iw
          return (
            <g>
              <line x1={cx} x2={cx} y1={pad.t} y2={pad.t + ih}
                className="stroke-neutral-400 dark:stroke-white/40" strokeWidth="1" strokeDasharray="3 3" />
              {shown.map((s) => {
                const v = s.points[Math.min(cursor, s.points.length - 1)]
                if (v == null) return null
                const lo = Math.min(...s.points), hi = Math.max(...s.points)
                const cy = pad.t + ih - ((v - lo) / (hi - lo || 1)) * ih
                return <circle key={s.key} cx={cx} cy={cy} r="4.5" fill={s.color} stroke="#000" strokeWidth="1.5" />
              })}
            </g>
          )
        })()}

        {/* date ticks: first, middle, last */}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => labels[i] ? (
          <text key={i} x={pad.l + (i / (n - 1)) * iw} y={h - 4}
            textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}
            className="fill-neutral-500 dark:fill-white/40" fontSize="10" fontFamily="monospace">
            {labels[i].slice(5)}
          </text>
        ) : null)}
      </svg>

      {/* Readout: the date you're hovering plus every series' value that day. */}
      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[12px]">
        {cursor !== null ? (
          <>
            <span className="text-neutral-700 dark:text-neutral-200">{labels[cursor] ?? '—'}</span>
            {shown.map((s) => {
              const v = s.points[Math.min(cursor, s.points.length - 1)]
              return v == null ? null : (
                <span key={s.key} style={{ color: s.color }}>{s.label} {s.format(v)}</span>
              )
            })}
          </>
        ) : (
          <span className="text-neutral-500 dark:text-white/40">slide across the chart to read any day · click a chip to hide a line</span>
        )}
      </div>
    </div>
  )
}
