'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

const COOKIE_KEY = 'lmc_consent'

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))
  return match ? decodeURIComponent(match[1]) : null
}

function setConsentCookie(value: string) {
  const expires = new Date(Date.now() + 365 * 864e5).toUTCString()
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(value)};expires=${expires};path=/;SameSite=Lax`
}

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID
const CLARITY_PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID

function loadGA4() {
  if (!GA_MEASUREMENT_ID) return
  if (document.querySelector('script[data-ga4]')) return
  const s = document.createElement('script')
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`
  s.async = true
  s.setAttribute('data-ga4', '1')
  document.head.appendChild(s)
  s.onload = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    w.dataLayer = w.dataLayer || []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function gtag(...args: any[]) { w.dataLayer.push(args) }
    gtag('js', new Date())
    gtag('config', GA_MEASUREMENT_ID)
  }
}

function loadClarity() {
  if (!CLARITY_PROJECT_ID) return
  if (document.querySelector('script[data-clarity]')) return
  const script = document.createElement('script')
  script.setAttribute('data-clarity', '1')
  script.innerHTML = `(function(c,l,a,r,i,t,y){
    c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
    t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
    y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
  })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`
  document.head.appendChild(script)
}

export function initConsentedScripts() {
  const consent = getCookie(COOKIE_KEY)
  if (consent === 'all') {
    loadGA4()
    loadClarity()
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const consent = getCookie(COOKIE_KEY)
    if (!consent) {
      setVisible(true)
    } else if (consent === 'all') {
      loadGA4()
      loadClarity()
    }
  }, [])

  function acceptAll() {
    setConsentCookie('all')
    loadGA4()
    loadClarity()
    setVisible(false)
  }

  function essentialOnly() {
    setConsentCookie('essential')
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[400] px-4 py-4"
      style={{ background: '#111111', borderTop: '1px solid rgba(245,158,11,0.3)' }}
    >
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-xs text-gray-400 flex-1">
          We use cookies for analytics (Google Analytics 4) and session recording (Microsoft Clarity) to improve this site.
          We also use cookies for essential site functionality.{' '}
          <Link href="/privacy" className="underline hover:text-white transition-colors">
            See our Privacy Policy
          </Link>
          .
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={acceptAll}
            className="text-xs font-bold px-4 py-2 rounded-lg whitespace-nowrap btn-gold"
          >
            Accept All
          </button>
          <button
            onClick={essentialOnly}
            className="text-xs font-semibold px-4 py-2 rounded-lg whitespace-nowrap"
            style={{ background: 'transparent', color: '#e2e8f0', border: '1px solid #374151' }}
          >
            Essential Only
          </button>
        </div>
      </div>
    </div>
  )
}
