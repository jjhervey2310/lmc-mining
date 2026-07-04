'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PROVIDERS_DATA, getProviderBySlug } from '@/lib/data'
import { HostingProvider } from '@/lib/types'
import { Suspense } from 'react'

function priceLabel(p: HostingProvider): string {
  if (p.flatMonthly) return `$${p.flatMonthly}/mo flat`
  if (p.rateMin && p.rateMax && p.rateMin !== p.rateMax) return `$${p.rateMin}–$${p.rateMax}/kWh`
  if (p.rateMin) return `$${p.rateMin}/kWh`
  return 'Contact required'
}

function CompareContent() {
  const searchParams = useSearchParams()
  const [selA, setSelA] = useState(searchParams.get('a') || '')
  const [selB, setSelB] = useState(searchParams.get('b') || '')

  const provA = selA ? getProviderBySlug(selA) : null
  const provB = selB ? getProviderBySlug(selB) : null

  const rows: { label: string; get: (p: HostingProvider) => string; highlight?: (p: HostingProvider) => boolean }[] = [
    { label: 'Lightning Score', get: p => `${p.lightningScore}/100`, highlight: p => p.lightningScore >= 80 },
    { label: 'Pricing', get: priceLabel },
    { label: 'Billing Type', get: p => p.billingType === 'flat' ? 'Flat monthly' : p.billingType === 'kwh' ? 'Per kWh' : 'Revenue share' },
    { label: 'Cooling', get: p => p.cooling.join(', ') },
    { label: 'Locations', get: p => p.facilityLocations.join(', ') },
    { label: 'Power Source', get: p => p.powerSource },
    { label: 'Setup Fee', get: p => p.setupFee ? `$${p.setupFee.toLocaleString()}` : '—' },
    { label: 'Contract', get: p => p.contractLength },
    { label: 'Min. Machines', get: p => p.minMachines ? String(p.minMachines) : '—' },
    { label: 'Insurance', get: p => p.insuranceAvailable ? 'Yes' : 'No', highlight: p => p.insuranceAvailable },
    { label: 'Financing', get: p => p.financingAvailable ? 'Available' : 'No', highlight: p => p.financingAvailable },
    { label: 'Pool Freedom', get: p => p.poolOptions.length > 0 ? 'Yes' : 'Restricted', highlight: p => p.poolOptions.length > 0 },
    { label: 'KYC Required', get: p => p.kycRequired ? 'Yes' : 'No' },
    { label: 'Uptime', get: p => p.uptimePercent ? `${p.uptimePercent}%` : '—' },
    { label: 'Hidden Fees', get: p => p.hiddenFees ?? 'None noted' },
    { label: 'Verification', get: p => p.verificationStatus === 'verified' ? '✓ Verified' : p.verificationStatus === 'contact_only' ? '✉ Contact only' : '⚠ Pending' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Bitcoin Mining Hosting Comparison Tool',
        description: 'Compare Bitcoin mining hosting providers side by side on pricing, cooling type, uptime, and verification status.',
        applicationCategory: 'FinanceApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }) }} />
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / <Link href="/hosts" className="hover:text-white">Hosting</Link> / Compare
      </div>
      <h1 className="text-3xl font-bold text-white mb-2">Compare Bitcoin Mining Hosting Providers</h1>
      <p className="text-gray-400 mb-8">Side-by-side comparison of verified hosting providers.</p>

      <div className="grid grid-cols-2 gap-4 mb-8">
        {[{ val: selA, set: setSelA, label: 'Provider A' }, { val: selB, set: setSelB, label: 'Provider B' }].map(({ val, set, label }) => (
          <div key={label}>
            <label className="text-xs text-gray-500 block mb-1">{label}</label>
            <select value={val} onChange={e => set(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]" style={{ background: '#111827' }}>
              <option value="">— Select provider —</option>
              {PROVIDERS_DATA.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
        ))}
      </div>

      {(!provA || !provB) ? (
        <div className="text-center py-16 text-gray-500">Select 2 providers to compare</div>
      ) : (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ background: '#1f2937' }}>
                <th className="text-left py-3 px-4 text-gray-400 font-medium w-44">Feature</th>
                <th className="py-3 px-4 text-center text-white font-semibold">
                  <Link href={`/hosts/${provA.id}`} className="hover:text-[#00d4aa]">{provA.name}</Link>
                  {provA.tier === 1 && <div className="text-xs font-normal" style={{ color: '#00d4aa' }}>#1 Rated</div>}
                </th>
                <th className="py-3 px-4 text-center text-white font-semibold">
                  <Link href={`/hosts/${provB.id}`} className="hover:text-[#00d4aa]">{provB.name}</Link>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {rows.map(row => (
                <tr key={row.label} style={{ background: '#111827' }}>
                  <td className="py-3 px-4 text-gray-400">{row.label}</td>
                  {[provA, provB].map(p => {
                    const val = row.get(p)
                    const hl = row.highlight?.(p)
                    return (
                      <td key={p.id} className="py-3 px-4 text-center" style={{ color: hl ? '#00d4aa' : '#e2e8f0' }}>
                        {val}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {provA && provB && (
        <div className="flex gap-4 mt-6">
          <Link href={`/hosts/${provA.id}`} className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#00d4aa] hover:text-white transition-colors">
            Full {provA.name} review →
          </Link>
          <Link href={`/hosts/${provB.id}`} className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#00d4aa] hover:text-white transition-colors">
            Full {provB.name} review →
          </Link>
          <Link href="/deal-analyzer" className="text-sm px-4 py-2 rounded-lg font-medium ml-auto" style={{ background: '#00d4aa', color: '#0a0e17' }}>
            Analyze My Deal →
          </Link>
        </div>
      )}
    </div>
  )
}

export default function HostComparePage() {
  return (
    <Suspense fallback={<div className="max-w-5xl mx-auto px-4 py-10 text-gray-400">Loading...</div>}>
      <CompareContent />
    </Suspense>
  )
}
