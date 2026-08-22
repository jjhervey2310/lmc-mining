'use client'

import { useState } from 'react'
import Link from 'next/link'
import FounderBlock from '@/components/FounderBlock'

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'
const TEAL = '#00d4aa'
const RED = '#ff4757'

// Application-first on purpose: at $997 the right funnel is a short application,
// then Jacob sends the payment link and books the kickoff. If a Stripe link is
// ever created for direct checkout, set it here and the pay button appears.
const STRIPE_997_LINK = 'https://buy.stripe.com/5kQ5kE1w8bWIgA4cAQf7i02'

const FAQ = [
  {
    q: 'What exactly is Done-With-You?',
    a: 'We plan and execute your first mining deployment together, on calls, over about four weeks. You make every decision and you own everything — the hardware, the accounts, the contracts. I bring the model, the vendor shortlist, the contract review, and the deployment checklist so you do not learn the expensive lessons the hard way.',
  },
  {
    q: 'How is this different from the $297 Mining Build Plan?',
    a: 'The Build Plan is a document: I analyse your situation and hand you a written plan plus one call. Done-With-You is the execution: we get on calls through the whole process — hardware selection, hosting negotiation, contract review, deployment, first payout verification — until machines are hashing and the numbers match the model.',
  },
  {
    q: 'Do you earn a commission if I use a host you recommend?',
    a: 'Sometimes, and I will tell you which ones before you choose. Some hosting providers pay a referral fee. That is disclosed on every recommendation, the fee never changes what I recommend, and if the best host for your situation pays nothing you will still get sent there. You can always sign direct and cut me out of the referral entirely — the plan is the same either way.',
  },
  {
    q: 'Will you tell me not to do it?',
    a: 'If the numbers say do not buy, that is the deliverable and you get your money back. That happens. Mining at small scale is not profitable in every market condition, and the whole point of this site is telling people that before they wire the money rather than after.',
  },
  {
    q: 'What do you need from me?',
    a: 'Your budget, your timeline, your electricity situation (or that you plan to host), and about two hours of calls spread across the engagement. If you already have quotes or a contract in hand, bring them — that is the fastest place to find money.',
  },
  {
    q: 'What if I only want the machines picked?',
    a: 'Then you want the $297 Build Plan, not this. Done-With-You is for people committing real capital who want someone in the room for the whole deployment.',
  },
]

const BUDGET_OPTIONS = ['$20k–$50k', '$50k–$100k', '$100k–$250k', '$250k+']
const TIMELINE_OPTIONS = ['Ready now', 'Next 1–3 months', '3–6 months', 'Just researching']

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(item => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
}

