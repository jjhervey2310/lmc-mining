'use client'

import { useEffect, useState } from 'react'

// Flashes the scoreboard entries the collector is feeding RIGHT NOW (Jacob, 2026-09-11).
//
// The rule that governs it: nothing flashes unless the collector is genuinely inside the
// step that supplies those questions. If the heartbeat goes stale, everything stops
// flashing — the same reason the pulse strip polls rather than animating. A board that
// shimmers while the machine is dead is worse than a still one.
//
// The mapping is from a collection step to the hypothesis families it actually feeds, so
// "researching" here means "gathering the evidence this question is waiting on", not
// "thinking about it".

const FEEDS: Record<string, string[]> = {
  candles: ['structure', 'trend', 'reversion', 'seasonality'],
  deep_history: ['structure', 'trend', 'reversion', 'seasonality', 'cross-section'],
  venue: ['execution'],
  microstructure: ['microstructure', 'execution'],
  derivatives: ['carry', 'positioning'],
  options: ['volatility'],
  option_flow: ['volatility', 'positioning'],
  fees: ['execution'],
  onchain: ['onchain'],
  contract_specs: ['risk'],
  insurance: ['risk'],
  macro: ['macro'],
  liquidation_tape: ['positioning', 'risk'],
  wallets: ['positioning'],
  cross_venue: ['carry', 'cross-venue'],
  forward: ['validation'],
  // push and waiting feed nothing; they must leave the board still.
}

// Matches the pulse strip: past this the machine is not merely busy on a long step.
const STALE_AFTER_MS = 12 * 60_000

export default function ScoreboardPulse({ secret }: { secret: string }) {
  const [active, setActive] = useState<string[]>([])

  useEffect(() => {
    let live = true

    const load = async () => {
      let families: string[] = []
      try {
        const res = await fetch(`/api/research-pulse?secret=${encodeURIComponent(secret)}`,
                                { cache: 'no-store' })
        if (res.ok) {
          const data = (await res.json()) as { phase: string | null; at: string | null }
          const fresh = data.at
            ? Date.now() - new Date(data.at).getTime() < STALE_AFTER_MS
            : false
          // A stale heartbeat means nothing is running, whatever the last phase said.
          if (fresh && data.phase) families = FEEDS[data.phase] ?? []
        }
      } catch {
        families = []   // unreachable is not the same as idle, but both mean: do not flash
      }
      if (live) setActive(families)
    }

    load()
    const poll = setInterval(load, 10_000)
    return () => { live = false; clearInterval(poll) }
  }, [secret])

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>('[data-family]')
    cards.forEach((card) => {
      const on = active.includes(card.dataset.family ?? '')
      card.classList.toggle('is-researching', on)
    })
  }, [active])

  return (
    <style>{`
      @keyframes researching {
        0%, 100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        50%      { box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.35); }
      }
      .is-researching { animation: researching 1.6s ease-in-out infinite; }
      .is-researching .researching-tag { display: inline; }
      @media (prefers-reduced-motion: reduce) {
        .is-researching { animation: none; box-shadow: 0 0 0 2px rgba(16, 185, 129, 0.45); }
      }
    `}</style>
  )
}
