'use client'

import { useEffect, useState } from 'react'

// ONE chart, every name on it: holdings as solid lines, the queue (POLE / WATCH / VERIFYING) dashed,
// each indexed to 0% at the start of the window so "where they are" is comparable at a glance.
// Legend chips carry the live price, the window move and — for holdings — the move vs the entry.
// Prices come from CoinGecko through /api/fund/history (one call per name, staggered, cached per window).

export interface PerfItem { symbol: string; cgId: string | null; kind: 'held' | 'queue'; entry: number | null; status?: string }

const RANGES = [{ label: '7d', days: 7 }, { label: '30d', days: 30 }, { label: '90d', days: 90 }] as const
const PALETTE = ['#fb7185', '#fbbf24', '#34d399', '#60a5fa', '#c084fc', '#f472b6', '#2dd4bf', '#f97316', '#a3e635', '#38bdf8', '#e879f9', '#facc15']

const fmt = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : n >= 1 ? `$${n.toFixed(2)}` : n >= 0.01 ? `$${n.toFixed(4)}` : n > 0 ? `$${n.toPrecision(3)}` : '$0'

type Series = { item: PerfItem; color: string; pts: [number, number][]; idx: number[] }

export default function PerfChart({ items, secret }: { items: PerfItem[]; secret: string }) {
  const [days, setDays] = useState<number>(30)
  // keyed by `${days}|${symbol}` so switching the window never needs a synchronous reset inside the effect
  const [data, setData] = useState<Record<string, [number, number][] | null>>({})
  const at = (sym: string) => data[`${days}|${sym}`]
  const [hidden, setHidden] = useState<Record<string, boolean>>({})
  const [cursor, setCursor] = useState<number | null>(null)
  const key = items.map((i) => i.symbol).join(',')

  useEffect(() => {
    let dead = false
    const want = items.filter((i) => i.cgId)
    ;(async () => {
      for (let k = 0; k < want.length; k++) {
        const it = want[k]
        try {
          // via our server: CoinGecko sends no CORS header on market_chart, so a browser fetch always fails (2026-09-07)
          const r = await fetch(`/api/fund/history?id=${encodeURIComponent(it.cgId as string)}&days=${days}&secret=${encodeURIComponent(secret)}`, { cache: 'no-store' })
          const j = r.ok ? ((await r.json()) as { prices?: [number, number][] }) : null
          const raw = j?.prices ?? []
          const step = Math.max(1, Math.ceil(raw.length / 200))
          const thin = raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
          if (!dead) setData((d) => ({ ...d, [`${days}|${it.symbol}`]: thin.length > 1 ? thin : null }))
        } catch { if (!dead) setData((d) => ({ ...d, [`${days}|${it.symbol}`]: null })) }
        if (k < want.length - 1) await new Promise((res) => setTimeout(res, 250))
      }
    })()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, days])

  const w = 900, h = 260
  const pad = { l: 8, r: 8, t: 14, b: 20 }
  const iw = w - pad.l - pad.r, ih = h - pad.t - pad.b
  // Resample every series onto a common time grid (n points across the window) so one x maps to one date.
  const n = 120
  // The window's clock comes from the data itself (latest point across loaded series), never from Date.now() in render.
  const loaded = items.map((i) => at(i.symbol)).filter((p): p is [number, number][] => !!p && p.length > 0)
  const nowMs = loaded.length ? Math.max(...loaded.map((p) => p[p.length - 1][0])) : 0
  const startMs = nowMs - days * 86400e3
  const tAt = (i: number) => startMs + (i / (n - 1)) * (nowMs - startMs)
  const series: Series[] = items.map((item, k) => {
    const pts = at(item.symbol) ?? null
    if (!pts) return { item, color: PALETTE[k % PALETTE.length], pts: [], idx: [] }
    const base = pts[0][1]
    const idx: number[] = []
    let j = 0
    for (let i = 0; i < n; i++) {
      const t = tAt(i)
      while (j < pts.length - 1 && pts[j + 1][0] <= t) j++
      idx.push((pts[j][1] / base - 1) * 100)
    }
    return { item, color: PALETTE[k % PALETTE.length], pts, idx }
  })
  const shown = series.filter((s) => s.idx.length && !hidden[s.item.symbol])
  const all = shown.flatMap((s) => s.idx)
  const lo = all.length ? Math.min(0, ...all) : -1, hi = all.length ? Math.max(0, ...all) : 1
  const span = hi - lo || 1
  const y = (v: number) => pad.t + ih - ((v - lo) / span) * ih
  const x = (i: number) => pad.l + (i / (n - 1)) * iw
  const dateAt = (i: number) => new Date(tAt(i)).toLocaleDateString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric' })
  const loading = items.some((i) => i.cgId && at(i.symbol) === undefined)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        {series.map((s) => {
          const last = s.pts.length ? s.pts[s.pts.length - 1][1] : null
          const win = s.idx.length ? s.idx[s.idx.length - 1] : null
          const vsEntry = last != null && s.item.entry ? (last / s.item.entry - 1) * 100 : null
          const off = hidden[s.item.symbol]
          return (
            <button key={s.item.symbol} onClick={() => setHidden((hh) => ({ ...hh, [s.item.symbol]: !hh[s.item.symbol] }))}
              className={`flex items-center gap-1.5 rounded-lg border px-2 py-0.5 text-[11px] transition-all ${off ? 'opacity-35' : ''} border-neutral-200 bg-white hover:bg-neutral-50 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10`}>
              <span className="inline-block h-2 w-4 rounded-sm" style={{ background: s.color, opacity: s.item.kind === 'queue' ? 0.55 : 1, borderBottom: s.item.kind === 'queue' ? `2px dashed ${s.color}` : undefined }} />
              <span className="font-bold text-neutral-700 dark:text-neutral-200">{s.item.symbol}</span>
              {s.item.kind === 'queue' && <span className="rounded bg-neutral-100 px-1 text-[9px] uppercase tracking-wide text-neutral-500 dark:bg-white/10">{s.item.status ?? 'queue'}</span>}
              {last != null ? <span className="font-mono text-neutral-600 dark:text-neutral-300">{fmt(last)}</span> : <span className="text-neutral-400">{at(s.item.symbol) === null ? 'n/a' : '…'}</span>}
              {win != null && <span className={`font-mono ${win >= 0 ? 'text-emerald-600 dark:text-emerald-300' : 'text-rose-600 dark:text-rose-300'}`}>{win >= 0 ? '+' : ''}{win.toFixed(1)}%</span>}
              {vsEntry != null && <span className={`font-mono text-[10px] ${vsEntry >= 0 ? 'text-emerald-600/80 dark:text-emerald-300/80' : 'text-rose-600/80 dark:text-rose-300/80'}`}>vs entry {vsEntry >= 0 ? '+' : ''}{vsEntry.toFixed(1)}%</span>}
            </button>
          )
        })}
        <div className="ml-auto flex gap-1">
          {RANGES.map((r) => (
            <button key={r.days} onClick={() => setDays(r.days)}
              className={`rounded-lg px-2.5 py-1 text-[12px] font-bold ${days === r.days ? 'bg-neutral-800 text-white dark:bg-white dark:text-black' : 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'}`}>{r.label}</button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${w} ${h}`} className="w-full touch-none select-none" style={{ maxHeight: h }}
        onPointerMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const f = Math.min(1, Math.max(0, ((e.clientX - r.left) / r.width * w - pad.l) / iw)); setCursor(Math.round(f * (n - 1))) }}
        onPointerLeave={() => setCursor(null)}>
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad.l} x2={w - pad.r} y1={pad.t + ih * f} y2={pad.t + ih * f} className="stroke-neutral-200 dark:stroke-white/10" strokeWidth="1" strokeDasharray="3 5" />
        ))}
        {/* zero line = the start of the window */}
        <line x1={pad.l} x2={w - pad.r} y1={y(0)} y2={y(0)} className="stroke-neutral-400 dark:stroke-white/30" strokeWidth="1" />
        <text x={pad.l + 2} y={y(0) - 3} fontSize="9" fontFamily="monospace" className="fill-neutral-500 dark:fill-white/40">0% · {dateAt(0)}</text>
        {shown.map((s) => (
          <path key={s.item.symbol} d={s.idx.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')}
            fill="none" stroke={s.color} strokeWidth={s.item.kind === 'held' ? 2.4 : 1.6} strokeDasharray={s.item.kind === 'queue' ? '5 4' : undefined}
            strokeLinejoin="round" strokeLinecap="round" opacity={s.item.kind === 'queue' ? 0.8 : 1} />
        ))}
        {shown.map((s) => (
          <g key={`e${s.item.symbol}`}>
            <circle cx={x(n - 1)} cy={y(s.idx[n - 1])} r="3.5" fill={s.color} />
            <text x={x(n - 1) - 6} y={y(s.idx[n - 1]) + 3.5} textAnchor="end" fontSize="10" fontFamily="monospace" fontWeight="bold" fill={s.color}>{s.item.symbol}</text>
          </g>
        ))}
        {cursor !== null && (
          <g>
            <line x1={x(cursor)} x2={x(cursor)} y1={pad.t} y2={pad.t + ih} className="stroke-neutral-400 dark:stroke-white/40" strokeWidth="1" strokeDasharray="3 3" />
            {shown.map((s) => <circle key={s.item.symbol} cx={x(cursor)} cy={y(s.idx[cursor])} r="3.5" fill={s.color} stroke="#000" strokeWidth="1" />)}
          </g>
        )}
        {[0, Math.floor((n - 1) / 2), n - 1].map((i) => (
          <text key={i} x={x(i)} y={h - 5} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'} className="fill-neutral-500 dark:fill-white/40" fontSize="10" fontFamily="monospace">{dateAt(i)}</text>
        ))}
      </svg>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px]">
        {cursor !== null ? (
          <>
            <span className="text-neutral-700 dark:text-neutral-200">{dateAt(cursor)}</span>
            {shown.map((s) => <span key={s.item.symbol} style={{ color: s.color }}>{s.item.symbol} {s.idx[cursor] >= 0 ? '+' : ''}{s.idx[cursor].toFixed(1)}%</span>)}
          </>
        ) : (
          <span className="text-neutral-500 dark:text-white/40">{loading ? 'loading prices…' : 'solid = held · dashed = up next · indexed to 0% at the window start · click a chip to hide'}</span>
        )}
      </div>
    </div>
  )
}
