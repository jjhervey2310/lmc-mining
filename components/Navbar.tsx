'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { SITE_NAME } from '@/lib/constants'
import { lightningEngine } from '@/lib/lightning-engine'

const NAV_LINKS = [
  { href: '/miners', label: 'Hardware', badge: null },
  { href: '/hosts', label: 'Hosting', badge: null },
  { href: '/deal-analyzer', label: 'Deal Analyzer', badge: null },
  { href: '/audit', label: 'Audits', badge: 'NEW' },
  { href: '/data', label: 'Live Data', badge: null },
  { href: '/university', label: 'University', badge: null },
  { href: '/glossary', label: 'Glossary', badge: null },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()
  const router = useRouter()
  const isHome = pathname === '/'

  const navStyle = isHome
    ? { background: 'rgba(0,0,0,0.15)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)', borderBottomColor: 'rgba(255,255,255,0.06)' }
    : { background: '#0a0e17', borderBottomColor: '#1f2937' }

  const handleNavClick = (e: React.MouseEvent, href: string) => {
    e.preventDefault()
    lightningEngine.fireBoltsAt(e.clientX, e.clientY, 3)
    setTimeout(() => router.push(href), 150)
  }

  const handleMobileNavClick = (e: React.MouseEvent, href: string) => {
    setMobileOpen(false)
    handleNavClick(e, href)
  }

  return (
    <nav className="border-b sticky top-0 z-50" style={navStyle}>
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0" onClick={(e) => handleNavClick(e, '/')}>
            <span className="text-xl font-bold" style={{ color: '#f59e0b' }}>⛏</span>
            <span className="font-bold text-white text-lg">{SITE_NAME}</span>
          </Link>

          <div className="hidden lg:flex items-center gap-5">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm text-gray-400 hover:text-white transition-colors whitespace-nowrap flex items-center gap-1.5"
                onClick={(e) => handleNavClick(e, l.href)}
              >
                {l.label}
                {l.badge && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(245,158,11,0.2)', color: '#f59e0b' }}>{l.badge}</span>
                )}
              </Link>
            ))}
            <Link
              href="/about"
              className="text-sm text-gray-400 hover:text-white transition-colors"
              onClick={(e) => handleNavClick(e, '/about')}
            >
              About
            </Link>
            <Link
              href="/deal-analyzer"
              className="text-sm font-semibold px-4 py-2 rounded-lg transition-colors whitespace-nowrap btn-gold"
              onClick={(e) => handleNavClick(e, '/deal-analyzer')}
            >
              Analyze My Deal
            </Link>
          </div>

          <button
            className="lg:hidden text-gray-400 hover:text-white p-2"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {mobileOpen
                ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />}
            </svg>
          </button>
        </div>

        {mobileOpen && (
          <div className="lg:hidden py-4 border-t border-gray-800 space-y-1">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="block text-sm text-gray-400 hover:text-white py-2 px-2 rounded"
                onClick={(e) => handleMobileNavClick(e, l.href)}
              >
                {l.label}
              </Link>
            ))}
            <Link href="/about" className="block text-sm text-gray-400 hover:text-white py-2 px-2" onClick={(e) => handleMobileNavClick(e, '/about')}>About</Link>
            <Link href="/financing" className="block text-sm text-gray-400 hover:text-white py-2 px-2" onClick={(e) => handleMobileNavClick(e, '/financing')}>Financing</Link>
            <Link href="/alerts" className="block text-sm text-gray-400 hover:text-white py-2 px-2" onClick={(e) => handleMobileNavClick(e, '/alerts')}>Price Alerts</Link>
            <Link
              href="/deal-analyzer"
              className="block text-sm font-semibold px-4 py-2 rounded-lg text-center mt-2 btn-gold"
              onClick={(e) => handleMobileNavClick(e, '/deal-analyzer')}
            >
              Analyze My Deal
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
