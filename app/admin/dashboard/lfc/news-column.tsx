'use client'

import { useState } from 'react'
import type { NewsItem } from '@/lib/lfc'

// The transfer column: click a story, it opens underneath with a chat box so
// Jacob can interrogate it ("is this credible?", "who's reporting it?", "do we
// even need a left back?"). Answers are anchored to that story server-side.

type Msg = { role: 'user' | 'assistant'; content: string }

const STARTERS = ['Is this actually credible?', 'What does it mean for the squad?', "What's the fee likely to be?"]

export default function NewsColumn({ items, secret }: { items: NewsItem[]; secret: string }) {
  const [open, setOpen] = useState<string | null>(null)
  const [threads, setThreads] = useState<Record<string, Msg[]>>({})
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<'all' | 'transfer' | 'romano'>('all')

  const shown = filter === 'transfer' ? items.filter((n) => n.transfer) : filter === 'romano' ? items.filter((n) => n.romano) : items

  async function ask(story: NewsItem, question: string) {
    const q = question.trim()
    if (!q || busy) return
    const thread = [...(threads[story.id] ?? []), { role: 'user' as const, content: q }]
    setThreads((t) => ({ ...t, [story.id]: thread }))
    setInput('')
    setBusy(true)
    try {
      const res = await fetch('/api/admin/lfc-ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret, title: story.title, summary: story.summary, source: story.source,
          published: story.published, link: story.link, messages: thread,
        }),
      })
      const d = await res.json()
      setThreads((t) => ({ ...t, [story.id]: [...thread, { role: 'assistant', content: d.reply || d.error || 'No answer.' }] }))
    } catch {
      setThreads((t) => ({ ...t, [story.id]: [...thread, { role: 'assistant', content: 'Connection failed.' }] }))
    } finally {
      setBusy(false)
    }
  }

  const when = (p: string | null) => {
    if (!p) return ''
    const mins = Math.round((Date.now() - new Date(p).getTime()) / 60000)
    if (!isFinite(mins) || mins < 0) return ''
    if (mins < 60) return `${mins}m ago`
    if (mins < 1440) return `${Math.floor(mins / 60)}h ago`
    return `${Math.floor(mins / 1440)}d ago`
  }

  return (
    <div>
      <div className="mb-2 flex gap-2">
        {(['all', 'transfer', 'romano'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              filter === f ? 'bg-[#C8102E] text-white' : 'bg-white/10 text-neutral-300 hover:bg-white/20'
            }`}>
            {f === 'all' ? `All (${items.length})`
              : f === 'transfer' ? `Transfers (${items.filter((n) => n.transfer).length})`
              : `Romano (${items.filter((n) => n.romano).length})`}
          </button>
        ))}
      </div>

      <div className="max-h-[560px] space-y-1.5 overflow-y-auto pr-1">
        {shown.map((n) => {
          const isOpen = open === n.id
          const thread = threads[n.id] ?? []
          return (
            <div key={n.id} className={`rounded-lg border transition-colors ${isOpen ? 'border-[#C8102E] bg-[#C8102E]/10' : 'border-white/10 bg-white/[0.03] hover:border-[#C8102E]/50'}`}>
              <button onClick={() => setOpen(isOpen ? null : n.id)} className="block w-full px-3 py-2 text-left">
                <div className="flex items-start gap-2">
                  {n.romano ? (
                    <span className="mt-0.5 shrink-0 rounded bg-[#F6EB61] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-black" title="cites Fabrizio Romano">
                      Romano
                    </span>
                  ) : n.transfer ? (
                    <span className="mt-0.5 shrink-0 rounded bg-[#C8102E] px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
                      Transfer
                    </span>
                  ) : null}
                  <span className="min-w-0 flex-1 text-[13px] font-medium leading-snug text-neutral-100">{n.title}</span>
                </div>
                <div className="mt-1 text-[10px] uppercase tracking-wide text-[#F6EB61]/70">
                  <span className={n.tier === 1 ? 'text-emerald-400' : n.tier === 2 ? 'text-[#F6EB61]/70' : 'text-neutral-500'}>
                    {'●'.repeat(4 - n.tier)} {n.source}
                  </span>
                  {n.published ? ` · ${when(n.published)}` : ''} · {isOpen ? 'tap to close' : 'tap to ask'}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-white/10 px-3 py-2">
                  {n.summary && <p className="mb-2 text-[12px] leading-relaxed text-neutral-300">{n.summary}</p>}
                  <a href={n.link} target="_blank" rel="noreferrer"
                    className="mb-2 inline-block text-[11px] text-[#F6EB61] underline underline-offset-2 hover:text-white">
                    Read the full story ↗
                  </a>

                  {thread.length > 0 && (
                    <div className="mb-2 space-y-2 border-t border-white/10 pt-2">
                      {thread.map((m, i) => (
                        <div key={i} className={`whitespace-pre-wrap text-[12px] leading-relaxed ${m.role === 'user' ? 'text-[#F6EB61]' : 'text-neutral-200'}`}>
                          <span className="mr-1 text-[10px] uppercase tracking-widest text-neutral-500">{m.role === 'user' ? 'you' : 'kop'}</span>
                          {m.content}
                        </div>
                      ))}
                    </div>
                  )}
                  {busy && open === n.id && <div className="mb-2 animate-pulse text-[12px] text-neutral-400">thinking…</div>}

                  {thread.length === 0 && (
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {STARTERS.map((s) => (
                        <button key={s} onClick={() => ask(n, s)} disabled={busy}
                          className="rounded-full border border-white/20 px-2.5 py-1 text-[11px] text-neutral-300 hover:border-[#C8102E] hover:text-white disabled:opacity-40">
                          {s}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="flex gap-1">
                    <input
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && ask(n, input)}
                      placeholder="ask about this story…"
                      className="min-w-0 flex-1 rounded border border-white/15 bg-white/5 px-2 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-500 focus:border-[#C8102E] focus:outline-none"
                    />
                    <button onClick={() => ask(n, input)} disabled={busy}
                      className="rounded bg-[#C8102E] px-3 py-1.5 text-[11px] font-bold uppercase text-white hover:bg-[#a00d25] disabled:opacity-40">
                      Ask
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {!shown.length && <div className="text-[12px] text-neutral-400">No stories in the feeds right now.</div>}
      </div>
    </div>
  )
}
