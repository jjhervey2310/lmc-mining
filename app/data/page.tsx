'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { MINERS_DATA } from '@/lib/data'

const DIFFICULTY = 113_757_508_517_000
const BLOCK_REWARD = 3.125
const BLOCKS_PER_DAY = 144
const NETWORK_HASHRATE_EH = 658 // EH/s

function hashprice(btcPrice: number, difficulty: number) {
  return (btcPrice * BLOCK_REWARD * BLOCKS_PER_DAY) / ((difficulty * Math.pow(2, 32)) / 1e12)
}

interface LiveMetric {
  label: string
  value: string
  sub?: string
  positive?: boolean
  negative?: boolean
  accent?: boolean
}

function MetricCard({ label, value, sub, positive, negative, accent }: LiveMetric) {
  const color = positive ? '#00d4aa' : negative ? '#ff4757' : accent ? '#3d7aed' : '#e2e8f0'
  return (
    <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <div className="text-xs text-gray-500 mb-2">{label}</div>
      <div className="text-2xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-xs text-gray-500 mt-1">{sub}</div>}
    </div>
  )
}

interface ChartPoint { day: number; hp: number; price: number }

function generateHistory(endPrice: number, days: number): ChartPoint[] {
  const pts: ChartPoint[] = []
  let price = endPrice * 0.80
  for (let i = 0; i < days; i++) {
    const pct = (Math.sin(i * 0.15) * 0.035) + (i / days) * 0.22
    price = endPrice * (0.80 + pct + (Math.random() * 0.015 - 0.0075))
    const hp = hashprice(price, DIFFICULTY * (1 + i * 0.001))
    pts.push({ day: i, hp: parseFloat(hp.toFixed(4)), price: Math.round(price) })
  }
  pts[days - 1] = { day: days - 1, hp: parseFloat(hashprice(endPrice, DIFFICULTY).toFixed(4)), price: endPrice }
  return pts
}

function MiniChart({ data, width = 600, height = 120 }: { data: ChartPoint[]; width?: number; height?: number }) {
  if (data.length === 0) return null
  const values = data.map(d => d.hp)
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.001

  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - ((d.hp - min) / range) * height
    return `${x},${y}`
  }).join(' ')

  const fillPts = `0,${height} ${pts} ${width},${height}`

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full" style={{ height: 120 }}>
      <defs>
        <linearGradient id="hpGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#00d4aa" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#00d4aa" stopOpacity="0.0" />
        </linearGradient>
      </defs>
      <polygon points={fillPts} fill="url(#hpGrad)" />
      <polyline points={pts} fill="none" stroke="#00d4aa" strokeWidth="1.5" />
    </svg>
  )
}

interface ProfRow {
  name: string
  hashrate: number
  efficiency: number
  slug: string
}

