'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { MINERS_DATA } from '@/lib/data'
import { Miner } from '@/lib/types'

const COOLING_LABELS: Record<string, string> = { air: 'Air', hydro: 'Hydro', immersion: 'Immersion' }
const COOLING_COLORS: Record<string, string> = { air: '#3d7aed', hydro: '#00d4aa', immersion: '#a855f7' }

function MinerCard({ miner, selected, onToggleCompare }: { miner: Miner; selected: boolean; onToggleCompare: () => void }) {
  const eff = miner.efficiency_j_per_th ?? (miner.power_watts / miner.default_hashrate_th)
  return (
    <div className="rounded-xl p-5 flex flex-col gap-3 relative" style={{ background: '#111827', border: `1px solid ${selected ? '#00d4aa' : '#1f2937'}` }}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <Link href={`/miners/${miner.slug}`} className="font-semibold text-white hover:text-[#00d4aa] transition-colors text-sm leading-tight">
            {miner.name}
          </Link>
          <div className="text-xs text-gray-500 mt-0.5">{miner.manufacturer}</div>
        </div>
        <span className="shrink-0 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: COOLING_COLORS[miner.cooling_type] + '22', color: COOLING_COLORS[miner.cooling_type] }}>
          {COOLING_LABELS[miner.cooling_type]}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg p-2" style={{ background: '#0a0e17' }}>
          <div className="text-gray-500">Hashrate</div>
          <div className="text-white font-mono font-semibold">{miner.default_hashrate_th} TH/s</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: '#0a0e17' }}>
          <div className="text-gray-500">Efficiency</div>
          <div className="font-mono font-semibold" style={{ color: eff < 18 ? '#00d4aa' : eff < 25 ? '#fbbf24' : '#ff4757' }}>{eff.toFixed(1)} J/TH</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: '#0a0e17' }}>
          <div className="text-gray-500">Power</div>
          <div className="text-white font-mono font-semibold">{miner.power_watts.toLocaleString()}W</div>
        </div>
        <div className="rounded-lg p-2" style={{ background: '#0a0e17' }}>
          <div className="text-gray-500">Est. Price</div>
          <div className="text-white font-mono font-semibold">{miner.market_price_usd ? `$${miner.market_price_usd.toLocaleString()}` : '—'}</div>
        </div>
      </div>

      {miner.rating && (
        <div className="flex items-center gap-1.5">
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="w-1.5 h-1.5 rounded-full" style={{ background: i < miner.rating! ? '#00d4aa' : '#1f2937' }} />
            ))}
          </div>
          <span className="text-xs text-gray-400">{miner.rating}/10</span>
        </div>
      )}

      {miner.best_for && (
        <p className="text-xs text-gray-500 line-clamp-2">{miner.best_for}</p>
      )}

      {miner.spec_confidence === 'pending_verification' && (
        <div className="text-xs px-2 py-1 rounded" style={{ background: '#fbbf2415', color: '#fbbf24' }}>Specs pending verification</div>
      )}

      <div className="flex gap-2 mt-auto pt-2">
        <Link href={`/miners/${miner.slug}`} className="flex-1 text-center text-xs py-1.5 rounded-lg font-medium" style={{ background: '#00d4aa', color: '#0a0e17' }}>
          View Specs
        </Link>
        <button
          onClick={onToggleCompare}
          className="text-xs px-3 py-1.5 rounded-lg border transition-colors"
          style={{ borderColor: selected ? '#00d4aa' : '#374151', color: selected ? '#00d4aa' : '#6b7280' }}
        >
          {selected ? '✓ Added' : 'Compare'}
        </button>
      </div>
    </div>
  )
}

