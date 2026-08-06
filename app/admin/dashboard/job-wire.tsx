'use client'

import { useState } from 'react'

// The job wire list with task-style tick boxes: tick = done, the job vanishes
// and never comes back (status flips in job_finds; the sweep dedups on url).

export interface WireJob {
  title: string
  company: string | null
  url: string
  source: string
  found_at: string
  salary?: string | null
  posted_at?: string | null
}

export default function JobWire({ jobs, secret }: { jobs: WireJob[]; secret: string }) {
  const [items, setItems] = useState(jobs)
  const [ticking, setTicking] = useState<string | null>(null)

  async function tickOff(url: string) {
    if (ticking) return
    setTicking(url)
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, url, status: 'done' }),
      })
      if (res.ok) setItems((cur) => cur.filter((j) => j.url !== url))
    } finally {
      setTicking(null)
    }
  }

  if (!items.length) {
    return (
      <div className="text-[12px] text-neutral-600">
        Wire is clear — everything ticked off. The 6am sweep restocks it with fresh postings.
      </div>
    )
  }

  return (
    <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
      {items.map((j) => (
        <div key={j.url} className={`flex items-start gap-2 border-l-2 border-amber-500/60 pl-2 ${ticking === j.url ? 'opacity-40' : ''}`}>
          <input
            type="checkbox"
            checked={false}
            onChange={() => tickOff(j.url)}
            disabled={ticking === j.url}
            title="tick = done, gone forever"
            className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-amber-500"
          />
          <a href={j.url} target="_blank" rel="noreferrer" className="block min-w-0 flex-1 hover:bg-amber-50">
            <div className="text-[13px] leading-snug text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-800">{j.title} ↗</div>
            {/* Only say "posted" when we actually know the post date. Sources that
                don't supply one get an honest "found" — a job discovered today can
                be months old on the board it came from (Jacob 2026-08-06). */}
            <div className="text-[11px] text-neutral-600">
              {j.company || '—'}{j.salary ? ` · ${j.salary}` : ''}
              {j.posted_at
                ? ` · posted ${j.posted_at.slice(5, 10)}`
                : ` · found ${j.found_at.slice(5, 10)} · post date unknown`}
            </div>
          </a>
        </div>
      ))}
    </div>
  )
}
