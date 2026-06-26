'use client'

import { useState } from 'react'
import Link from 'next/link'

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

const FAQ = [
  {
    q: 'What do I get in the $97 Mining Deal Audit?',
    a: 'A full profitability model customized to your miner, cooling type, and hosting situation. Includes an ROI breakdown with realistic difficulty adjustment scenarios, a risk assessment, compatible hosting provider recommendations, and a clear go/no-go recommendation. Delivered by email within 48 hours.',
  },
  {
    q: 'What does the $297 Mining Build Plan include?',
    a: 'Everything in the $97 audit, plus: a complete deployment checklist, hardware purchase recommendations for your budget, financing evaluation if relevant, a tax strategy overview, and a 30-minute video call to walk through findings. Delivered within 72 hours.',
  },
  {
    q: 'Is this AI-generated or personally reviewed?',
    a: 'Every audit is completed personally — not an AI-generated report. We review your actual contract terms, hardware specs, and hosting offer against current market data.',
  },
  {
    q: 'Is my data kept confidential?',
    a: 'Yes. Your deal details and personal information are never shared with third parties.',
  },
  {
    q: 'What if I\'m not sure which tier is right for me?',
    a: 'The $97 Mining Deal Audit is right for most people — it covers everything you need to make a confident go/no-go decision. The $297 Mining Build Plan is for people who want a complete deployment plan from scratch.',
  },
]

