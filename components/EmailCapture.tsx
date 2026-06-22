'use client'

import { useState } from 'react'

export default function EmailCapture() {
  const [submitted, setSubmitted] = useState(false)

  const formUrl = process.env.NEXT_PUBLIC_EMAIL_FORM_URL

  if (submitted) {
    return (
      <div
        className="rounded-xl p-6 text-center"
        style={{ background: '#00d4aa10', border: '1px solid #00d4aa30' }}
      >
        <div className="text-2xl mb-2">✓</div>
        <p className="text-white font-semibold">You&apos;re subscribed!</p>
        <p className="text-sm text-gray-400 mt-1">
          It&apos;s on its way. Check your inbox for the <em>Mining ROI Spreadsheet</em>.
        </p>
      </div>
    )
  }

  if (formUrl) {
    // Use external embed URL (Mailchimp/ConvertKit)
    return (
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
        <iframe
          src={formUrl}
          width="100%"
          height="160"
          frameBorder="0"
          scrolling="no"
          title="Email signup"
          className="block"
        />
      </div>
    )
  }

  // Fallback: use leads API
  return (
    <div
      className="rounded-xl p-6"
      style={{ background: '#111827', border: '1px solid #1f2937' }}
    >
      <h3 className="font-semibold text-white mb-1">Get the Free Mining ROI Spreadsheet</h3>
      <p className="text-sm text-gray-400 mb-4">
        The exact spreadsheet framework for evaluating any mining deal. Plus weekly profitability alerts — free.
      </p>
      <FallbackEmailForm onSubmit={() => setSubmitted(true)} />
    </div>
  )
}

function FallbackEmailForm({ onSubmit }: { onSubmit: () => void }) {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: email.split('@')[0],
        email,
        lead_type: 'email_capture',
        form_data: { email, source: 'footer_capture' },
      }),
    }).catch(() => {})

    await fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'email_signup', event_data: { source: 'footer' } }),
    }).catch(() => {})

    setLoading(false)
    onSubmit()
  }

  return (
    <form onSubmit={handleSubmit} className="flex gap-2">
      <input
        type="email"
        required
        placeholder="your@email.com"
        className="flex-1 rounded-lg px-3 py-2 text-sm"
        style={{ background: '#1f2937', color: '#e2e8f0', border: '1px solid #374151' }}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button
        type="submit"
        disabled={loading}
        className="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap disabled:opacity-60"
        style={{ background: '#00d4aa', color: '#0a0e17' }}
      >
        {loading ? '...' : <><span className="hidden sm:inline">Get the Free Spreadsheet</span><span className="sm:hidden">Get Spreadsheet</span></>}
      </button>
    </form>
  )
}
