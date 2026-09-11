'use client'

import { useEffect, useState } from 'react'

// The live strip above the LEVERAGE page (Jacob, 2026-09-11): "is it actually running and
// researching right now".
//
// It polls rather than animates, and that distinction is the whole point. A spinner drawn
// unconditionally says "working" whether or not anything is, which on this page would be
// the one dishonest element. This reads the collector's own heartbeat: green while it is
// inside a step, amber when the last beat is older than a cycle, red when it has clearly
// stopped. If the collector dies, this goes red on its own.

type Pulse = {
  phase: string | null
  at: string | null
  cycle: number | null
  host: string | null
  observations: number
  answered: number
  hypotheses: number
}

// A cycle plus its five-minute wait, with room to spare. Past this the machine is not
// merely busy.
const WARN_AFTER_S = 12 * 60
const DEAD_AFTER_S = 30 * 60

const LABEL: Record<string, string> = {
  candles: 'reading 5-minute candles',
  venue: 'checking venue tick sizes and leverage limits',
  microstructure: 'walking the order book for the real cost of size',
  derivatives: 'pulling funding, open interest and basis',
  options: 'rebuilding the implied volatility surface',
  option_flow: 'reading individual option prints',
  push: 'pushing collected data to the store',
  fees: 'refreshing venue fee schedules',
  onchain: 'measuring stablecoin supply and chain TVL',
  contract_specs: 'reading maintenance margin parameters',
  insurance: 'checking the insurance fund',
  macro: 'pulling macro and cross-asset series',
  liquidation_tape: 'collecting individual forced liquidations',
  wallets: 'following winning and losing wallets',
  cross_venue: 'reading Binance and Bybit funding',
  deep_history: 'backfilling years of candle history',
  forward: 'resolving preregistered forward decisions',
  waiting: 'waiting for the next cycle',
}

function ago(seconds: number): string {
  if (seconds < 60) return `${seconds}s ago`
  const m = Math.floor(seconds / 60)
  if (m < 60) return `${m}m ago`
  return `${Math.floor(m / 60)}h ${m % 60}m ago`
}

export default function ResearchPulse({ secret }: { secret: string }) {
  const [pulse, setPulse] = useState<Pulse | null>(null)
  const [failed, setFailed] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let live = true
    const load = async () => {
      try {
        const res = await fetch(`/api/research-pulse?secret=${encodeURIComponent(secret)}`,
                                { cache: 'no-store' })
        if (!res.ok) throw new Error(String(res.status))
        const data = (await res.json()) as Pulse
        if (live) { setPulse(data); setFailed(false) }
      } catch {
        // Say so rather than freezing on the last good value, which would read as alive.
        if (live) setFailed(true)
      }
    }
    load()
    const poll = setInterval(load, 15_000)
    const tick = setInterval(() => setNow(Date.now()), 1000)
    return () => { live = false; clearInterval(poll); clearInterval(tick) }
  }, [secret])

  if (failed && !pulse) {
    return (
      <div className="mb-3 rounded-xl border border-rose-500/40 bg-rose-400/10 px-4 py-2.5 text-[13px] text-rose-700 dark:text-rose-300">
        Cannot reach the research store to ask whether the collector is running.
      </div>
    )
  }
  if (!pulse) {
    return (
      <div className="mb-3 rounded-xl border border-neutral-300/60 bg-neutral-100/60 px-4 py-2.5 text-[13px] text-neutral-500 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400">
        Asking the collector what it is doing…
      </div>
    )
  }

  const seconds = pulse.at
    ? Math.max(0, Math.round((now - new Date(pulse.at).getTime()) / 1000))
    : null
  const dead = seconds === null || seconds > DEAD_AFTER_S
  const stale = !dead && seconds !== null && seconds > WARN_AFTER_S
  const tone = dead
    ? { box: 'border-rose-500/40 bg-rose-400/10', dot: 'bg-rose-500', text: 'text-rose-700 dark:text-rose-300' }
    : stale
      ? { box: 'border-amber-500/40 bg-amber-400/10', dot: 'bg-amber-500', text: 'text-amber-800 dark:text-amber-200' }
      : { box: 'border-emerald-500/40 bg-emerald-400/10', dot: 'bg-emerald-500', text: 'text-emerald-800 dark:text-emerald-200' }

  const headline = dead
    ? 'The collector has stopped'
    : pulse.phase === 'waiting'
      ? 'Running — between cycles'
      : `Researching — ${LABEL[pulse.phase ?? ''] ?? pulse.phase ?? 'working'}`

  return (
    <div className={`mb-3 rounded-xl border px-4 py-2.5 ${tone.box}`}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <span className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            {!dead && (
              <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${tone.dot}`} />
            )}
            <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${tone.dot}`} />
          </span>
          <span className={`text-[13px] font-bold ${tone.text}`}>{headline}</span>
        </span>
        <span className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
          {seconds === null ? 'no heartbeat' : `beat ${ago(seconds)}`}
          {pulse.cycle ? ` · cycle ${pulse.cycle.toLocaleString()}` : ''}
          {pulse.host ? ` · ${pulse.host}` : ''}
        </span>
        <span className="ml-auto font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
          {pulse.observations.toLocaleString()} observations ·{' '}
          {pulse.answered}/{pulse.hypotheses} questions answered
        </span>
      </div>
      {dead && (
        <div className="mt-1 text-[12px] text-rose-700 dark:text-rose-300">
          No heartbeat for {seconds === null ? 'an unknown time' : ago(seconds)}. Funding
          and order-book history cannot be backfilled, so this is losing data now.
        </div>
      )}
    </div>
  )
}
