'use client'

import { useState } from 'react'
import Link from 'next/link'
import DealChecklist from '@/components/DealChecklist'
import FounderBlock from '@/components/FounderBlock'

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'
const TEAL = '#00d4aa'
const RED = '#ff4757'

const STRIPE_97_LINK = 'https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01'
const STRIPE_297_LINK = 'https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00'

const FAQ = [
  {
    q: 'What does the $297 Mining Build Plan include?',
    a: 'Everything in the $97 Mining Deal Audit, plus: a complete deployment checklist from purchase to first payout, hardware purchase recommendations for your budget, a financing evaluation if relevant, a tax strategy overview, and a 30-minute video call to walk through the findings live. Delivered within 72 hours.',
  },
  {
    q: 'What do I get in the $97 Mining Deal Audit?',
    a: 'A full profitability model customized to your miner, cooling type, and hosting situation. Includes an ROI breakdown with realistic difficulty adjustment scenarios, a risk assessment, compatible hosting provider recommendations, and a clear go/no-go recommendation. Delivered by email within 48 hours.',
  },
  {
    q: 'Is this AI-generated or personally reviewed?',
    a: 'Every audit is completed personally by Jacob — not an AI-generated report. We review your actual contract terms, hardware specs, and hosting offer against current live network data.',
  },
  {
    q: 'What makes you qualified to review my deal?',
    a: 'Jacob H. has spent 8 years in Bitcoin mining and reviews all site data monthly. Every number in your audit is traceable to live BTC price and network difficulty from public APIs — the same methodology behind the free calculator. See exactly how we source and verify data on the How We Verify page.',
  },
  {
    q: 'Which tier is right for me?',
    a: 'If you just need to know whether a specific deal is worth signing, the $97 Mining Deal Audit answers that. If you are building or scaling a mining operation and want the full plan — hardware, deployment, financing, tax, and a live call — the $297 Mining Build Plan is the complete package and the one most buyers choose.',
  },
  {
    q: 'Is my data kept confidential?',
    a: 'Yes. Your deal details and personal information are never shared with third parties.',
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
  const [tier, setTier] = useState<'basic' | 'deep'>('deep')
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

      {/* ---------- HERO / PROBLEM FRAMING ---------- */}
      <div className="text-center mb-12">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
          style={{ background: 'rgba(255,71,87,0.12)', color: RED, border: '1px solid rgba(255,71,87,0.25)' }}
        >
          48–72 hour turnaround · money-back guarantee
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
          Don&apos;t wire $20,000 into a mining deal you haven&apos;t stress-tested.
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          Most people buy miners on a spreadsheet the seller handed them. The
          <span className="text-white font-semibold"> Mining Build Plan </span>
          replaces that with an independent, numbers-first analysis of your exact setup —
          so you know your breakeven, your risk, and whether the deal survives the next difficulty jump before you commit a dollar.
        </p>
      </div>

      {/* ---------- ANCHOR OFFER: $297 BUILD PLAN ---------- */}
      <div
        className="rounded-2xl p-6 md:p-10 mb-6 relative"
        style={{ background: CARD_BG, border: `2px solid rgba(247,147,26,0.5)`, boxShadow: '0 0 40px rgba(247,147,26,0.08)' }}
      >
        <div
          className="absolute -top-3 left-6 md:left-10 px-4 py-1 rounded-full text-xs font-bold"
          style={{ background: ORANGE, color: '#000' }}
        >
          Most chosen — the complete build
        </div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 mt-2">
          <div>
            <div className="text-sm text-gray-500 mb-1">Deep Dive</div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Mining Build Plan</h2>
            <p className="text-sm text-gray-400 mt-2 max-w-md">
              The full playbook from &ldquo;which machine&rdquo; to &ldquo;first payout&rdquo; — plus a live call to walk through it with you.
            </p>
          </div>
          <div className="shrink-0">
            <div className="text-5xl font-bold" style={{ color: ORANGE }}>$297</div>
            <div className="text-xs text-gray-500 mt-1">Delivered within 72 hours</div>
          </div>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-8">
          {[
            'Everything in the $97 Mining Deal Audit',
            'Hardware purchase recommendation for your budget',
            '24-month cash flow model with difficulty growth scenarios',
            'Complete deployment checklist — purchase to first payout',
            'Financing evaluation if relevant to your situation',
            'Tax strategy overview (Section 179 applicability)',
            '30-minute video call walkthrough of the findings',
            'Written build plan delivered within 72 hours',
          ].map(item => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
              <span style={{ color: ORANGE }} className="mt-0.5 shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>

        <a
          href={STRIPE_297_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center text-base font-bold py-4 rounded-xl transition-all hover:opacity-90"
          style={{ background: ORANGE, color: '#000' }}
        >
          Get My Mining Build Plan — $297 →
        </a>
        <p className="text-xs text-gray-600 text-center mt-3">
          Secure checkout via Stripe. Backed by our money-back guarantee below.
        </p>
      </div>

      {/* Secondary $97 entry option */}
      <div
        className="rounded-xl p-5 mb-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
        style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
      >
        <div>
          <div className="text-sm font-semibold text-white">
            Just need a go / no-go on one deal?
          </div>
          <p className="text-xs text-gray-500 mt-1 max-w-md">
            The <span style={{ color: TEAL }}>$97 Mining Deal Audit</span> is the lighter entry option:
            profitability model, risk assessment, and a plain-English verdict. Delivered within 48 hours.
          </p>
        </div>
        <a
          href={STRIPE_97_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-center text-sm font-semibold px-5 py-2.5 rounded-lg transition-all hover:opacity-90 whitespace-nowrap"
          style={{ background: 'rgba(0,212,170,0.1)', color: TEAL, border: '1px solid rgba(0,212,170,0.3)' }}
        >
          Start with the $97 audit →
        </a>
      </div>

      {/* ---------- WHAT THE BUILD PLAN COVERS ---------- */}
      <div className="mb-12">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6">What we actually dig into</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {([
            { label: 'The real numbers', desc: 'A profitability model built on live BTC price and network difficulty — not the seller\'s optimistic spreadsheet. Breakeven, ROI, and payback period for your exact miner and power cost.' },
            { label: 'The downside', desc: 'What happens when difficulty climbs and BTC dips. We stress-test the deal across scenarios so you know the floor, not just the pitch.' },
            { label: 'The build', desc: 'Hardware pick for your budget, deployment checklist, financing and tax angles, and a live call — everything you need to go from decision to running machines.' },
          ] as const).map(item => (
            <div key={item.label} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="text-sm font-semibold text-white mb-2">{item.label}</div>
              <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-12">
        <DealChecklist />
      </div>

      <div className="mb-12">
        <FounderBlock />
      </div>

      {/* ---------- WHAT YOU RECEIVE & BY WHEN ---------- */}
      <div id="pricing" className="scroll-mt-24 rounded-2xl p-6 md:p-8 mb-12" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6">What you receive, and by when</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: 480 }}>
            <thead>
              <tr className="text-left text-gray-500">
                <th className="pb-3 pr-4 font-medium">Deliverable</th>
                <th className="pb-3 px-4 font-medium text-center whitespace-nowrap">$97 Audit</th>
                <th className="pb-3 pl-4 font-medium text-center whitespace-nowrap" style={{ color: ORANGE }}>$297 Build Plan</th>
              </tr>
            </thead>
            <tbody className="text-gray-300">
              {([
                ['Profitability model for your setup', true, true],
                ['ROI breakdown across difficulty scenarios', true, true],
                ['Risk assessment + red flag identification', true, true],
                ['Hosting provider recommendation', true, true],
                ['Plain-English go / no-go verdict', true, true],
                ['Hardware purchase recommendation', false, true],
                ['24-month cash flow model', false, true],
                ['Full deployment checklist', false, true],
                ['Financing evaluation', false, true],
                ['Tax strategy overview', false, true],
                ['30-minute video call walkthrough', false, true],
              ] as const).map(([label, basic, deep]) => (
                <tr key={label} style={{ borderTop: `1px solid ${BORDER}` }}>
                  <td className="py-2.5 pr-4">{label}</td>
                  <td className="py-2.5 px-4 text-center">
                    {basic ? <span style={{ color: TEAL }}>✓</span> : <span className="text-gray-700">—</span>}
                  </td>
                  <td className="py-2.5 pl-4 text-center">
                    {deep ? <span style={{ color: ORANGE }}>✓</span> : <span className="text-gray-700">—</span>}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: `1px solid ${BORDER}` }}>
                <td className="py-2.5 pr-4 font-semibold text-white">Delivery time</td>
                <td className="py-2.5 px-4 text-center text-gray-400 whitespace-nowrap">48 hours</td>
                <td className="py-2.5 pl-4 text-center font-semibold whitespace-nowrap" style={{ color: ORANGE }}>72 hours</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ---------- SAMPLE AUDIT PREVIEW ---------- */}
      <div className="mb-12">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">What your audit report looks like</h2>
        <p className="text-sm text-gray-400 mb-6 max-w-2xl">
          Every audit follows the same structure. Here is an anonymized excerpt so you know exactly what lands in your inbox — no vague &ldquo;it depends,&rdquo; just numbers and a decision.
        </p>
        <div className="rounded-2xl overflow-hidden" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          {/* Report header */}
          <div className="px-5 py-4 flex items-center justify-between" style={{ background: '#0a0a0a', borderBottom: `1px solid ${BORDER}` }}>
            <div className="text-sm font-semibold text-white">Mining Deal Audit — Sample</div>
            <div className="text-xs" style={{ color: ORANGE }}>Lightning Mines</div>
          </div>
          <div className="p-5 md:p-6 space-y-5">
            {/* Verdict */}
            <div className="rounded-xl p-4 flex items-center gap-3" style={{ background: 'rgba(255,71,87,0.08)', border: '1px solid rgba(255,71,87,0.3)' }}>
              <span className="text-xs font-bold uppercase px-2 py-1 rounded" style={{ background: 'rgba(255,71,87,0.15)', color: '#ff4757' }}>Verdict: No-Go (as structured)</span>
              <span className="text-sm text-gray-300">Renegotiate hosting to ≤ $0.075/kWh or walk. At the quoted rate this deal is underwater below ~$83k BTC.</span>
            </div>
            {/* Key numbers */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ['Breakeven BTC', '$83,400'],
                ['Net / machine / mo', '−$18'],
                ['Payback', 'Never at quote'],
                ['24-mo difficulty drag', '~28%'],
              ].map(([label, val]) => (
                <div key={label} className="rounded-xl p-3 text-center" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
                  <div className="text-xs text-gray-500 mb-1">{label}</div>
                  <div className="text-sm font-bold font-mono text-white">{val}</div>
                </div>
              ))}
            </div>
            {/* Red flags */}
            <div>
              <div className="text-sm font-semibold text-white mb-2">Red flags found</div>
              <ul className="space-y-1.5 text-sm text-gray-400">
                {[
                  'Hosting rate quoted per-kWh but contract lets provider pass through demand charges — uncapped.',
                  'No written exit clause; hardware retrieval terms undefined.',
                  '“Guaranteed” uptime with no SLA credit mechanism behind it.',
                ].map((f, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5" style={{ color: '#ff4757' }}>⚑</span>{f}
                  </li>
                ))}
              </ul>
            </div>
            {/* Recommendation */}
            <div className="rounded-xl p-4" style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.25)' }}>
              <div className="text-sm font-semibold mb-1" style={{ color: '#00d4aa' }}>Recommendation</div>
              <p className="text-sm text-gray-300 leading-relaxed">
                Counter at a flat $225/mo all-in, get the demand-charge pass-through struck, and add a 30-day exit clause. With those three changes the same hardware clears breakeven near $68k and pays back in ~19 months at the base-case BTC price.
              </p>
            </div>
            <p className="text-xs text-gray-600">Illustrative sample. Your report uses your real hardware, hosting quote, and live BTC price / network difficulty at the time of analysis.</p>
          </div>
        </div>
      </div>

      {/* ---------- PROOF / CREDIBILITY ---------- */}
      <div className="rounded-2xl p-6 md:p-8 mb-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-start gap-4">
          <div
            className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE }}
          >
            JH
          </div>
          <div>
            <div className="text-sm font-semibold text-white">Jacob H. — Founder, 8 years in Bitcoin mining</div>
            <p className="text-sm text-gray-400 leading-relaxed mt-2">
              Every audit is completed personally — not an AI-generated report. I review your actual contract
              terms, hardware specs, and hosting offer against current live network data, using the same
              methodology behind the free calculator. Numbers first, no hype, and I&apos;ll tell you when the
              math says <span className="text-white font-semibold">don&apos;t buy</span>.
            </p>
          </div>
        </div>
      </div>

      {/* Methodology / verify link */}
      <div
        className="rounded-lg px-4 py-3 text-xs leading-relaxed mb-12"
        style={{ background: 'rgba(0,212,170,0.04)', border: `1px solid rgba(0,212,170,0.15)`, color: '#6b7280' }}
      >
        <strong style={{ color: TEAL }}>How the numbers are sourced:</strong>{' '}
        Profitability figures use live BTC price and network difficulty from public APIs, reviewed monthly by Jacob.
        See the full sourcing and verification process on our{' '}
        <Link href="/how-we-verify" className="underline transition-colors hover:text-white" style={{ color: TEAL }}>
          How We Verify
        </Link>{' '}
        page.
      </div>

      {/* Guarantee */}
      <div className="mb-12 text-center rounded-xl p-5" style={{ background: 'rgba(0,212,170,0.05)', border: '1px solid rgba(0,212,170,0.15)' }}>
        <p className="text-sm text-gray-400">
          <span className="font-semibold" style={{ color: TEAL }}>100% Money-Back Guarantee.</span>{' '}
          If your audit doesn&apos;t give you at least one concrete, actionable insight about your mining deal,
          we&apos;ll refund you in full. No questions asked.
        </p>
      </div>

      {/* ---------- INQUIRY FORM ---------- */}
      <div id="inquiry" />
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
        <div className="rounded-2xl p-6 md:p-8 mb-12" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h2 className="text-xl font-bold text-white mb-2">Prefer to send your details first?</h2>
          <p className="text-sm text-gray-500 mb-6">
            Tell us about your deal and we&apos;ll reply with a payment link and any quick questions. Or skip straight to checkout above.
          </p>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="text-sm font-semibold text-white block mb-3">Select Tier</label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {([
                  { value: 'deep' as const, label: 'Mining Build Plan — $297' },
                  { value: 'basic' as const, label: 'Mining Deal Audit — $97' },
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
                <label className="text-xs text-gray-400 block mb-1">Your Name *</label>
                <input
                  type="text" value={name} onChange={e => setName(e.target.value)} required aria-label="Your name"
                  placeholder="First and last name"
                  className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-[#f7931a]"
                  style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 block mb-1">Email Address *</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)} required aria-label="Email address"
                  placeholder="you@example.com"
                  className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-[#f7931a]"
                  style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Which miner(s) are you considering?</label>
              <input
                type="text" value={miners} onChange={e => setMiners(e.target.value)} aria-label="Miners you are considering"
                placeholder="e.g. Antminer S21 Pro, Whatsminer M60S"
                className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-[#f7931a]"
                style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Which hosting provider(s) are you considering?</label>
              <input
                type="text" value={providers} onChange={e => setProviders(e.target.value)} aria-label="Hosting providers you are considering"
                placeholder="e.g. Abundant Mines, Compass Mining, or I don't know yet"
                className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-500 outline-none focus-visible:ring-2 focus-visible:ring-[#f7931a]"
                style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
              />
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Hardware budget</label>
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
              <label className="text-xs text-gray-400 block mb-1">What&apos;s your main question about this deal?</label>
              <textarea
                value={question} onChange={e => setQuestion(e.target.value)} rows={3} aria-label="Your main question about this deal"
                placeholder="e.g. I want to know if this deal makes sense at current BTC prices and what happens if price drops..."
                className="w-full text-sm px-4 py-3 rounded-xl text-white placeholder-gray-600 outline-none resize-none"
                style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
              />
            </div>

            {error && (
              <div className="text-sm px-4 py-2 rounded-lg" style={{ background: 'rgba(255,71,87,0.12)', color: RED }}>{error}</div>
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

      {/* ---------- FAQ / OBJECTION HANDLING ---------- */}
      <div className="mb-12">
        <h2 className="text-xl md:text-2xl font-bold text-white mb-6">Questions before you commit</h2>
        <div className="space-y-4">
          {FAQ.map(item => (
            <div key={item.q} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <h3 className="font-semibold text-white text-sm mb-2">{item.q}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ---------- CLOSING CTA ---------- */}
      <div className="rounded-2xl p-6 md:p-10 text-center mb-8" style={{ background: CARD_BG, border: `2px solid rgba(247,147,26,0.4)` }}>
        <h2 className="text-xl md:text-2xl font-bold text-white mb-3">
          Get the full picture before you buy.
        </h2>
        <p className="text-sm text-gray-400 max-w-xl mx-auto mb-6">
          A single bad mining deal costs far more than $297. Get an independent build plan, a live walkthrough,
          and a clear verdict on whether the numbers actually work.
        </p>
        <a
          href={STRIPE_297_LINK}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block text-base font-bold py-4 px-8 rounded-xl transition-all hover:opacity-90"
          style={{ background: ORANGE, color: '#000' }}
        >
          Get My Mining Build Plan — $297 →
        </a>
        <div className="mt-4 text-xs text-gray-600">
          Just need a quick go / no-go?{' '}
          <a href={STRIPE_97_LINK} target="_blank" rel="noopener noreferrer" className="underline hover:text-white" style={{ color: TEAL }}>
            Start with the $97 Mining Deal Audit →
          </a>
        </div>
      </div>

      <div className="text-center text-sm text-gray-600">
        Not ready for an audit?{' '}
        <Link href="/review" className="hover:text-white transition-colors" style={{ color: ORANGE }}>
          Start with a free deal review →
        </Link>
      </div>
    </div>
  )
}
