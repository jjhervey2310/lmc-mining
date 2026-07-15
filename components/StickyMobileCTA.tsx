'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function StickyMobileCTA() {
  const pathname = usePathname()
  if (pathname === '/calculator' || pathname === '/review') return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden"
      style={{ height: '56px', background: '#0a0a0a', borderTop: '1px solid rgba(255,255,255,0.1)' }}
    >
      <div className="flex items-center gap-2 px-4 h-full">
        <Link
          href="/calculator"
          className="flex-1 text-center text-xs font-bold py-2 rounded-lg btn-gold"
        >
          Free ROI Calculator
        </Link>
        <Link
          href="/review"
          className="flex-1 text-center text-xs font-bold py-2 rounded-lg"
          style={{ border: '1px solid rgba(255,255,255,0.2)', color: '#ffffff' }}
        >
          Free Review
        </Link>
      </div>
    </div>
  )
}
