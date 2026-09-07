'use client'

import { useEffect, useMemo, useState } from 'react'

// Click-a-name chart (build request #4, compare mode 2026-09-07): the coin's price history up
// to a year back from CoinGecko, with ENTRY and STOP drawn as lines. Tap other names in the chip
// row to overlay them — with two or more selected the chart switches to % change from the start
// of the range so different-priced coins compare on one axis. Read-only.

const RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: '1y', days: 365 },
] as const

const COLORS = ['#fb7185', '#5eead4', '#fbbf24', '#a78bfa', '#60a5fa', '#34d399', '#f472b6', '#fb923c', '#c084fc', '#38bdf8', '#a3e635', '#f87171']

const fmt = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'
const pctFmt = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

export interface ChartName { symbol: string; cgId: string | null }
type Series = [number, number][] | null | undefined   // undefined = loading, null = failed

export default function HoldingChart({ symbol, cgId, entry, stop, others = [], onClose }: {
  symbol: string
  cgId: string | null
  entry: number | null
  stop: number | null
  /** every other name on the tab (holdings + queue) that can be overlaid for comparison */
  others?: ChartName[]
  onClose: () => void
}) {
  const [days, setDays] = useState<number>(90)
  const [sel, setSel] = useState<string[]>([symbol])
  const [data, setData] = useState<Record<string, Series>>({})
  const [cursor, setCursor] = useState<number | null>(null)

  const names = useMemo<ChartName[]>(() => {
    const seen = new Set<string>()
    return [{ symbol, cgId }, ...others].filter((n) => (seen.has(n.symbol) ? false : (seen.add(n.symbol), true)))
  }, [symbol, cgId, others])
  const idOf = (s: string) => names.find((n) => n.symbol === s)?.cgId ?? null

  // Fetch each selected symbol for the current range; cache by symbol+days so toggling is instant.
  useEffect(() => {
    let dead = false
    for (const s of sel) {
      const key = `${s}:${days}`
      if (data[key] !== undefined) continue
      const id = idOf(s)
      if (!id) { setData((d) => ({ ...d, [key]: null })); continue }
      setData((d) => ({ ...d, [key]: undefined }))
      ;(async () => {
        try {
          const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`)
          if (!r.ok) { if (!dead) setData((d) => ({ ...d, [key]: null })); return }
          const j = (await r.json()) as { prices?: [number, number][] }
          const raw = j.prices ?? []
          const step = Math.max(1, Math.ceil(raw.length / 240))   // ~240 points keeps the SVG light on a phone
          const thin = raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
          if (!dead) setData((d) => ({ ...d, [key]: thin.length > 1 ? thin : null }))
        } catch { if (!dead) setData((d) => ({ ...d, [key]: null })) }
      })()
    }
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, days])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const toggle = (s: string) => setSel((cur) => cur.includes(s) ? (cur.length > 1 ? cur.filter((x) => x !== s) : cur) : [...cur, s])
  const compare = sel.length > 1
  const colorOf = (s: string) => COLORS[Math.max(0, names.findIndex((n) => n.symbol === s)) % COLORS.length]

  // Series in draw form: price (single) or % from the first point (compare), sampled onto the primary's x-grid by index.
  const primary = data[`${sel[0]}:${days}`]
  const loading = sel.some((s) => data[`${s}:${days}`] === undefined)
  const drawn = sel.map((s) => {
    const pts = data[`${s}:${days}`]
    if (!pts) return { s, vals: [] as number[], pts, base: 0 }
    const base = pts[0][1]
    return { s, pts, base, vals: pts.map((p) => compare ? ((p[1] - base) / base) * 100 : p[1]) }
  })
  const w = 900, h = 300
  const pad = { l: 8, r: 8, t: 12, b: 20 }
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b
  const allVals = drawn.flatMap((d) => d.vals)
  const lo = allVals.length ? Math.min(...allVals, ...(!compare && entry ? [entry] : []), ...(!compare && stop ? [stop] : []), ...(compare ? [0] : [])) : 0
  const hi = allVals.length ? Math.max(...allVals, ...(!compare && entry ? [entry] : []), ...(compare ? [0] : [])) : 1
  const span = hi - lo || 1
  const y = (v: number) => pad.t + ih - ((v - lo) / span) * ih
  const xOf = (i: number, n: number) => pad.l + (i / Math.max(1, n - 1)) * iw
  const pathOf = (vals: number[]) => vals.map((v, i) => `${i === 0 ? 'M' : 'L'}${xOf(i, vals.length).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const n0 = primary?.length ?? 0
  const dateOf = (i: number) => primary?.[i] ? new Date(primary[i][0]).toLocaleDateString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', ...(days > 90 ? { year: '2-digit' } : {}) }) : ''
  const single = drawn[0]
  const last = single?.pts ? single.pts[single.pts.length - 1][1] : null
  const singlePct = single?.pts ? ((last as number) - single.base) / single.base * 100 : null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-2 sm:items-center" onClick={onClose}>
      <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-3 shadow-2xl dark:border-white/10 dark:bg-[#0f0f16]" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[17px] font-bold text-rose-600 dark:text-rose-300">{compare ? `${sel.length} names` : sel[0]}</span>
          {!compare && last != null && <span className="font-mono text-[15px] font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{fmt(last)}</span>}
          {!compare && singlePct != null && (
            <span className={`font-mono text-[12px] tabular-nums ${singlePct >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{singlePct >= 0 ? '▲' : '▼'}{Math.abs(singlePct).toFixed(1)}% over {days}d</span>
          )}
          {compare && <span className="text-[12px] text-neutral-500">% change from the start of the range</span>}
          <div className="ml-auto flex gap-1">
            {RANGES.map((r) => (
              <button key={r.days} onClick={() => setDays(r.days)}
                className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${days === r.days ? 'bg-rose-600 text-white' : 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'}`}>{r.label}</button>
            ))}
            <button onClick={onClose} aria-label="close" className="ml-1 rounded-lg bg-neutral-100 px-2.5 py-1 text-[12px] font-bold text-neutral-600 dark:bg-white/10 dark:text-neutral-300">✕</button>
          </div>
        </div>

        {/* compare chips — tap to add or remove a name; the first one can't be removed */}
        {names.length > 1 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {names.map((nm) => {
              const on = sel.includes(nm.symbol); const c = colorOf(nm.symbol)
              const d = data[`${nm.symbol}:${days}`]
              const chg = on && d ? ((d[d.length - 1][1] - d[0][1]) / d[0][1]) * 100 : null
              return (
                <button key={nm.symbol} onClick={() => toggle(nm.symbol)} disabled={!nm.cgId} title={nm.cgId ? (on ? 'remove from chart' : 'add to chart') : 'no price feed for this symbol'}
                  className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] font-bold ${on ? 'border-transparent text-white' : 'border-neutral-200 text-neutral-600 dark:border-white/10 dark:text-neutral-300'} disabled:opacity-40`}
                  style={on ? { background: c } : undefined}>
                  <span className="inline-block h-2 w-2 rounded-full" style={{ background: on ? '#fff' : c }} />
                  {nm.symbol}
                  {chg != null && <span className="font-mono font-normal opacity-90">{pctFmt(chg)}</span>}
                </button>
              )
            })}
          </div>
        )}

        {!compare && (
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[12px] tabular-nums">
            {entry != null && <span className="text-teal-700 dark:text-teal-300">— entry <b className="font-mono">{fmt(entry)}</b></span>}
            {stop != null && <span className="text-amber-700 dark:text-amber-300">— stop <b className="font-mono">{fmt(stop)}</b>{entry ? <span className="text-neutral-500"> ({(((stop - entry) / entry) * 100).toFixed(1)}% from entry)</span> : null}</span>}
            {entry != null && last != null && <span className={last >= entry ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}>position {last >= entry ? '+' : ''}{(((last - entry) / entry) * 100).toFixed(1)}%</span>}
          </div>
        )}

        {loading && !primary ? (
          <div className="py-16 text-center text-[13px] text-neutral-500">loading {days}d of prices…</div>
        ) : primary === null ? (
          <div className="py-16 text-center text-[13px] text-red-600">Price history unavailable — CoinGecko fetch failed{idOf(sel[0]) ? '' : ' (no CoinGecko id mapped for this symbol)'}. Not a zero.</div>
        ) : (
          <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 w-full touch-none select-none" style={{ maxHeight: h }}
            onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const f = Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width * w - pad.l) / iw)); setCursor(Math.round(f * (n0 - 1))) }}
            onPointerLeave={() => setCursor(null)}>
            <defs>
              <linearGradient id={`hg-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fb7185" stopOpacity="0.25" /><stop offset="100%" stopColor="#fb7185" stopOpacity="0" />
              </linearGradient>
            </defs>
            {[0, 0.25, 0.5, 0.75, 1].map((f) => (
              <line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f} className="stroke-neutral-200 dark:stroke-white/10" strokeWidth="1" strokeDasharray="3 5" />
            ))}
            {compare && lo < 0 && hi > 0 && (
              <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} className="stroke-neutral-400 dark:stroke-white/30" strokeWidth="1" />
            )}
            {!compare && single?.vals.length ? (
              <path d={`${pathOf(single.vals)} L${xOf(single.vals.length - 1, single.vals.length)},${pad.t + ih} L${pad.l},${pad.t + ih} Z`} fill={`url(#hg-${symbol})`} />
            ) : null}
            {drawn.map((d) => d.vals.length > 1 ? (
              <path key={d.s} d={pathOf(d.vals)} fill="none" stroke={colorOf(d.s)} strokeWidth={compare ? 2 : 2.2} strokeLinejoin="round" strokeLinecap="round" />
            ) : null)}
            {!compare && entry != null && (<g>
              <line x1={pad.l} x2={w - pad.r} y1={y(entry)} y2={y(entry)} stroke="#14b8a6" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x={w - pad.r - 4} y={y(entry) - 4} textAnchor="end" fontSize="11" fontFamily="monospace" fill="#14b8a6">entry {fmt(entry)}</text>
            </g>)}
            {!compare && stop != null && (<g>
              <line x1={pad.l} x2={w - pad.r} y1={y(stop)} y2={y(stop)} stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="6 4" />
              <text x={w - pad.r - 4} y={y(stop) + 13} textAnchor="end" fontSize="11" fontFamily="monospace" fill="#f59e0b">stop {fmt(stop)}</text>
            </g>)}
            {cursor !== null && n0 > 0 && (<g>
              <line x1={xOf(cursor, n0)} x2={xOf(cursor, n0)} y1={pad.t} y2={pad.t + ih} className="stroke-neutral-400 dark:stroke-white/40" strokeWidth="1" strokeDasharray="3 3" />
              {drawn.map((d) => {
                const i = Math.min(cursor, d.vals.length - 1); const v = d.vals[i]
                return v == null ? null : <circle key={d.s} cx={xOf(i, d.vals.length)} cy={y(v)} r="4.5" fill={colorOf(d.s)} stroke="#000" strokeWidth="1.5" />
              })}
            </g>)}
            {[0, Math.floor((n0 - 1) / 2), n0 - 1].map((i) => (
              <text key={i} x={xOf(i, n0)} y={h - 5} textAnchor={i === 0 ? 'start' : i === n0 - 1 ? 'end' : 'middle'} className="fill-neutral-500 dark:fill-white/40" fontSize="10" fontFamily="monospace">{dateOf(i)}</text>
            ))}
          </svg>
        )}
        <div className="mt-1 flex flex-wrap gap-x-3 font-mono text-[12px] text-neutral-600 dark:text-neutral-400">
          {cursor !== null && n0 > 0 ? (
            <>
              <span>{dateOf(cursor)}</span>
              {drawn.map((d) => {
                const i = Math.min(cursor, d.vals.length - 1); const v = d.vals[i]
                return v == null ? null : <span key={d.s} style={{ color: colorOf(d.s) }}>{d.s} {compare ? pctFmt(v) : fmt(v)}</span>
              })}
            </>
          ) : (
            <span>{names.length > 1 ? 'tap names above to compare · ' : ''}slide across the chart to read any day · Esc or tap outside to close</span>
          )}
        </div>
      </div>
    </div>
  )
}
