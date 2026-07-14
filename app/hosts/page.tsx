'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { PROVIDERS_DATA } from '@/lib/data'
import { HostingProvider } from '@/lib/types'

function VerificationBadge({ status }: { status: string }) {
  if (status === 'verified') return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#00d4aa15', color: '#00d4aa' }}>✓ Verified</span>
  if (status === 'contact_only') return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#818cf815', color: '#818cf8' }}>✉ Contact for Pricing</span>
  return <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fbbf2415', color: '#fbbf24' }}>⏳ Pending</span>
}

function priceLabel(p: HostingProvider): string {
  if (p.flatMonthly) return `$${p.flatMonthly}/mo flat`
  if (p.rateMin && p.rateMax && p.rateMin !== p.rateMax) return `$${p.rateMin}–$${p.rateMax}/kWh`
  if (p.rateMin) return `$${p.rateMin}/kWh`
  return 'Contact required'
}

function ProviderCard({ p, featured }: { p: HostingProvider; featured?: boolean }) {
  return (
    <div className="rounded-2xl p-6" style={{ background: '#111827', border: `1px solid ${featured ? '#00d4aa' : '#1f2937'}` }}>
      {featured && (
        <div className="text-xs font-semibold mb-3 px-2 py-1 rounded inline-block" style={{ background: '#00d4aa20', color: '#00d4aa' }}>
          #1 RATED — RECOMMENDED
        </div>
      )}
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <Link href={`/hosts/${p.id}`} className="text-lg font-bold text-white hover:text-[#00d4aa] transition-colors">{p.name}</Link>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {p.cooling.map(c => (
              <span key={c} className="text-xs px-1.5 py-0.5 rounded capitalize" style={{ background: '#1f2937', color: '#9ca3af' }}>{c}</span>
            ))}
          </div>
        </div>
        <VerificationBadge status={p.verificationStatus} />
      </div>

      {p.description && <p className="text-sm text-gray-400 mb-4">{p.description}</p>}

      <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
        <div className="rounded-lg p-2.5" style={{ background: '#0a0e17' }}>
          <div className="text-gray-500 mb-0.5">Pricing</div>
          <div className="text-white font-semibold">{priceLabel(p)}</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: '#0a0e17' }}>
          <div className="text-gray-500 mb-0.5">Location</div>
          <div className="text-white font-semibold">{p.facilityLocations.slice(0, 2).join(', ') || '—'}</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: '#0a0e17' }}>
          <div className="text-gray-500 mb-0.5">Min. Units</div>
          <div className="text-white font-semibold">{p.minMachines ?? '—'}</div>
        </div>
        <div className="rounded-lg p-2.5" style={{ background: '#0a0e17' }}>
          <div className="text-gray-500 mb-0.5">Financing</div>
          <div className="font-semibold" style={{ color: p.financingAvailable ? '#00d4aa' : '#6b7280' }}>
            {p.financingAvailable ? 'Available' : 'No'}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        {p.insuranceAvailable && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#00d4aa15', color: '#00d4aa' }}>Insurance included</span>}
        {p.poolOptions.length > 0 && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#3d7aed15', color: '#3d7aed' }}>Pool freedom</span>}
        {p.hiddenFees && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#f59e0b15', color: '#f59e0b' }}>Check hidden fees</span>}
      </div>

      <div className="flex items-center gap-2 mb-4">
        <div className="h-1.5 rounded-full flex-1" style={{ background: '#1f2937' }}>
          <div className="h-1.5 rounded-full" style={{ width: `${p.lightningScore}%`, background: p.lightningScore >= 80 ? '#00d4aa' : p.lightningScore >= 60 ? '#f59e0b' : '#ff4757' }} />
        </div>
        <span className="text-xs text-gray-400 shrink-0">{p.lightningScore}/100</span>
      </div>

      {p.bestFor && <p className="text-xs text-gray-500 mb-4">{p.bestFor}</p>}

      <div className="flex gap-2">
        <Link href={`/hosts/${p.id}`} className="flex-1 text-center text-sm py-2 rounded-lg font-medium" style={{ background: featured ? '#00d4aa' : '#1f2937', color: featured ? '#0a0e17' : '#e2e8f0' }}>
          View Full Profile
        </Link>
        {p.website && (
          <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-sm px-3 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors">
            Visit ↗
          </a>
        )}
      </div>
    </div>
  )
}

export default function HostsPage() {
  const [cooling, setCooling] = useState('all')
  const [showFinancing, setShowFinancing] = useState(false)
  const [compareList, setCompareList] = useState<string[]>([])

  const sorted = useMemo(() => {
    let list = [...PROVIDERS_DATA]
    if (cooling !== 'all') list = list.filter(p => p.cooling.includes(cooling as 'air' | 'hydro' | 'immersion'))
    if (showFinancing) list = list.filter(p => p.financingAvailable)
    return list.sort((a, b) => a.tier - b.tier || b.lightningScore - a.lightningScore)
  }, [cooling, showFinancing])

  const [featured, ...rest] = sorted

  function toggleCompare(id: string) {
    setCompareList(prev => prev.includes(id) ? prev.filter(s => s !== id) : prev.length < 2 ? [...prev, id] : prev)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: 'Bitcoin Mining Hosting Providers — Verified Comparison 2026',
        description: 'Compare verified Bitcoin mining hosting providers. Independent ratings, pricing, and reviews. Find the best host for your setup.',
      }) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / Hosting Providers
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Bitcoin Mining Hosting Providers — Verified Comparison 2026</h1>
      <p className="text-gray-400 max-w-2xl mb-8">Independent reviews of every major Bitcoin mining hosting provider. All pricing and specs verified from primary sources. No paid placements.</p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-8">
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {['all', 'air', 'hydro', 'immersion'].map(c => (
            <button key={c} onClick={() => setCooling(c)} className="text-xs px-3 py-2 capitalize transition-colors"
              style={{ background: cooling === c ? '#00d4aa' : '#111827', color: cooling === c ? '#0a0e17' : '#9ca3af' }}>
              {c === 'all' ? 'All Cooling' : c.charAt(0).toUpperCase() + c.slice(1)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
          <input type="checkbox" checked={showFinancing} onChange={e => setShowFinancing(e.target.checked)} className="accent-[#00d4aa]" />
          Financing available
        </label>
        <Link href="/hosts/compare" className="ml-auto text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#00d4aa] hover:text-white transition-colors">
          Compare 2 providers →
        </Link>
      </div>

      {/* Featured provider */}
      {featured && <div className="mb-8"><ProviderCard p={featured} featured={featured.tier === 1} /></div>}

      {/* Rest */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {rest.map(p => (
          <div key={p.id} className="relative">
            <ProviderCard p={p} />
            <button
              onClick={() => toggleCompare(p.id)}
              className="absolute top-4 right-4 text-xs px-2.5 py-1 rounded-full border transition-colors"
              style={{ borderColor: compareList.includes(p.id) ? '#00d4aa' : '#374151', color: compareList.includes(p.id) ? '#00d4aa' : '#6b7280', background: '#0a0e17' }}
            >
              {compareList.includes(p.id) ? '✓ Added' : 'Compare'}
            </button>
          </div>
        ))}
      </div>

      {/* Compare bar */}
      {compareList.length === 2 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl shadow-2xl flex items-center gap-4" style={{ background: '#1f2937', border: '1px solid #00d4aa' }}>
          <span className="text-sm text-white">2 providers selected</span>
          <Link href={`/hosts/compare?a=${compareList[0]}&b=${compareList[1]}`}
            className="text-sm font-semibold px-4 py-1.5 rounded-lg"
            style={{ background: '#00d4aa', color: '#0a0e17' }}>
            Compare Now
          </Link>
          <button onClick={() => setCompareList([])} className="text-xs text-gray-400 hover:text-white">Clear</button>
        </div>
      )}

      {/* CTA */}
      <div className="mt-12 rounded-2xl p-8 text-center" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-xl font-bold text-white mb-2">Not Sure Which Provider to Choose?</h2>
        <p className="text-gray-400 mb-6 max-w-lg mx-auto">Tell us your miner model and budget. We&apos;ll match you with the best available hosting option — free, no obligation.</p>
        <Link href="/hosting-match" className="inline-block text-sm font-semibold px-6 py-3 rounded-lg" style={{ background: '#00d4aa', color: '#0a0e17' }}>
          Get My Free Hosting Match →
        </Link>
      </div>
    </div>
  )
}
