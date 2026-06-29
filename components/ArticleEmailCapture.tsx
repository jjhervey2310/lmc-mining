'use client'

import { useState } from 'react'

export default function ArticleEmailCapture() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <div
        className="rounded-2xl p-6 my-8 text-center"
        style={{ background: 'rgba(0,212,170,0.08)', border: '1px solid rgba(0,212,170,0.25)' }}
      >
        <div className="text-2xl mb-2">✓</div>
        <p className="font-semibold text-white">Spreadsheet on its way!</p>
        <p className="text-sm text-gray-400 mt-1">Check your inbox for the Mining ROI Spreadsheet.</p>
      </div>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: email.split('@')[0],
        email,
        lead_type: 'email_capture',
        form_data: { source: 'article_cta' },
      }),
    }).catch(() => {})
    setLoading(false)
    setSubmitted(true)
  }

  return (
    <div
      className="rounded-2xl p-6 my-8"
      style={{ background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.2)' }}
    >
      <div className="flex items-start gap-3 mb-4">
        <span className="text-xl shrink-0">📊</span>
        <div>
          <h3 className="font-bold text-white text-base mb-1">Get the Free Mining ROI Spreadsheet</h3>
          <p className="text-sm text-gray-400">
            Model your exact setup with BTC price scenarios, difficulty growth, and breakeven analysis built in.
          </p>
        </div>
      </div>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="email"
          required
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="flex-1 rounded-lg px-3 py-2.5 text-sm"
          style={{ background: '#111827', color: '#e2e8f0', border: '1px solid #374151' }}
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap disabled:opacity-60"
          style={{ background: '#f7931a', color: '#000' }}
        >
          {loading ? '...' : 'Send Me the Spreadsheet'}
        </button>
      </form>
    </div>
  )
}
