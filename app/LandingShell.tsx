'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
const ElectricalArc = dynamic(() => import('@/components/ElectricalArc'), { ssr: false })
import MiningBackground from '@/components/MiningBackground'

const NAV_LINKS = [
  { href: '/platform', label: 'Platform' },
  { href: '/hosting', label: 'Hosting' },
  { href: '/miners', label: 'Miners' },
  { href: '/university', label: 'University' },
  { href: '/audit', label: 'Audit' },
]

export default function LandingShell() {
  return (
    <MiningBackground
      overlay={0.74}
      className="min-h-screen flex flex-col"
    >
      <ElectricalArc />

      {/* Minimal nav */}
      <nav className="relative z-20 flex items-center justify-between px-6 md:px-12 py-6">
        <div className="flex items-center gap-2">
          <span style={{ color: '#f7931a', fontSize: '1.1rem', fontWeight: 700 }}>⚡</span>
          <span className="text-white font-bold text-sm tracking-wide">Lightning Mines</span>
        </div>
        <div className="hidden md:flex items-center gap-6">
          {NAV_LINKS.map(l => (
            <Link
              key={l.href}
              href={l.href}
              className="text-xs font-medium text-gray-400 hover:text-white transition-colors"
            >
              {l.label}
            </Link>
          ))}
        </div>
      </nav>

      {/* Hero content — vertically centered */}
      <div className="relative z-20 flex-1 flex flex-col items-center justify-center text-center px-6 py-20">

        {/* Eyebrow */}
        <div
          className="landing-headline inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-8"
          style={{ background: 'rgba(247,147,26,0.12)', color: '#f7931a', border: '1px solid rgba(247,147,26,0.3)' }}
        >
          Independent Bitcoin Mining Intelligence
        </div>

        {/* Headline */}
        <h1
          className="landing-headline text-5xl md:text-7xl font-black text-white mb-6 leading-none tracking-tight"
          style={{ letterSpacing: '-0.03em', textShadow: '0 2px 40px rgba(0,0,0,0.6)' }}
        >
          The Bloomberg<br />
          <span style={{ color: '#f7931a' }}>of Bitcoin Mining</span>
        </h1>

        {/* Subline */}
        <p
          className="landing-sub text-base md:text-lg max-w-xl mx-auto mb-12 leading-relaxed"
          style={{ color: 'rgba(226,232,240,0.78)', textShadow: '0 1px 10px rgba(0,0,0,0.5)' }}
        >
          Independent data. No sponsored rankings. No marketing math.<br />
          ROI calculators, verified hosting, and expert deal reviews — before you commit capital.
        </p>

        {/* CTA */}
        <div className="landing-cta flex flex-col sm:flex-row items-center gap-4">
          <Link
            href="/platform"
            className="btn-gold-hero text-sm font-bold px-8 py-4 rounded-xl"
          >
            Explore the Platform →
          </Link>
          <Link
            href="/calculator"
            className="btn-outline-hero text-sm font-medium px-8 py-4 rounded-xl"
          >
            Run Free ROI Calculator
          </Link>
        </div>

        {/* Live indicators */}
        <div className="landing-cta flex items-center gap-6 mt-10 text-xs text-gray-500">
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#00d4aa' }} />
            Live hashprice data
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#f7931a' }} />
            Verified hosting providers
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: '#9ca3af' }} />
            No sponsored content
          </div>
        </div>
      </div>

      {/* Bottom scroll hint */}
      <div className="relative z-20 flex justify-center pb-8">
        <Link
          href="/platform"
          className="text-gray-600 hover:text-gray-400 transition-colors"
          aria-label="Scroll to explore"
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="chevron-bounce">
            <path d="M4 7l6 6 6-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
    </MiningBackground>
  )
}
