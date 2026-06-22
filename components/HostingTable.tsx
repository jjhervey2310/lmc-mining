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
  const verified = providers.filter((p) => p.verification_status === 'verified')
  const pending = providers.filter((p) => p.verification_status === 'pending_verification')

  return (
    <div className="space-y-6">
      {/* Verified providers */}
      <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid #1f2937' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ background: '#111827', borderBottom: '1px solid #1f2937' }}>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Provider</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Locations</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Cooling</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Pricing</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Deposit</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Contract</th>
              <th className="text-left px-4 py-3 text-gray-400 font-medium">Affiliate</th>
            </tr>
          </thead>
          <tbody>
            {verified.map((p) => (
              <tr
                key={p.id}
                style={{
                  background: p.is_primary ? '#00d4aa08' : '#0a0e17',
                  borderBottom: '1px solid #1f2937',
                  borderLeft: p.is_primary ? '3px solid #00d4aa' : '3px solid transparent',
                }}
              >
                <td className="px-4 py-3">
                  <div className="font-semibold text-white">
                    {p.name}
                    {p.is_primary && (
                      <span
                        className="ml-2 text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ background: '#00d4aa20', color: '#00d4aa' }}
                      >
                        #1 Rated for Air
                      </span>
                    )}
                  </div>
                  {(p.affiliate_url || p.website) && (
                    <a
                      href={p.affiliate_url ?? p.website ?? '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:underline"
                      style={{ color: p.affiliate_url ? '#00d4aa' : '#60a5fa' }}
                      onClick={() => onAffiliateClick(p)}
                    >
                      {p.affiliate_url ? 'Get started ↗' : 'Visit website ↗'}
                    </a>
                  )}
                  {p.hydro_immersion_available_date && p.is_primary && (
                    <div className="text-xs text-gray-500 mt-0.5">
                      Hydro/Immersion ~{p.hydro_immersion_available_date}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <VerificationBadge status={p.verification_status} date={p.verification_date} />
                  <div className="text-xs text-gray-500 mt-1">
                    {p.verification_date && `Verified ${new Date(p.verification_date).toLocaleDateString()}`}
                  </div>
                </td>
                <td className="px-4 py-3 text-gray-300 text-xs">
                  {p.locations?.join(', ') || '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {p.supported_cooling?.map((c) => (
                      <span key={c} title={c} className="text-base">
                        {COOLING_ICONS[c] || c}
                      </span>
                    )) || '—'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {p.pricing_status === 'contact_required' ? (
                    <span className="text-xs text-yellow-400">Contact for Pricing</span>
                  ) : (
                    <div className="font-mono text-xs text-gray-300">
                      {p.monthly_fee_air && <div>Air: ${p.monthly_fee_air}/mo</div>}
                      {p.monthly_fee_hydro && <div>Hydro: ${p.monthly_fee_hydro}/mo</div>}
                      {p.monthly_fee_immersion && <div>Immersion: ${p.monthly_fee_immersion}/mo</div>}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-300">
                  {p.deposit_status === 'unverified' ? (
                    <span className="text-gray-500">Unverified</span>
                  ) : p.deposit_amount ? (
                    <div>
                      <div className="font-mono">${p.deposit_amount}</div>
                      {p.deposit_description && (
                        <div className="text-gray-500 mt-0.5">{p.deposit_description}</div>
                      )}
                    </div>
                  ) : (
                    '—'
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-gray-300">
                  {p.contract_status === 'unverified' ? (
                    <span className="text-gray-500">Unverified</span>
                  ) : (
                    p.contract_terms || '—'
                  )}
                </td>
                <td className="px-4 py-3">
                  {p.affiliate_program_available ? (
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

      {/* Pending verification providers */}
      {pending.length > 0 && (
        <div>
          <div
            className="text-xs text-gray-400 px-1 pb-3 border-t border-gray-800 pt-4"
            style={{ borderStyle: 'dashed' }}
          >
            The following providers are shown for cooling comparison. Verified partnerships coming soon.
          </div>
          <div className="overflow-x-auto rounded-xl opacity-70" style={{ border: '1px solid #374151' }}>
            <table className="w-full text-sm">
              <tbody>
                {pending.map((p) => (
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
                      <VerificationBadge status="pending_verification" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {p.supported_cooling?.map((c) => COOLING_ICONS[c]).join(' ')}
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
