'use client'

import { useState } from 'react'

// Rival score entry for the trading competition: Jacob types the weekly cash
// total GPT / Gemini / Perplexity report and it lands in comp_weekly.

export default function RivalEntry({ secret }: { secret: string }) {
  const [contestant, setContestant] = useState('gpt')
  const [cash, setCash] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  async function save() {
    const cashTotal = parseFloat(cash)
    if (!isFinite(cashTotal) || cashTotal < 0) { setStatus('enter a dollar amount'); return }
    setStatus('saving…')
    try {
      const res = await fetch('/api/admin/competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, contestant, cashTotal }),
      })
      const d = await res.json()
      if (!res.ok) { setStatus(d.error || 'failed'); return }
      setStatus(`saved — ${contestant} $${cashTotal.toLocaleString()} (wk ${d.weekOf})`)
      setCash('')
      setTimeout(() => window.location.reload(), 800)
    } catch {
      setStatus('network error')
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-[12px]">
      <span className="text-[11px] uppercase tracking-widest text-neutral-600">log rival week</span>
      <select value={contestant} onChange={(e) => setContestant(e.target.value)}
        className="border border-neutral-300 px-2 py-1 font-mono text-neutral-900 outline-none focus:border-amber-500">
        <option value="gpt">GPT</option>
        <option value="gemini">Gemini</option>
        <option value="perplexity">Perplexity</option>
      </select>
      <input value={cash} onChange={(e) => setCash(e.target.value)} placeholder="cash total $"
        className="w-24 border border-neutral-300 px-2 py-1 font-mono text-neutral-900 outline-none focus:border-amber-500" />
      <button onClick={save}
        className="border border-amber-500 bg-amber-50 px-3 py-1 font-mono text-amber-800 hover:bg-amber-100">
        SAVE
      </button>
      {status && <span className="text-neutral-500">{status}</span>}
    </div>
  )
}
