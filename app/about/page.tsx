import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { absolute: 'About LMC Mining — Independent Bitcoin Mining Data' },
  description: 'LMC Mining was founded by an 8-year Bitcoin mining veteran and operations executive. Independent data, verified specs, no sponsored rankings.',
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'About LMC Mining Intelligence',
  description: 'LMC Mining was founded by an 8-year Bitcoin mining veteran and operations executive. Independent data, verified specs, no sponsored rankings.',
  author: {
    '@type': 'Person',
    name: 'Jacob H.',
  },
  publisher: {
    '@type': 'Organization',
    name: 'LMC Mining Intelligence',
    url: 'https://lmcmining.com',
  },
}

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'LMC Mining Intelligence',
  description: 'Independent Bitcoin mining profitability analysis, hosting comparisons, and deal auditing.',
  url: 'https://lmcmining.com',
  founder: {
    '@type': 'Person',
    name: 'Jacob H.',
  },
}

const credentials = [
  {
    icon: '⚡',
    heading: '8 Years in Bitcoin Mining',
    text: 'Active since the early days of ASIC dominance. Lived through three halvings, two bear markets, and the shift to institutional-scale hosting.',
  },
  {
    icon: '📊',
    heading: '15 Years Operations Leadership',
    text: 'P&L ownership and team leadership across multiple multi-million dollar companies. The same analytical frameworks apply to mining that apply to any serious business.',
  },
  {
    icon: '⛏️',
    heading: 'Active Mining Operation',
    text: 'Lightning Mining Corp is live and generating monthly BTC. We use every tool on this site for our own capital allocation decisions.',
  },
]

const whyColumns = [
  {
    heading: 'The Problem',
    text: 'The Bitcoin mining information landscape is dominated by manufacturers selling hardware, hosting companies selling capacity, and review sites collecting affiliate fees for \'independent\' rankings. The retail miner has no neutral source of truth.',
  },
  {
    heading: 'Our Approach',
    text: 'Every data point on LMC Mining is sourced from primary sources — direct contracts, manufacturer spec sheets, and live API data. We disclose every affiliate relationship. We do not accept payment for rankings or reviews.',
  },
  {
    heading: 'Our Standard',
    text: 'If a hosting deal doesn\'t make sense at current BTC prices, we say so. If a miner is overpriced relative to its efficiency, we say so. The goal is not to maximise affiliate revenue — it\'s to be the source serious miners actually trust.',
  },
]

