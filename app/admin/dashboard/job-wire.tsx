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
  const [cving, setCving] = useState<string | null>(null)
  const [angle, setAngle] = useState<Record<string, string>>({})

  /** Build a CV tailored to this posting and download it. ~4s, one click.
   *  Jacob's recruiter (2026-08-12) wants a tailored CV on every application, so
   *  this has to cost no more time than not doing it. */
  async function makeCv(j: WireJob) {
    if (cving) return
    setCving(j.url)
    try {
      const res = await fetch('/api/admin/resume', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, url: j.url, title: j.title, company: j.company }),
      })
      if (!res.ok) { setAngle((a) => ({ ...a, [j.url]: 'CV failed — try again' })); return }
      const blob = await res.blob()
      const name = decodeURIComponent(
        res.headers.get('Content-Disposition')?.match(/filename="(.+?)"/)?.[1] || 'resume.docx',
      )
      // The anchor must be in the document and the blob URL must outlive the
      // click — revoking immediately cancels the download in Safari and some
      // Chrome versions, which looked like "nothing happened" (Jacob 2026-08-18).
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      a.download = name
      a.rel = 'noopener'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        document.body.removeChild(a)
        URL.revokeObjectURL(href)
      }, 30_000)
      const note = decodeURIComponent(res.headers.get('X-Resume-Angle') || '')
      const body = res.headers.get('X-Resume-Body') === 'full' ? '' : ' (title only — no posting text stored)'
      setAngle((a2) => ({ ...a2, [j.url]: note + body }))
    } finally {
      setCving(null)
    }
  }

  /** status: 'done' = not for me · 'applied' = I applied. Either way it leaves for good. */
  async function retire(url: string, status: 'done' | 'applied') {
    if (ticking) return
    setTicking(url)
    try {
      const res = await fetch('/api/admin/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret, url, status }),
      })
      if (res.ok) setItems((cur) => cur.filter((j) => j.url !== url))
    } finally {
      setTicking(null)
    }
  }

  /** Open the posting, then mark it applied so it never comes back around. */
  function apply(url: string) {
    window.open(url, '_blank', 'noopener,noreferrer')
    retire(url, 'applied')
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
            onChange={() => retire(j.url, 'done')}
            disabled={ticking === j.url}
            title="not for me — tick to clear it for good"
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
            {angle[j.url] && (
              <div className="mt-0.5 text-[10px] italic leading-snug text-sky-700">CV: {angle[j.url]}</div>
            )}
          </a>
          <button
            onClick={() => makeCv(j)}
            disabled={cving === j.url || ticking === j.url}
            title="build a CV tailored to this posting and download it"
            className="mt-0.5 shrink-0 rounded border border-sky-600 bg-sky-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-sky-700 hover:bg-sky-600 hover:text-white disabled:opacity-40"
          >
            {cving === j.url ? '…' : 'CV ↓'}
          </button>
          <button
            onClick={() => apply(j.url)}
            disabled={ticking === j.url}
            title="open the posting and mark it applied"
            className="mt-0.5 shrink-0 rounded border border-green-600 bg-green-50 px-2 py-1 text-[11px] font-bold uppercase tracking-wide text-green-700 hover:bg-green-600 hover:text-white disabled:opacity-40"
          >
            Apply ↗
          </button>
        </div>
      ))}
    </div>
  )
}
