'use client'

import { useEffect, useState } from 'react'

// Manual refresh for the terminal (Jacob 2026-09-10), in the Shell header so it
// is on every page at once.
//
// Two parts, and the age is the more useful half: every dashboard page is
// `force-dynamic`, so what you are looking at is a snapshot from whenever the
// page was rendered, with nothing auto-refreshing it. The header used to say
// "refresh 5m", which was not true of anything. Now it says how old the
// snapshot actually is and goes amber once it is stale enough to distrust.
//
// The button does a full location.reload() rather than router.refresh():
// several panels are client components that fetch on mount (desk-live,
// live-tiles, the ticker), and a server-component refresh leaves those holding
// their old numbers — a refresh that half-refreshes is worse than none.

const STALE_AFTER_MS = 5 * 60_000

function ageLabel(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 20) return 'just now'
  if (s < 90) return `${s}s ago`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m ago`
}

export default function RefreshButton({ renderedAt }: { renderedAt: string }) {
  // Starts at 0 on both server and client, so the first paint matches and there
  // is no hydration mismatch; the interval takes it from there.
  const [age, setAge] = useState(0)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    const at = new Date(renderedAt).getTime()
    const id = setInterval(() => setAge(Date.now() - at), 5000)
    return () => clearInterval(id)
  }, [renderedAt])

  const stale = age >= STALE_AFTER_MS

  return (
    <span className="flex items-center gap-1.5">
      <span
        className={`whitespace-nowrap tabular-nums ${stale ? 'text-amber-600 dark:text-amber-300' : 'text-neutral-500 dark:text-neutral-400'}`}
        title={`Page rendered ${new Date(renderedAt).toLocaleString('en-US', { timeZone: 'America/Denver' })} DEN`}
      >
        {ageLabel(age)}
      </span>
      <button
        type="button"
        onClick={() => { setBusy(true); window.location.reload() }}
        disabled={busy}
        aria-label="Refresh this page"
        title="Reload the page for up-to-date numbers"
        className={`rounded-full border px-2 py-0.5 text-[12px] transition-colors disabled:opacity-60 ${
          stale
            ? 'border-amber-500 text-amber-600 hover:bg-amber-50 dark:border-amber-400 dark:text-amber-300 dark:hover:bg-amber-400/10'
            : 'border-neutral-300 hover:border-amber-500 dark:border-white/15 dark:text-neutral-300 dark:hover:border-amber-400'
        }`}
      >
        <span className={busy ? 'inline-block animate-spin' : 'inline-block'}>⟳</span>
      </button>
    </span>
  )
}
