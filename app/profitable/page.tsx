'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import DifficultyWidget from '@/components/DifficultyWidget'

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'
const HALVING_DATE = new Date('2028-04-15T00:00:00Z')

// Reference miner: Antminer S21 Pro
const REF_TH = 234
const REF_W = 3510

const POWER_TIERS = [
  { rate: 0.05, label: '$0.05/kWh', sublabel: 'Cheap hydro / stranded energy' },
  { rate: 0.07, label: '$0.07/kWh', sublabel: 'Competitive hosting deal' },
  { rate: 0.09, label: '$0.09/kWh', sublabel: 'Average US hosting' },
  { rate: 0.10, label: '$0.10/kWh', sublabel: 'Breakeven territory' },
]

function calcHashprice(btcPrice: number, difficulty: number): number {
  return (2.7e20 * btcPrice) / (difficulty * 4294967296)
}

function getVerdict(profit: number, revenue: number) {
  const margin = revenue > 0 ? profit / revenue : -1
  if (margin > 0.15) return { label: '✓ PROFITABLE', color: '#00d4aa', bg: 'rgba(0,212,170,0.08)', border: 'rgba(0,212,170,0.25)' }
  if (margin > 0)    return { label: '⚡ MARGINAL',    color: '#f7931a', bg: 'rgba(247,147,26,0.08)', border: 'rgba(247,147,26,0.25)' }
  return               { label: '✕ UNPROFITABLE', color: '#ff4757', bg: 'rgba(255,71,87,0.08)',  border: 'rgba(255,71,87,0.25)' }
}

