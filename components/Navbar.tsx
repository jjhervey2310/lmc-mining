'use client'

import Link from 'next/link'
import { useState } from 'react'
import { usePathname } from 'next/navigation'

const NAV_LINKS = [
  { href: '/', label: 'Home' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/hosting', label: 'Hosting' },
  { href: '/miners', label: 'Miners' },
  { href: '/university', label: 'University' },
  { href: '/deal-analyzer', label: 'Deal Analyzer' },
  { href: '/audit', label: 'Audit' },
  { href: '/tools', label: 'Tools' },
  { href: '/financing', label: 'Financing' },
  { href: '/glossary', label: 'Glossary' },
  { href: '/profitable', label: 'Profitability' },
]

export default function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  return (
    <nav
      className="border-b sticky top-0 z-50"
      style={{ background: '#0a0a0a', borderBottomColor: '#222222' }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <svg
              className="w-6 h-6 lightning-bolt-pulse"
              viewBox="0 0 24 24"
              fill="#f7931a"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
            <span className="font-bold text-white text-lg tracking-tight">Lightning Mines</span>
          </Link>

          <div className="hidden lg:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="text-sm transition-colors whitespace-nowrap"
                style={{ color: pathname === l.href ? '#f7931a' : '#9ca3af' }}
                onMouseEnter={e => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={e => (e.currentTarget.style.color = pathname === l.href ? '#f7931a' : '#9ca3af')}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/review"
              className="text-sm font-semibold px-4 py-2 rounded-lg whitespace-nowrap transition-all"
              style={{ background: '#f7931a', color: '#000000' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Free Review
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
          <div className="lg:hidden py-4 border-t space-y-1" style={{ borderColor: '#222222' }}>
            {NAV_LINKS.map(l => (
              <Link
                key={l.href}
                href={l.href}
                className="block text-sm text-gray-400 hover:text-white py-2 px-2 rounded"
                onClick={() => setMobileOpen(false)}
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/review"
              className="block text-sm font-semibold px-4 py-2 rounded-lg text-center mt-2"
              style={{ background: '#f7931a', color: '#000000' }}
              onClick={() => setMobileOpen(false)}
            >
              Free Deal Review
            </Link>
          </div>
        )}
      </div>
    </nav>
  )
}
