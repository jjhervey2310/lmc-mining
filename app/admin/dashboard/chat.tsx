'use client'

import { useEffect, useRef, useState } from 'react'

type Msg = { role: 'user' | 'assistant'; content: string }

export default function ChatWindow({ secret }: { secret: string }) {
  const [messages, setMessages] = useState<Msg[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const saved = localStorage.getItem('lmc-pa-chat')
      if (saved) setMessages(JSON.parse(saved))
    } catch { /* fresh start */ }
  }, [])

  useEffect(() => {
    try { localStorage.setItem('lmc-pa-chat', JSON.stringify(messages.slice(-30))) } catch { /* ignore */ }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight })
  }, [messages])

  async function send() {
    const text = input.trim()
    if (!text || busy) return
    const next: Msg[] = [...messages, { role: 'user', content: text }]
    setMessages(next)
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/admin/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ secret, messages: next.slice(-12) }),
      })
      const data = await res.json()
      setMessages([...next, { role: 'assistant', content: data.reply || data.error || 'No reply.' }])
    } catch {
      setMessages([...next, { role: 'assistant', content: 'Connection failed — try again.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex h-[420px] flex-col">
      <div ref={scroller} className="flex-1 space-y-2 overflow-y-auto pr-1">
        {!messages.length && (
          <div className="text-[12px] leading-relaxed text-neutral-600">
            Ask me anything about the operation — &quot;did everything post today?&quot;, &quot;how are the
            videos doing?&quot;, &quot;what needs my attention?&quot; I see it all live.
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`whitespace-pre-wrap text-[13px] leading-relaxed ${m.role === 'user' ? 'text-amber-600' : 'text-neutral-800'}`}>
            <span className="mr-1 text-[11px] uppercase tracking-widest text-neutral-500">{m.role === 'user' ? 'you' : 'pa'}</span>
            {m.content}
          </div>
        ))}
        {busy && <div className="text-[13px] text-neutral-500 animate-pulse">pa is checking…</div>}
      </div>
      <div className="mt-2 flex gap-1 border-t border-neutral-200 pt-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="ask your PA…"
          className="min-w-0 flex-1 border border-neutral-200 bg-white px-2 py-1.5 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500"
        />
        <button onClick={send} disabled={busy} className="border border-amber-500 px-3 py-1.5 text-[12px] uppercase text-amber-500 hover:bg-amber-500 hover:text-black disabled:opacity-40">
          Send
        </button>
      </div>
    </div>
  )
}