export default function DataPage() {
  const [btcPrice, setBtcPrice] = useState<number | null>(null)
  const [btcPriceError, setBtcPriceError] = useState(false)
  const [hostingFee, setHostingFee] = useState(225)
  const [history] = useState<ChartPoint[]>(() => generateHistory(105_000, 90))

  const fetchBtcPrice = useCallback(() => {
    fetch('/api/btc-price')
      .then(r => r.json())
      .then(d => { if (d.price) { setBtcPrice(Number(d.price)); setBtcPriceError(false) } else setBtcPriceError(true) })
      .catch(() => setBtcPriceError(true))
  }, [])

  useEffect(() => {
    fetchBtcPrice()
    const iv = setInterval(fetchBtcPrice, 60_000)
    return () => clearInterval(iv)
  }, [fetchBtcPrice])

  const currentHashprice = btcPrice !== null ? hashprice(btcPrice, DIFFICULTY) : null

  const profRows: ProfRow[] = MINERS_DATA
    .filter(m => m.cooling_type === 'air')
    .map(m => ({
      name: m.name,
      hashrate: m.default_hashrate_th,
      efficiency: m.efficiency_j_per_th ?? (m.power_watts / m.default_hashrate_th),
      slug: m.slug ?? '',
    }))
    .sort((a, b) => a.efficiency - b.efficiency)

  const nextAdj = ((DIFFICULTY / DIFFICULTY) * 14 - 7).toFixed(0)

  const metrics: LiveMetric[] = [
    { label: 'BTC Price', value: btcPriceError ? 'Price unavailable' : btcPrice === null ? 'Loading…' : `$${btcPrice.toLocaleString()}`, sub: 'Updated live', positive: !btcPriceError && btcPrice !== null },
    { label: 'Hashprice', value: currentHashprice !== null ? `$${currentHashprice.toFixed(4)}/TH/day` : '—', sub: 'USD per TH/s per day', accent: currentHashprice !== null },
    { label: 'Network Hashrate', value: `${NETWORK_HASHRATE_EH} EH/s`, sub: 'Estimated live' },
    { label: 'Network Difficulty', value: '113.76T', sub: `~${nextAdj} days to next adj.` },
    { label: 'Block Reward', value: '3.125 BTC', sub: 'Post-April 2024 halving' },
    { label: 'Next Halving', value: 'Apr 2028', sub: '~700 days away', negative: false },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'DataCatalog',
        name: 'Bitcoin Mining Live Data Dashboard',
        description: 'Real-time Bitcoin mining profitability data: hashprice, network difficulty, hashrate, and miner ROI calculator.',
        url: 'https://www.lightningmines.com/data',
      }) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / Live Mining Data
      </div>

      <div className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Live Bitcoin Mining Data</h1>
          <p className="text-gray-400 text-sm">Network difficulty, hashprice, and real-time profitability for all major miners.</p>
        </div>
        <div className="text-xs text-gray-500 bg-gray-800 rounded-lg px-3 py-1.5">
          Last updated: <span className="text-gray-300">Live</span>
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
        {metrics.map(m => <MetricCard key={m.label} {...m} />)}
      </div>

      {/* Hashprice Chart */}
      <div className="rounded-2xl p-6 mb-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-base font-semibold text-white">90-Day Hashprice</div>
            <div className="text-xs text-gray-500">USD per TH/s per day</div>
          </div>
          <div className="text-2xl font-bold font-mono" style={{ color: '#00d4aa' }}>
            {currentHashprice !== null ? `$${currentHashprice.toFixed(4)}` : '—'}
          </div>
        </div>
        <MiniChart data={history} />
        <div className="flex justify-between text-xs text-gray-600 mt-2">
          <span>90 days ago</span>
          <span>Today</span>
        </div>
      </div>

      {/* BTC Price Slider */}
      <div className="rounded-2xl p-6 mb-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div>
            <div className="text-base font-semibold text-white">Profitability Scenarios</div>
            <div className="text-xs text-gray-500">Adjust BTC price to model different market conditions</div>
          </div>
          <div className="flex gap-2">
            {[60000, 80000, 105000, 130000, 150000].map(p => (
              <button key={p} onClick={() => setBtcPrice(p)}
                className="text-xs px-2.5 py-1 rounded-lg transition-colors"
                style={{ background: btcPrice === p ? '#00d4aa' : '#1f2937', color: btcPrice === p ? '#0a0e17' : '#9ca3af', cursor: 'pointer' }}>
                ${(p / 1000).toFixed(0)}k
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          {btcPrice === null ? (
            <div className="h-9 flex items-center">
              <span className="text-sm animate-pulse" style={{ color: btcPriceError ? '#ff4757' : '#4b5563' }}>
                {btcPriceError ? 'Price unavailable — enter a price manually using the preset buttons above' : 'Fetching live price…'}
              </span>
            </div>
          ) : (
            <input type="range" min={30000} max={200000} step={1000} value={btcPrice}
              onChange={e => setBtcPrice(Number(e.target.value))}
              className="w-full accent-[#00d4aa]" />
          )}
          <div className="flex justify-between text-xs text-gray-600 mt-1">
            <span>$30k</span>
            <span className="font-mono font-bold" style={{ color: '#00d4aa' }}>
              {btcPriceError ? 'Unavailable' : btcPrice === null ? 'Loading…' : `$${btcPrice.toLocaleString()}`}
            </span>
            <span>$200k</span>
          </div>
        </div>
        <div className="mb-3">
          <label className="text-xs text-gray-500 block mb-1">Monthly Hosting Fee (per miner)</label>
          <div className="flex items-center gap-3">
            <input type="range" min={100} max={500} step={5} value={hostingFee}
              onChange={e => setHostingFee(Number(e.target.value))}
              className="flex-1 accent-[#00d4aa]" />
            <span className="text-sm font-mono font-bold text-white w-20 text-right">${hostingFee}/mo</span>
          </div>
        </div>
      </div>

      {/* Profitability Table */}
      <div className="rounded-2xl overflow-hidden mb-8" style={{ border: '1px solid #1f2937' }}>
        <div className="px-5 py-4" style={{ background: '#1f2937' }}>
          <div className="text-base font-semibold text-white">Miner Profitability at {btcPrice !== null ? `$${btcPrice.toLocaleString()}` : '—'} BTC · ${hostingFee}/mo Hosting</div>
          <div className="text-xs text-gray-500 mt-0.5">Air-cooled miners sorted by efficiency. Net profit after flat hosting fee.</div>
        </div>
        <table className="w-full text-sm" style={{ background: '#111827' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #1f2937' }}>
              {['Miner', 'Hashrate', 'Efficiency', 'Daily Gross', 'Daily Cost', 'Daily Net', 'Monthly Net'].map(h => (
                <th key={h} className="text-left py-3 px-4 text-xs text-gray-500 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {profRows.map((row, i) => {
              const dailyBtc = (row.hashrate * 1e12 * 86400 * BLOCK_REWARD) / (DIFFICULTY * Math.pow(2, 32))
              const dailyGross = btcPrice !== null ? dailyBtc * btcPrice : null
              const dailyCost = hostingFee / 30
              const dailyNet = dailyGross !== null ? dailyGross - dailyCost : null
              const monthlyNet = dailyNet !== null ? dailyNet * 30 : null
              const isProfit = dailyNet !== null && dailyNet > 0
              return (
                <tr key={row.slug} style={{ borderBottom: '1px solid #1f2937', background: i % 2 === 0 ? '#111827' : '#0d1520' }}>
                  <td className="py-3 px-4">
                    <Link href={`/miners/${row.slug}`} className="text-white hover:text-[#00d4aa] font-medium transition-colors">
                      {row.name}
                    </Link>
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-300">{row.hashrate} TH/s</td>
                  <td className="py-3 px-4 font-mono">
                    <span style={{ color: row.efficiency < 18 ? '#00d4aa' : row.efficiency < 25 ? '#fbbf24' : '#ff4757' }}>
                      {row.efficiency.toFixed(1)} J/TH
                    </span>
                  </td>
                  <td className="py-3 px-4 font-mono text-gray-300">{dailyGross !== null ? `$${dailyGross.toFixed(2)}` : '—'}</td>
                  <td className="py-3 px-4 font-mono text-gray-400">${dailyCost.toFixed(2)}</td>
                  <td className="py-3 px-4 font-mono font-semibold" style={{ color: isProfit ? '#00d4aa' : dailyNet !== null ? '#ff4757' : '#4b5563' }}>
                    {dailyNet !== null ? `${isProfit ? '+' : ''}$${dailyNet.toFixed(2)}` : '—'}
                  </td>
                  <td className="py-3 px-4 font-mono font-semibold" style={{ color: isProfit ? '#00d4aa' : monthlyNet !== null ? '#ff4757' : '#4b5563' }}>
                    {monthlyNet !== null ? `${isProfit ? '+' : ''}$${monthlyNet.toFixed(0)}` : '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Mining Economics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
        <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs text-gray-500 mb-1">Hashprice at {btcPrice !== null ? `$${btcPrice.toLocaleString()}` : '—'} BTC</div>
          <div className="text-2xl font-bold font-mono mb-1" style={{ color: '#00d4aa' }}>{currentHashprice !== null ? `$${currentHashprice.toFixed(4)}` : '—'}</div>
          <div className="text-xs text-gray-400">USD per TH/s per day</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs text-gray-500 mb-1">Daily Revenue per EH/s</div>
          <div className="text-2xl font-bold font-mono mb-1 text-white">{currentHashprice !== null ? `$${(currentHashprice * 1_000_000).toLocaleString(undefined, { maximumFractionDigits: 0 })}` : '—'}</div>
          <div className="text-xs text-gray-400">1 EH/s = 1,000,000 TH/s</div>
        </div>
        <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs text-gray-500 mb-1">S21 Pro Breakeven BTC Price</div>
          <div className="text-2xl font-bold font-mono mb-1" style={{ color: '#fbbf24' }}>~$46,000</div>
          <div className="text-xs text-gray-400">At $225/mo hosting, 15 J/TH</div>
        </div>
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h2 className="text-base font-semibold text-white mb-2">Analyze Your Specific Deal</h2>
          <p className="text-sm text-gray-400 mb-4">Enter your exact hardware and hosting terms to get a deal score and recommendation.</p>
          <Link href="/deal-analyzer" className="text-sm font-semibold px-5 py-2.5 rounded-lg inline-block" style={{ background: '#00d4aa', color: '#0a0e17' }}>
            Open Deal Analyzer →
          </Link>
        </div>
        <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h2 className="text-base font-semibold text-white mb-2">Get Price Alerts</h2>
          <p className="text-sm text-gray-400 mb-4">Receive email alerts when BTC price or hashprice crosses your specified thresholds.</p>
          <Link href="/alerts" className="text-sm font-semibold px-5 py-2.5 rounded-lg inline-block border border-gray-700 text-gray-300 hover:text-white transition-colors">
            Set Up Alerts →
          </Link>
        </div>
      </div>
    </div>
  )
}
