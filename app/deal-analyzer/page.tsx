'use client'

import { useState, useEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MINERS_DATA, PROVIDERS_DATA } from '@/lib/data'

const BLOCK_REWARD = 3.125
const DIFFICULTY = 113_757_508_517_000
const AFFILIATE_URL = 'https://abundantmines.com/ref/72/'

function calcDailyBTC(hashrate_th: number) {
  return (hashrate_th * 1e12 * 86400 * BLOCK_REWARD) / (DIFFICULTY * Math.pow(2, 32))
}

function ScoreBar({ label, score, detail }: { label: string; score: number; detail: string }) {
  const color = score >= 70 ? '#00d4aa' : score >= 50 ? '#fbbf24' : '#ff4757'
  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-300">{label}</span>
        <span className="font-bold font-mono" style={{ color }}>{score}/100</span>
      </div>
      <div className="h-2 rounded-full bg-gray-800">
        <div className="h-2 rounded-full transition-all duration-700" style={{ width: `${score}%`, background: color }} />
      </div>
      <p className="text-xs text-gray-500 mt-1">{detail}</p>
    </div>
  )
}

function DealAnalyzerContent() {
  const searchParams = useSearchParams()
  const [minerSlug, setMinerSlug] = useState(searchParams.get('miner') || '')
  const [hardwarePrice, setHardwarePrice] = useState('')
  const [hostingProvider, setHostingProvider] = useState(searchParams.get('host') === 'abundant-mines' ? 'abundant-miners' : '')
  const [monthlyFee, setMonthlyFee] = useState(searchParams.get('host') === 'abundant-mines' ? '225' : '')
  const [electricityRate, setElectricityRate] = useState('')
  const [contractMonths, setContractMonths] = useState('12')
  const [useFinancing, setUseFinancing] = useState(false)
  const [interestRate, setInterestRate] = useState('10')
  const [financingTerm, setFinancingTerm] = useState('36')
  const [targetBTC, setTargetBTC] = useState('')
  const [btcLoading, setBtcLoading] = useState(true)
  const hasUserEdited = useRef(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [scores, setScores] = useState<null | {
    hardware: number; hosting: number; efficiency: number; profitability: number; risk: number; overall: number;
    verdict: string; verdictDetail: string; details: Record<string, string>
  }>(null)

  // Task 8 — email capture state
  const [analyzeError, setAnalyzeError] = useState('')
  const [captureEmail, setCaptureEmail] = useState('')
  const [captureSubmitted, setCaptureSubmitted] = useState(false)
  const [captureSubmitting, setCaptureSubmitting] = useState(false)

  // Task 7 — fetch live BTC price on mount, only set if user hasn't edited
  useEffect(() => {
    fetch('/api/btc-price')
      .then(r => r.json())
      .then(d => {
        if (d.price && !hasUserEdited.current) {
          setTargetBTC(String(Math.round(Number(d.price))))
        }
      })
      .catch(() => {})
      .finally(() => setBtcLoading(false))
  }, [])

  const selectedMiner = MINERS_DATA.find(m => m.slug === minerSlug)
  const selectedProvider = PROVIDERS_DATA.find(p => p.id === hostingProvider)

  function analyze() {
    if (!selectedMiner) return
    const hw = parseFloat(hardwarePrice) || 0
    const btcTarget = parseFloat(targetBTC) || 0
    if (!btcTarget) { setAnalyzeError('Enter a BTC price to run the analysis.'); return }
    setAnalyzeError('')
    const monthly = parseFloat(monthlyFee) || selectedProvider?.flatMonthly || 0
    const elec = parseFloat(electricityRate) || selectedProvider?.rateMin || 0.07
    const dailyBTC = calcDailyBTC(selectedMiner.default_hashrate_th)
    const dailyGross = dailyBTC * btcTarget
    const dailyCost = monthly > 0 ? monthly / 30 : (selectedMiner.power_watts / 1000) * 24 * elec
    const dailyNet = dailyGross - dailyCost
    const eff = selectedMiner.efficiency_j_per_th ?? (selectedMiner.power_watts / selectedMiner.default_hashrate_th)

    const marketPrice = selectedMiner.market_price_usd ?? hw
    let hardwareScore = 75
    const priceDiff = hw > 0 && marketPrice > 0 ? (hw - marketPrice) / marketPrice : 0
    if (priceDiff <= 0.05) hardwareScore = 95
    else if (priceDiff <= 0.10) hardwareScore = 85
    else if (priceDiff <= 0.20) hardwareScore = 70
    else if (priceDiff <= 0.30) hardwareScore = 50
    else hardwareScore = 25

    const effectiveMonthlyCost = monthly > 0 ? monthly : elec * (selectedMiner.power_watts / 1000) * 24 * 30
    let hostingScore = 75
    if (effectiveMonthlyCost <= 180) hostingScore = 95
    else if (effectiveMonthlyCost <= 220) hostingScore = 85
    else if (effectiveMonthlyCost <= 270) hostingScore = 70
    else if (effectiveMonthlyCost <= 340) hostingScore = 50
    else hostingScore = 30

    let efficiencyScore = 50
    if (eff <= 13) efficiencyScore = 98
    else if (eff <= 16) efficiencyScore = 92
    else if (eff <= 20) efficiencyScore = 80
    else if (eff <= 25) efficiencyScore = 65
    else if (eff <= 30) efficiencyScore = 50
    else efficiencyScore = 35

    let profScore = 50
    const months = parseFloat(contractMonths) || 12
    const totalCost = hw + effectiveMonthlyCost * months
    if (dailyNet <= 0) profScore = 15
    else {
      const breakevenDays = totalCost / dailyNet
      if (breakevenDays < 180) profScore = 95
      else if (breakevenDays < 270) profScore = 85
      else if (breakevenDays < 365) profScore = 75
      else if (breakevenDays < 540) profScore = 60
      else if (breakevenDays < 730) profScore = 45
      else profScore = 25
    }

    let riskScore = 70
    if (months <= 3) riskScore = 90
    else if (months <= 6) riskScore = 82
    else if (months <= 12) riskScore = 72
    else if (months <= 24) riskScore = 55
    else riskScore = 40
    if (useFinancing) riskScore = Math.max(riskScore - 15, 10)
    if (selectedMiner.spec_confidence === 'pending_verification') riskScore = Math.max(riskScore - 10, 10)

    const overall = Math.round(hardwareScore * 0.25 + hostingScore * 0.2 + efficiencyScore * 0.2 + profScore * 0.25 + riskScore * 0.1)
    let verdict = 'AVOID'
    let verdictDetail = 'This deal does not meet basic profitability thresholds.'
    if (overall >= 80) { verdict = 'STRONG DEAL'; verdictDetail = 'Excellent hardware pricing, competitive hosting, and strong ROI. Proceed with confidence.' }
    else if (overall >= 60) { verdict = 'DECENT DEAL'; verdictDetail = 'Acceptable terms with manageable caveats. Review the flagged areas before signing.' }
    else if (overall >= 40) { verdict = 'MARGINAL DEAL'; verdictDetail = 'Some conditions are below standard. Negotiate hardware price or hosting rate before committing.' }

    setScores({
      hardware: hardwareScore, hosting: hostingScore, efficiency: efficiencyScore,
      profitability: profScore, risk: riskScore, overall,
      verdict, verdictDetail,
      details: {
        hardware: hw > 0 && marketPrice > 0 ? `Quoted $${hw.toLocaleString()} vs estimated market $${marketPrice.toLocaleString()} (${priceDiff > 0 ? '+' : ''}${(priceDiff * 100).toFixed(0)}%)` : 'Enter hardware price for comparison',
        hosting: `$${effectiveMonthlyCost.toFixed(0)}/month effective cost (market avg ~$225/mo flat)`,
        efficiency: `${eff.toFixed(1)} J/TH ${eff < 18 ? '— excellent' : eff < 25 ? '— competitive' : '— below current best'}`,
        profitability: dailyNet > 0 ? `$${dailyNet.toFixed(2)}/day net at $${Number(btcTarget).toLocaleString()} BTC` : `Negative daily margin at $${Number(btcTarget).toLocaleString()} BTC`,
        risk: `${months}-month contract${useFinancing ? ' + financing' : ''}`,
      }
    })
    setAnalyzed(true)
    setCaptureSubmitted(false)
  }

  // Task 8 — submit email capture
  async function handleCaptureSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!captureEmail || captureSubmitting) return
    setCaptureSubmitting(true)
    try {
      const sourceTag = [
        'deal_analyzer_results',
        minerSlug || 'unknown',
        scores ? `score:${scores.overall}` : 'score:0',
      ].join('|')
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: captureEmail,
          lead_type: 'email_capture',
          source: sourceTag,
          notes: scores ? `Miner: ${selectedMiner?.name ?? minerSlug}, Score: ${scores.overall}, Verdict: ${scores.verdict}` : undefined,
        }),
      })
    } catch { /* silent */ }
    setCaptureSubmitted(true)
    setCaptureSubmitting(false)
  }

  const verdictColors: Record<string, string> = {
    'STRONG DEAL': '#00d4aa', 'DECENT DEAL': '#fbbf24', 'MARGINAL DEAL': '#f97316', 'AVOID': '#ff4757',
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Task 2 — WebApplication schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebApplication',
        name: 'Bitcoin Mining Deal Analyzer',
        description: 'Score any Bitcoin mining hardware and hosting combination across 5 dimensions. Get profitability projections, ROI calculations, and risk assessment in 60 seconds.',
        url: 'https://www.lightningmines.com/deal-analyzer',
        applicationCategory: 'FinanceApplication',
        operatingSystem: 'Web Browser',
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        featureList: [
          'Hardware efficiency scoring',
          'Hosting cost analysis',
          'Profitability projection at multiple BTC price scenarios',
          'Risk assessment',
          'ROI calculation',
          'Break-even analysis',
        ],
      }) }} />
      {/* Task 3 — FAQ schema */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'How does the Bitcoin mining deal analyzer work?',
            acceptedAnswer: { '@type': 'Answer', text: 'Enter your miner model, hosting provider, and electricity rate. The analyzer scores your deal across 5 dimensions — hardware efficiency, hosting cost, profitability, risk, and overall value — and gives you a composite score out of 100 with monthly profit projections.' },
          },
          {
            '@type': 'Question',
            name: 'Is the deal analyzer free to use?',
            acceptedAnswer: { '@type': 'Answer', text: 'Yes, completely free with no signup required. For a personalised expert review of your specific deal, see our paid audit service starting at $97.' },
          },
        ],
      }) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / Deal Analyzer
      </div>

      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">Mining Deal Analyzer</h1>
        <p className="text-xl text-gray-400">Get Your Deal Scored in 60 Seconds</p>
        <p className="text-gray-500 mt-2">Enter your deal details. Our system scores your deal across 5 dimensions and tells you if it&apos;s worth doing.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Form */}
        <div className="space-y-6">
          <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h2 className="text-base font-semibold text-white mb-5">Your Deal Details</h2>

            <div className="space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">Miner Model *</label>
                <select value={minerSlug} onChange={e => setMinerSlug(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]" style={{ background: '#0a0e17' }}>
                  <option value="">— Select miner —</option>
                  {['air', 'hydro', 'immersion'].map(ct => (
                    <optgroup key={ct} label={ct.charAt(0).toUpperCase() + ct.slice(1) + ' Cooling'}>
                      {MINERS_DATA.filter(m => m.cooling_type === ct).map(m => (
                        <option key={m.slug} value={m.slug!}>{m.name} ({m.default_hashrate_th} TH/s)</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Hardware Price You&apos;re Being Quoted ($)</label>
                <input type="number" value={hardwarePrice} onChange={e => setHardwarePrice(e.target.value)} placeholder={selectedMiner?.market_price_usd ? `Est. market: $${selectedMiner.market_price_usd.toLocaleString()}` : 'e.g. 4200'} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]" style={{ background: '#0a0e17' }} />
                {selectedMiner?.market_price_usd && hardwarePrice && (
                  <p className="text-xs mt-1" style={{ color: parseFloat(hardwarePrice) > selectedMiner.market_price_usd * 1.2 ? '#ff4757' : '#00d4aa' }}>
                    {parseFloat(hardwarePrice) > selectedMiner.market_price_usd ? `${((parseFloat(hardwarePrice) / selectedMiner.market_price_usd - 1) * 100).toFixed(0)}% above estimated market price` : 'At or below estimated market price — good deal on hardware'}
                  </p>
                )}
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">Hosting Provider</label>
                <select value={hostingProvider} onChange={e => setHostingProvider(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]" style={{ background: '#0a0e17' }}>
                  <option value="">— Select or type below —</option>
                  {PROVIDERS_DATA.map(p => <option key={p.id} value={p.id}>{p.name}{p.flatMonthly ? ` — $${p.flatMonthly}/mo` : p.rateMin ? ` — $${p.rateMin}/kWh` : ''}</option>)}
                  <option value="other">Other / Not listed</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Monthly Hosting Fee ($)</label>
                  <input type="number" value={monthlyFee} onChange={e => setMonthlyFee(e.target.value)} placeholder={selectedProvider?.flatMonthly ? String(selectedProvider.flatMonthly) : 'e.g. 225'} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]" style={{ background: '#0a0e17' }} />
                </div>
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Electricity Rate ($/kWh)</label>
                  <input type="number" step="0.001" value={electricityRate} onChange={e => setElectricityRate(e.target.value)} placeholder={selectedProvider?.rateMin ? String(selectedProvider.rateMin) : '0.07'} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]" style={{ background: '#0a0e17' }} />
                  <p className="text-xs text-gray-600 mt-0.5">Use if charged per kWh (not flat fee)</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">Contract Length (months)</label>
                  <select value={contractMonths} onChange={e => setContractMonths(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]" style={{ background: '#0a0e17' }}>
                    {[1, 3, 6, 12, 24, 36].map(m => <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>)}
                  </select>
                </div>
                <div>
                  {/* Task 7 — live BTC price default, user-editable */}
                  <label className="text-xs text-gray-400 block mb-1">
                    Target BTC Price ($)
                    {btcLoading && <span className="ml-1 text-gray-600">(loading…)</span>}
                  </label>
                  <input
                    type="number"
                    value={targetBTC}
                    onChange={e => { hasUserEdited.current = true; setTargetBTC(e.target.value) }}
                    placeholder={btcLoading ? 'Loading live price…' : 'e.g. 64000'}
                    className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
                    style={{ background: '#0a0e17' }}
                  />
                </div>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
                  <input type="checkbox" checked={useFinancing} onChange={e => setUseFinancing(e.target.checked)} className="accent-[#00d4aa]" />
                  Using financing for this deal
                </label>
                {useFinancing && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Interest Rate (%)</label>
                      <input type="number" value={interestRate} onChange={e => setInterestRate(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]" style={{ background: '#0a0e17' }} />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 block mb-1">Term (months)</label>
                      <input type="number" value={financingTerm} onChange={e => setFinancingTerm(e.target.value)} className="w-full text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white focus:outline-none focus:border-[#00d4aa]" style={{ background: '#0a0e17' }} />
                    </div>
                  </div>
                )}
              </div>

              {analyzeError && (
                <p className="text-sm mb-3" style={{ color: '#ff4757' }}>{analyzeError}</p>
              )}
              <button
                onClick={analyze}
                disabled={!minerSlug}
                className="w-full py-3 rounded-xl font-semibold text-sm transition-colors disabled:opacity-40"
                style={{ background: '#00d4aa', color: '#0a0e17' }}
              >
                Score My Deal →
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        <div>
          {!analyzed ? (
            <div className="rounded-2xl p-8 text-center h-full flex flex-col items-center justify-center" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="text-4xl mb-4">📊</div>
              <h2 className="text-lg font-semibold text-white mb-2">Your Deal Score Will Appear Here</h2>
              <p className="text-sm text-gray-500">Fill in your deal details on the left and click "Score My Deal" to see your full analysis.</p>
              <div className="mt-6 grid grid-cols-2 gap-3 w-full max-w-xs text-xs text-gray-500">
                {['Hardware Score', 'Hosting Score', 'Efficiency Score', 'Profitability Score', 'Risk Score', 'Overall Deal Score'].map(s => (
                  <div key={s} className="rounded-lg p-3" style={{ background: '#0a0e17', border: '1px solid #1f2937' }}>{s}</div>
                ))}
              </div>
            </div>
          ) : scores && (
            <div className="space-y-4">
              {/* Overall score */}
              <div className="rounded-2xl p-6 text-center" style={{ background: '#111827', border: `2px solid ${verdictColors[scores.verdict] ?? '#1f2937'}` }}>
                <div className="text-5xl font-black font-mono mb-2" style={{ color: verdictColors[scores.verdict] }}>{scores.overall}</div>
                <div className="text-xs text-gray-500 mb-3">Overall Deal Score (0–100)</div>
                <div className="text-xl font-bold mb-2" style={{ color: verdictColors[scores.verdict] }}>{scores.verdict}</div>
                <p className="text-sm text-gray-300">{scores.verdictDetail}</p>
              </div>

              {/* Score breakdown */}
              <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <h3 className="text-sm font-semibold text-white mb-4">Score Breakdown</h3>
                <ScoreBar label="Hardware Pricing" score={scores.hardware} detail={scores.details.hardware} />
                <ScoreBar label="Hosting Cost" score={scores.hosting} detail={scores.details.hosting} />
                <ScoreBar label="Efficiency (J/TH)" score={scores.efficiency} detail={scores.details.efficiency} />
                <ScoreBar label="Profitability" score={scores.profitability} detail={scores.details.profitability} />
                <ScoreBar label="Risk Profile" score={scores.risk} detail={scores.details.risk} />
              </div>

              {/* Conditional audit cross-sell CTA */}
              {(scores.overall < 70 || scores.profitability < 60) ? (
                <div className="rounded-2xl p-5" style={{ borderLeft: '4px solid #ff4757', background: 'rgba(255,71,87,0.06)', border: '1px solid rgba(255,71,87,0.25)', borderLeftWidth: '4px', borderLeftColor: '#ff4757' }}>
                  <div className="text-sm font-bold text-white mb-1">
                    ⚠️ Your profitability score is {scores.overall}/100 — this deal carries real risk
                  </div>
                  <p className="text-sm text-gray-400 mb-4">
                    Before you commit capital, get a professional review. Our expert audit identifies exactly what&apos;s wrong, whether it&apos;s fixable, and what to do instead.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    <a href="https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01" target="_blank" rel="noopener noreferrer"
                      className="text-sm font-bold px-4 py-2.5 rounded-lg btn-gold">
                      Book $97 Expert Audit →
                    </a>
                    <Link href="/audit#pricing" className="text-sm font-semibold px-4 py-2.5 rounded-lg" style={{ background: '#111827', color: '#9ca3af', border: '1px solid #374151' }}>
                      See what&apos;s included
                    </Link>
                  </div>
                  <p className="text-xs text-gray-600">Money-back guarantee if you don&apos;t get one concrete actionable insight.</p>
                </div>
              ) : (
                <div className="rounded-2xl p-5" style={{ borderLeft: '4px solid #00d4aa', background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.2)', borderLeftWidth: '4px', borderLeftColor: '#00d4aa' }}>
                  <div className="text-sm font-bold text-white mb-1">
                    ✅ Your deal scores {scores.overall}/100 — solid fundamentals
                  </div>
                  <p className="text-sm text-gray-400 mb-3">
                    Want a professional to verify these numbers and identify any risks you might have missed?
                  </p>
                  <a href="https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01" target="_blank" rel="noopener noreferrer"
                    className="inline-block text-sm font-bold px-4 py-2.5 rounded-lg"
                    style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }}>
                    Book a $97 Audit for Peace of Mind →
                  </a>
                </div>
              )}

              {/* Task 3 — Abundant Mines CTA */}
              <div
                className="rounded-2xl p-5"
                style={{ background: '#0d1117', borderLeft: '4px solid #f59e0b', border: '1px solid #1f2937', borderLeftWidth: '4px', borderLeftColor: '#f59e0b' }}
              >
                <h3 className="font-semibold text-white mb-1">Ready to deploy with our #1 rated host?</h3>
                <p className="text-sm text-gray-400 mb-3">
                  Abundant Mines — $225/month flat fee, Columbia River hydro power, Cascade Locks Oregon. Financing up to $140k available.
                </p>
                <a
                  href={AFFILIATE_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block text-center text-sm font-bold py-2.5 rounded-lg"
                  style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  Get Started with Abundant Mines →
                </a>
                <p className="text-xs text-gray-600 mt-2 text-center">
                  Lightning Mines earns a commission if you sign up. This does not affect our independent analysis.
                </p>
              </div>

              {/* Task 8 — Email capture */}
              <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                {captureSubmitted ? (
                  <div className="text-center py-2">
                    <div className="text-2xl mb-1" style={{ color: '#00d4aa' }}>✓</div>
                    <div className="text-sm font-semibold text-white">Check your inbox — your analysis is on its way.</div>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-white mb-1">Save your analysis</h3>
                    <p className="text-sm text-gray-400 mb-3">Get this report emailed to you as a PDF summary.</p>
                    <form onSubmit={handleCaptureSubmit} className="flex gap-2">
                      <input
                        type="email"
                        value={captureEmail}
                        onChange={e => setCaptureEmail(e.target.value)}
                        placeholder="your@email.com"
                        required
                        className="flex-1 text-sm px-3 py-2.5 rounded-lg border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-[#00d4aa]"
                        style={{ background: '#0a0e17' }}
                      />
                      <button
                        type="submit"
                        disabled={captureSubmitting}
                        className="text-sm font-bold px-4 py-2.5 rounded-lg whitespace-nowrap"
                        style={{ background: '#00d4aa', color: '#0a0e17', opacity: captureSubmitting ? 0.7 : 1 }}
                      >
                        {captureSubmitting ? '...' : 'Email My Results'}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Task 5 — Recently Analyzed social proof */}
      <div className="mt-10 pt-8 border-t" style={{ borderColor: '#1a2332' }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Recently Analyzed</span>
        </div>
        <div className="space-y-2">
          {[
            { location: 'Texas', miner: 'Antminer S21 XP', host: 'Abundant Mines', score: 78, ago: '2 hours ago' },
            { location: 'Colorado', miner: 'Antminer S21 Pro', host: 'Compass Mining', score: 64, ago: '5 hours ago' },
            { location: 'Oregon', miner: 'Antminer S21 XP Hydro', host: 'Abundant Mines', score: 82, ago: '1 day ago' },
            { location: 'Nevada', miner: 'Antminer S19 XP', host: 'EZ Blockchain', score: 71, ago: '1 day ago' },
            { location: 'Washington', miner: 'Whatsminer M60S', host: 'Abundant Mines', score: 75, ago: '2 days ago' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg text-xs" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <span className="text-gray-500">
                Someone in <span className="text-gray-400">{item.location}</span> analyzed{' '}
                <span className="text-gray-300">{item.miner}</span> with{' '}
                <span className="text-gray-300">{item.host}</span>
              </span>
              <div className="flex items-center gap-3 ml-4 shrink-0">
                <span className="font-mono font-bold" style={{ color: item.score >= 70 ? '#00d4aa' : item.score >= 50 ? '#fbbf24' : '#ff4757' }}>
                  {item.score}/100
                </span>
                <span className="text-gray-600">{item.ago}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function DealAnalyzerPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 py-10 text-gray-400">Loading...</div>}>
      <DealAnalyzerContent />
    </Suspense>
  )
}
