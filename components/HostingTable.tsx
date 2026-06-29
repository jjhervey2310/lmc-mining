'use client'

import { HostingProvider } from '@/lib/types'
import VerificationBadge from './VerificationBadge'

const COOLING_ICONS: Record<string, string> = {
  air: '💨',
  hydro: '💧',
  immersion: '🌊',
}

interface HostingTableProps {
  providers: HostingProvider[]
  onAffiliateClick: (provider: HostingProvider) => void
}

export default function HostingTable({ providers, onAffiliateClick }: HostingTableProps) {
  const verified = providers.filter((p) => p.verificationStatus === 'verified')
  const other = providers.filter((p) => p.verificationStatus !== 'verified')

  function priceLabel(p: HostingProvider): string {
    if (p.flatMonthly) return `$${p.flatMonthly}/mo flat`
    if (p.rateMin && p.rateMax && p.rateMin !== p.rateMax) return `$${p.rateMin}–$${p.rateMax}/kWh`
    if (p.rateMin) return `$${p.rateMin}/kWh`
    return 'Contact required'
  }

  return (
    <div className="space-y-6">
      {/* Verified providers */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #1f2937' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111827', borderBottom: '1px solid #1f2937' }}>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Provider</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Location</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Cooling</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Pricing</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Setup Fee</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Contract</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Affiliate</th>
            </tr>
          </thead>
          <tbody>
            {verified.map((p) => (
              <tr
                key={p.id}
                style={{
                  background: p.tier === 1 ? '#00d4aa08' : '#0a0e17',
                  borderBottom: '1px solid #1f2937',
                  borderLeft: p.tier === 1 ? '3px solid #00d4aa' : '3px solid transparent',
                }}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">
                    {p.name}
                    {p.tier === 1 && (
                      <span className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: '#00d4aa20', color: '#00d4aa' }}>
                        #1 Rated
                      </span>
                    )}
                  </div>
                  {(p.affiliateLink || p.website) && (
                    <a
                      href={p.affiliateLink ?? p.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:underline"
                      style={{ color: p.affiliateLink ? '#00d4aa' : '#60a5fa' }}
                      onClick={() => onAffiliateClick(p)}
                    >
                      {p.affiliateLink ? 'Get started ↗' : 'Visit website ↗'}
                    </a>
                  )}
                </td>
                <td className="px-4 py-3">
                  <VerificationBadge status={p.verificationStatus} date={p.lastVerified} />
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {p.facilityLocations.join(', ') || '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {p.cooling.map((c) => (
                      <span key={c} title={c} className="text-base">{COOLING_ICONS[c] || c}</span>
                    ))}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-gray-300">{priceLabel(p)}</td>
                <td className="px-4 py-3 text-xs text-gray-300">
                  {p.setupFee ? `$${p.setupFee.toLocaleString()}` : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-gray-300">{p.contractLength || '—'}</td>
                <td className="px-4 py-3">
                  {p.affiliateProgram ? (
                    <span className="text-xs text-green-400">Yes</span>
                  ) : (
                    <span className="text-xs text-gray-500">No</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contact / pending providers */}
      {other.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 px-1 pb-3 border-t border-gray-800 pt-4" style={{ borderStyle: 'dashed' }}>
            The following providers require a direct quote. Contact them for current pricing and terms.
          </div>
          <div className="overflow-x-auto rounded-xl opacity-70" style={{ border: '1px solid #374151' }}>
            <table className="w-full text-sm">
              <tbody>
                {other.map((p) => (
                  <tr key={p.id} style={{ background: '#0a0e17', borderBottom: '1px solid #1f2937' }}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-300">{p.name}</div>
                      {p.website && (
                        <a href={p.website} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400">
                          {p.website} ↗
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <VerificationBadge status={p.verificationStatus} />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.cooling.map((c) => COOLING_ICONS[c]).join(' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
