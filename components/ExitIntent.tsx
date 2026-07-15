'use client'

import { useEffect, useState } from 'react'

export default function ExitIntent() {
  const [visible, setVisible] = useState(false)
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Close on Escape while open (a11y 2.1.2 — no keyboard trap).
  useEffect(() => {
    if (!visible) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setVisible(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [visible])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('exit_intent_shown')) return

    let ready = false
    const onMouseLeave = (e: MouseEvent) => {
      if (!ready) return
      if (e.clientY < 8) {
        sessionStorage.setItem('exit_intent_shown', '1')
        setVisible(true)
        document.removeEventListener('mouseleave', onMouseLeave)
      }
    }

    // Wait 3s before arming to avoid triggering on page load
    const arm = setTimeout(() => {
      ready = true
      document.addEventListener('mouseleave', onMouseLeave)
    }, 3000)

    return () => {
      clearTimeout(arm)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || submitting) return
    setSubmitting(true)
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, lead_type: 'email_capture', source: 'exit_intent' }),
      })
    } catch { /* silent */ }
    setSubmitted(true)
    setSubmitting(false)
  }

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(6px)' }}
      onClick={e => { if (e.target === e.currentTarget) setVisible(false) }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Get the free Mining ROI Spreadsheet"
        className="w-full max-w-md rounded-2xl p-8 relative"
        style={{ background: '#111827', border: '1px solid #1f2937', boxShadow: '0 25px 60px rgba(0,0,0,0.6)' }}
      >
        <button
          onClick={() => setVisible(false)}
          aria-label="Close"
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-gray-500 hover:text-white hover:bg-gray-800 transition-colors text-sm"
        >
          ✕
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div className="text-4xl mb-4" style={{ color: '#00d4aa' }}>✓</div>
            <h2 className="text-xl font-bold text-white mb-2">On its way!</h2>
            <p className="text-sm text-gray-400">It&apos;s on its way. Check your inbox for the Mining ROI Spreadsheet.</p>
          </div>
        ) : (
          <>
            <div className="inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-full mb-4" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
              Free Resource
            </div>
            <h2 className="text-xl font-bold text-white mb-2">
              Before you go — get the free Mining ROI Spreadsheet
            </h2>
            <p className="text-sm text-gray-400 mb-6">
              The exact spreadsheet framework we use to evaluate every mining deal. Plug in any miner, any hosting rate, and see your real ROI across 3 BTC price scenarios.
            </p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                aria-label="Email address"
                required
                className="w-full text-sm px-4 py-3 rounded-xl text-white focus:outline-none"
                style={{
                  background: '#0a0e17',
                  border: '1px solid #374151',
                  color: '#ffffff',
                  caretColor: '#f59e0b',
                }}
                onFocus={e => (e.target.style.borderColor = 'rgba(245,158,11,0.5)')}
                onBlur={e => (e.target.style.borderColor = '#374151')}
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 rounded-xl text-sm font-bold transition-opacity btn-gold"
                style={{ opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? 'Sending...' : 'Send Me the Spreadsheet →'}
              </button>
            </form>
            <button
              onClick={() => setVisible(false)}
              className="block w-full text-center text-xs text-gray-600 mt-4 hover:text-gray-400 transition-colors"
            >
              No thanks, I don&apos;t need this
            </button>
          </>
        )}
      </div>
    </div>
  )
}