const BUDGET_OPTIONS = ['Under $5k', '$5k–$20k', '$20k–$50k', '$50k+']

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

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
          form_data: { tier: tier === 'basic' ? '$97 Mining Deal Audit' : '$297 Mining Build Plan', miners, providers, budget, question },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>Audit</span>
      </div>

      {/* Payment links coming soon notice */}
      <div className="rounded-xl p-4 mb-8 flex flex-col sm:flex-row items-start sm:items-center gap-3" style={{ background: 'rgba(247,147,26,0.08)', border: '1px solid rgba(247,147,26,0.25)' }}>
        <span className="text-lg shrink-0">⚡</span>
        <div className="flex-1">
          <span className="text-sm font-semibold" style={{ color: ORANGE }}>Payment links coming soon.</span>
          <span className="text-sm text-gray-400 ml-2">Use the form below to request an audit — we&apos;ll send your payment link within a few hours.</span>
        </div>
        <Link href="/review" className="text-xs font-semibold px-4 py-2 rounded-lg shrink-0 transition-colors" style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE, border: '1px solid rgba(247,147,26,0.3)' }}>
          Or get a free review →
        </Link>
      </div>

      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-4"
          style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE }}
        >
          ⚡ Limited to 8 audits per month — currently open
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Bitcoin Mining Audit</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          Stop guessing. Get a professional profitability analysis tailored to your exact setup.
        </p>
      </div>

      {/* Pricing tiers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* $97 tier */}
        <div className="rounded-2xl p-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="text-sm text-gray-500 mb-1">Standard</div>
          <h2 className="text-xl font-bold text-white mb-2">Mining Deal Audit</h2>
          <div className="text-4xl font-bold mb-6" style={{ color: '#00d4aa' }}>$97</div>
          <ul className="space-y-3 mb-8">
            {[
              'Profitability model for your specific miner and hosting setup',
              'ROI projection at 3 BTC price scenarios ($60k / $90k / $120k)',
              'Risk assessment with red flag identification',
              'Hosting provider recommendation for your situation',
              'Go / No-Go recommendation in plain English',
              'Written report delivered within 48 hours',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                <span style={{ color: '#00d4aa' }} className="mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_97_URL || 'https://buy.stripe.com/placeholder97'}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-sm font-bold py-3 rounded-xl transition-all"
            style={{ background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }}
          >
            Book $97 Audit →
          </a>
        </div>

        {/* $297 tier */}
        <div className="rounded-2xl p-8 relative" style={{ background: CARD_BG, border: `2px solid rgba(247,147,26,0.4)` }}>
          <div
            className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full text-xs font-bold"
            style={{ background: ORANGE, color: '#000' }}
          >
            Most Popular
          </div>
          <div className="text-sm text-gray-500 mb-1">Complete</div>
          <h2 className="text-xl font-bold text-white mb-2">Mining Build Plan</h2>
          <div className="text-4xl font-bold mb-6" style={{ color: ORANGE }}>$297</div>
          <ul className="space-y-3 mb-8">
            {[
              'Everything in the $97 Mining Deal Audit',
              'Hardware purchase recommendation for your budget',
              '24-month cash flow model with difficulty growth scenarios',
              'Complete deployment checklist from purchase to first payout',
              'Tax strategy overview (Section 179 applicability)',
              'Financing evaluation if relevant to your situation',
              '30-minute video call walkthrough of findings',
              'Written report delivered within 72 hours',
            ].map(item => (
              <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
                <span style={{ color: ORANGE }} className="mt-0.5 shrink-0">✓</span>
                {item}
              </li>
            ))}
          </ul>
          <a
            href={process.env.NEXT_PUBLIC_STRIPE_297_URL || 'https://buy.stripe.com/placeholder297'}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-sm font-bold py-3 rounded-xl transition-all"
            style={{ background: ORANGE, color: '#000' }}
          >
            Book $297 Build Plan →
          </a>
        </div>
      </div>

      <div className="mb-10 text-center rounded-xl p-4" style={{ background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.15)' }}>
        <p className="text-sm text-gray-400">
          <span className="font-semibold" style={{ color: '#00d4aa' }}>100% Money-Back Guarantee.</span>{' '}
          If your audit doesn&apos;t give you at least one concrete, actionable insight about your mining deal, we&apos;ll refund you in full. No questions asked.
        </p>
      </div>

      {/* Inquiry form */}
      {submitted ? (
        <div className="rounded-2xl p-10 text-center mb-12" style={{ background: CARD_BG, border: '1px solid rgba(0,212,170,0.4)' }}>
          <div className="text-4xl mb-4">✓</div>
          <h2 className="text-xl font-bold text-white mb-2">Request Received</h2>
          <p className="text-gray-400 mb-4">
            We&apos;ll send a payment link to <strong className="text-white">{email}</strong> within a few hours.
          </p>
          <Link href="/calculator" className="inline-block text-sm font-semibold px-5 py-2 rounded-lg" style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE }}>
            Try the Free Calculator While You Wait →
          </Link>
        </div>
      ) : (
        <div className="rounded-2xl p-8 mb-12" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h2 className="text-xl font-bold text-white mb-6">Request Your Audit</h2>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-white block mb-3">Select Tier</label>
              <div className="grid grid-cols-2 gap-3">
                {([
                  { value: 'basic' as const, label: 'Mining Deal Audit — $97' },
                  { value: 'deep' as const, label: 'Mining Build Plan — $297' },
                ] as const).map(t => (
                  <button
                    type="button"
                    key={t.value}
                    onClick={() => setTier(t.value)}
                    className="text-sm py-3 px-4 rounded-xl font-semibold text-left transition-all"
                    style={{
                      background: tier === t.value ? 'rgba(247,147,26,0.12)' : '#0a0a0a',
                      border: `1px solid ${tier === t.value ? 'rgba(247,147,26,0.4)' : BORDER}`,
                      color: tier === t.value ? ORANGE : '#9ca3af',
                    }}
                  >
                    {tier === t.value && '◆ '}{t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-500 block mb-1">Your Name *</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} required
                  placeholder="First and last name"
                  className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
                  style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 block mb-1">Email Address *</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  placeholder="you@example.com"
                  className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
                  style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Which miner(s) are you considering?</label>
              <input
                type="text" value={miners} onChange={e => setMiners(e.target.value)}
                placeholder="e.g. Antminer S21 Pro, Whatsminer M60S"
                className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
                style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Which hosting provider(s) are you considering?</label>
              <input
                type="text" value={providers} onChange={e => setProviders(e.target.value)}
                placeholder="e.g. Abundant Mines, Compass Mining, or I don't know yet"
                className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none"
                style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
              />
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">Hardware budget</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {BUDGET_OPTIONS.map(opt => (
                  <button
                    type="button" key={opt} onClick={() => setBudget(opt)}
                    className="text-xs py-2 px-3 rounded-lg transition-all"
                    style={{
                      background: budget === opt ? 'rgba(247,147,26,0.12)' : '#0a0a0a',
                      border: `1px solid ${budget === opt ? 'rgba(247,147,26,0.4)' : BORDER}`,
                      color: budget === opt ? ORANGE : '#9ca3af',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-500 block mb-1">What&apos;s your main question about this deal?</label>
              <textarea
                value={question} onChange={e => setQuestion(e.target.value)} rows={3}
                placeholder="e.g. I want to know if this deal makes sense at current BTC prices and what happens if price drops..."
                className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none resize-none"
                style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
              />
            </div>

            {error && (
              <div className="text-sm px-4 py-2 rounded-lg" style={{ background: 'rgba(255,71,87,0.12)', color: '#ff4757' }}>{error}</div>
            )}

            <button
              type="submit" disabled={submitting}
              className="w-full text-sm font-bold py-3.5 rounded-xl transition-all"
              style={{ background: ORANGE, color: '#000', opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? 'Submitting...' : `Request ${tier === 'basic' ? '$97 Mining Deal Audit' : '$297 Mining Build Plan'} →`}
            </button>
            <p className="text-xs text-gray-600 text-center">We&apos;ll review your request and send a payment link within a few hours.</p>
          </form>
        </div>
      )}

      {/* FAQ */}
      <div>
        <h2 className="text-xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQ.map(item => (
            <div key={item.q} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <h3 className="font-semibold text-white text-sm mb-2">{item.q}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-10 text-center text-sm text-gray-600">
        Not ready for an audit?{' '}
        <Link href="/review" className="hover:text-white transition-colors" style={{ color: ORANGE }}>
          Start with a free deal review →
        </Link>
      </div>
    </div>
  )
}
