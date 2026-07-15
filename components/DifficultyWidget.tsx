'use client'

import { useEffect, useState } from 'react'

const CARD_BG = '#111111'
const BORDER = '#222222'
const ORANGE = '#f7931a'
const GREEN = '#00d4aa'
const RED = '#ff4757'

interface DiffAdj {
  progressPercent: number
  difficultyChange: number
  remainingBlocks: number
  remainingTime: number      // milliseconds
  nextRetargetHeight: number
  timeAvg: number            // milliseconds per block
  previousRetarget: number
}

function msToCountdown(ms: number) {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(totalSec / 86400)
  const h = Math.floor((totalSec % 86400) / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  return { d, h, m }
}

export default function DifficultyWidget() {
  const [data, setData] = useState<DiffAdj | null>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const load = () =>
      fetch('/api/difficulty-adjustment')
        .then(r => r.json())
        .then(d => {
          if (d.error) { setError(true); return }
          setData(d)
          setError(false)
        })
        .catch(() => setError(true))

    load()
    const iv = setInterval(load, 5 * 60 * 1000)
    return () => clearInterval(iv)
  }, [])

  if (error) return null

  if (!data) {
    return (
      <div
        className="rounded-2xl animate-pulse"
        style={{ background: CARD_BG, border: `1px solid ${BORDER}`, minHeight: '228px' }}
      />
    )
  }

  const { d, h, m } = msToCountdown(data.remainingTime)
  const change = data.difficultyChange
  const isUp = change >= 0
  // For an existing miner, RISING difficulty is unfavorable (more competition,
  // less BTC per machine); falling difficulty is favorable. Color by mining
  // impact — not a generic up=green convention.
  const changeColor = isUp ? RED : GREEN
  const avgSec = data.timeAvg / 1000
  // Faster blocks => network hashrate rising => tougher for miners.
  const blocksFaster = avgSec < 600

  return (
    <div className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-white font-bold text-base">Next Difficulty Adjustment</h3>
        <span
          className="text-xs px-2 py-0.5 rounded-full font-mono"
          style={{ background: 'rgba(247,147,26,0.1)', color: ORANGE }}
        >
          #{data.nextRetargetHeight.toLocaleString()}
        </span>
      </div>

      {/* Countdown */}
      <div className="flex items-end gap-4 mb-5">
        {[
          { v: d, l: 'days' },
          { v: h, l: 'hrs' },
          { v: m, l: 'min' },
        ].map(({ v, l }) => (
          <div key={l} className="text-center">
            <div className="text-3xl font-bold font-mono text-white leading-none">
              {String(v).padStart(2, '0')}
            </div>
            <div className="text-xs text-gray-500 mt-1">{l}</div>
          </div>
        ))}
        <div className="mb-0.5 ml-1">
          <span className="text-xs text-gray-600">{data.remainingBlocks.toLocaleString()} blocks</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-5">
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#1a1a1a' }}>
          <div
            className="h-1.5 rounded-full transition-all"
            style={{ width: `${Math.min(100, data.progressPercent)}%`, background: ORANGE }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-600 mt-1.5">
          <span>Epoch start</span>
          <span>{data.progressPercent.toFixed(0)}% of 2,016 blocks</span>
          <span>Retarget</span>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
          <div className="text-xs text-gray-500 mb-1">Projected Change</div>
          <div className="text-xl font-bold font-mono" style={{ color: changeColor }}>
            {isUp ? '+' : ''}{change.toFixed(2)}%
          </div>
          <div className="text-xs mt-0.5" style={{ color: changeColor }}>
            {isUp ? '▲ up — tougher to mine' : '▼ down — better for miners'}
          </div>
        </div>
        <div className="rounded-xl p-3" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
          <div className="text-xs text-gray-500 mb-1">Avg Block Time</div>
          <div className="text-xl font-bold font-mono" style={{ color: blocksFaster ? RED : GREEN }}>
            {avgSec.toFixed(0)}s
          </div>
          <div className="text-xs mt-0.5" style={{ color: blocksFaster ? RED : GREEN }}>
            {blocksFaster ? '▲ fast — hashrate rising' : '▼ slow — hashrate falling'}
          </div>
        </div>
      </div>
      <p className="text-[11px] text-gray-500 mt-3 leading-relaxed">
        <span style={{ color: GREEN }}>Green</span> = moves in miners&apos; favor, <span style={{ color: RED }}>red</span> = against. Rising difficulty and network hashrate mean more competition for the same block rewards.
      </p>
    </div>
  )
}
