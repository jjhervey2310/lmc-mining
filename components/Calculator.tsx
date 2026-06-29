'use client'

import { useState, useEffect, useCallback } from 'react'
import { Miner, HostingProvider, CoolingType } from '@/lib/types'
import { calculateMiningProfitability, formatBTC, formatUSD, formatDays } from '@/lib/calculator'
import VerificationBadge from './VerificationBadge'

interface LiveData {
  price: number
  difficulty: number
  last_updated: string
  stale?: boolean
  warning?: string
}

export default function Calculator() {
  const [miners, setMiners] = useState<Miner[]>([])
  const [providers, setProviders] = useState<HostingProvider[]>([])
  const [liveData, setLiveData] = useState<LiveData | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [coolingFilter, setCoolingFilter] = useState<'all' | CoolingType>('all')
  const [selectedMiner, setSelectedMiner] = useState<Miner | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<HostingProvider | null>(null)
  const [hashrateOverride, setHashrateOverride] = useState('')
  const [powerOverride, setPowerOverride] = useState('')
  const [monthlyFee, setMonthlyFee] = useState('')
  const [electricityRate, setElectricityRate] = useState('0.10')
  const [electricityFromProvider, setElectricityFromProvider] = useState(false)
  const [purchasePrice, setPurchasePrice] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/miners').then((r) => r.json()),
      fetch('/api/providers').then((r) => r.json()),
      fetch('/api/btc-price').then((r) => r.json()),
    ]).then(([minerData, providerData, priceData]) => {
      setMiners(minerData.miners || [])
      setProviders(providerData.providers || [])
      if (!priceData.error) setLiveData(priceData)
      setLoadingData(false)
    })
  }, [])

  const filteredMiners = miners.filter(
    (m) => coolingFilter === 'all' || m.cooling_type === coolingFilter
  )

  const filteredProviders = selectedMiner
    ? providers.filter((p) =>
        !p.supported_cooling || p.supported_cooling.includes(selectedMiner.cooling_type)
      )
    : providers

  const pricedProviders = filteredProviders.filter((p) => p.pricing_status !== 'contact_required')
  const quoteProviders = filteredProviders.filter((p) => p.pricing_status === 'contact_required')

  const handleMinerChange = useCallback(
    (minerId: string) => {
      const miner = miners.find((m) => m.id === parseInt(minerId)) || null
      setSelectedMiner(miner)
      if (miner) {
        setHashrateOverride('')
        setPowerOverride('')
        // Auto-set cooling filter to match miner
        setCoolingFilter(miner.cooling_type)
        // Auto-select primary provider compatible with this miner
        const compatible = providers.filter(
          (p) => !p.supported_cooling || p.supported_cooling.includes(miner.cooling_type)
        )
        const primary = compatible.find((p) => p.is_primary) || compatible[0] || null
        setSelectedProvider(primary)
        if (primary?.monthly_fee_air && miner.cooling_type === 'air') {
          setMonthlyFee(String(primary.monthly_fee_air))
        } else if (primary?.monthly_fee_hydro && miner.cooling_type === 'hydro') {
          setMonthlyFee(String(primary.monthly_fee_hydro))
        } else if (primary?.monthly_fee_immersion && miner.cooling_type === 'immersion') {
          setMonthlyFee(String(primary.monthly_fee_immersion))
        } else {
          setMonthlyFee('')
        }
        if (primary?.electricity_rate_kwh) {
          setElectricityRate(String(primary.electricity_rate_kwh))
          setElectricityFromProvider(true)
        }
      }
    },
    [miners, providers]
  )

  const handleProviderChange = useCallback(
    (providerId: string) => {
      const provider = providers.find((p) => p.id === parseInt(providerId)) || null
      setSelectedProvider(provider)
      if (provider && selectedMiner) {
        const fee =
          selectedMiner.cooling_type === 'air'
            ? provider.monthly_fee_air
            : selectedMiner.cooling_type === 'hydro'
            ? provider.monthly_fee_hydro
            : provider.monthly_fee_immersion
        setMonthlyFee(fee ? String(fee) : '')
        if (provider.electricity_rate_kwh) {
          setElectricityRate(String(provider.electricity_rate_kwh))
          setElectricityFromProvider(true)
        } else {
          setElectricityFromProvider(false)
        }
      }
    },
    [providers, selectedMiner]
  )

  const effectiveHashrate = parseFloat(hashrateOverride) || selectedMiner?.default_hashrate_th || 0
  const effectivePower = parseFloat(powerOverride) || selectedMiner?.power_watts || 0
  const effectiveMonthlyFee = parseFloat(monthlyFee) || null

  const results =
    effectiveHashrate > 0 && liveData
      ? calculateMiningProfitability({
          miner: selectedMiner,
          hashrate_th: effectiveHashrate,
          power_watts: effectivePower,
          cooling_type: selectedMiner?.cooling_type || 'air',
          provider: selectedProvider,
          monthly_hosting_fee: effectiveMonthlyFee,
          electricity_rate_kwh: parseFloat(electricityRate) || 0.10,
          miner_purchase_price: parseFloat(purchasePrice) || null,
          btc_price: liveData.price,
          network_difficulty: liveData.difficulty,
        })
      : null

  return (
    <div className="space-y-6">
      {/* Live data status */}
      {liveData && (
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span>
            BTC:{' '}
            <span className="font-mono font-semibold" style={{ color: '#00d4aa' }}>
              {formatUSD(liveData.price)}
            </span>
            {liveData.stale && (
              <span className="ml-2 text-yellow-500">⚠ Cached data — {liveData.warning}</span>
            )}
          </span>
          <span>Updated: {new Date(liveData.last_updated).toLocaleTimeString()}</span>
        </div>
      )}

      {/* Cooling type filter */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Cooling Type</label>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'air', 'hydro', 'immersion'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setCoolingFilter(type)
                setSelectedMiner(null)
                setSelectedProvider(null)
              }}
              className="px-4 py-2 rounded-lg text-sm font-medium transition-all"
              style={
                coolingFilter === type
                  ? { background: '#00d4aa', color: '#0a0e17' }
                  : { background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }
              }
            >
              {type === 'all' ? 'All Types' : type.charAt(0).toUpperCase() + type.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Miner selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Select Miner</label>
          <select
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
            value={selectedMiner?.id || ''}
            onChange={(e) => handleMinerChange(e.target.value)}
            disabled={loadingData}
          >
            <option value="">Choose a miner...</option>
            {(['air', 'hydro', 'immersion'] as CoolingType[]).map((type) => {
              const group = filteredMiners.filter((m) => m.cooling_type === type)
              if (!group.length) return null
              return (
                <optgroup key={type} label={`${type.charAt(0).toUpperCase() + type.slice(1)}-Cooled`}>
                  {group.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} — {m.default_hashrate_th} TH/s
                      {m.spec_confidence === 'pending_verification' ? ' ⏳' : ''}
                    </option>
                  ))}
                </optgroup>
              )
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Hosting Provider</label>
          <select
            className="w-full rounded-lg px-3 py-2.5 text-sm"
            style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
            value={selectedProvider?.id || ''}
            onChange={(e) => handleProviderChange(e.target.value)}
            disabled={loadingData}
          >
            <option value="">Choose a provider...</option>
            {pricedProviders.map((p) => {
              const isAbundantForHydroImmersion =
                p.is_primary && selectedMiner && selectedMiner.cooling_type !== 'air'
              return (
                <option
                  key={p.id}
                  value={p.id}
                  style={isAbundantForHydroImmersion ? { color: '#6b7280' } : {}}
                >
                  {p.name}
                  {p.is_primary ? ' ⭐ #1 Rated' : ''}
                  {isAbundantForHydroImmersion ? ` — Hydro/Immersion ~${p.hydro_immersion_available_date}` : ''}
                  {p.verification_status === 'pending_verification' ? ' ⏳' : ''}
                </option>
              )
            })}
          </select>
          {selectedProvider && (
            <div className="mt-1 flex items-center gap-2">
              <VerificationBadge
                status={selectedProvider.verification_status}
                date={selectedProvider.verification_date}
              />
              {selectedProvider.is_primary && (
                <span className="text-xs" style={{ color: '#00d4aa' }}>
                  #1 Recommended for Air
                </span>
              )}
            </div>
          )}
          {quoteProviders.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: '#1f2937' }}>
              <p className="text-xs text-gray-500 mb-2">Need a custom quote from these providers?</p>
              <div className="flex flex-wrap gap-2">
                {quoteProviders.map((p) => (
                  <a
                    key={p.id}
                    href="/review"
                    className="text-xs px-3 py-1.5 rounded-lg transition-opacity hover:opacity-80"
                    style={{ background: '#1f2937', color: '#9ca3af', border: '1px solid #374151' }}
                  >
                    {p.name} — Request Quote →
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Electricity rate — always visible */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Electricity Rate ($/kWh)
        </label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full max-w-xs rounded-lg px-3 py-2.5 text-sm font-mono"
          style={{
            background: electricityFromProvider ? '#0d1f17' : '#1f2937',
            color: '#e2e8f0',
            border: electricityFromProvider ? '1px solid rgba(0,212,170,0.4)' : '1px solid #374151',
          }}
          value={electricityRate}
          onChange={(e) => {
            setElectricityRate(e.target.value)
            setElectricityFromProvider(false)
          }}
        />
        <p className="text-xs mt-1.5" style={{ color: electricityFromProvider ? '#00d4aa' : '#6b7280' }}>
          {electricityFromProvider
            ? `Auto-filled from ${selectedProvider?.name}. Type to override.`
            : 'Enter your rate or select a provider above to auto-fill.'}
        </p>
      </div>

      {/* Auto-filled & overridable fields */}
      {selectedMiner && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 rounded-lg" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hashrate (TH/s)</label>
            <input
              type="number"
              className="w-full rounded px-2 py-1.5 text-sm font-mono"
              style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
              placeholder={String(selectedMiner.default_hashrate_th)}
              value={hashrateOverride}
              onChange={(e) => setHashrateOverride(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Power (W)</label>
            <input
              type="number"
              className="w-full rounded px-2 py-1.5 text-sm font-mono"
              style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
              placeholder={String(selectedMiner.power_watts)}
              value={powerOverride}
              onChange={(e) => setPowerOverride(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-400 mb-1">Hosting $/mo</label>
            <input
              type="number"
              className="w-full rounded px-2 py-1.5 text-sm font-mono"
              style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
              placeholder="Monthly fee"
              value={monthlyFee}
              onChange={(e) => setMonthlyFee(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Optional purchase price */}
      {selectedMiner && (
        <div className="max-w-xs">
          <label className="block text-xs text-gray-400 mb-1">
            Miner Purchase Price (optional — for breakeven estimate)
          </label>
          <input
            type="number"
            className="w-full rounded px-2 py-1.5 text-sm font-mono"
            style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
            placeholder="e.g. 4500"
            value={purchasePrice}
            onChange={(e) => setPurchasePrice(e.target.value)}
          />
        </div>
      )}

      {/* Results */}
      {results && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Home Mining */}
          <ResultCard
            title="Home Mining"
            subtitle={`at $${electricityRate}/kWh electricity`}
            daily={results.daily_net_profit_home}
            monthly={results.monthly_net_profit_home}
            annual={results.annual_net_profit_home}
            dailyBTC={results.daily_btc_mined}
            breakevenDays={results.breakeven_days_home}
          />

          {/* Hosted Mining */}
          {effectiveMonthlyFee !== null ? (
            <ResultCard
              title="Hosted Mining"
              subtitle={`with ${selectedProvider?.name || 'selected provider'} at $${effectiveMonthlyFee}/mo`}
              daily={results.daily_net_profit_hosted!}
              monthly={results.monthly_net_profit_hosted!}
              annual={results.annual_net_profit_hosted!}
              dailyBTC={results.daily_btc_mined}
              breakevenDays={results.breakeven_days_hosted}
              provider={selectedProvider}
            />
          ) : (
            <div
              className="rounded-xl p-6 flex flex-col items-center justify-center text-center"
              style={{ background: '#111827', border: '1px solid #1f2937' }}
            >
              <p className="text-gray-400 text-sm mb-3">
                {selectedProvider?.pricing_status === 'contact_required'
                  ? `${selectedProvider.name} requires a custom quote.`
                  : 'Select a hosting provider to compare.'}
              </p>
              {selectedProvider?.pricing_status === 'contact_required' && (
                <a
                  href="/hosting-match"
                  className="text-sm font-semibold px-4 py-2 rounded-lg"
                  style={{ background: '#00d4aa20', color: '#00d4aa', border: '1px solid #00d4aa40' }}
                >
                  Get a Free Hosting Match →
                </a>
              )}
            </div>
          )}
        </div>
      )}

      {/* Abundant Miners deposit note */}
      {selectedProvider?.is_primary && results && (
        <div
          className="rounded-lg px-4 py-3 text-sm"
          style={{ background: '#00d4aa10', border: '1px solid #00d4aa30', color: '#00d4aa' }}
        >
          ℹ️ Abundant Miners: $500 deposit covers months 11 and 12 of your 12-month contract.
        </div>
      )}

      {/* Hydro/immersion efficiency note */}
      {selectedMiner && ['hydro', 'immersion'].includes(selectedMiner.cooling_type) && (
        <div
          className="rounded-lg px-4 py-3 text-sm text-gray-300"
          style={{ background: '#1f2937', border: '1px solid #374151' }}
        >
          💧 <strong>{selectedMiner.cooling_type === 'hydro' ? 'Hydro' : 'Immersion'} cooling</strong>{' '}
          enables denser deployments and higher overclocking potential, improving efficiency vs. air cooling.
          Hosting for {selectedMiner.cooling_type} miners requires specialized infrastructure — fewer providers
          offer it, but costs per TH are often lower at scale.
        </div>
      )}

      {/* Spec confidence warning */}
      {selectedMiner?.spec_confidence === 'pending_verification' && (
        <div
          className="rounded-lg px-4 py-3 text-xs"
          style={{ background: '#f59e0b10', border: '1px solid #f59e0b30', color: '#f59e0b' }}
        >
          ⏳ Miner specs for {selectedMiner.name} are pending manufacturer verification. Results are estimates
          based on available data and may not reflect exact performance.
        </div>
      )}

      {/* CTA below calculator */}
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: '#111827', border: '1px solid #1f2937' }}
      >
        <p className="text-gray-300 mb-3">
          Not sure if your mining deal is worth it?
        </p>
        <a
          href="/review"
          className="inline-block font-semibold px-6 py-3 rounded-lg transition-colors"
          style={{ background: '#00d4aa', color: '#0a0e17' }}
        >
          Get a Free Deal Review →
        </a>
      </div>
    </div>
  )
}

interface ResultCardProps {
  title: string
  subtitle: string
  daily: number
  monthly: number
  annual: number
  dailyBTC: number
  breakevenDays: number | null
  provider?: HostingProvider | null
}

function ResultCard({ title, subtitle, daily, monthly, annual, dailyBTC, breakevenDays, provider }: ResultCardProps) {
  const profitable = daily > 0
  const profitColor = profitable ? '#00d4aa' : '#ff4757'

  return (
    <div
      className="rounded-xl p-6"
      style={{
        background: '#111827',
        border: `1px solid ${profitable ? '#00d4aa30' : '#ff475730'}`,
      }}
    >
      <div className="mb-4">
        <h3 className="font-semibold text-white text-lg">{title}</h3>
        <p className="text-xs text-gray-400">{subtitle}</p>
        {provider && (
          <div className="mt-1">
            <VerificationBadge status={provider.verification_status} date={provider.verification_date} />
          </div>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Daily Net Profit</span>
          <span className="font-mono font-bold text-lg" style={{ color: profitColor }}>
            {formatUSD(daily)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Monthly Net Profit</span>
          <span className="font-mono font-semibold" style={{ color: profitColor }}>
            {formatUSD(monthly)}
          </span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Annual Net Profit</span>
          <span className="font-mono font-semibold" style={{ color: profitColor }}>
            {formatUSD(annual)}
          </span>
        </div>
        <div className="border-t border-gray-700 pt-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Daily BTC Mined</span>
            <span className="font-mono text-sm text-gray-300">{formatBTC(dailyBTC)} BTC</span>
          </div>
        </div>
        {breakevenDays !== null && (
          <div className="flex justify-between items-center">
            <span className="text-sm text-gray-400">Breakeven</span>
            <span className="font-mono text-sm text-gray-300">
              {profitable ? formatDays(breakevenDays) : 'Not profitable'}
            </span>
          </div>
        )}
        {!profitable && (
          <div
            className="rounded-lg p-3 text-xs text-center mt-2"
            style={{ background: '#ff475710', border: '1px solid #ff475730', color: '#ff4757' }}
          >
            ⚠ This configuration does not currently generate profit at these market conditions.
          </div>
        )}
      </div>
    </div>
  )
}
