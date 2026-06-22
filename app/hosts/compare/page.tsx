'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PROVIDERS_DATA, getProviderBySlug } from '@/lib/data'
import { HostingProvider } from '@/lib/types'
import { Suspense } from 'react'

function CompareContent() {
  const searchParams = useSearchParams()
  const [selA, setSelA] = useState(searchParams.get('a') || '')
  const [selB, setSelB] = useState(searchParams.get('b') || '')

  const provA = selA ? getProviderBySlug(selA) : null
  const provB = selB ? getProviderBySlug(selB) : null

  const rows: { label: string; get: (p: HostingProvider) => string; highlight?: (p: HostingProvider) => boolean }[] = [
    { label: 'Monthly Cost (air)', get: p => p.monthly_fee_air ? `$${p.monthly_fee_air}/mo flat` : 'Contact required' },
    { label: 'Electricity Rate', get: p => p.electricity_rate_kwh ? `$${p.electricity_rate_kwh}/kWh` : p.monthly_fee_air ? 'Included in flat fee' : '—' },
    { label: 'Cooling Supported', get: p => p.supported_cooling?.join(', ') ?? '—' },
    { label: 'Locations', get: p => p.locations?.join(', ') ?? '—' },
    { label: 'Contract Terms', get: p => p.contract_terms ?? '—' },
    { label: 'Deposit', get: p => p.deposit_amount ? `$${p.deposit_amount.toLocaleString()}` : '—' },
    { label: 'Insurance Included', get: p => p.insurance_included ? 'Yes' : 'No', highlight: p => !!p.insurance_included },
    { label: 'Pool Flexibility', get: p => p.pool_flexibility ? 'Yes' : 'No', highlight: p => !!p.pool_flexibility },
    { label: 'Firmware Flexibility', get: p => p.firmware_flexibility ? 'Yes' : 'No', highlight: p => !!p.firmware_flexibility },
    { label: 'Financing', get: p => p.financing_available ? 'Available' : 'No', highlight: p => !!p.financing_available },
    { label: 'Min. Units', get: p => p.min_units ? String(p.min_units) : '—' },
    { label: 'Uptime Guarantee', get: p => p.uptime_guarantee ? `${p.uptime_guarantee}%` : '—' },
    { label: 'User Rating', get: p => p.user_rating ? `${p.user_rating}/5 (${p.review_count ?? 0} reviews)` : '—' },
    { label: 'Verification', get: p => p.verification_status === 'verified' ? '✓ Verified' : '⚠ Pending' },
  ]

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
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
              {PROVIDERS_DATA.map(p => <option key={p.slug} value={p.slug!}>{p.name}</option>)}
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
                  <Link href={`/hosts/${provA.slug}`} className="hover:text-[#00d4aa]">{provA.name}</Link>
                  {provA.is_primary && <div className="text-xs font-normal" style={{ color: '#00d4aa' }}>#1 Rated</div>}
                </th>
                <th className="py-3 px-4 text-center text-white font-semibold">
                  <Link href={`/hosts/${provB.slug}`} className="hover:text-[#00d4aa]">{provB.name}</Link>
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
                      <td key={p.slug} className="py-3 px-4 text-center" style={{ color: hl ? '#00d4aa' : '#e2e8f0' }}>
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
          <Link href={`/hosts/${provA.slug}`} className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#00d4aa] hover:text-white transition-colors">
            Full {provA.name} review →
          </Link>
          <Link href={`/hosts/${provB.slug}`} className="text-sm px-4 py-2 rounded-lg border border-gray-700 text-gray-300 hover:border-[#00d4aa] hover:text-white transition-colors">
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
