'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const FINANCING_OPTIONS = [
  {
    provider: 'Abundant Miners',
    slug: 'abundant-miners',
    type: 'Vendor Financing',
    max_amount: 140000,
    apr: 10,
    term_months: 36,
    down_payment_pct: 10,
    verified: true,
    highlight: true,
    description: 'Finance hardware and hosting together. The only verified vendor financing option with integrated hosting at $225/month flat fee.',
    details: [
      'Up to $140,000 financed',
      '10% down payment required',
      '36-month term',
      '10% APR fixed',
      'Financing includes both hardware and hosting setup',
      'No pre-payment penalty',
    ],
  },
  {
    provider: 'Simple Mining',
    slug: 'simple-mining',
    type: 'Equipment Finance',
    max_amount: 500000,
    apr: null,
    term_months: null,
    down_payment_pct: null,
    verified: true,
    highlight: false,
    description: 'Equipment financing available through Simple Mining with flexible month-to-month contracts. Contact for rates.',
    details: [
      'Contact for rate quotes',
      'Month-to-month hosting available',
      'Multiple hardware brands supported',
      'Financing for larger deployments',
    ],
  },
  {
    provider: 'Third-Party Equipment Lenders',
    slug: null,
    type: 'Specialty Lender',
    max_amount: null,
    apr: null,
    term_months: null,
    down_payment_pct: null,
    verified: false,
    highlight: false,
    description: 'Several specialty lenders provide equipment financing for Bitcoin mining hardware. Typical rates 12-18% APR, 50-70% LTV on equipment value.',
    details: [
      'Independent of hosting provider',
      'Rates typically 12-18% APR',
      'LTV: 50-70% of hardware value',
      'Terms: 12-36 months',
      'Requires business entity',
    ],
  },
]

