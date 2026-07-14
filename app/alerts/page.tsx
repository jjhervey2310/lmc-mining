'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

type AlertType = 'btc_above' | 'btc_below' | 'hashprice_above' | 'hashprice_below'

function calcHashprice(price: number, difficulty: number): number {
  return (2.7e20 * price) / (difficulty * 4294967296)
}

const ALERT_TYPES: { type: AlertType; label: string; unit: string; defaultVal: number; description: string }[] = [
  { type: 'btc_above', label: 'BTC Price Above', unit: '$', defaultVal: 120000, description: 'Alert when BTC rises above your target — time to evaluate selling or scaling' },
  { type: 'btc_below', label: 'BTC Price Below', unit: '$', defaultVal: 80000, description: 'Alert when BTC falls below your threshold — monitor profitability' },
  { type: 'hashprice_above', label: 'Hashprice Above', unit: '$', defaultVal: 100, description: 'Alert when hashprice rises — may signal optimal expansion timing' },
  { type: 'hashprice_below', label: 'Hashprice Below', unit: '$', defaultVal: 50, description: 'Alert when hashprice falls near your operating cost — risk management' },
]

export default function AlertsPage() {
  const [email, setEmail] = useState('')
  const [selectedTypes, setSelectedTypes] = useState<AlertType[]>(['btc_below'])
  const [thresholds, setThresholds] = useState<Record<AlertType, number>>({
    btc_above: 120000,
    btc_below: 80000,
    hashprice_above: 100,
    hashprice_below: 50,
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [currentBTC, setCurrentBTC] = useState<number | null>(null)
  const [currentHP, setCurrentHP] = useState<number | null>(null)

  useEffect(() => {
    fetch('/api/btc-price')
      .then(r => r.json())
      .then(d => {
        if (d?.price) setCurrentBTC(Number(d.price))
        if (d?.price && d?.difficulty) {
          setCurrentHP(calcHashprice(Number(d.price), Number(d.difficulty)))
        }
      })
      .catch(() => {})
  }, [])

  function toggleType(t: AlertType) {
    setSelectedTypes(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t])
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || selectedTypes.length === 0) {
      setError('Please enter your email and select at least one alert type.')
      return
    }
    setSubmitting(true)
    setError('')
    try {
      const res = await fetch('/api/price-alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, alerts: selectedTypes.map(t => ({ type: t, threshold: thresholds[t] })) }),
      })
      if (res.ok) {
        setSubmitted(true)
      } else {
        setError('Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Bitcoin Mining Price Alerts',
        description: 'Free Bitcoin price and hashprice alerts for miners. Get notified when BTC or hashprice crosses your thresholds.',
        applicationCategory: 'FinanceApplication',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      }) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / Price Alerts
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Mining Price Alerts</h1>
      <p className="text-gray-400 mb-2">Get notified when BTC price or hashprice crosses your thresholds. Free for all miners.</p>

      {/* Current levels */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs text-gray-500 mb-1">Current BTC Price</div>
          <div className="text-xl font-bold font-mono" style={{ color: '#00d4aa' }}>{currentBTC ? `$${currentBTC.toLocaleString()}` : 'Loading...'}</div>
        </div>
        <div className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs text-gray-500 mb-1">Current Hashprice</div>
          <div className="text-xl font-bold font-mono" style={{ color: '#3d7aed' }}>{currentHP ? `$${currentHP.toFixed(2)}/PH/day` : 'Loading...'}</div>
        </div>
      </div>

      {submitted ? (
        <div className="rounded-2xl p-8 text-center" style={{ background: '#111827', border: '1px solid #00d4aa' }}>
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-bold text-white mb-2">Alerts Set Up Successfully</h2>
          <p className="text-gray-400 mb-2">We&apos;ll email <span className="text-white">{email}</span> when your thresholds are triggered.</p>
          <p className="text-xs text-gray-500">Check your inbox for a confirmation email. Alerts may take up to 15 minutes to activate.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/data" className="text-sm font-semibold px-5 py-2 rounded-lg" style={{ background: '#00d4aa', color: '#0a0e17' }}>
              View Live Data →
            </Link>
            <button onClick={() => setSubmitted(false)} className="text-sm px-5 py-2 rounded-lg border border-gray-700 text-gray-400 hover:text-white transition-colors">
              Set More Alerts
            </button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Email */}
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <label className="text-sm font-semibold text-white block mb-3">Your Email Address</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              className="w-full text-sm px-4 py-3 rounded-xl border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
              style={{ background: '#0a0e17' }}
            />
          </div>

          {/* Alert types */}
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <div className="text-sm font-semibold text-white mb-4">Select Alert Types</div>
            <div className="space-y-4">
              {ALERT_TYPES.map(at => {
                const selected = selectedTypes.includes(at.type)
                const isHp = at.type.includes('hashprice')
                return (
                  <div key={at.type} className={`rounded-xl p-4 cursor-pointer transition-colors`}
                    onClick={() => toggleType(at.type)}
                    style={{ background: selected ? '#00d4aa10' : '#0a0e17', border: `1px solid ${selected ? '#00d4aa' : '#374151'}` }}>
                    <div className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded flex items-center justify-center mt-0.5 shrink-0 transition-colors"
                        style={{ background: selected ? '#00d4aa' : '#1f2937', border: selected ? 'none' : '1px solid #374151' }}>
                        {selected && <span className="text-xs font-bold" style={{ color: '#0a0e17' }}>✓</span>}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-semibold text-white mb-1">{at.label}</div>
                        <div className="text-xs text-gray-400 mb-3">{at.description}</div>
                        {selected && (
                          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            <span className="text-xs text-gray-500">Threshold:</span>
                            <span className="text-xs text-gray-400">{at.unit}</span>
                            <input
                              type="number"
                              value={thresholds[at.type]}
                              step={isHp ? 1 : 1000}
                              onChange={e => setThresholds(prev => ({ ...prev, [at.type]: Number(e.target.value) }))}
                              className="text-sm px-2 py-1 rounded border border-gray-700 text-white w-28 focus:outline-none focus:border-[#00d4aa]"
                              style={{ background: '#0a0e17' }}
                            />
                            {isHp && <span className="text-xs text-gray-500">/PH/day</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {error && <div className="text-sm py-2 px-4 rounded-lg" style={{ background: '#ff475720', color: '#ff4757' }}>{error}</div>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full text-sm font-semibold py-3 rounded-xl transition-opacity"
            style={{ background: '#00d4aa', color: '#0a0e17', opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? 'Setting up alerts...' : 'Set Up Free Alerts →'}
          </button>
          <p className="text-xs text-gray-600 text-center">
            Free forever. No spam. Unsubscribe any time. We only email when your threshold is triggered.
          </p>
        </form>
      )}

      {/* How it works */}
      <div className="mt-10 rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-base font-bold text-white mb-4">How Mining Alerts Work</h2>
        <div className="space-y-3 text-sm text-gray-400">
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#00d4aa20', color: '#00d4aa' }}>1</span>
            <p>Set your thresholds for BTC price and/or hashprice. Choose alerts above or below your target levels.</p>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#00d4aa20', color: '#00d4aa' }}>2</span>
            <p>We monitor Bitcoin network conditions and trigger your alerts when thresholds are crossed.</p>
          </div>
          <div className="flex gap-3">
            <span className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#00d4aa20', color: '#00d4aa' }}>3</span>
            <p>You receive an email with the current market data and a link to our profitability calculator to assess the impact.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