export default function SetupPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [budget, setBudget] = useState('')
  const [timeline, setTimeline] = useState('')
  const [situation, setSituation] = useState('')
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
          source: 'done_with_you_997',
          form_data: { tier: '$997 Done-With-You Mining Setup', budget, timeline, situation },
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

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>Done-With-You Setup</span>
      </div>

      {/* ---------- HERO ---------- */}
      <div className="text-center mb-12">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold mb-5"
          style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE, border: '1px solid rgba(247,147,26,0.25)' }}
        >
          Limited to 3 clients per month · application required
        </div>
        <h1 className="text-3xl md:text-5xl font-bold text-white mb-5 leading-tight">
          Deploy your first miners with someone who has already made the mistakes.
        </h1>
        <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
          A $50,000 mining deployment has roughly six places to lose serious money: the wrong machine,
          the wrong host, a bad contract clause, the wrong month to buy, a botched setup, and no plan
          for the halving.
          <span className="text-white font-semibold"> Done-With-You </span>
          walks you through all six, on calls, until your machines are hashing and the real numbers
          match the model we built together.
        </p>
      </div>

      {/* ---------- THE OFFER ---------- */}
      <div
        className="rounded-2xl p-6 md:p-10 mb-6 relative"
        style={{ background: CARD_BG, border: `2px solid rgba(247,147,26,0.5)`, boxShadow: '0 0 40px rgba(247,147,26,0.08)' }}
      >
        <div
          className="absolute -top-3 left-6 md:left-10 px-4 py-1 rounded-full text-xs font-bold"
          style={{ background: ORANGE, color: '#000' }}
        >
          The full deployment, done together
        </div>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-8 mt-2">
          <div>
            <div className="text-sm text-gray-500 mb-1">Done-With-You</div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Mining Setup</h2>
            <p className="text-sm text-gray-400 mt-2 max-w-md">
              About four weeks, start to first payout. You own everything. I am in the room for all of it.
            </p>
          </div>
          <div className="shrink-0">
            <div className="text-5xl font-bold" style={{ color: ORANGE }}>$997</div>
            <div className="text-xs text-gray-500 mt-1">One-time · 3 clients per month</div>
          </div>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-3 mb-8">
          {[
            'Kickoff call: your capital, power situation, and risk tolerance modelled honestly',
            'Hardware selection — specific machines, specific sellers, current pricing',
            'Hosting shortlist with the real all-in rate, not the advertised one',
            'I review your hosting contract clause by clause before you sign',
            'Purchase timing guidance against live network conditions',
            'Deployment checklist: shipping, install, pool setup, monitoring, payouts',
            'First-payout verification — we check reality against the model',
            'Direct access to me by email for the whole engagement',
          ].map(item => (
            <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
              <span style={{ color: ORANGE }} className="mt-0.5 shrink-0">✓</span>
              {item}
            </li>
          ))}
        </ul>

        <a
          href="#apply"
          className="block w-full text-center text-base font-bold py-4 rounded-xl transition-all hover:opacity-90"
          style={{ background: ORANGE, color: '#000' }}
        >
          Apply for a spot →
        </a>
        {STRIPE_997_LINK && (
          <a
            href={STRIPE_997_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full text-center text-sm font-semibold py-3 rounded-xl mt-3 transition-all hover:opacity-90"
            style={{ background: 'transparent', color: ORANGE, border: `1px solid ${ORANGE}` }}
          >
            Already spoken with Jacob? Pay now — $997
          </a>
        )}
        <p className="text-xs text-gray-600 text-center mt-3">
          Application first — I only take three of these a month and I turn down people who should not be mining yet.
        </p>
      </div>

      {/* ---------- HONESTY BLOCK ---------- */}
      <div
        className="rounded-xl p-6 mb-10"
        style={{ background: '#0a0a0a', border: `1px solid rgba(255,71,87,0.25)` }}
      >
        <div className="text-sm font-bold text-white mb-3">What this is not</div>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span style={{ color: RED }} className="mt-0.5 shrink-0">·</span>
            Not a promise that mining will be profitable for you. Some months the honest answer is wait, and I will say so.
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: RED }} className="mt-0.5 shrink-0">·</span>
            Not a managed service. You own the machines, the accounts, and the contracts — I am not touching your money or your keys.
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: RED }} className="mt-0.5 shrink-0">·</span>
            Not financial advice. It is operational help from someone who runs the numbers publicly every day.
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: RED }} className="mt-0.5 shrink-0">·</span>
            Not for everyone. If your budget is under $20k, start with the{' '}
            <Link href="/audit" className="underline" style={{ color: TEAL }}>$97 audit</Link> instead — it is the right tool for that size.
          </li>
        </ul>
      </div>

      {/* ---------- APPLICATION FORM ---------- */}
      <div id="apply" className="rounded-2xl p-6 md:p-8 mb-10" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-xl md:text-2xl font-bold text-white mb-2">Apply for a spot</h2>
        <p className="text-sm text-gray-400 mb-6">
          Takes a minute. I reply personally within one business day — either with next steps and a payment
          link, or with an honest note about why this is not the right fit yet.
        </p>

        {submitted ? (
          <div className="rounded-xl p-6 text-center" style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.3)' }}>
            <div className="text-lg font-bold text-white mb-2">Application received.</div>
            <p className="text-sm text-gray-400">
              I will read it myself and reply to <span className="text-white">{email}</span> within one business day.
              If you want to get ahead, run your setup through the{' '}
              <Link href="/calculator" className="underline" style={{ color: TEAL }}>free calculator</Link> and bring the numbers to our first call.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dwy-name" className="block text-xs text-gray-500 mb-1.5">Name *</label>
                <input
                  id="dwy-name" type="text" value={name} onChange={e => setName(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none focus:border-orange-500"
                  style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
                />
              </div>
              <div>
                <label htmlFor="dwy-email" className="block text-xs text-gray-500 mb-1.5">Email *</label>
                <input
                  id="dwy-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none focus:border-orange-500"
                  style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dwy-budget" className="block text-xs text-gray-500 mb-1.5">Capital you are working with</label>
                <select
                  id="dwy-budget" value={budget} onChange={e => setBudget(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none focus:border-orange-500"
                  style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
                >
                  <option value="">Select…</option>
                  {BUDGET_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="dwy-timeline" className="block text-xs text-gray-500 mb-1.5">Timeline</label>
                <select
                  id="dwy-timeline" value={timeline} onChange={e => setTimeline(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none focus:border-orange-500"
                  style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
                >
                  <option value="">Select…</option>
                  {TIMELINE_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="dwy-situation" className="block text-xs text-gray-500 mb-1.5">
                Where are you right now? Quotes in hand, power situation, anything relevant.
              </label>
              <textarea
                id="dwy-situation" value={situation} onChange={e => setSituation(e.target.value)} rows={4}
                className="w-full px-3 py-2.5 rounded-lg text-sm text-white outline-none focus:border-orange-500"
                style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}
              />
            </div>

            {error && <div className="text-sm" style={{ color: RED }}>{error}</div>}

            <button
              type="submit" disabled={submitting}
              className="w-full text-base font-bold py-3.5 rounded-xl transition-all hover:opacity-90 disabled:opacity-50"
              style={{ background: ORANGE, color: '#000' }}
            >
              {submitting ? 'Sending…' : 'Send my application →'}
            </button>
            <p className="text-xs text-gray-600 text-center">
              No spam, no list-selling. Your details are used to answer your application.
            </p>
          </form>
        )}
      </div>

      {/* ---------- AFFILIATE DISCLOSURE (BRAND.md requirement) ---------- */}
      <div className="rounded-xl p-5 mb-10" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
        <div className="text-xs font-semibold text-gray-400 mb-2">How I get paid — all of it</div>
        <p className="text-xs text-gray-500 leading-relaxed">
          You pay $997 for the engagement. Separately, some hosting providers pay this site a referral
          fee if you sign with them, and I will tell you which ones do before you choose. That fee never
          changes what I recommend, and you can always sign direct with any host to remove it entirely.
          Saying that out loud is the whole point of this site.
        </p>
      </div>

      {/* ---------- FAQ ---------- */}
      <h2 className="text-xl md:text-2xl font-bold text-white mb-5">Questions</h2>
      <div className="space-y-3 mb-12">
        {FAQ.map(item => (
          <details key={item.q} className="rounded-xl p-4 group" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <summary className="text-sm font-semibold text-white cursor-pointer list-none flex justify-between gap-3">
              {item.q}
              <span className="text-gray-600 group-open:rotate-45 transition-transform shrink-0">+</span>
            </summary>
            <p className="text-sm text-gray-400 mt-3 leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>

      <FounderBlock />

      <div className="text-center mt-10">
        <p className="text-sm text-gray-500">
          Not ready for this? Run your own numbers free at{' '}
          <Link href="/calculator" className="underline" style={{ color: ORANGE }}>the calculator</Link>{' '}
          — no email required.
        </p>
      </div>
    </div>
  )
}
