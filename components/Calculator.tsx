'use client'

import { useState, useEffect, useCallback } from 'react'
import { Miner, CoolingType, CalculatorResults } from '@/lib/types'
import { calculateMiningProfitability, formatBTC, formatUSD, formatDays } from '@/lib/calculator'

interface LiveData {
  price: number
  difficulty: number
  last_updated: string
  stale?: boolean
  warning?: string
}

interface CalculatorProps {
  initialLiveData?: LiveData | null
}

export default function Calculator({ initialLiveData = null }: CalculatorProps) {
  const [miners, setMiners] = useState<Miner[]>([])
  const [liveData, setLiveData] = useState<LiveData | null>(initialLiveData)
  const [loadingData, setLoadingData] = useState(true)

  const [coolingFilter, setCoolingFilter] = useState<'all' | CoolingType>('all')
  const [selectedMiner, setSelectedMiner] = useState<Miner | null>(null)
  const [hashrate, setHashrate] = useState('')
  const [power, setPower] = useState('')
  const [electricityRate, setElectricityRate] = useState('')
  const [hardwareCost, setHardwareCost] = useState('')

  useEffect(() => {
    fetch('/api/miners')
      .then((r) => r.json())
      .then((minerData) => setMiners(minerData.miners || []))
      .catch(() => setMiners([]))

    // Server already provided live price/difficulty for the initial render.
    // Only re-fetch client-side if that server-side fetch failed.
    if (initialLiveData) {
      setLoadingData(false)
      return
    }

    fetch('/api/btc-price')
      .then((r) => r.json())
      .then((priceData) => {
        if (!priceData.error) setLiveData(priceData)
      })
      .catch(() => {})
      .finally(() => setLoadingData(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filteredMiners = miners.filter(
    (m) => coolingFilter === 'all' || m.cooling_type === coolingFilter
  )

  const handleMinerChange = useCallback(
    (minerId: string) => {
      const miner = miners.find((m) => m.id === parseInt(minerId)) || null
      setSelectedMiner(miner)
      if (miner) {
        setHashrate(String(miner.default_hashrate_th))
        setPower(String(miner.power_watts))
        setCoolingFilter(miner.cooling_type)
      }
    },
    [miners]
  )

  const hashrateNum = parseFloat(hashrate)
  const powerNum = parseFloat(power)
  const electricityRateNum = parseFloat(electricityRate)
  const hardwareCostNum = parseFloat(hardwareCost) || null

  const inputsComplete =
    hashrate !== '' &&
    power !== '' &&
    electricityRate !== '' &&
    hashrateNum > 0 &&
    powerNum > 0 &&
    electricityRateNum >= 0

  const results =
    inputsComplete && liveData
      ? calculateMiningProfitability({
          hashrate_th: hashrateNum,
          power_watts: powerNum,
          electricity_rate_kwh: electricityRateNum,
          hardware_cost: hardwareCostNum,
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

      {/* Cooling type filter (optional shortcut) */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Cooling Type</label>
        <div className="flex gap-2 flex-wrap">
          {(['all', 'air', 'hydro', 'immersion'] as const).map((type) => (
            <button
              key={type}
              onClick={() => {
                setCoolingFilter(type)
                setSelectedMiner(null)
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

      {/* Miner selector (optional shortcut) */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Select a Miner <span className="text-gray-500 font-normal">(optional — auto-fills specs below)</span>
        </label>
        <select
          className="w-full max-w-md rounded-lg px-3 py-2.5 text-sm"
          style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
          value={selectedMiner?.id || ''}
          onChange={(e) => handleMinerChange(e.target.value)}
          disabled={loadingData}
        >
          <option value="">Enter specs manually...</option>
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

      {/* Required inputs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Hashrate (TH/s)</label>
          <input
            type="number"
            min="0"
            step="any"
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono"
            style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
            placeholder="e.g. 335"
            value={hashrate}
            onChange={(e) => setHashrate(e.target.value)}
          />
          <p className="text-xs mt-1.5 text-gray-500">Find this on your miner spec sheet</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Power Consumption (W)</label>
          <input
            type="number"
            min="0"
            step="any"
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono"
            style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
            placeholder="e.g. 3250"
            value={power}
            onChange={(e) => setPower(e.target.value)}
          />
          <p className="text-xs mt-1.5 text-gray-500">Watts drawn at wall</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Electricity Rate ($/kWh)</label>
          <input
            type="number"
            min="0"
            step="0.001"
            className="w-full rounded-lg px-3 py-2.5 text-sm font-mono"
            style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
            placeholder="e.g. 0.077"
            value={electricityRate}
            onChange={(e) => setElectricityRate(e.target.value)}
          />
          <p className="text-xs mt-1.5 text-gray-500">
            Your all-in hosting rate. US facilities typically $0.055–$0.095/kWh
          </p>
        </div>
      </div>

      {/* Optional hardware cost for payback period */}
      <div className="max-w-xs">
        <label className="block text-xs text-gray-400 mb-1">
          Hardware Cost (optional — for payback period)
        </label>
        <input
          type="number"
          min="0"
          className="w-full rounded px-2 py-1.5 text-sm font-mono"
          style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
          placeholder="e.g. 4500"
          value={hardwareCost}
          onChange={(e) => setHardwareCost(e.target.value)}
        />
      </div>

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

      {/* Results */}
      {results && <ResultsGrid results={results} />}

      {/* Disclaimer */}
      {results && (
        <p className="text-xs text-gray-500 text-center">
          Projections assume constant difficulty and BTC price. Difficulty adjusts every ~2 weeks.
        </p>
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

function ResultsGrid({ results }: { results: CalculatorResults }) {
  const profitable = results.daily_profit_usd > 0
  const profitColor = profitable ? '#00d4aa' : '#ff4757'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Revenue */}
        <div className="rounded-xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h3 className="font-semibold text-white text-lg mb-4">Revenue</h3>
          <div className="space-y-3">
            <Row label="Daily" value={formatUSD(results.daily_revenue_usd)} color="#e2e8f0" />
            <Row label="Monthly" value={formatUSD(results.monthly_revenue_usd)} color="#e2e8f0" />
            <Row label="Annual" value={formatUSD(results.annual_revenue_usd)} color="#e2e8f0" />
            <div className="border-t pt-3" style={{ borderColor: '#1f2937' }}>
              <Row label="Daily BTC Mined" value={`${formatBTC(results.daily_btc_mined)} BTC`} color="#9ca3af" mono />
            </div>
          </div>
        </div>

        {/* Profit */}
        <div
          className="rounded-xl p-6"
          style={{ background: '#111827', border: `1px solid ${profitable ? '#00d4aa30' : '#ff475730'}` }}
        >
          <h3 className="font-semibold text-white text-lg mb-4">Net Profit</h3>
          <div className="space-y-3">
            <Row label="Daily" value={formatUSD(results.daily_profit_usd)} color={profitColor} bold />
            <Row label="Monthly" value={formatUSD(results.monthly_profit_usd)} color={profitColor} bold />
            <Row label="Annual" value={formatUSD(results.annual_profit_usd)} color={profitColor} bold />
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
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Breakeven BTC Price" value={formatUSD(results.breakeven_btc_price)} />
        <StatCard
          label="Profit Margin"
          value={`${results.profit_margin_percent.toFixed(1)}%`}
          color={profitable ? '#00d4aa' : '#ff4757'}
        />
        <StatCard label="Hashprice" value={`${formatUSD(results.hashprice_usd_per_th_day)}/TH/day`} />
        {results.payback_days !== null && (
          <StatCard label="Payback Period" value={formatDays(results.payback_days)} color="#00d4aa" />
        )}
      </div>
    </div>
  )
}

function Row({
  label,
  value,
  color,
  bold,
  mono,
}: {
  label: string
  value: string
  color: string
  bold?: boolean
  mono?: boolean
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-400">{label}</span>
      <span
        className={`font-mono ${bold ? 'font-bold text-lg' : mono ? 'text-sm' : 'font-semibold'}`}
        style={{ color }}
      >
        {value}
      </span>
    </div>
  )
}

function StatCard({ label, value, color = '#e2e8f0' }: { label: string; value: string; color?: string }) {
  return (
    <div className="rounded-xl p-4 text-center" style={{ background: '#111827', border: '1px solid #1f2937' }}>
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className="font-mono font-semibold" style={{ color }}>
        {value}
      </p>
    </div>
  )
}
