'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import dynamic from 'next/dynamic'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'
import HalvingDays from '@/components/HalvingDays'
const DifficultyWidget = dynamic(() => import('@/components/DifficultyWidget'), { ssr: false })
const HashpriceChart = dynamic(() => import('@/components/HashpriceChart'), { ssr: false })

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

function calcHashprice(price: number, difficulty: number): number {
  return (2.7e20 * price) / (difficulty * 4294967296)
}

const TRUST_STATS = [
  { value: 'Free', label: 'ROI Calculator' },
  { value: '48hr', label: 'Deal Review' },
  { value: 'Verified', label: 'Hosting Providers' },
  { value: 'No Bias', label: 'Independent Analysis' },
]

const HOW_WE_HELP = [
  {
    icon: '🧮',
    title: 'Calculate Real ROI',
    body: 'Our calculator uses your actual hardware specs, hosting cost, electricity rate, and live BTC price — not marketing estimates. Get a real number before you spend a dollar.',
    link: '/calculator',
    cta: 'Open Calculator',
  },
  {
    icon: '🏗️',
    title: 'Compare Verified Hosting',
    body: 'We verify hosting providers before listing them. See real pricing, power sources, cooling types, minimums, and setup fees — side by side without the sales pitch.',
    link: '/hosting',
    cta: 'Compare Hosting',
  },
  {
    icon: '🔍',
    title: 'Get a Free Deal Review',
    body: "Submit your mining deal and get a Pass / Pass with Conditions / Avoid verdict within 48 hours. Completely free. We've reviewed hundreds of deals and know every red flag.",
    link: '/review',
    cta: 'Submit My Deal',
  },
]

const MISTAKES = [
  {
    mistake: 'Paying retail for hardware',
    truth: 'New-gen ASICs depreciate 40-60% in the first 12 months. Used hardware at the right price often delivers better ROI than new hardware at inflated retail.',
  },
  {
    mistake: 'Ignoring electricity cost per kWh',
    truth: "A 1¢/kWh difference in electricity cost changes your annual profit by ~$260 per machine. At 10 miners, that's $2,600/year. Always get the exact rate in writing.",
  },
  {
    mistake: 'Signing long contracts without exit clauses',
    truth: 'A 12-month hosting contract with no exit clause locks you in through price swings, difficulty spikes, and facility problems. Always negotiate an exit or buyout provision.',
  },
  {
    mistake: 'Skipping the breakeven calculation',
    truth: "If you don't know your hardware breakeven price, you can't manage risk. Run our calculator before every purchase to know exactly where you stand.",
  },
  {
    mistake: 'Not modeling difficulty growth',
    truth: 'Bitcoin network difficulty grows ~20% per year in bull markets. A deal that looks great today looks marginal in 12 months. Always stress-test at +20% difficulty.',
  },
  {
    mistake: 'Trusting unverified hosting claims',
    truth: 'Hosting providers routinely overstate uptime, understate fees, and use vague contract language. Get everything in writing and use a provider with a verifiable track record.',
  },
]

const UNIVERSITY_PREVIEWS = [
  { slug: 'what-is-bitcoin-mining', title: 'What Is Bitcoin Mining?', cat: 'Basics', time: '8 min' },
  { slug: 'is-bitcoin-mining-profitable', title: 'Is Bitcoin Mining Profitable?', cat: 'Profitability', time: '12 min' },
  { slug: 'hosted-bitcoin-mining-explained', title: 'Hosted Bitcoin Mining Explained', cat: 'Hosting', time: '10 min' },
  { slug: 'how-to-avoid-bad-mining-deals', title: 'How to Avoid Bad Mining Deals', cat: 'Red Flags', time: '9 min' },
]

