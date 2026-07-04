'use client'

import { useState } from 'react'
import Link from 'next/link'

const QUESTIONS = [
  {
    id: 'financing',
    question: 'Do you need financing to purchase your mining hardware?',
    options: [
      { value: 'yes', label: 'Yes — financing is essential' },
      { value: 'no', label: 'No — I have capital ready' },
    ],
  },
  {
    id: 'budget',
    question: 'What is your total hardware + hosting budget?',
    options: [
      { value: 'under_20k', label: 'Under $20,000' },
      { value: '20k_100k', label: '$20,000 – $100,000' },
      { value: 'over_100k', label: 'Over $100,000' },
    ],
  },
  {
    id: 'cooling',
    question: 'What cooling type do you need?',
    options: [
      { value: 'air', label: 'Air cooling (standard)' },
      { value: 'hydro', label: 'Hydro / liquid cooling' },
      { value: 'immersion', label: 'Immersion cooling' },
      { value: 'unsure', label: "I'm not sure" },
    ],
  },
  {
    id: 'contract',
    question: 'What contract length do you prefer?',
    options: [
      { value: 'month_to_month', label: 'Month-to-month flexibility' },
      { value: '12_months', label: '12-month commitment' },
      { value: 'longer', label: 'Longer term for better rates' },
    ],
  },
  {
    id: 'scale',
    question: 'How many miners are you deploying?',
    options: [
      { value: '1_5', label: '1–5 machines' },
      { value: '6_20', label: '6–20 machines' },
      { value: '20_plus', label: '20+ machines' },
    ],
  },
]

type Answers = Record<string, string>

interface Recommendation {
  host: string
  tagline: string
  reason: string
  cta: string
  ctaHref: string
  isAffiliate: boolean
  note?: string
}

function getRecommendation(answers: Answers): Recommendation {
  const needsFinancing = answers.financing === 'yes'
  const smallBudget = answers.budget === 'under_20k'
  const wantsImmersion = answers.cooling === 'immersion'
  const monthToMonth = answers.contract === 'month_to_month'

  if (wantsImmersion) {
    return {
      host: 'Abundant Mines (Future) or Specialized Provider',
      tagline: 'Immersion cooling — plan for 2028',
      reason:
        'Immersion cooling is not yet widely available from most hosting providers. Abundant Mines has immersion planned for approximately 2028. For immediate immersion needs, you may need to contact specialty facilities directly.',
      cta: 'Explore Abundant Mines',
      ctaHref: 'https://abundantmines.com/ref/72/',
      isAffiliate: true,
      note: "If you can run air cooling in the interim, Abundant Mines' $225/month flat fee is the best option while immersion capacity expands.",
    }
  }

  if (monthToMonth) {
    return {
      host: 'Simple Mining',
      tagline: 'Best for month-to-month flexibility',
      reason:
        'Month-to-month contracts are rare in the hosting industry. Simple Mining offers more flexible terms than most providers. Note: flexible contracts typically carry higher per-unit rates than committed contracts.',
      cta: 'Compare All Hosts',
      ctaHref: '/hosts',
      isAffiliate: false,
      note: 'If flexibility is a preference rather than a hard requirement, Abundant Mines at $225/month on a 12-month contract often beats month-to-month pricing elsewhere.',
    }
  }

  if (needsFinancing || smallBudget) {
    return {
      host: 'Abundant Mines',
      tagline: 'Best for beginners and financed buyers',
      reason:
        needsFinancing
          ? 'Abundant Mines offers in-house financing up to $140,000 at 10% interest over 36 months — one of the only hosting providers with built-in financing. $225/month flat fee means predictable costs from day one.'
          : 'With a budget under $20,000, predictable costs and low capital requirements are critical. Abundant Mines at $225/month flat fee (electricity + cooling + insurance included) is the most accessible starting point for smaller operations.',
      cta: 'Get Started with Abundant Mines',
      ctaHref: 'https://abundantmines.com/ref/72/',
      isAffiliate: true,
    }
  }

  return {
    host: 'Abundant Mines',
    tagline: 'Our top-rated host for most miners',
    reason:
      'For air-cooled operations with capital ready and a standard contract commitment, Abundant Mines delivers the best combination of price certainty ($225/month flat fee), industrial hydro power, and included insurance. Strong fit for 1–20 machine operators.',
    cta: 'Get Started with Abundant Mines',
    ctaHref: 'https://abundantmines.com/ref/72/',
    isAffiliate: true,
  }
}