export default function ProfitabilityPage() {
  const [btcPrice, setBtcPrice] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [lastUpdated, setLastUpdated] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/btc-price')
      .then(r => r.json())
      .then(d => {
        if (d.price) setBtcPrice(Number(d.price))
        if (d.difficulty) setDifficulty(Number(d.difficulty))
        if (d.last_updated) setLastUpdated(d.last_updated)
      })
      .catch(() => {})
  }, [])

  const hashprice = btcPrice && difficulty ? calcHashprice(btcPrice, difficulty) : null
  const networkEH = difficulty ? (difficulty * 4294967296 / 600 / 1e18) : null
  const daysToHalving = Math.max(0, Math.ceil((HALVING_DATE.getTime() - Date.now()) / 86400000))

  // Daily revenue for reference miner (REF_TH is in TH, hashprice is $/PH/day)
  const dailyRevenue = hashprice ? hashprice * (REF_TH / 1000) : null

  // Breakeven electricity rate
  const breakevenRate = dailyRevenue ? dailyRevenue / ((REF_W / 1000) * 24) : null

  const tiers = dailyRevenue !== null
    ? POWER_TIERS.map(t => {
        const powerCost = (REF_W / 1000) * 24 * t.rate
        const profit = dailyRevenue - powerCost
        return { ...t, powerCost, profit, verdict: getVerdict(profit, dailyRevenue) }
      })
    : null

  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-10">

        <div className="text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span>Is Mining Profitable?</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Is Bitcoin Mining Profitable Right Now?
        </h1>
        <p className="text-gray-400 mb-1 text-sm">
          Live analysis based on current BTC price and network difficulty. Reference miner: Antminer S21 Pro (234 TH/s · 3,510W · 15 J/TH).
        </p>
        {lastUpdated && (
          <p className="text-xs text-gray-600 mb-8">
            Data as of {new Date(lastUpdated).toLocaleTimeString()} · refreshes every 10 min
          </p>
        )}
        {!lastUpdated && <div className="mb-8" />}

        {/* Live market data strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
          {[
            { label: 'BTC Price',        value: btcPrice    ? `$${btcPrice.toLocaleString()}`           : '...', live: true  },
            { label: 'Hashprice',        value: hashprice   ? `$${hashprice.toFixed(2)}/PH/day`         : '...', live: true  },
            { label: 'Network Hashrate', value: networkEH   ? `${networkEH.toFixed(0)} EH/s`            : '...', live: true  },
            { label: 'Next Halving',     value: `${daysToHalving} days`,                                          live: false },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="text-xs text-gray-500">{s.label}</span>
                {s.live && <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#00d4aa' }} />}
              </div>
              <div className="font-bold font-mono text-sm" style={{ color: ORANGE }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Breakeven callout */}
        {breakevenRate !== null && (
          <div className="rounded-xl p-4 mb-8 flex items-center gap-3"
            style={{ background: 'rgba(247,147,26,0.07)', border: '1px solid rgba(247,147,26,0.2)' }}>
            <span style={{ color: ORANGE, fontSize: '1.4rem' }}>⚡</span>
            <p className="text-sm">
              <span className="text-white font-semibold">Breakeven power cost: </span>
              <span className="font-mono font-bold" style={{ color: ORANGE }}>${breakevenRate.toFixed(4)}/kWh</span>
              <span className="text-gray-400"> — mining is profitable below this rate for the S21 Pro at current BTC price and difficulty.</span>
            </p>
          </div>
        )}

        {/* Power tier cards */}
        <h2 className="text-xl font-bold text-white mb-2">Profitability by Power Cost</h2>
        <p className="text-xs text-gray-500 mb-5">Per-machine figures. Does not include pool fees (~1%), setup fees, or depreciation.</p>

        {!tiers ? (
          <div className="text-center py-20 text-gray-500">Loading live data...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {tiers.map(tier => (
              <div key={tier.rate} className="rounded-2xl p-6"
                style={{ background: tier.verdict.bg, border: `1px solid ${tier.verdict.border}` }}>

                <div className="flex items-start justify-between mb-5">
                  <div>
                    <div className="font-mono font-bold text-white text-xl">{tier.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{tier.sublabel}</div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1.5 rounded-full whitespace-nowrap"
                    style={{ color: tier.verdict.color, background: tier.verdict.bg, border: `1px solid ${tier.verdict.border}` }}>
                    {tier.verdict.label}
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center mb-4">
                  <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="text-xs text-gray-500 mb-1">Daily Revenue</div>
                    <div className="font-mono font-semibold text-sm" style={{ color: '#00d4aa' }}>
                      ${dailyRevenue!.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="text-xs text-gray-500 mb-1">Daily Power</div>
                    <div className="font-mono font-semibold text-sm" style={{ color: '#ff4757' }}>
                      −${tier.powerCost.toFixed(2)}
                    </div>
                  </div>
                  <div className="rounded-lg p-3" style={{ background: 'rgba(0,0,0,0.3)' }}>
                    <div className="text-xs text-gray-500 mb-1">Daily Net</div>
                    <div className="font-mono font-bold text-sm"
                      style={{ color: tier.profit >= 0 ? '#00d4aa' : '#ff4757' }}>
                      {tier.profit >= 0 ? '+' : ''}${tier.profit.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div className="text-xs text-gray-500 pt-3" style={{ borderTop: `1px solid rgba(255,255,255,0.05)` }}>
                  Monthly:{' '}
                  <span className="font-mono" style={{ color: tier.profit * 30 >= 0 ? '#00d4aa' : '#ff4757' }}>
                    {tier.profit * 30 >= 0 ? '+' : ''}${(tier.profit * 30).toFixed(0)}
                  </span>
                  {'  ·  '}
                  Annual:{' '}
                  <span className="font-mono" style={{ color: tier.profit * 365 >= 0 ? '#00d4aa' : '#ff4757' }}>
                    {tier.profit * 365 >= 0 ? '+' : ''}${(tier.profit * 365).toFixed(0)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mb-8">
          <DifficultyWidget />
        </div>

        {/* Disclaimer */}
        <div className="rounded-xl p-5 mb-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <p className="text-xs text-gray-500 leading-relaxed">
            <strong className="text-gray-400">How this is calculated:</strong> Hashprice = (3.125 BTC × 144 blocks/day × BTC price) ÷ network hashrate (PH/s).
            Daily revenue uses the reference miner&apos;s hashrate (234 TH/s). Power cost = (3,510W ÷ 1,000) × 24h × $/kWh.
            Network difficulty adjusts every ~2,016 blocks (~2 weeks) — profitability changes constantly.
            These figures exclude pool fees (~1%), hosting management fees, repair costs, and hardware depreciation.
            Always{' '}
            <Link href="/calculator" style={{ color: ORANGE }}>run your exact numbers</Link>
            {' '}before committing capital.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/calculator"
            className="text-sm font-bold px-6 py-3 rounded-lg text-center"
            style={{ background: ORANGE, color: '#000' }}>
            Run My Exact ROI →
          </Link>
          <Link href="/hosting"
            className="text-sm font-semibold px-6 py-3 rounded-lg text-center border text-gray-300 hover:text-white transition-colors"
            style={{ borderColor: BORDER }}>
            Compare Hosting Prices →
          </Link>
          <Link href="/university/is-bitcoin-mining-profitable"
            className="text-sm font-semibold px-6 py-3 rounded-lg text-center border text-gray-300 hover:text-white transition-colors"
            style={{ borderColor: BORDER }}>
            Mining Profitability Guide →
          </Link>
        </div>
      </div>
    </div>
  )
}
