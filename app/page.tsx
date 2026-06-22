'use client'

import { Fragment, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { useGSAP } from '@gsap/react'
import Calculator from '@/components/Calculator'
import HostingTable from '@/components/HostingTable'
import MinerShowcase from '@/components/MinerShowcase'
import AnimatedStats from '@/components/AnimatedStats'
import AnimatedCounter from '@/components/AnimatedCounter'
import { HostingProvider } from '@/lib/types'
import { MINERS_DATA, PROVIDERS_DATA } from '@/lib/data'
import { ARTICLES } from '@/lib/articles'

gsap.registerPlugin(ScrollTrigger, useGSAP)

const DIFFICULTY   = 113_757_508_517_000
const BLOCK_REWARD = 3.125
const DAYS_TO_HALVING = Math.ceil((new Date('2028-04-01').getTime() - Date.now()) / (1000 * 60 * 60 * 24))

export default function HomePage() {
  const [mounted, setMounted]     = useState(false)
  const [providers, setProviders] = useState<HostingProvider[]>([])
  const [btcLive, setBtcLive]     = useState<number | null>(null)
  const [btcError, setBtcError]   = useState(false)
  const [heroEmail, setHeroEmail]       = useState('')
  const [heroSubmitted, setHeroSubmitted] = useState(false)
  const [heroSubmitting, setHeroSubmitting] = useState(false)

  const heroRef    = useRef<HTMLDivElement>(null)
  const mainRef    = useRef<HTMLDivElement>(null)

  const fetchBtcPrice = useCallback(() => {
    fetch('/api/btc-price')
      .then(r => r.json())
      .then(d => { if (d.price) { setBtcLive(Number(d.price)); setBtcError(false) } else setBtcError(true) })
      .catch(() => setBtcError(true))
  }, [])

  useEffect(() => {
    setMounted(true)
    fetch('/api/providers').then(r => r.json()).then(d => setProviders(d.providers || []))
    fetch('/api/analytics', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'page_view', page: '/' }) }).catch(() => {})
    fetchBtcPrice()
    const iv = setInterval(fetchBtcPrice, 60_000)
    return () => clearInterval(iv)
  }, [fetchBtcPrice])

  // ── GSAP hero animate-in ─────────────────────────────────────────────────
  useGSAP(() => {
    const tl = gsap.timeline({ delay: 0.2 })
    tl.from('.hero-line-1', { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out' })
      .from('.hero-line-2', { y: 40, opacity: 0, duration: 0.9, ease: 'power3.out' }, '-=0.65')
      .from('.hero-sub',    { y: 20, opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.5')
      .from('.hero-badge',  { opacity: 0, duration: 0.5, ease: 'power1.out' }, '-=0.8')
      .from('.hero-buttons',{ y: 20, opacity: 0, duration: 0.6, ease: 'power2.out' }, '-=0.4')
      .from('.hero-stats',  { y: 16, opacity: 0, duration: 0.5, ease: 'power2.out' }, '-=0.3')
  }, { scope: heroRef })

  // ── GSAP scroll animations ────────────────────────────────────────────────
  useGSAP(() => {
    // All .gsap-reveal sections
    ScrollTrigger.batch('.gsap-reveal', {
      start: 'top 88%',
      once: true,
      onEnter: (elements) => {
        gsap.to(elements, {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          stagger: 0.08,
          clearProps: 'transform',
        })
      },
    })

    // How It Works cards — stagger left → center → right
    gsap.from('.how-step', {
      opacity: 0,
      y: 40,
      scale: 0.95,
      duration: 0.7,
      ease: 'power2.out',
      stagger: 0.2,
      scrollTrigger: { trigger: '.how-section', start: 'top 82%', once: true },
    })

    // Tool cards
    gsap.from('.tool-card', {
      opacity: 0,
      y: 30,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.1,
      scrollTrigger: { trigger: '.tools-section', start: 'top 82%', once: true },
    })

    // Miner cards
    gsap.from('.miner-list-card', {
      opacity: 0,
      y: 30,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.12,
      scrollTrigger: { trigger: '.miners-section', start: 'top 82%', once: true },
    })

    // University cards
    gsap.from('.uni-card', {
      opacity: 0,
      y: 30,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.1,
      scrollTrigger: { trigger: '.uni-section', start: 'top 82%', once: true },
    })
  }, { scope: mainRef })

  const handleAffiliateClick = (provider: HostingProvider) => {
    if (!provider.website) return
    fetch('/api/track-click', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider_name: provider.name, destination_url: provider.affiliate_url ?? provider.website, source_page: '/', cooling_type_context: provider.supported_cooling?.join(',') }),
    }).catch(() => {})
  }

  async function handleHeroEmail(e: React.FormEvent) {
    e.preventDefault()
    if (!heroEmail) return
    setHeroSubmitting(true)
    try {
      await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: heroEmail, lead_type: 'email_capture', source: 'homepage_hero' }) })
      setHeroSubmitted(true)
    } catch { setHeroSubmitted(true) } finally { setHeroSubmitting(false) }
  }

  const topMiners      = [...MINERS_DATA].filter(m => m.cooling_type === 'air' && m.is_active).sort((a, b) => (a.efficiency_j_per_th ?? 99) - (b.efficiency_j_per_th ?? 99)).slice(0, 3)
  const topHosts       = PROVIDERS_DATA.filter(p => p.is_active).sort((a, b) => a.sort_order - b.sort_order).slice(0, 3)
  const featuredArticles = ARTICLES.slice(0, 3)
  const totalMiners    = MINERS_DATA.length

  return (
    <div ref={mainRef}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify([
        {
          '@context': 'https://schema.org', '@type': 'WebApplication',
          name: 'LMC Mining Intelligence — Bitcoin Mining Profitability Calculator',
          description: 'The independent Bitcoin mining intelligence platform. Free profitability calculator, deal analyzer, miner comparisons, hosting reviews, and live data.',
          applicationCategory: 'FinanceApplication', operatingSystem: 'Web',
          offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        },
        {
          '@context': 'https://schema.org', '@type': 'Organization',
          name: 'LMC Mining Intelligence',
          url: 'https://lmc-mining.vercel.app',
          logo: 'https://lmc-mining.vercel.app/favicon.ico',
          description: 'Independent Bitcoin mining intelligence platform. Hardware comparisons, hosting reviews, profitability analysis, and live data.',
          founder: { '@type': 'Person', name: 'Jacob H.' },
          foundingDate: '2024',
          areaServed: 'Worldwide',
          contactPoint: { '@type': 'ContactPoint', contactType: 'Customer Support', email: 'hello@lmcmining.com' },
        },
        {
          '@context': 'https://schema.org', '@type': 'WebSite',
          name: 'LMC Mining Intelligence',
          url: 'https://lmc-mining.vercel.app',
          potentialAction: {
            '@type': 'SearchAction',
            target: { '@type': 'EntryPoint', urlTemplate: 'https://lmc-mining.vercel.app/miners?q={search_term_string}' },
            'query-input': 'required name=search_term_string',
          },
        },
      ]) }} />

      {/* ═══════════════════════════════════════════════════
          HERO — Lightning Storm
          ═══════════════════════════════════════════════════ */}
      <section
        ref={heroRef}
        className="relative flex flex-col items-center justify-center text-center overflow-hidden"
        style={{ minHeight: '100dvh', marginTop: '-64px', paddingTop: '64px', background: '#000000' }}
      >
        {/* Warm gold radial glow over storm */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: 'radial-gradient(ellipse 70% 50% at 50% 20%, rgba(245,158,11,0.09) 0%, transparent 65%)',
        }} />

        {/* Text overlay */}
        <div className="relative z-10 w-full max-w-5xl mx-auto px-6">

          {/* Badge */}
          <div className="hero-badge mb-6 inline-flex items-center gap-2 text-xs px-4 py-1.5 rounded-full" style={{ background: 'rgba(245,158,11,0.08)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)', letterSpacing: '0.1em', fontWeight: 600 }}>
            ⚡ INDEPENDENT · NO PAID RANKINGS · BUILT FOR MINERS ⚡
          </div>

          {/* Headline */}
          <div>
            <h1 style={{ margin: 0 }}>
              <span
                className="hero-line-1 block"
                style={{
                  fontSize: 'clamp(3.5rem, 7vw, 6.5rem)',
                  fontWeight: 900,
                  lineHeight: 0.95,
                  letterSpacing: '-0.03em',
                  color: '#ffffff',
                  textShadow: '0 0 40px rgba(245,158,11,0.4), 0 0 80px rgba(245,158,11,0.2)',
                }}
              >
                The Intelligence Layer
              </span>
              <span
                className="hero-line-2 block"
                style={{
                  fontSize: 'clamp(3.5rem, 7vw, 6.5rem)',
                  fontWeight: 900,
                  lineHeight: 1.0,
                  letterSpacing: '-0.03em',
                  background: 'linear-gradient(135deg, #f59e0b, #fbbf24, #d97706)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  marginTop: '0.05em',
                  textShadow: '0 0 60px rgba(245,158,11,0.6)',
                }}
              >
                for Bitcoin Mining
              </span>
            </h1>
          </div>

          {/* Subheadline */}
          <p
            className="hero-sub"
            style={{ maxWidth: '500px', margin: '1.75rem auto 0', fontSize: '1.1rem', color: '#94a3b8', lineHeight: 1.6 }}
          >
            Independent data. No sponsored rankings. Built for miners who do their own math.
          </p>

          {/* CTA buttons */}
          <div className="hero-buttons flex flex-wrap items-center justify-center gap-4 mt-10">
            <Link
              href="/deal-analyzer"
              className="btn-gold-hero rounded-xl"
              style={{
                padding: '18px 48px',
                fontSize: '1.05rem',
                fontWeight: 700,
                boxShadow: '0 0 30px rgba(245,158,11,0.35), 0 0 60px rgba(245,158,11,0.15)',
              }}
            >
              ⚡ Analyze Your Deal →
            </Link>
            <Link
              href="/miners"
              className="btn-outline-hero rounded-xl"
              style={{ padding: '16px 32px', fontSize: '1rem' }}
            >
              Explore Hardware
            </Link>
          </div>

          {/* Stats bar */}
          <div className="hero-stats mt-14" style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '32px' }}>
            <div className="hidden sm:flex items-center justify-center">
              {[
                { label: 'BTC Price', node: !mounted ? <span style={{ fontSize: '1rem', color: '#4b5563' }}>---</span> : btcError ? <span style={{ fontSize: '1rem', color: '#4b5563' }}>Unavailable</span> : btcLive === null ? <span className="animate-pulse" style={{ fontSize: '1rem', color: '#4b5563' }}>Loading…</span> : <AnimatedCounter end={btcLive} prefix="$" decimals={0} duration={1500} delay={800} /> },
                { label: 'Miners in DB',    node: <AnimatedCounter end={totalMiners}     decimals={0} duration={1500} delay={800} /> },
                { label: 'Days to Halving', node: <AnimatedCounter end={DAYS_TO_HALVING} decimals={0} duration={1500} delay={800} /> },
                { label: 'Top Efficiency',  node: <AnimatedCounter end={13.5} suffix=" J/TH" decimals={1} duration={1500} delay={800} /> },
              ].map((stat, i) => (
                <Fragment key={stat.label}>
                  {i > 0 && <div style={{ width: '1px', height: '2rem', background: 'rgba(255,255,255,0.1)', margin: '0 36px', flexShrink: 0 }} />}
                  <div className="text-center">
                    <div style={{ color: '#64748b', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '6px' }}>{stat.label}</div>
                    <div style={{ color: '#ffffff', fontSize: '1.5rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{stat.node}</div>
                  </div>
                </Fragment>
              ))}
            </div>
            <div className="sm:hidden grid grid-cols-2 gap-6">
              {[
                { label: 'BTC Price', val: !mounted ? '---' : btcError ? '—' : btcLive === null ? '…' : `$${btcLive.toLocaleString()}` },
                { label: 'Miners in DB', val: `${totalMiners}` },
                { label: 'Days to Halving', val: `${DAYS_TO_HALVING}` },
                { label: 'Top Efficiency', val: '13.5 J/TH' },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div style={{ color: '#64748b', fontSize: '0.65rem', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '4px' }}>{s.label}</div>
                  <div style={{ color: '#ffffff', fontSize: '1.25rem', fontWeight: 700 }}>{s.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2" style={{ opacity: 0.4 }}>
          <span className="chevron-bounce" style={{ fontSize: '1.5rem', color: '#9ca3af' }}>›</span>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          EMAIL CAPTURE SECTION
          ═══════════════════════════════════════════════════ */}
      <section style={{ background: 'rgba(255,255,255,0.02)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div className="max-w-xl mx-auto px-4 py-10 text-center">
          <h2 className="text-xl font-bold text-white mb-2">Get the Free Mining ROI Spreadsheet</h2>
          <p className="text-sm text-gray-400 mb-6">The exact framework for evaluating any mining deal — plug in any miner, any hosting rate, see your real ROI.</p>
          {heroSubmitted ? (
            <div className="inline-flex items-center gap-2 text-sm px-5 py-3 rounded-xl" style={{ background: 'rgba(0,212,170,0.12)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.3)' }}>
              <span>✓</span> It&apos;s on its way — check your inbox.
            </div>
          ) : (
            <form onSubmit={handleHeroEmail} className="flex gap-2 max-w-sm mx-auto">
              <input
                type="email"
                value={heroEmail}
                onChange={e => setHeroEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="flex-1 min-w-0 text-sm px-4 rounded-xl text-white focus:outline-none"
                style={{ height: '48px', background: '#111827', border: '1px solid #374151', color: '#ffffff', caretColor: '#f59e0b' }}
                onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
                onBlur={e => (e.target.style.borderColor = '#374151')}
              />
              <button type="submit" disabled={heroSubmitting}
                className="text-sm font-bold px-5 rounded-xl whitespace-nowrap shrink-0 btn-gold"
                style={{ height: '48px', opacity: heroSubmitting ? 0.7 : 1 }}>
                {heroSubmitting ? 'Sending…' : 'Send It Free →'}
              </button>
            </form>
          )}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          ANIMATED STATS (Task 5)
          ═══════════════════════════════════════════════════ */}
      <AnimatedStats btcLive={btcLive} />

      {/* ═══════════════════════════════════════════════════
          HORIZONTAL MINER SHOWCASE (Task 4)
          ═══════════════════════════════════════════════════ */}
      <MinerShowcase btcLive={btcLive} />

      {/* ═══════════════════════════════════════════════════
          TRUST BAR
          ═══════════════════════════════════════════════════ */}
      <div className="gsap-reveal border-y overflow-x-auto" style={{ background: '#0d1117', borderColor: '#1a2332', opacity: 0, transform: 'translateY(30px)' }}>
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-center gap-6 md:gap-10 text-xs whitespace-nowrap flex-wrap" style={{ color: '#475569' }}>
            {['5 Verified Hosting Providers', `${totalMiners} Miners Analysed`, '20 Educational Articles', 'Independent Data', 'No Paid Placements'].map((item, i) => (
              <span key={i} className="flex items-center gap-2">
                <span style={{ color: '#f59e0b' }}>◆</span>{item}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════
          SOCIAL PROOF
          ═══════════════════════════════════════════════════ */}
      <div className="gsap-reveal" style={{ background: '#0d1117', borderBottom: '1px solid #1a2332', opacity: 0, transform: 'translateY(30px)' }}>
        <div className="max-w-5xl mx-auto px-4 py-14">
          <div className="flex flex-wrap justify-center gap-x-12 gap-y-6 mb-14">
            {[
              { value: '71',   label: 'Pages of Independent\nMining Data' },
              { value: '$200', label: 'Average Commission\nPer Machine Deployed' },
              { value: '20',   label: 'In-Depth\nEducational Articles' },
              { value: `${totalMiners}`, label: 'Miners Analysed\nwith Real Specs' },
              { value: '0',   label: 'Paid Placements.\nEver.' },
            ].map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-3xl font-bold" style={{ color: '#f59e0b' }}>{stat.value}</div>
                <div className="text-xs text-gray-500 mt-1 leading-tight whitespace-pre-line max-w-[110px] mx-auto">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="text-center mb-8"><h2 className="text-xl font-bold text-white">Why Miners Trust LMC</h2></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              { icon: '📊', title: 'Real Data', desc: 'Every spec, price, and efficiency figure is sourced from manufacturers, hosting contracts, or on-chain data. Nothing is estimated or AI-generated.' },
              { icon: '🔗', title: 'Disclosed Relationships', desc: 'We earn affiliate commissions from hosting providers we recommend. Every relationship is disclosed. It never affects our rankings or analysis.' },
              { icon: '🧮', title: 'Professional Math', desc: 'The same mining formulas institutional miners use — hashprice, difficulty-adjusted ROI, breakeven analysis. No simplified black-box calculators.' },
            ].map(item => (
              <div key={item.title} className="rounded-xl p-5 flex items-start gap-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="text-xl flex-shrink-0 mt-0.5">{item.icon}</div>
                <div>
                  <div className="text-sm font-semibold text-white mb-1">{item.title}</div>
                  <p className="text-xs text-gray-400 leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4">

        {/* ═══════════════════════════════════════════════════
            CALCULATOR
            ═══════════════════════════════════════════════════ */}
        <div className="gsap-reveal py-16" style={{ opacity: 0, transform: 'translateY(60px)' }}>
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-white mb-2">Profitability Calculator</h2>
            <p className="text-gray-500">Is your mining deal actually profitable? Enter your numbers and find out.</p>
          </div>
          <div className="rounded-2xl p-6 md:p-8" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <Calculator />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            HOW IT WORKS
            ═══════════════════════════════════════════════════ */}
        <div className="how-section py-4 mb-16">
          <div className="gsap-reveal text-center mb-10" style={{ opacity: 0, transform: 'translateY(30px)' }}>
            <h2 className="text-2xl font-bold text-white mb-2">How It Works</h2>
            <p className="text-gray-500 text-sm">Three steps to a data-backed mining decision</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { step: '01', title: 'Research Hardware', desc: 'Compare all major ASICs by efficiency (J/TH), hashrate, and ROI. Find the right miner for your budget.', href: '/miners', cta: 'Compare Miners →' },
              { step: '02', title: 'Find Hosting', desc: 'Compare verified hosting providers by price, cooling type, and features. No paid placements.', href: '/hosts', cta: 'Compare Hosts →' },
              { step: '03', title: 'Analyze Your Deal', desc: 'Score any hardware + hosting combination across 5 dimensions. Get a STRONG/DECENT/AVOID verdict.', href: '/deal-analyzer', cta: 'Run Analysis →' },
            ].map((s) => (
              <div key={s.step} className="how-step rounded-2xl p-6 h-full flex flex-col" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="text-3xl font-bold font-mono mb-4" style={{ color: 'rgba(245,158,11,0.25)' }}>{s.step}</div>
                <div className="text-base font-bold text-white mb-2">{s.title}</div>
                <p className="text-sm text-gray-400 flex-1 mb-4">{s.desc}</p>
                <Link href={s.href} className="text-xs font-semibold" style={{ color: '#f59e0b' }}>{s.cta}</Link>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            FEATURED TOOLS
            ═══════════════════════════════════════════════════ */}
        <div className="tools-section mb-16">
          <div className="gsap-reveal text-center mb-8" style={{ opacity: 0, transform: 'translateY(30px)' }}>
            <h2 className="text-2xl font-bold text-white mb-2">Free Mining Intelligence Tools</h2>
            <p className="text-gray-500 text-sm">Everything you need to evaluate and optimize your mining operation</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            {[
              { icon: '🔍', title: 'Deal Analyzer', desc: 'Score any hardware + hosting deal across 5 dimensions. Get a verdict before you commit.', href: '/deal-analyzer', cta: 'Analyze Deal', gold: true },
              { icon: '⚡', title: 'Live Data', desc: 'Real-time hashprice, difficulty, and profitability for all major miners at any BTC price.', href: '/data', cta: 'View Data', gold: false },
              { icon: '⚙️', title: 'Miner Comparison', desc: 'Compare up to 3 miners side by side. Find the winner on efficiency, hashrate, and ROI.', href: '/miners/compare', cta: 'Compare Miners', gold: false },
              { icon: '🏗️', title: 'Hosting Comparison', desc: 'Side-by-side comparison of verified hosting providers. Find the best rate for your setup.', href: '/hosts/compare', cta: 'Compare Hosts', gold: false },
            ].map(t => (
              <div key={t.href} className="tool-card rounded-2xl p-5 flex flex-col" style={{ background: '#111827', border: `1px solid ${t.gold ? 'rgba(245,158,11,0.3)' : '#1f2937'}` }}>
                <div className="text-2xl mb-3">{t.icon}</div>
                <div className="text-base font-semibold text-white mb-2">{t.title}</div>
                <p className="text-xs text-gray-400 flex-1 mb-4">{t.desc}</p>
                <Link href={t.href} className={`text-xs font-semibold px-4 py-2 rounded-lg text-center ${t.gold ? 'btn-gold' : ''}`}
                  style={t.gold ? {} : { background: '#1f2937', color: '#00d4aa' }}>
                  {t.cta} →
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            TOP MINERS
            ═══════════════════════════════════════════════════ */}
        <div className="miners-section mb-16">
          <div className="gsap-reveal flex items-center justify-between mb-6" style={{ opacity: 0, transform: 'translateY(30px)' }}>
            <div>
              <h2 className="text-2xl font-bold text-white">Best Miners of 2026</h2>
              <p className="text-gray-500 text-sm mt-1">Ranked by efficiency (J/TH) — the metric that matters most</p>
            </div>
            <Link href="/miners" className="text-sm text-gray-400 hover:text-white transition-colors">View all →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {topMiners.map((m, i) => {
              const dailyBtc = (m.default_hashrate_th * 1e12 * 86400 * BLOCK_REWARD) / (DIFFICULTY * Math.pow(2, 32))
              const dailyNet = btcLive !== null ? dailyBtc * btcLive - (225 / 30) : null
              const eff = m.efficiency_j_per_th ?? (m.power_watts / m.default_hashrate_th)
              return (
                <div key={m.slug} className="miner-list-card rounded-2xl p-5 h-full" style={{ background: '#111827', border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.35)' : '#1f2937'}` }}>
                  {i === 0 && <div className="text-xs font-semibold mb-3 px-2 py-0.5 rounded inline-block" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>BEST OVERALL</div>}
                  <Link href={`/miners/${m.slug}`} className="text-base font-bold text-white hover:text-amber-400 transition-colors block mb-3">{m.name}</Link>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-lg p-2.5 text-center" style={{ background: '#0a0e17' }}>
                      <div className="text-xs text-gray-500">Hashrate</div>
                      <div className="text-sm font-bold text-white">{m.default_hashrate_th} TH/s</div>
                    </div>
                    <div className="rounded-lg p-2.5 text-center" style={{ background: '#0a0e17' }}>
                      <div className="text-xs text-gray-500">Efficiency</div>
                      <div className="text-sm font-bold" style={{ color: eff < 15 ? '#f59e0b' : eff < 18 ? '#00d4aa' : '#fbbf24' }}>{eff.toFixed(1)} J/TH</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">{dailyNet !== null && btcLive !== null ? `~$${dailyNet.toFixed(0)}/day net at $${(btcLive / 1000).toFixed(0)}k BTC` : '—'}</span>
                    <Link href={`/miners/${m.slug}`} className="font-medium" style={{ color: '#f59e0b' }}>Review →</Link>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            TOP HOSTS
            ═══════════════════════════════════════════════════ */}
        <div className="gsap-reveal mb-16" style={{ opacity: 0, transform: 'translateY(60px)' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Verified Hosting Providers</h2>
              <p className="text-gray-500 text-sm mt-1">All providers independently verified. No paid placements.</p>
            </div>
            <Link href="/hosts" className="text-sm text-gray-400 hover:text-white transition-colors">View all →</Link>
          </div>
          <div className="space-y-3 mb-4">
            {topHosts.map((p, i) => (
              <div key={p.slug} className="rounded-xl p-4 flex items-center gap-4" style={{ background: '#111827', border: `1px solid ${i === 0 ? 'rgba(245,158,11,0.25)' : '#1f2937'}` }}>
                <div className="text-2xl font-bold text-gray-700 w-8 font-mono">#{i + 1}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/hosts/${p.slug}`} className="text-sm font-semibold text-white hover:text-amber-400 transition-colors">{p.name}</Link>
                    {p.verification_status === 'verified' && <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ background: '#00d4aa15', color: '#00d4aa' }}>✓ Verified</span>}
                  </div>
                  <div className="text-xs text-gray-500 mt-0.5">{p.locations?.slice(0, 2).join(' · ')}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-white">{p.monthly_fee_air ? `$${p.monthly_fee_air}/mo` : p.electricity_rate_kwh ? `$${p.electricity_rate_kwh}/kWh` : 'Contact'}</div>
                  <div className="text-xs text-gray-500">{p.monthly_fee_air ? 'flat fee' : p.electricity_rate_kwh ? 'per kWh' : 'required'}</div>
                </div>
                <a href={p.affiliate_url ?? p.website ?? `/hosts/${p.slug}`} target={p.affiliate_url ? '_blank' : undefined} rel={p.affiliate_url ? 'noopener noreferrer' : undefined}
                  className="text-xs font-medium px-3 py-1.5 rounded-lg"
                  style={{ background: i === 0 ? 'rgba(245,158,11,0.15)' : '#1f2937', color: i === 0 ? '#f59e0b' : '#00d4aa' }}>
                  {p.affiliate_url ? 'Get Started →' : 'View →'}
                </a>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            FULL HOSTING TABLE
            ═══════════════════════════════════════════════════ */}
        <div className="gsap-reveal mb-16" style={{ opacity: 0, transform: 'translateY(60px)' }}>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-white">Full Hosting Comparison</h2>
              <p className="text-gray-400 text-sm mt-1">All providers independently verified. Unverified claims are labeled.</p>
            </div>
          </div>
          {providers.length > 0 ? (
            <HostingTable providers={providers} onAffiliateClick={handleAffiliateClick} />
          ) : (
            <div className="rounded-2xl p-8 text-center text-gray-500" style={{ background: '#111827', border: '1px solid #1f2937' }}>Loading providers...</div>
          )}
        </div>

        {/* ═══════════════════════════════════════════════════
            UNIVERSITY
            ═══════════════════════════════════════════════════ */}
        <div className="uni-section mb-16">
          <div className="gsap-reveal flex items-center justify-between mb-6" style={{ opacity: 0, transform: 'translateY(30px)' }}>
            <div>
              <h2 className="text-2xl font-bold text-white">Mining University</h2>
              <p className="text-gray-500 text-sm mt-1">Free guides for beginner to advanced operators</p>
            </div>
            <Link href="/university" className="text-sm text-gray-400 hover:text-white transition-colors">All {ARTICLES.length} guides →</Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredArticles.map((a, i) => (
              <Link key={a.slug} href={`/university/${a.slug}`} className="uni-card group rounded-2xl p-5 block h-full" style={{ background: '#111827', border: '1px solid #1f2937', textDecoration: 'none' }}>
                <div className="text-xs font-medium mb-2 px-2 py-0.5 rounded-full inline-block" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>{a.category}</div>
                <h3 className="text-sm font-semibold text-white mb-2 group-hover:text-amber-400 transition-colors leading-snug">{a.title}</h3>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-gray-500">{a.reading_time_minutes} min read</span>
                  <span className="text-xs" style={{ color: '#f59e0b' }}>Read →</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════
            TRUST SIGNALS
            ═══════════════════════════════════════════════════ */}
        <div className="gsap-reveal mb-16" style={{ opacity: 0, transform: 'translateY(60px)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: '✓', title: 'Verified Data Only', desc: 'No fabricated pricing or specs. All claims from primary sources. Unverified claims always labeled.' },
              { icon: '⚙️', title: 'Air, Hydro & Immersion', desc: 'Industrial mining is moving to hydro and immersion. We cover all three cooling types end to end.' },
              { icon: '🎯', title: 'Honest Recommendations', desc: "We never recommend a setup that doesn't pass our profitability analysis. Transparent affiliate disclosures." },
            ].map((item) => (
              <div key={item.title} className="rounded-xl p-6 h-full" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="text-2xl mb-3 font-bold" style={{ color: '#f59e0b' }}>{item.icon}</div>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-sm text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