function ROIPreview({ btcPrice, difficulty: difficultyProp }: { btcPrice: number | null; difficulty: number | null }) {
  const price = btcPrice || 100000
  const hashrate = 234
  const difficulty = difficultyProp || 113_757_508_517_000
  const blockReward = 3.125
  const poolFee = 0.01
  const hostingMonthly = 225

  const dailyBtc = (hashrate * 1e12 * 86400 * blockReward * (1 - poolFee)) / (difficulty * Math.pow(2, 32))
  const dailyGross = dailyBtc * price
  const dailyHosting = hostingMonthly / 30
  const dailyNet = dailyGross - dailyHosting
  const monthlyNet = dailyNet * 30
  const annualNet = dailyNet * 365

  return (
    <div className="rounded-2xl p-6 md:p-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h3 className="text-white font-bold text-lg">Sample ROI Preview</h3>
          <p className="text-sm text-gray-500">Antminer S21 Pro · $225/mo hosting · Live BTC price</p>
        </div>
        <Link
          href="/calculator"
          className="text-sm font-semibold px-4 py-2 rounded-lg"
          style={{ background: ORANGE, color: '#000' }}
        >
          Run Your Numbers →
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Daily Gross', val: `$${dailyGross.toFixed(2)}`, positive: true },
          { label: 'Daily Net', val: `$${dailyNet.toFixed(2)}`, positive: dailyNet > 0 },
          { label: 'Monthly Net', val: `$${monthlyNet.toFixed(0)}`, positive: monthlyNet > 0 },
          { label: 'Annual Net', val: `$${annualNet.toFixed(0)}`, positive: annualNet > 0 },
        ].map(s => (
          <div key={s.label} className="rounded-xl p-4" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className="font-bold font-mono" style={{ color: s.positive ? '#00d4aa' : '#ff4757' }}>
              {s.val}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-gray-600 mt-4">
        At ${price.toLocaleString()} BTC · {(difficulty / 1e12).toFixed(1)}T difficulty · 1% pool fee · $225/mo hosting ·{' '}
        <span style={{ color: ORANGE }}>Profitability changes daily — run your own numbers.</span>
      </p>
    </div>
  )
}

export default function PlatformPage() {
  const [btcPrice, setBtcPrice] = useState<number | null>(null)
  const [difficulty, setDifficulty] = useState<number | null>(null)
  const [email, setEmail] = useState('')
  const [emailSubmitted, setEmailSubmitted] = useState(false)
  const [emailSubmitting, setEmailSubmitting] = useState(false)

  useEffect(() => {
    fetch('/api/btc-price')
      .then(r => r.json())
      .then(d => {
      if (d.price) setBtcPrice(Number(d.price))
      if (d.difficulty) setDifficulty(Number(d.difficulty))
    })
      .catch(() => {})
  }, [])

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email) return
    setEmailSubmitting(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: '', email, lead_type: 'email_capture', form_data: { email } }),
      })
    } catch {
      // swallow errors — still show success
    } finally {
      setEmailSubmitted(true)
      setEmailSubmitting(false)
    }
  }

  const orgSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Lightning Mines',
    url: 'https://www.lightningmines.com',
    description: 'Independent Bitcoin mining intelligence — ROI calculator, hosting comparison, and deal reviews.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'contact@lightningmines.com',
      contactType: 'customer support',
    },
  }

  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Lightning Mines',
    url: 'https://www.lightningmines.com',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://www.lightningmines.com/miners?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  }

  return (
    <div style={{ background: '#0a0a0a' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      {/* Hero — cinematic full-bleed with mining rig background */}
      <section className="relative min-h-[600px] md:min-h-[680px] flex items-center justify-center overflow-hidden">
        <Image
          src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=80"
          alt="Bitcoin mining rigs in server racks"
          fill
          className="object-cover object-center"
          priority
          sizes="100vw"
        />
        {/* Dark overlay 60% */}
        <div className="absolute inset-0" style={{ background: 'rgba(10,10,10,0.62)' }} />
        {/* Lightning flash — diagonal white streak every 8s */}
        <div className="hero-lightning-flash absolute inset-0" />

        {/* Content */}
        <div className="relative z-20 max-w-5xl mx-auto px-4 py-20 text-center">
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-6"
            style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE, border: '1px solid rgba(247,147,26,0.35)' }}
          >
            ⚡ Independent Bitcoin Mining Intelligence
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Bitcoin Mining Profitability,<br />
            <span style={{ color: ORANGE }}>Hosting and Hardware</span><br />
            Made Simple
          </h1>

          <p className="text-lg md:text-xl max-w-2xl mx-auto mb-8 leading-relaxed" style={{ color: 'rgba(226,232,240,0.85)' }}>
            Lightning Mines helps you avoid bad Bitcoin mining deals. Free ROI calculator,
            verified hosting comparisons, and expert deal reviews — before you commit capital.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link href="/calculator" className="btn-gold-hero text-base font-bold px-8 py-4 rounded-xl w-full sm:w-auto">
              Calculate Mining ROI →
            </Link>
            <Link href="/review" className="btn-outline-hero text-base font-semibold px-8 py-4 rounded-xl w-full sm:w-auto">
              Get a Free Deal Review
            </Link>
          </div>
        </div>
      </section>

      {/* Affiliate disclosure */}
      <section className="pt-6 px-4">
        <div className="max-w-4xl mx-auto">
          <AffiliateDisclosure />
        </div>
      </section>

      {/* Trust Bar */}
      <section className="border-y py-8" style={{ borderColor: BORDER }}>
        <div className="max-w-4xl mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            {TRUST_STATS.map(s => (
              <div key={s.label}>
                <div className="text-2xl font-bold mb-1" style={{ color: ORANGE }}>{s.value}</div>
                <div className="text-sm text-gray-500">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Live Market Data — hashprice widget */}
      <section className="border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {[
              { label: 'BTC Price', value: btcPrice ? `$${btcPrice.toLocaleString()}` : '—', live: true },
              {
                label: 'Hashprice',
                value: btcPrice && difficulty ? `$${calcHashprice(btcPrice, difficulty).toFixed(2)}/PH/day` : '—',
                live: true,
              },
              {
                label: 'Network Hashrate',
                value: difficulty ? `~${(difficulty * 4294967296 / 600 / 1e18).toFixed(0)} EH/s` : '—',
                live: true,
              },
              { label: 'Next Halving', value: <>~<HalvingDays /></>, live: false },
            ].map(s => (
              <div key={s.label} className="rounded-xl p-4 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-center justify-center gap-1.5 mb-1">
                  <span className="text-xs text-gray-500">{s.label}</span>
                  {s.live && <span className="w-1.5 h-1.5 rounded-full" style={{ background: '#00d4aa', display: 'inline-block' }} />}
                </div>
                <div className="font-bold font-mono text-sm" style={{ color: ORANGE }}>{s.value}</div>
              </div>
            ))}
          </div>
          <div className="text-center">
            <Link href="/profitable" className="text-xs hover:underline" style={{ color: ORANGE }}>
              Is Bitcoin mining profitable right now? →
            </Link>
          </div>
        </div>
      </section>

      {/* Difficulty Adjustment + Hashprice History */}
      <section className="border-b" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-4 py-6">
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
            <div className="lg:col-span-2">
              <DifficultyWidget />
            </div>
            <div className="lg:col-span-3">
              <HashpriceChart />
            </div>
          </div>
        </div>
      </section>

      {/* ROI Preview */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-8">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">See What Mining Actually Earns</h2>
          <p className="text-gray-500">Live numbers. No marketing spin. Enter your own setup to get your exact ROI.</p>
        </div>
        <ROIPreview btcPrice={btcPrice} difficulty={difficulty} />
      </section>

      {/* How Lightning Mines Helps */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">How Lightning Mines Helps</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Three tools that give you an honest picture before you spend a dollar on mining.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {HOW_WE_HELP.map(item => (
            <div key={item.title} className="rounded-2xl p-6 flex flex-col" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="text-3xl mb-4">{item.icon}</div>
              <h3 className="text-white font-bold text-lg mb-2">{item.title}</h3>
              <p className="text-gray-400 text-sm flex-1 leading-relaxed mb-5">{item.body}</p>
              <Link
                href={item.link}
                className="text-sm font-semibold py-2.5 px-4 rounded-lg text-center"
                style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE, border: '1px solid rgba(247,147,26,0.25)' }}
              >
                {item.cta} →
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* Hosting Preview */}
      <section className="border-y py-16" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Our Top Hosting Pick</h2>
              <p className="text-gray-500">Verified. Transparent pricing. No hidden fees.</p>
            </div>
            <Link href="/hosting" className="text-sm font-semibold" style={{ color: ORANGE }}>
              Compare All Providers →
            </Link>
          </div>

          <div className="rounded-2xl p-6 md:p-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
              <div>
                <div
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-3"
                  style={{ background: 'rgba(247,147,26,0.15)', color: ORANGE, border: '1px solid rgba(247,147,26,0.3)' }}
                >
                  ⚡ #1 PICK
                </div>
                <h3 className="text-white text-xl font-bold">Abundant Mines</h3>
                <p className="text-gray-400 text-sm mt-1">Air-cooled, US-based, flat monthly fee — no per-kWh surprises</p>
              </div>
              <a
                href="https://abundantmines.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-semibold px-5 py-2.5 rounded-lg"
                style={{ background: ORANGE, color: '#000' }}
              >
                Visit Abundant Mines ↗
              </a>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Monthly Fee', value: '$225/miner' },
                { label: 'Setup Deposit', value: '$500' },
                { label: 'Cooling', value: 'Air' },
                { label: 'Min. Commitment', value: '1 machine' },
              ].map(stat => (
                <div key={stat.label} className="rounded-xl p-4" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
                  <div className="text-xs text-gray-500 mb-1">{stat.label}</div>
                  <div className="text-white font-semibold text-sm">{stat.value}</div>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-600 mt-4">
              Affiliate disclosure: Lightning Mines earns a commission if you sign up through our link. This does not affect our recommendation.
            </p>
          </div>
        </div>
      </section>

      {/* Avoid These Mining Mistakes */}
      <section className="max-w-5xl mx-auto px-4 py-16">
        <div className="text-center mb-10">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">Avoid These Mining Mistakes</h2>
          <p className="text-gray-500 max-w-xl mx-auto">
            Most mining losses are preventable. These are the six mistakes we see most often.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {MISTAKES.map((m, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
              <div className="flex items-start gap-3">
                <div
                  className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5"
                  style={{ background: 'rgba(255,71,87,0.15)', color: '#ff4757' }}
                >
                  ✕
                </div>
                <div>
                  <div className="text-white font-semibold text-sm mb-1">{m.mistake}</div>
                  <p className="text-gray-500 text-sm leading-relaxed">{m.truth}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <Link href="/review" className="inline-block text-sm font-semibold px-6 py-3 rounded-lg" style={{ background: ORANGE, color: '#000' }}>
            Get My Deal Reviewed Free →
          </Link>
        </div>
      </section>

      {/* University Preview */}
      <section className="border-t py-16" style={{ borderColor: BORDER }}>
        <div className="max-w-5xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Lightning Mines University</h2>
              <p className="text-gray-500">Free guides covering everything from basics to advanced strategy.</p>
            </div>
            <Link href="/university" className="text-sm font-semibold" style={{ color: ORANGE }}>
              All 12 Guides →
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {UNIVERSITY_PREVIEWS.map(a => (
              <Link
                key={a.slug}
                href={`/university/${a.slug}`}
                className="group flex items-center gap-4 rounded-xl p-4 transition-colors"
                style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium mb-1" style={{ color: ORANGE }}>{a.cat}</div>
                  <div className="text-sm font-semibold text-white leading-snug">{a.title}</div>
                </div>
                <div className="text-xs text-gray-600 whitespace-nowrap">{a.time}</div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Email Capture */}
      <section className="border-t py-16" style={{ borderColor: BORDER }}>
        <div className="max-w-2xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-3">
            Get the Free Mining ROI Spreadsheet
          </h2>
          <p className="text-gray-500 mb-8">
            Model your exact setup with BTC price scenarios, difficulty growth, and breakeven analysis built in.
          </p>

          {emailSubmitted ? (
            <div className="rounded-xl p-6 text-center" style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.2)' }}>
              <div className="text-2xl mb-2">✓</div>
              <p className="text-white font-semibold">Check your inbox!</p>
              <p className="text-sm text-gray-400 mt-1">The spreadsheet is on its way.</p>
            </div>
          ) : (
            <form onSubmit={handleEmailSubmit} className="flex gap-3 max-w-md mx-auto">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 rounded-lg px-4 py-3 text-sm outline-none"
                style={{ background: CARD_BG, border: `1px solid ${BORDER}`, color: 'white' }}
              />
              <button
                type="submit"
                disabled={emailSubmitting}
                className="text-sm font-bold px-5 py-3 rounded-lg whitespace-nowrap"
                style={{ background: ORANGE, color: '#000' }}
              >
                {emailSubmitting ? '...' : 'Get It Free'}
              </button>
            </form>
          )}
          <p className="text-xs text-gray-600 mt-3">No spam. Unsubscribe anytime.</p>
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div
          className="rounded-2xl p-8 md:p-12 text-center"
          style={{ background: 'linear-gradient(135deg, rgba(247,147,26,0.08) 0%, rgba(0,0,0,0) 100%)', border: '1px solid rgba(247,147,26,0.2)' }}
        >
          <h2 className="text-2xl md:text-4xl font-bold text-white mb-4">Know Before You Mine</h2>
          <p className="text-gray-400 mb-8 max-w-xl mx-auto">
            Run your ROI in 60 seconds, compare verified hosting, or submit your deal for a free expert review. All free. No credit card.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/calculator" className="btn-gold-hero text-base font-bold px-8 py-4 rounded-xl">
              Calculate ROI →
            </Link>
            <Link href="/review" className="btn-outline-hero text-base font-semibold px-8 py-4 rounded-xl">
              Free Deal Review
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
