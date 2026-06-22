'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

const FAQ = [
  {
    q: 'What do I get in the $97 audit?',
    a: 'A full profitability model customized to your miner, cooling type, and hosting situation. Includes an ROI breakdown with realistic difficulty adjustment scenarios, a risk assessment, compatible hosting provider recommendations, and a clear go/no-go recommendation. Delivered by email within 48 hours.',
  },
  {
    q: 'Is this AI-generated or personally reviewed?',
    a: 'Every audit is completed personally — not an AI-generated report. We review your actual contract terms, hardware specs, and hosting offer against current market data and provide a genuine expert assessment.',
  },
  {
    q: 'Is my data kept confidential?',
    a: 'Yes. Your deal details and personal information are never shared with third parties.',
  },
  {
    q: 'Do you cover hydro and immersion cooling?',
    a: 'Yes. If you are considering hydro or immersion cooling, the audit will include a comparison of cooling type economics and specific hosting provider recommendations for those configurations.',
  },
  {
    q: 'What if I\'m not sure which tier is right?',
    a: 'The standard $97 audit is right for most people — it covers everything you need to make a confident go/no-go decision. The Deep Dive ($297) adds a 24-month cash flow model, exit strategy analysis, and full deployment checklist.',
  },
]

const BUDGET_OPTIONS = ['Under $5k', '$5k–$20k', '$20k–$50k', '$50k+']

