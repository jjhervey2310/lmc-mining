'use client'

import { useEffect, useState } from 'react'

const CARD_BG = '#111111'
const BORDER = '#222222'
const ORANGE = '#f7931a'

interface Row {
  snapshot_date: string
  btc_price: number
  hashprice_usd: number
}

// SVG viewport constants
const VW = 600
const VH = 150
const PAD = { top: 14, right: 14, bottom: 30, left: 50 }
const PLOT_W = VW - PAD.left - PAD.right
const PLOT_H = VH - PAD.top - PAD.bottom

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
  })
}

function fmtHP(v: number): string {
  return `$${v.toFixed(0)}`
}

export default function HashpriceChart() {
  const [rows, setRows] = useState<Row[] | null>(null)

  useEffect(() => {
    fetch('/api/hashprice-history')
      .then(r => r.json())
      .then(d => setRows(Array.isArray(d.rows) ? d.rows : []))
      .catch(() => setRows([]))
  }, [])

  if (rows === null) {
    return (
      <div
        className="rounded-2xl animate-pulse"
        style={{ background: CARD_BG, border: `1px solid ${BORDER}`, minHeight: '228px' }}
      />
    )
  }

  const latest = rows.length > 0 ? rows[rows.length - 1] : null

  return (
    <div className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-white font-bold text-base">Hashprice — 30 Day History</h3>
        {latest && (
          <span className="font-mono text-sm font-bold" style={{ color: ORANGE }}>
            ${latest.hashprice_usd.toFixed(2)}/PH/day
          </span>
        )}
      </div>
      <p className="text-xs text-gray-600 mb-4">Daily snapshot · midnight UTC</p>

      {rows.length < 7 ? (
        <div
          className="flex flex-col items-center justify-center rounded-xl"
          style={{ height: '130px', background: '#0a0a0a', border: `1px solid ${BORDER}` }}
        >
          <div className="text-2xl mb-2">📊</div>
          <div className="text-sm text-gray-400 font-medium">Building historical data — check back soon</div>
          <div className="text-xs text-gray-600 mt-1">Captures daily at midnight UTC</div>
        </div>
      ) : (
        <ChartSVG rows={rows} />
      )}
    </div>
  )
}

function ChartSVG({ rows }: { rows: Row[] }) {
  const values = rows.map(r => r.hashprice_usd)
  const rawMin = Math.min(...values)
  const rawMax = Math.max(...values)
  const pad = (rawMax - rawMin) * 0.12 || rawMax * 0.05
  const minV = rawMin - pad
  const maxV = rawMax + pad
  const rangeV = maxV - minV

  const x = (i: number) =>
    PAD.left + (rows.length > 1 ? (i / (rows.length - 1)) * PLOT_W : PLOT_W / 2)
  const y = (v: number) => PAD.top + PLOT_H - ((v - minV) / rangeV) * PLOT_H

  const linePoints = rows.map((r, i) => `${x(i).toFixed(1)},${y(r.hashprice_usd).toFixed(1)}`).join(' ')

  const areaPath = [
    `M ${x(0).toFixed(1)} ${(PAD.top + PLOT_H).toFixed(1)}`,
    ...rows.map((r, i) => `L ${x(i).toFixed(1)} ${y(r.hashprice_usd).toFixed(1)}`),
    `L ${x(rows.length - 1).toFixed(1)} ${(PAD.top + PLOT_H).toFixed(1)}`,
    'Z',
  ].join(' ')

  // Four evenly-spaced date labels
  const dateIdxs = Array.from({ length: 4 }, (_, k) =>
    Math.round((k / 3) * (rows.length - 1))
  )

  // Y-axis: 3 reference lines at min, mid, max of raw data
  const yRefs = [rawMin, (rawMin + rawMax) / 2, rawMax]

  const lastIdx = rows.length - 1
  const lastX = x(lastIdx)
  const lastY = y(rows[lastIdx].hashprice_usd)

  return (
    <svg
      viewBox={`0 0 ${VW} ${VH}`}
      className="w-full"
      style={{ display: 'block' }}
      aria-label="Hashprice 30-day history chart"
    >
      <defs>
        <linearGradient id="hp-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.22" />
          <stop offset="100%" stopColor={ORANGE} stopOpacity="0.01" />
        </linearGradient>
      </defs>

      {/* Grid lines */}
      {yRefs.map((v, i) => (
        <line
          key={i}
          x1={PAD.left} y1={y(v).toFixed(1)}
          x2={VW - PAD.right} y2={y(v).toFixed(1)}
          stroke="#1e1e1e" strokeWidth="1"
        />
      ))}

      {/* Area fill */}
      <path d={areaPath} fill="url(#hp-fill)" />

      {/* Line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke={ORANGE}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Current value dot */}
      <circle cx={lastX.toFixed(1)} cy={lastY.toFixed(1)} r="3.5" fill={ORANGE} />

      {/* Y-axis labels */}
      {yRefs.map((v, i) => (
        <text
          key={i}
          x={PAD.left - 6}
          y={y(v).toFixed(1)}
          textAnchor="end"
          dominantBaseline="middle"
          fontSize="10"
          fill="#4b5563"
        >
          {fmtHP(v)}
        </text>
      ))}

      {/* X-axis date labels */}
      {dateIdxs.map(i => (
        <text
          key={i}
          x={x(i).toFixed(1)}
          y={VH - 4}
          textAnchor={i === 0 ? 'start' : i === rows.length - 1 ? 'end' : 'middle'}
          fontSize="10"
          fill="#4b5563"
        >
          {fmtDate(rows[i].snapshot_date)}
        </text>
      ))}
    </svg>
  )
}