function formatCurrency(n: number) {
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

function calcMonthlyPayment(principal: number, annualRate: number, months: number) {
  const r = annualRate / 100 / 12
  if (r === 0) return principal / months
  return principal * (r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
}

export default function FinancingPage() {
  const [hardwareCost, setHardwareCost] = useState(38000)
  const [downPctInput, setDownPctInput] = useState(10)
  const [apr, setApr] = useState(10)
  const [termMonths, setTermMonths] = useState(36)
  const [unitsForHosting, setUnitsForHosting] = useState(10)
  const [btcPrice, setBtcPrice] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/btc-price')
      .then(r => r.json())
      .then(d => { if (d?.price) setBtcPrice(Number(d.price)) })
      .catch(() => {})
  }, [])

  const downAmount = hardwareCost * (downPctInput / 100)
  const principal = hardwareCost - downAmount
  const monthlyPayment = calcMonthlyPayment(principal, apr, termMonths)
  const totalInterest = monthlyPayment * termMonths - principal
  const totalCost = hardwareCost + totalInterest
  const monthlyHosting = unitsForHosting * 225

  const DIFFICULTY = 113_757_508_517_000
  const hashrateTH = unitsForHosting * 234
  const dailyBtc = (hashrateTH * 1e12 * 86400 * 3.125) / (DIFFICULTY * Math.pow(2, 32))
  const dailyGross = btcPrice ? dailyBtc * btcPrice : null
  const dailyCostTotal = (monthlyHosting / 30) + (monthlyPayment / 30)
  const dailyNet = dailyGross !== null ? dailyGross - dailyCostTotal : null

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FinancialProduct',
        name: 'Bitcoin Mining Equipment Financing',
        description: 'Finance Bitcoin mining hardware through vendor financing, equipment loans, or specialty lenders. Calculate your monthly payments and ROI.',
        url: 'https://lmcmining.com/financing',
      }) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / Financing
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Bitcoin Mining Financing</h1>
      <p className="text-gray-400 mb-10">Finance your mining hardware to scale faster. Calculate monthly payments and model ROI with and without financing.</p>

      {/* Financing Options */}
      <div className="space-y-5 mb-12">
        <h2 className="text-lg font-bold text-white">Verified Financing Options</h2>
        {FINANCING_OPTIONS.map(opt => (
          <div key={opt.provider} className="rounded-2xl p-6" style={{ background: '#111827', border: `1px solid ${opt.highlight ? '#00d4aa' : '#1f2937'}` }}>
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base font-bold text-white">{opt.provider}</span>
                  {opt.verified && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#00d4aa15', color: '#00d4aa' }}>✓ Verified</span>}
                  {opt.highlight && <span className="text-xs px-2 py-0.5 rounded-full font-semibold" style={{ background: '#00d4aa20', color: '#00d4aa' }}>RECOMMENDED</span>}
                </div>
                <div className="text-xs text-gray-500">{opt.type}</div>
              </div>
              {opt.apr && (
                <div className="text-right">
                  <div className="text-xl font-bold font-mono" style={{ color: '#00d4aa' }}>{opt.apr}% APR</div>
                  {opt.term_months && <div className="text-xs text-gray-500">{opt.term_months}-month term</div>}
                </div>
              )}
            </div>
            <p className="text-sm text-gray-400 mb-4">{opt.description}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-4">
              {opt.details.map(d => (
                <div key={d} className="flex items-center gap-2 text-xs text-gray-400">
                  <span style={{ color: '#00d4aa' }}>✓</span> {d}
                </div>
              ))}
            </div>
            {opt.max_amount && (
              <div className="text-xs text-gray-500 mb-4">Max financing: {formatCurrency(opt.max_amount)}</div>
            )}
            {opt.slug && (
              <Link href={`/hosts/${opt.slug}`} className="text-sm font-semibold px-4 py-2 rounded-lg inline-block" style={{ background: opt.highlight ? '#00d4aa' : '#1f2937', color: opt.highlight ? '#0a0e17' : '#e2e8f0' }}>
                View {opt.provider} →
              </Link>
            )}
          </div>
        ))}
      </div>

      {/* Financing Calculator */}
      <div className="rounded-2xl p-6 mb-10" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-lg font-bold text-white mb-5">Financing Calculator</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="text-xs text-gray-500 block mb-1">Hardware Cost ($)</label>
            <input type="number" value={hardwareCost} onChange={e => setHardwareCost(Number(e.target.value))}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]"
              style={{ background: '#0a0e17' }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Down Payment (%)</label>
            <div className="flex items-center gap-3">
              <input type="range" min={0} max={50} step={1} value={downPctInput}
                onChange={e => setDownPctInput(Number(e.target.value))}
                className="flex-1 accent-[#00d4aa]" />
              <span className="text-sm font-mono font-bold text-white w-16 text-right">{downPctInput}% = {formatCurrency(downAmount)}</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Annual Interest Rate (APR)</label>
            <div className="flex items-center gap-3">
              <input type="range" min={5} max={25} step={0.5} value={apr}
                onChange={e => setApr(Number(e.target.value))}
                className="flex-1 accent-[#00d4aa]" />
              <span className="text-sm font-mono font-bold text-white w-12 text-right">{apr}%</span>
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Loan Term (months)</label>
            <div className="flex gap-2">
              {[12, 24, 36, 48].map(t => (
                <button key={t} onClick={() => setTermMonths(t)}
                  className="flex-1 text-xs py-2 rounded-lg transition-colors"
                  style={{ background: termMonths === t ? '#00d4aa' : '#1f2937', color: termMonths === t ? '#0a0e17' : '#9ca3af' }}>
                  {t}mo
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">Number of Miners</label>
            <input type="number" value={unitsForHosting} onChange={e => setUnitsForHosting(Number(e.target.value))}
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]"
              style={{ background: '#0a0e17' }} />
          </div>
          <div>
            <label className="text-xs text-gray-500 block mb-1">BTC Price ($)</label>
            <input type="number" value={btcPrice ?? ''} onChange={e => setBtcPrice(Number(e.target.value))}
              placeholder="Loading live price…"
              className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
              style={{ background: '#0a0e17' }} />
          </div>
        </div>

        {/* Results */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="rounded-xl p-4 text-center" style={{ background: '#0a0e17' }}>
            <div className="text-xs text-gray-500 mb-1">Monthly Payment</div>
            <div className="text-xl font-bold font-mono" style={{ color: '#ff4757' }}>{formatCurrency(monthlyPayment)}</div>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: '#0a0e17' }}>
            <div className="text-xs text-gray-500 mb-1">Total Interest</div>
            <div className="text-xl font-bold font-mono" style={{ color: '#fbbf24' }}>{formatCurrency(totalInterest)}</div>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: '#0a0e17' }}>
            <div className="text-xs text-gray-500 mb-1">Total Cost</div>
            <div className="text-xl font-bold font-mono text-white">{formatCurrency(totalCost)}</div>
          </div>
          <div className="rounded-xl p-4 text-center" style={{ background: '#0a0e17' }}>
            <div className="text-xs text-gray-500 mb-1">Daily Net (after hosting + financing)</div>
            <div className="text-xl font-bold font-mono" style={{ color: dailyNet === null ? '#9ca3af' : dailyNet > 0 ? '#00d4aa' : '#ff4757' }}>
              {dailyNet === null ? 'Loading...' : `${dailyNet > 0 ? '+' : ''}${formatCurrency(dailyNet)}/day`}
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Assumes {unitsForHosting} × Antminer S21 Pro (234 TH/s each) at $225/month hosting per machine.
          Net daily profit after both hosting fees ({formatCurrency(monthlyHosting / 30)}/day) and loan payment ({formatCurrency(monthlyPayment / 30)}/day).
        </p>
      </div>

      {/* CTA */}
      <div className="text-center rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-xl font-bold text-white mb-2">Ready to Finance Your Operation?</h2>
        <p className="text-gray-400 mb-6 max-w-lg mx-auto">Contact Abundant Miners about their vendor financing program — up to $140,000 at 10% APR with 10% down.</p>
        <Link href="/hosts/abundant-miners" className="inline-block text-sm font-semibold px-6 py-3 rounded-lg mr-3" style={{ background: '#00d4aa', color: '#0a0e17' }}>
          View Abundant Miners →
        </Link>
        <Link href="/deal-analyzer" className="inline-block text-sm font-semibold px-6 py-3 rounded-lg border border-gray-700 text-gray-300 hover:text-white transition-colors">
          Analyze My Deal
        </Link>
      </div>
    </div>
  )
}
