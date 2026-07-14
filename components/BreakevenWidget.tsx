'use client'

import { useState } from 'react'

const CARD_BG = '#111111'
const BORDER = '#222222'

export default function BreakevenWidget() {
  const [cost, setCost] = useState('')
  const [dailyNet, setDailyNet] = useState('')

  const costNum = parseFloat(cost)
  const netNum = parseFloat(dailyNet)

  const days = costNum > 0 && netNum > 0 ? Math.ceil(costNum / netNum) : null
  const breakevenDate = days
    ? new Date(Date.now() + days * 86400000).toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      })
    : null
  const notProfitable = netNum <= 0 && dailyNet !== ''

  return (
    <div className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <h2 className="text-lg font-bold text-white mb-1">Hardware Breakeven Calculator</h2>
      <p className="text-sm text-gray-500 mb-6">
        Enter your hardware cost and daily net profit to find out when your miner pays for itself.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Hardware Cost ($)</label>
          <input
            type="number"
            min="0"
            step="100"
            placeholder="e.g. 4500"
            value={cost}
            onChange={e => setCost(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono"
            style={{ background: '#1a1a1a', color: '#e2e8f0', border: `1px solid ${BORDER}` }}
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1.5">Daily Net Profit ($)</label>
          <input
            type="number"
            step="0.01"
            placeholder="e.g. 12.50"
            value={dailyNet}
            onChange={e => setDailyNet(e.target.value)}
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono"
            style={{ background: '#1a1a1a', color: '#e2e8f0', border: `1px solid ${BORDER}` }}
          />
          <p className="text-xs text-gray-600 mt-1">From the ROI calculator above</p>
        </div>
      </div>

      {notProfitable && (
        <div className="rounded-xl p-4 text-center" style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.2)' }}>
          <p className="text-sm font-semibold" style={{ color: '#ff4757' }}>
            ✕ No breakeven — daily net profit must be positive
          </p>
        </div>
      )}

      {days !== null && breakevenDate && (
        <div className="rounded-xl p-5" style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.2)' }}>
          <div className="grid grid-cols-2 gap-4 text-center">
            <div>
              <div className="text-xs text-gray-500 mb-1">Days to Breakeven</div>
              <div className="text-3xl font-bold font-mono" style={{ color: '#00d4aa' }}>
                {days.toLocaleString()}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                {(days / 30).toFixed(1)} months
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-1">Breakeven Date</div>
              <div className="text-lg font-bold" style={{ color: '#00d4aa' }}>
                {breakevenDate}
              </div>
              <div className="text-xs text-gray-500 mt-0.5">
                at ${netNum.toFixed(2)}/day
              </div>
            </div>
          </div>
          <p className="text-xs text-gray-600 text-center mt-4">
            Assumes constant daily profit. In practice, BTC price and difficulty change — use as a baseline, not a guarantee.
          </p>
        </div>
      )}

      {!days && !notProfitable && (
        <div className="rounded-xl p-4 text-center" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
          <p className="text-sm text-gray-600">Enter both values above to calculate</p>
        </div>
      )}
    </div>
  )
}