export default function AuditPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [miners, setMiners] = useState('')
  const [providers, setProviders] = useState('')
  const [budget, setBudget] = useState('')
  const [question, setQuestion] = useState('')
  const [tier, setTier] = useState<'basic' | 'deep'>('basic')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  const [nextAdjustment, setNextAdjustment] = useState<string | null>(null)

  useEffect(() => {
    fetch('https://mempool.space/api/v1/difficulty-adjustment')
      .then(r => r.json())
      .then((d: { estimatedRetargetDate?: number }) => {
        if (d.estimatedRetargetDate) {
          const date = new Date(d.estimatedRetargetDate)
          setNextAdjustment(date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }))
        }
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email) { setError('Name and email are required.'); return }
    setSubmitting(true); setError('')
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email, name,
          lead_type: 'audit_inquiry',
          notes: `Tier: ${tier === 'basic' ? '$97 Basic' : '$297 Deep Dive'}\nMiners: ${miners}\nProviders: ${providers}\nBudget: ${budget}\nQuestion: ${question}`,
        }),
      })
      setSubmitted(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: FAQ.map(item => ({
          '@type': 'Question',
          name: item.q,
          acceptedAnswer: { '@type': 'Answer', text: item.a },
        })),
      }) }} />

      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Bitcoin Mining Audit</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Stop guessing. Get a professional profitability analysis tailored to your exact setup.
        </p>
        <div className="mt-6 rounded-xl p-4 text-left max-w-xl mx-auto" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="flex items-center gap-2 text-sm font-bold mb-2" style={{ color: '#f59e0b' }}>
            ⚡ Limited availability — accepting a maximum of 8 audits per month. Currently open.
          </div>
          <ul className="text-xs text-gray-400 space-y-1 mb-2">
            <li>· Every audit is completed personally — not an AI-generated report</li>
            {nextAdjustment && (
              <li>· Next network difficulty adjustment estimated <span className="text-yellow-400 font-semibold">{nextAdjustment}</span> — book before to lock in current projections</li>
            )}
            <li>· Spots fill mid-month — early submission guarantees your slot</li>
          </ul>
        </div>
      </div>

      {/* Task 8 — What happens after you book timeline */}
      <div className="mb-10" id="book">
        <h2 className="text-lg font-bold text-white mb-6 text-center">What happens after you book</h2>
        {/* Desktop: horizontal timeline */}
        <div className="hidden md:flex items-start gap-0">
          {[
            { day: 'Day 0', title: 'You submit', desc: 'Submit your setup details and we confirm receipt within 2 hours' },
            { day: 'Day 1', title: 'We analyze', desc: 'We analyze your hardware, hosting costs, and deal economics using professional mining operator frameworks' },
            { day: 'Day 2–3', title: 'Report delivered', desc: 'You receive a written report with specific recommendations — not a template. Basic: 48h. Deep Dive: 72h.' },
            { day: 'Deep Dive', title: 'Video call', desc: 'We schedule your 30-minute video call to walk through findings and answer questions' },
          ].map((step, i) => (
            <div key={i} className="flex-1 relative">
              {/* Connector line */}
              {i < 3 && <div className="absolute top-4 left-1/2 w-full h-0.5 z-0" style={{ background: 'linear-gradient(to right, #f59e0b, #374151)' }} />}
              <div className="relative z-10 flex flex-col items-center text-center px-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold mb-2 shrink-0" style={{ background: '#f59e0b', color: '#000' }}>
                  {i + 1}
                </div>
                <div className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>{step.day}</div>
                <div className="text-sm font-semibold text-white mb-1">{step.title}</div>
                <p className="text-xs text-gray-400 leading-relaxed">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
        {/* Mobile: vertical timeline */}
        <div className="md:hidden space-y-0">
          {[
            { day: 'Day 0', title: 'You submit', desc: 'Submit your setup details and we confirm receipt within 2 hours' },
            { day: 'Day 1', title: 'We analyze', desc: 'We analyze your hardware, hosting costs, and deal economics using professional mining operator frameworks' },
            { day: 'Day 2–3', title: 'Report delivered', desc: 'Written report with specific recommendations. Basic: 48h. Deep Dive: 72h.' },
            { day: 'Deep Dive', title: 'Video call', desc: '30-minute call to walk through findings and answer questions' },
          ].map((step, i) => (
            <div key={i} className="flex gap-4">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: '#f59e0b', color: '#000' }}>
                  {i + 1}
                </div>
                {i < 3 && <div className="w-0.5 h-8 mt-1" style={{ background: '#374151' }} />}
              </div>
              <div className="pb-6">
                <div className="text-xs font-semibold mb-0.5" style={{ color: '#f59e0b' }}>{step.day}</div>
                <div className="text-sm font-semibold text-white mb-1">{step.title}</div>
                <p className="text-xs text-gray-400">{step.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Value framing */}
      <div className="max-w-2xl mx-auto mb-6 rounded-xl p-4" style={{ borderLeft: '4px solid #f59e0b', background: 'rgba(245,158,11,0.06)' }}>
        <p className="text-sm text-gray-300 italic">
          The average first-time hosted mining deployment costs <strong className="text-white">$7,900</strong> (hardware + first year hosting). At $97, a Standard Audit represents just <strong className="text-yellow-400">1.2% of that investment</strong> — the cheapest due diligence you can buy before committing capital.
        </p>
      </div>

      {/* Pricing tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="rounded-2xl p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-sm text-gray-400 mb-2">Standard</div>
          <h2 className="text-2xl font-bold text-white mb-1">Mining Profitability Audit</h2>
          <div className="text-4xl font-bold mb-6" style={{ color: '#00d4aa' }}>$97</div>
          <ul className="space-y-3 mb-8">
            {[
              'Profitability calculation for your specific miner and hosting setup',
              'Hosting provider recommendation based on your situation',
              '12-month ROI projection at 3 BTC price scenarios',
              'Written report delivered within 48 hours',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                <span style={{ color: '#00d4aa' }} className="mt-0.5 flex-shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <a href="https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01" target="_blank" rel="noopener noreferrer"
            className="block w-full text-center text-sm font-bold py-3 rounded-xl"
            style={{ background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }}>
            Book $97 Standard Audit →
          </a>
        </div>

        <div className="rounded-2xl p-8 relative" style={{ background: '#111827', border: '2px solid rgba(245,158,11,0.4)' }}>
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-semibold btn-gold">
            Most Popular
          </div>
          <div className="text-sm text-gray-400 mb-2">Deep Dive</div>
          <h2 className="text-2xl font-bold text-white mb-1">Complete Build Plan</h2>
          <div className="text-4xl font-bold mb-6" style={{ color: '#f59e0b' }}>$297</div>
          <ul className="space-y-3 mb-8">
            {[
              'Everything in the Basic Audit',
              'Tax strategy overview (Section 179 applicability)',
              'Financing evaluation if relevant',
              'Hardware recommendation for your budget',
              '30-minute video call to walk through findings',
              'Written report delivered within 72 hours',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                <span style={{ color: '#f59e0b' }} className="mt-0.5 flex-shrink-0">✓</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <a href="https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00" target="_blank" rel="noopener noreferrer"
            className="block w-full text-center text-sm font-bold py-3 rounded-xl btn-gold">
            Book $297 Deep Dive Audit →
          </a>
        </div>
      </div>

      {/* Money-back guarantee */}
      <div className="mb-10 text-center px-6 py-4 rounded-xl" style={{ background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.15)' }}>
        <p className="text-sm text-gray-400">
          <span className="font-semibold" style={{ color: '#00d4aa' }}>100% Money-Back Guarantee.</span>{' '}
          If your audit doesn&apos;t give you at least one concrete, actionable insight about your mining deal, we&apos;ll refund you in full. No questions asked.
        </p>
      </div>

      {/* Booking Form */}
      {submitted ? (
        <div className="rounded-2xl p-10 text-center mb-12" style={{ background: '#111827', border: '1px solid #00d4aa' }}>
          <div className="text-5xl mb-4">✓</div>
          <h2 className="text-xl font-bold text-white mb-2">Request Received</h2>
          <p className="text-gray-400 mb-2">We'll review your request and send a payment link to <strong className="text-white">{email}</strong> within a few hours.</p>
          <p className="text-xs text-gray-500">Questions? Use the deal analyzer for a free first look while you wait.</p>
          <Link href="/deal-analyzer" className="mt-4 inline-block text-sm font-semibold px-5 py-2 rounded-lg" style={{ background: '#00d4aa', color: '#0a0e17' }}>
            Free Deal Analyzer →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl p-8 mb-12" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h2 className="text-xl font-bold text-white mb-6">Book Your Audit</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Tier selection */}
            <div>
              <label className="text-sm font-semibold text-white block mb-3">Select Tier</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'basic' as const, label: 'Standard Audit — $97' },
                  { value: 'deep' as const, label: 'Deep Dive — $297' },
                ].map(t => (
                  <button type="button" key={t.value} onClick={() => setTier(t.value)}
                    className="text-sm py-3 px-4 rounded-xl font-semibold text-left transition-colors"
                    style={{ background: tier === t.value ? 'rgba(245,158,11,0.15)' : '#0a0e17', border: `1px solid ${tier === t.value ? 'rgba(245,158,11,0.5)' : '#374151'}`, color: tier === t.value ? '#f59e0b' : '#9ca3af' }}>
                    {tier === t.value && '◆ '}{t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Your Name *</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required placeholder="First and last name"
                  className="w-full text-sm px-4 py-3 rounded-xl border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                  style={{ background: '#0a0e17' }} />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Email Address *</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@example.com"
                  className="w-full text-sm px-4 py-3 rounded-xl border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                  style={{ background: '#0a0e17' }} />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Which miner(s) are you considering?</label>
              <input type="text" value={miners} onChange={e => setMiners(e.target.value)} placeholder="e.g. Antminer S21 Pro, Whatsminer M60S"
                className="w-full text-sm px-4 py-3 rounded-xl border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                style={{ background: '#0a0e17' }} />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Which hosting provider(s) are you considering?</label>
              <input type="text" value={providers} onChange={e => setProviders(e.target.value)} placeholder="e.g. Abundant Mines, Compass Mining, or I don't know yet"
                className="w-full text-sm px-4 py-3 rounded-xl border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500"
                style={{ background: '#0a0e17' }} />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Hardware budget</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {BUDGET_OPTIONS.map(opt => (
                  <button type="button" key={opt} onClick={() => setBudget(opt)}
                    className="text-xs py-2 px-3 rounded-lg transition-colors"
                    style={{ background: budget === opt ? 'rgba(245,158,11,0.15)' : '#0a0e17', border: `1px solid ${budget === opt ? 'rgba(245,158,11,0.4)' : '#374151'}`, color: budget === opt ? '#f59e0b' : '#9ca3af' }}>
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">What's your biggest question about mining profitability?</label>
              <textarea value={question} onChange={e => setQuestion(e.target.value)} rows={3}
                placeholder="e.g. I want to know if this deal makes sense at current BTC prices and what happens if price drops..."
                className="w-full text-sm px-4 py-3 rounded-xl border border-gray-700 text-white placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
                style={{ background: '#0a0e17' }} />
            </div>

            {error && <div className="text-sm px-4 py-2 rounded-lg" style={{ background: '#ff475720', color: '#ff4757' }}>{error}</div>}

            <button type="submit" disabled={submitting}
              className="w-full text-sm font-bold py-3.5 rounded-xl btn-gold transition-opacity"
              style={{ opacity: submitting ? 0.7 : 1 }}>
              {submitting ? 'Submitting...' : `Book ${tier === 'basic' ? '$97 Standard' : '$297 Deep Dive'} Audit →`}
            </button>
            <p className="text-xs text-gray-600 text-center">We'll review your request and send a payment link within a few hours.</p>
          </form>
        </div>
      )}

      {/* FAQ */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQ.map(item => (
            <div key={item.q} className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h3 className="font-semibold text-white mb-2">{item.q}</h3>
              <p className="text-sm text-gray-400">{item.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