export default function HostingMatchPage() {
  const [current, setCurrent] = useState(0)
  const [answers, setAnswers] = useState<Answers>({})
  const [done, setDone] = useState(false)

  function handleAnswer(value: string) {
    const q = QUESTIONS[current]
    const next = { ...answers, [q.id]: value }
    setAnswers(next)
    if (current + 1 < QUESTIONS.length) {
      setCurrent(current + 1)
    } else {
      setDone(true)
    }
  }

  function restart() {
    setAnswers({})
    setCurrent(0)
    setDone(false)
  }

  const rec = done ? getRecommendation(answers) : null
  const progress = done ? 100 : Math.round((current / QUESTIONS.length) * 100)

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-5" style={{ background: 'rgba(0,212,170,0.1)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.2)' }}>
          Takes 60 seconds
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Find Your Best Mining Host
        </h1>
        <p className="text-gray-400">
          Answer 5 questions and get an instant, personalized hosting recommendation based on your budget, cooling needs, and contract preferences.
        </p>
      </div>

      {/* Progress bar */}
      <div className="mb-8">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span>{done ? 'Complete' : `Question ${current + 1} of ${QUESTIONS.length}`}</span>
          <span>{progress}%</span>
        </div>
        <div className="h-1.5 rounded-full" style={{ background: '#1f2937' }}>
          <div className="h-1.5 rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: '#00d4aa' }} />
        </div>
      </div>

      {!done ? (
        <div className="rounded-2xl p-6 md:p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h2 className="text-xl font-bold text-white mb-6">{QUESTIONS[current].question}</h2>
          <div className="space-y-3">
            {QUESTIONS[current].options.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleAnswer(opt.value)}
                className="w-full text-left px-5 py-4 rounded-xl font-medium text-sm transition-all"
                style={{ background: '#0d1421', border: '1px solid #1f2937', color: '#d1d5db' }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#00d4aa'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#ffffff'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLButtonElement).style.borderColor = '#1f2937'
                  ;(e.currentTarget as HTMLButtonElement).style.color = '#d1d5db'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {current > 0 && (
            <button
              onClick={() => setCurrent(current - 1)}
              className="mt-5 text-xs text-gray-500 hover:text-gray-300"
            >
              ← Back
            </button>
          )}
        </div>
      ) : rec ? (
        <div>
          <div className="rounded-2xl p-6 md:p-8 mb-5" style={{ background: '#111827', border: '1px solid rgba(0,212,170,0.3)' }}>
            <div className="text-xs font-semibold mb-2" style={{ color: '#00d4aa' }}>YOUR MATCH</div>
            <h2 className="text-2xl font-bold text-white mb-1">{rec.host}</h2>
            <div className="text-sm font-medium mb-4" style={{ color: '#f59e0b' }}>{rec.tagline}</div>
            <p className="text-sm text-gray-400 leading-6 mb-5">{rec.reason}</p>

            {rec.note && (
              <div className="text-xs text-gray-500 rounded-lg p-3 mb-5" style={{ background: '#0d1421', border: '1px solid #1f2937' }}>
                {rec.note}
              </div>
            )}

            {rec.isAffiliate ? (
              <a
                href={rec.ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block text-sm font-bold px-6 py-3 rounded-xl"
                style={{ background: '#f59e0b', color: '#0a0e17' }}
              >
                {rec.cta} →
              </a>
            ) : (
              <Link
                href={rec.ctaHref}
                className="inline-block text-sm font-bold px-6 py-3 rounded-xl"
                style={{ background: '#00d4aa', color: '#0a0e17' }}
              >
                {rec.cta} →
              </Link>
            )}

            {rec.isAffiliate && (
              <p className="text-xs text-gray-600 mt-3">Affiliate link — Lightning Mines earns a commission at no cost to you.</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <Link
              href="/deal-analyzer"
              className="text-center text-sm font-semibold py-3 rounded-xl"
              style={{ background: '#0d1421', border: '1px solid #1f2937', color: '#9ca3af' }}
            >
              Analyze Your Deal Free →
            </Link>
            <Link
              href="/hosts"
              className="text-center text-sm font-semibold py-3 rounded-xl"
              style={{ background: '#0d1421', border: '1px solid #1f2937', color: '#9ca3af' }}
            >
              Compare All Hosts →
            </Link>
          </div>

          <div className="text-center">
            <button onClick={restart} className="text-xs text-gray-500 hover:text-gray-300 underline">
              Start over
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