export default function AboutPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />

      {/* ── SECTION 1: Hero ────────────────────────────────────────────────── */}
      <section style={{ background: 'linear-gradient(180deg, #050810 0%, #0a0e17 100%)', borderBottom: '1px solid #1f2937' }}>
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <div className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-6" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.25)' }}>
            About
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-5 leading-tight">
            About LMC Mining Intelligence
          </h1>
          <p className="text-xl text-gray-400 mb-2">
            Independent data. No sponsored rankings.{' '}
          </p>
          <p className="text-xl font-semibold" style={{ color: '#f59e0b' }}>
            Built by a miner, for miners.
          </p>
        </div>
      </section>

      {/* ── SECTION 2: Founder Bio ─────────────────────────────────────────── */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10 items-start">

          {/* Avatar card */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center justify-center w-28 h-28 rounded-full mb-5" style={{ background: 'linear-gradient(135deg, #92610a 0%, #f59e0b 50%, #92610a 100%)', boxShadow: '0 0 40px rgba(245,158,11,0.25)' }}>
              <span style={{ fontFamily: 'Georgia, serif', fontSize: '2.25rem', fontWeight: 700, color: '#0a0e17', letterSpacing: '-0.02em' }}>JH</span>
            </div>
            <div className="text-center md:text-left">
              <div className="text-lg font-bold text-white">Jacob H.</div>
              <div className="text-sm mt-0.5" style={{ color: '#f59e0b' }}>Founder, LMC Mining Intelligence</div>
              <div className="text-sm text-gray-500 mt-1">Colorado, USA</div>
            </div>
          </div>

          {/* Bio text */}
          <div className="md:col-span-2 space-y-4 text-gray-300 leading-7 text-[15px]">
            <p>
              I&apos;ve been deep in the Bitcoin mining world for over 8 years — long enough to have made every mistake worth making, and to have learned what actually moves the needle on mining profitability.
            </p>
            <p>
              Before founding LMC Mining, I spent 15 years in operations leadership across multi-million dollar companies — running teams, managing P&L, and building systems that scale. That background taught me one thing above everything else: the numbers either work or they don&apos;t. No amount of hype changes the math.
            </p>
            <p>
              I founded LMC Mining Intelligence because I was frustrated with the lack of honest, independent analysis in this space. Every &apos;review&apos; site has a sponsored ranking. Every calculator uses optimistic assumptions. Every hosting comparison is written by someone with a financial interest in the outcome.
            </p>
            <p>
              LMC Mining is different. Every spec on this site comes from a verified primary source. Every hosting comparison uses real contracted rates. Every profitability calculation uses conservative assumptions — because I&apos;d rather you go in clear-eyed than get burned.
            </p>
            <p>
              Today, Lightning Mining Corp — our own Bitcoin mining operation — is actively deploying capacity and generating monthly BTC returns. We eat our own cooking. Every tool and framework on this site is what we use ourselves to evaluate our own mining decisions.
            </p>
            <p>
              If you&apos;re serious about Bitcoin mining, you&apos;re in the right place. The data here will tell you the truth — even when the truth is that a particular deal doesn&apos;t make sense.
            </p>
          </div>
        </div>

        {/* Credential cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-12">
          {credentials.map((c) => (
            <div key={c.heading} className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="text-3xl mb-3">{c.icon}</div>
              <div className="text-base font-bold text-white mb-2">{c.heading}</div>
              <p className="text-sm text-gray-400 leading-6">{c.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── SECTION 3: Why LMC Exists ──────────────────────────────────────── */}
      <section style={{ background: '#0a0e17', borderTop: '1px solid #1f2937', borderBottom: '1px solid #1f2937' }}>
        <div className="max-w-5xl mx-auto px-4 py-16">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-10 text-center">Why We Built This</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {whyColumns.map((col) => (
              <div key={col.heading}>
                <div className="text-base font-bold text-white mb-3 flex items-center gap-2">
                  <span className="w-1 h-5 rounded-full inline-block" style={{ background: '#f59e0b' }} />
                  {col.heading}
                </div>
                <p className="text-sm text-gray-400 leading-7">{col.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── SECTION 4: Affiliate Disclosure ────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-4 py-14">
        <div className="rounded-2xl p-8" style={{ background: 'rgba(17,24,39,0.8)', border: '1px solid #374151' }}>
          <div className="flex items-center gap-3 mb-5">
            <div className="w-2 h-2 rounded-full" style={{ background: '#f59e0b' }} />
            <h2 className="text-lg font-bold text-white">Affiliate Relationships &amp; Disclosures</h2>
          </div>
          <div className="space-y-4 text-sm text-gray-400 leading-7">
            <p>
              LMC Mining Intelligence maintains affiliate relationships with select hosting providers. When you sign up with a hosting provider through a link on this site, we may earn a commission at no additional cost to you.
            </p>
            <div className="rounded-lg p-4" style={{ background: 'rgba(245,158,11,0.05)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <p className="text-gray-300 font-semibold mb-2">Current affiliate relationships:</p>
              <ul className="space-y-2">
                <li className="flex items-start gap-2">
                  <span style={{ color: '#f59e0b' }} className="mt-0.5">→</span>
                  <span>
                    <strong className="text-gray-200">Abundant Mines</strong> — we earn $200 per machine deployed through our referral link. This relationship does not influence our independent assessment of their service. We recommend Abundant Mines because we believe they offer genuine value for hosted mining — not because of the commission.
                  </span>
                </li>
              </ul>
            </div>
            <p>
              We do not accept payment for rankings, reviews, or editorial placement. Our hosting comparison tables and miner rankings are based solely on independently verified data.
            </p>
            <p>
              If you believe any data on this site is inaccurate, contact us and we will investigate and correct it within 48 hours.
            </p>
          </div>
        </div>
      </section>

      {/* ── SECTION 5: Contact CTA ─────────────────────────────────────────── */}
      <section style={{ background: '#0a0e17', borderTop: '1px solid #1f2937' }}>
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Get in Touch</h2>
          <p className="text-gray-400 mb-8 leading-7">
            Questions about the data, a deal you want a second opinion on, or just want to talk mining — reach out.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/audit"
              className="text-sm font-bold px-7 py-3 rounded-xl transition-opacity hover:opacity-90"
              style={{ background: 'linear-gradient(135deg, #d97706, #f59e0b)', color: '#0a0e17' }}
            >
              Book a Profitability Audit
            </Link>
            <Link
              href="/contact"
              className="text-sm font-semibold px-7 py-3 rounded-xl transition-colors"
              style={{ background: 'rgba(255,255,255,0.05)', color: '#d1d5db', border: '1px solid #374151' }}
            >
              Contact Us
            </Link>
          </div>
        </div>
      </section>
    </>
  )
}
