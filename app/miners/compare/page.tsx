'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MINERS_DATA, getMinerBySlug } from '@/lib/data'
import { Miner } from '@/lib/types'
import { Suspense } from 'react'

const COOLING_LABELS: Record<string, string> = { air: 'Air', hydro: 'Hydro', immersion: 'Immersion' }

function formatUSD(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

function getWinner(miners: (Miner | null)[], getValue: (m: Miner) => number, lowerIsBetter = false): string | null {
  const vals = miners.map(m => (m ? getValue(m) : null))
  const defined = vals.filter(v => v !== null) as number[]
  if (defined.length < 2) return null
  const best = lowerIsBetter ? Math.min(...defined) : Math.max(...defined)
  return String(best)
}

function CompareContent() {
  const searchParams = useSearchParams()
  const slugA = searchParams.get('a') || ''
  const slugB = searchParams.get('b') || ''
  const slugC = searchParams.get('c') || ''

  const [selA, setSelA] = useState(slugA)
  const [selB, setSelB] = useState(slugB)
  const [selC, setSelC] = useState(slugC)

  const miners: (Miner | null)[] = [
    selA ? getMinerBySlug(selA) || null : null,
    selB ? getMinerBySlug(selB) || null : null,
    selC ? getMinerBySlug(selC) || null : null,
  ]

  const [btcPrice, setBtcPrice] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/btc-price')
      .then(r => r.json())
      .then(d => { if (d?.price) setBtcPrice(Number(d.price)) })
      .catch(() => {})
  }, [])

  const difficulty = 113_757_508_517_000

  function dailyBTC(m: Miner) {
    return (m.default_hashrate_th * 1e12 * 86400 * 3.125) / (difficulty * Math.pow(2, 32))
  }

  function dailyGross(m: Miner) { return btcPrice ? dailyBTC(m) * btcPrice : 0 }
  function dailyCost(m: Miner) { return (m.power_watts / 1000) * 24 * 0.07 }

  const rows: { label: string; get: (m: Miner) => string; raw: (m: Miner) => number; lowerBetter?: boolean }[] = [
    { label: 'Hashrate (TH/s)', get: m => `${m.default_hashrate_th} TH/s`, raw: m => m.default_hashrate_th },
    { label: 'Power (W)', get: m => `${m.power_watts.toLocaleString()} W`, raw: m => m.power_watts, lowerBetter: true },
    { label: 'Efficiency (J/TH)', get: m => `${(m.efficiency_j_per_th ?? m.power_watts / m.default_hashrate_th).toFixed(1)} J/TH`, raw: m => m.efficiency_j_per_th ?? m.power_watts / m.default_hashrate_th, lowerBetter: true },
    { label: 'Est. Market Price', get: m => m.market_price_usd ? formatUSD(m.market_price_usd) : '—', raw: m => m.market_price_usd ?? 0, lowerBetter: true },
    { label: 'Rating', get: m => `${m.rating ?? '—'}/10`, raw: m => m.rating ?? 0 },
    { label: 'Daily Gross Revenue', get: m => btcPrice ? formatUSD(dailyGross(m)) : '—', raw: m => dailyGross(m) },
    { label: 'Daily Power Cost ($0.07/kWh)', get: m => formatUSD(dailyCost(m)), raw: m => dailyCost(m), lowerBetter: true },
    { label: 'Daily Net (home power)', get: m => btcPrice ? formatUSD(dailyGross(m) - dailyCost(m)) : '—', raw: m => dailyGross(m) - dailyCost(m) },
    { label: 'Noise Level', get: m => m.noise_db ? `${m.noise_db} dB` : '—', raw: m => m.noise_db ?? 99, lowerBetter: true },
    { label: 'Cooling Type', get: m => COOLING_LABELS[m.cooling_type], raw: () => 0 },
    { label: 'Manufacturer', get: m => m.manufacturer ?? '—', raw: () => 0 },
  ]

  const activeMines = miners.filter(Boolean) as Miner[]
  const bestMiner = activeMines.length >= 2 ? activeMines.reduce((best, m) => {
    const score = (m.rating ?? 0) * 10 + dailyGross(m) / 10 - (m.efficiency_j_per_th ?? 30)
    const bestScore = (best.rating ?? 0) * 10 + dailyGross(best) / 10 - (best.efficiency_j_per_th ?? 30)
    return score > bestScore ? m : best
  }) : null

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Bitcoin Miner Comparison Tool',
        description: 'Compare up to 3 Bitcoin ASIC miners side by side on hashrate, power draw, efficiency, and price.',
        applicationCategory: 'FinanceApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }) }} />
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / <Link href="/miners" className="hover:text-white">Hardware</Link> / Compare
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">Bitcoin Miner Comparison Tool</h1>
      <p className="text-gray-400 mb-8">Compare up to 3 miners side by side. Winners highlighted in green.</p>

      {/* Selector */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {[
          { val: selA, set: setSelA, label: 'Miner 1' },
          { val: selB, set: setSelB, label: 'Miner 2' },
          { val: selC, set: setSelC, label: 'Miner 3 (optional)' },
        ].map(({ val, set, label }) => (
          <div key={label}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            <select value={val} onChange={e => set(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]" style={{ background: '#111827' }}>
              <option value="">— Select miner —</option>
              {['air', 'hydro', 'immersion'].map(ct => (
                <optgroup key={ct} label={COOLING_LABELS[ct] + ' Cooling'}>
                  {MINERS_DATA.filter(m => m.cooling_type === ct).map(m => (
                    <option key={m.slug} value={m.slug!}>{m.name}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
        ))}
      </div>

      {activeMines.length < 2 ? (
        <div className="text-center py-16 text-gray-500">Select at least 2 miners to compare</div>
      ) : (
        <>
          {/* Verdict */}
          {bestMiner && (
            <div className="rounded-xl p-5 mb-6" style={{ background: '#00d4aa15', border: '1px solid #00d4aa30' }}>
              <div className="text-xs font-semibold mb-1" style={{ color: '#00d4aa' }}>OUR VERDICT</div>
              <p className="text-sm text-white">
                <strong>{bestMiner.name}</strong> wins this comparison — best combination of efficiency ({(bestMiner.efficiency_j_per_th ?? bestMiner.power_watts / bestMiner.default_hashrate_th).toFixed(1)} J/TH), hashrate ({bestMiner.default_hashrate_th} TH/s), and overall rating ({bestMiner.rating}/10).
                {bestMiner.market_price_usd && ` At ${formatUSD(bestMiner.market_price_usd)} it offers the best return on investment of the miners compared.`}
              </p>
            </div>
          )}

          {/* Table */}
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: '#1f2937' }}>
                  <th className="text-left py-3 px-4 text-gray-400 font-medium w-44">Spec</th>
                  {miners.map((m, i) => (
                    <th key={i} className="py-3 px-4 text-center">
                      {m ? (
                        <Link href={`/miners/${m.slug}`} className="text-white hover:text-[#00d4aa] font-medium">{m.name}</Link>
                      ) : <span className="text-gray-600">—</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {rows.map(row => {
                  const winnerVal = getWinner(miners, row.raw, row.lowerBetter)
                  return (
                    <tr key={row.label} style={{ background: '#111827' }}>
                      <td className="py-3 px-4 text-gray-400">{row.label}</td>
                      {miners.map((m, i) => {
                        if (!m) return <td key={i} className="py-3 px-4 text-center text-gray-600">—</td>
                        const val = row.raw(m)
                        const isWinner = winnerVal !== null && String(val) === winnerVal && row.raw(m) !== 0
                        return (
                          <td key={i} className="py-3 px-4 text-center font-mono" style={{ color: isWinner ? '#00d4aa' : '#e2e8f0' }}>
                            {row.get(m)}
                            {isWinner && <span className="ml-1 text-xs">★</span>}
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-4 mt-8">
            {activeMines.map(m => (
              <Link key={m.slug} href={`/miners/${m.slug}`} className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#00d4aa] hover:text-white transition-colors">
                View {m.name} full review →
              </Link>
            ))}
            <Link href="/deal-analyzer" className="text-sm px-4 py-2 rounded-lg font-medium ml-auto" style={{ background: '#00d4aa', color: '#0a0e17' }}>
              Analyze Your Deal →
            </Link>
          </div>
        </>
      )}
    </div>
  )
}

export default function ComparePage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-10 text-gray-400">Loading...</div>}>
      <CompareContent />
    </Suspense>
  )
}