export default function MinersPage() {
  const [cooling, setCooling] = useState<string>('all')
  const [sortBy, setSortBy] = useState<string>('rating')
  const [compareList, setCompareList] = useState<string[]>([])
  const [searchQ, setSearchQ] = useState('')

  const filtered = useMemo(() => {
    let list = MINERS_DATA.filter(m => m.is_active)
    if (cooling !== 'all') list = list.filter(m => m.cooling_type === cooling)
    if (searchQ) list = list.filter(m => m.name.toLowerCase().includes(searchQ.toLowerCase()) || m.manufacturer?.toLowerCase().includes(searchQ.toLowerCase()))
    list.sort((a, b) => {
      if (sortBy === 'rating') return (b.rating || 0) - (a.rating || 0)
      if (sortBy === 'hashrate') return b.default_hashrate_th - a.default_hashrate_th
      if (sortBy === 'efficiency') return (a.efficiency_j_per_th || 99) - (b.efficiency_j_per_th || 99)
      if (sortBy === 'price') return (a.market_price_usd || 9999) - (b.market_price_usd || 9999)
      return 0
    })
    return list
  }, [cooling, sortBy, searchQ])

  const top3 = useMemo(() => MINERS_DATA.filter(m => m.is_active).sort((a, b) => (b.rating || 0) - (a.rating || 0)).slice(0, 3), [])

  function toggleCompare(slug: string) {
    setCompareList(prev => prev.includes(slug) ? prev.filter(s => s !== slug) : prev.length < 3 ? [...prev, slug] : prev)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      {/* Schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: 'Bitcoin Mining Hardware Database 2026',
        description: 'Compare all Bitcoin miners by efficiency, hashrate, and ROI. Independent reviews and specs for every major ASIC miner in 2026.',
        url: 'https://lmc-mining.vercel.app/miners',
      }) }} />

      <div className="mb-8">
        <div className="text-xs text-gray-500 mb-2">
          <Link href="/" className="hover:text-white">Home</Link> / Hardware Database
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Bitcoin Mining Hardware Database 2026</h1>
        <p className="text-gray-400 max-w-2xl">Independent specs, efficiency ratings, and ROI estimates for every major Bitcoin miner. All data sourced from manufacturer datasheets.</p>
      </div>

      {/* Featured top 3 */}
      <div className="mb-10 p-6 rounded-2xl" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="flex items-center gap-2 mb-4">
          <span style={{ color: '#00d4aa' }}>★</span>
          <h2 className="font-semibold text-white">Best Miners of 2026</h2>
          <span className="text-xs text-gray-500 ml-auto">Ranked by efficiency and ROI</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {top3.map((m, i) => (
            <Link key={m.slug} href={`/miners/${m.slug}`} className="flex items-center gap-3 p-3 rounded-xl hover:border-[#00d4aa] transition-colors" style={{ background: '#0a0e17', border: '1px solid #1f2937' }}>
              <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold shrink-0" style={{ background: i === 0 ? '#fbbf24' : i === 1 ? '#94a3b8' : '#cd7c3b', color: '#0a0e17' }}>
                {i + 1}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-medium text-white truncate">{m.name}</div>
                <div className="text-xs text-gray-500">{m.efficiency_j_per_th?.toFixed(1)} J/TH · {m.default_hashrate_th} TH/s</div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <input
          value={searchQ}
          onChange={e => setSearchQ(e.target.value)}
          placeholder="Search miners..."
          className="text-sm px-3 py-2 rounded-lg text-white placeholder-gray-600 border border-gray-700 focus:outline-none focus:border-[#00d4aa]"
          style={{ background: '#111827' }}
        />
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {['all', 'air', 'hydro', 'immersion'].map(c => (
            <button key={c} onClick={() => setCooling(c)} className="text-xs px-3 py-2 capitalize transition-colors"
              style={{ background: cooling === c ? '#00d4aa' : '#111827', color: cooling === c ? '#0a0e17' : '#9ca3af' }}>
              {c === 'all' ? 'All' : COOLING_LABELS[c]}
            </button>
          ))}
        </div>
        <select value={sortBy} onChange={e => setSortBy(e.target.value)} className="text-sm px-3 py-2 rounded-lg border border-gray-700 text-gray-300 focus:outline-none" style={{ background: '#111827' }}>
          <option value="rating">Sort: Rating</option>
          <option value="hashrate">Sort: Hashrate</option>
          <option value="efficiency">Sort: Efficiency (J/TH)</option>
          <option value="price">Sort: Price</option>
        </select>
        <span className="text-xs text-gray-500 ml-auto">{filtered.length} miners</span>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filtered.map(m => (
          <MinerCard key={m.slug} miner={m} selected={compareList.includes(m.slug!)} onToggleCompare={() => toggleCompare(m.slug!)} />
        ))}
      </div>

      {/* Compare sticky bar */}
      {compareList.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4" style={{ background: '#1f2937', border: '1px solid #00d4aa' }}>
          <span className="text-sm text-white">{compareList.length} selected</span>
          {compareList.length >= 2 && (
            <Link href={`/miners/compare?a=${compareList[0]}&b=${compareList[1]}${compareList[2] ? `&c=${compareList[2]}` : ''}`}
              className="text-sm font-semibold px-4 py-1.5 rounded-lg"
              style={{ background: '#00d4aa', color: '#0a0e17' }}>
              Compare Now
            </Link>
          )}
          <button onClick={() => setCompareList([])} className="text-xs text-gray-400 hover:text-white">Clear</button>
        </div>
      )}
    </div>
  )
}
