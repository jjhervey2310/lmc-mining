'use client'

import { useEffect, useId, useRef, useState } from 'react'

// The readiness brain (Jacob, 2026-09-10): a circuit-board brain that fills
// with green as the desk learns what it needs, reaching 100% only once every
// question it is waiting on has an answer.
//
// Cold traces are blue. Everything below the learning line turns green and
// lights up. The fill is a real fraction — answered / asked, summed across the
// tracks — so the same honesty rule as the rest of the page holds: this can
// never read "ready" while a question is still open, and with nothing to
// measure it shows a dash rather than 0%.

/** One line of enquiry.
 *
 *  `credit` drives the fill and is deliberately continuous: a question that is answered
 *  counts in full, and one that is still collecting counts for a FRACTION of the evidence
 *  it has gathered. Counting only finished answers made the readout sit flat for days and
 *  then jump, which tells you nothing about whether the work is moving.
 *
 *  The fraction is capped below 1 on purpose. Data gathered is progress towards an answer
 *  and is not an answer, so no amount of collecting can make a track read as complete.
 */
export interface Track {
  key: string
  label: string
  credit: number      // 0..total, fractional
  answered: number    // whole questions with a verdict either way
  total: number
  evidence: number    // 0..1, how much of the data the open questions still need
  detail: string
}

/** Evidence counts for at most this much of a question. It is progress, not an answer. */
export const EVIDENCE_WEIGHT = 0.5

// Stylised brain silhouette: a bumpy blob plus a stem, drawn in a 120x104 box.
const OUTLINE = [
  'M60 8',
  'C50 2 38 4 33 12', 'C24 10 16 16 16 25', 'C8 28 5 36 9 44',
  'C3 50 4 60 11 65', 'C9 74 15 82 24 84', 'C28 92 38 96 46 92',
  'C52 97 62 97 68 92', 'C78 96 88 92 92 84', 'C101 82 107 74 105 65',
  'C112 60 113 50 107 44', 'C111 36 108 28 100 25', 'C100 16 92 10 83 12',
  'C78 4 70 2 60 8', 'Z',
].join(' ')
const STEM = 'M54 90 C 53 98 57 103 62 102 C 67 101 68 95 66 89 Z'

// PCB traces: right angles and 45° dog-legs, the way a real board is routed.
// They overrun the silhouette on purpose — the clip cuts them at the edge, so
// the brain looks like a section of a much larger board.
const TRACES = [
  'M2 24 H26 L34 16 H58', 'M2 36 H18 L26 30 H48',
  'M2 52 H22 L30 44 H54 L62 52 H88', 'M2 62 H16 L24 70 H44',
  'M2 76 H26 L34 82 H56',
  'M118 22 H94 L86 30 H64', 'M118 38 H100 L92 32 H72',
  'M118 50 H98 L90 58 H70', 'M118 62 H104 L96 68 H78', 'M118 76 H92 L84 70 H66',
  'M60 8 V 28 L52 36 V 58 L60 66 V 100', 'M60 28 H74 L82 20 H104',
  'M40 20 V 6', 'M46 98 V 78 L38 70 V 54', 'M76 98 V 80 L84 72 V 56',
  'M22 40 V 64', 'M98 34 V 66', 'M14 58 H24 L32 66 H44',
  'M30 12 V 26', 'M88 12 V 26', 'M52 84 H70', 'M36 46 H48',
  'M72 44 H86', 'M64 74 H80',
]
const NODES: [number, number][] = [
  [26, 24], [58, 16], [18, 36], [48, 30], [22, 52], [54, 52], [88, 52], [26, 76],
  [56, 82], [94, 22], [64, 30], [100, 38], [72, 32], [98, 50], [70, 58], [104, 62],
  [78, 68], [92, 76], [66, 70], [52, 36], [60, 66], [74, 28], [104, 20], [40, 20],
  [46, 78], [76, 80], [22, 40], [98, 34], [60, 44], [34, 82], [44, 66], [30, 12],
  [88, 12], [52, 84], [70, 84], [36, 46], [86, 44], [80, 74], [16, 62], [44, 70],
]
// Chips: body plus pins down each side.
const CHIPS: { x: number; y: number; w: number; h: number }[] = [
  { x: 27, y: 55, w: 15, h: 11 },
  { x: 70, y: 22, w: 14, h: 10 },
  { x: 79, y: 62, w: 13, h: 10 },
  { x: 44, y: 10, w: 13, h: 9 },
  { x: 30, y: 33, w: 12, h: 9 },
]
// The cerebellum, drawn as a ridged arc at the lower right — the one anatomical
// cue that stops the silhouette reading as a cloud.
const CEREBELLUM = 'M70 86 C 86 85 98 76 100 62'
const RIDGES = ['M74 86 L 77 80', 'M81 84 L 85 78', 'M88 80 L 91 74', 'M94 74 L 97 68']

// Vertical extent of the silhouette — the fill travels between these, so an
// empty brain is genuinely empty and a full one is genuinely full.
const TOP = 4
const BOT = 102

/** One full copy of the circuitry. Drawn twice: cold underneath, lit on top. */
function Circuit({ lit }: { lit: boolean }) {
  const w = lit ? 1 : 0.85
  return (
    <>
      <path d={OUTLINE} fill="currentColor" fillOpacity={lit ? 0.16 : 0.07} />
      <path d={STEM} fill="currentColor" fillOpacity={lit ? 0.16 : 0.07} />
      {TRACES.map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeOpacity={lit ? 0.95 : 0.62}
          strokeWidth={1.6 * w} strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {CHIPS.map((c) => (
        <g key={`${c.x}-${c.y}`}>
          <rect x={c.x} y={c.y} width={c.w} height={c.h} rx="1.5"
            fill="currentColor" fillOpacity={lit ? 0.5 : 0.2}
            stroke="currentColor" strokeOpacity={lit ? 0.95 : 0.65} strokeWidth={1.1 * w} />
          {[0.25, 0.5, 0.75].map((f) => (
            <g key={f}>
              <line x1={c.x - 2.5} x2={c.x} y1={c.y + c.h * f} y2={c.y + c.h * f}
                stroke="currentColor" strokeOpacity={lit ? 0.9 : 0.55} strokeWidth={1.1 * w} strokeLinecap="round" />
              <line x1={c.x + c.w} x2={c.x + c.w + 2.5} y1={c.y + c.h * f} y2={c.y + c.h * f}
                stroke="currentColor" strokeOpacity={lit ? 0.9 : 0.55} strokeWidth={1.1 * w} strokeLinecap="round" />
            </g>
          ))}
        </g>
      ))}
      {NODES.map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={lit ? 2 : 1.7}
          fill="currentColor" fillOpacity={lit ? 0.95 : 0.6} />
      ))}
      <path d={CEREBELLUM} fill="none" stroke="currentColor" strokeOpacity={lit ? 0.9 : 0.55}
        strokeWidth={1.8 * w} strokeLinecap="round" />
      {RIDGES.map((d) => (
        <path key={d} d={d} fill="none" stroke="currentColor" strokeOpacity={lit ? 0.75 : 0.45}
          strokeWidth={1.3 * w} strokeLinecap="round" />
      ))}
      <path d={OUTLINE} fill="none" stroke="currentColor" strokeOpacity={lit ? 1 : 0.7}
        strokeWidth={2.4 * w} strokeLinejoin="round" />
      <path d={STEM} fill="none" stroke="currentColor" strokeOpacity={lit ? 1 : 0.7}
        strokeWidth={2.4 * w} strokeLinejoin="round" />
    </>
  )
}

export default function ReadinessBrain(
  { tracks, dataHeld = 0, dataNeeded = 0, durationMs = 2200 }:
  { tracks: Track[]; dataHeld?: number; dataNeeded?: number; durationMs?: number }) {
  const uid = useId().replace(/:/g, '')
  const asked = tracks.reduce((n, t) => n + t.total, 0)
  const answered = tracks.reduce((n, t) => n + Math.min(t.credit, t.total), 0)
  const settled = tracks.reduce((n, t) => n + t.answered, 0)
  // Nothing to measure is not the same claim as nothing learned, so the readout
  // dashes instead of reading 0% — the page rule, applied to the brain.
  const measurable = asked > 0
  const target = measurable ? (answered / asked) * 100 : 0
  // Ready means every question ANSWERED, not every question well supplied with data.
  const ready = measurable && settled === asked

  // Climb from empty on every load. Driven frame by frame rather than by a CSS
  // transition because the fill level is an SVG geometry attribute, and
  // browsers disagree about transitioning those.
  const [pct, setPct] = useState(0)
  const raf = useRef<number | null>(null)
  useEffect(() => {
    // Reduced motion jumps straight to the answer. Both paths set state inside
    // the frame callback rather than the effect body, which keeps the React
    // hooks lint rule happy and costs one imperceptible frame.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const start = performance.now()
    const tick = (now: number) => {
      if (reduce) { setPct(target); return }
      const t = Math.min(1, (now - start) / durationMs)
      setPct(target * (1 - Math.pow(1 - t, 3))) // ease-out cubic: quick off the mark, slow to settle
      if (t < 1) raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => { if (raf.current !== null) cancelAnimationFrame(raf.current) }
  }, [target, durationMs])

  const fillY = BOT - (BOT - TOP) * (pct / 100)
  const shown = Math.round(pct)

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      <div className="flex shrink-0 flex-col items-center">
        <svg viewBox="0 0 120 108" className="h-[132px] w-[146px]" role="img" aria-label={`Desk readiness ${shown} percent`}>
          <defs>
            <clipPath id={`brain-${uid}`}>
              <path d={OUTLINE} />
              <path d={STEM} />
            </clipPath>
            <clipPath id={`level-${uid}`}>
              <rect x="0" y={fillY} width="120" height={Math.max(0, BOT - fillY + 8)} />
            </clipPath>
          </defs>

          {/* Cold board: everything the desk has not learned yet. Clipped to the
              silhouette so the traces terminate at the edge like real routing
              rather than sticking out past it. */}
          <g className="text-sky-500 dark:text-sky-400" clipPath={`url(#brain-${uid})`}>
            <Circuit lit={false} />
          </g>

          {/* Learned: the same circuitry in green, clipped to the silhouette and
              then to the level, so the green rises as gates close. */}
          <g clipPath={`url(#brain-${uid})`}>
            <g clipPath={`url(#level-${uid})`} className={`text-emerald-500 dark:text-emerald-300 ${ready ? 'animate-pulse' : ''}`}>
              <Circuit lit />
            </g>
            {pct > 0.5 && pct < 99.5 && (
              <line x1="0" x2="120" y1={fillY} y2={fillY} className="text-emerald-500 dark:text-emerald-300"
                stroke="currentColor" strokeWidth="1.6" strokeOpacity="0.9" />
            )}
          </g>

          {/* The silhouette itself, drawn last and unclipped — a clipped stroke
              loses its outer half and the brain reads thin-edged. */}
          <g className="text-sky-500 dark:text-sky-400" fill="none" stroke="currentColor" strokeOpacity="0.8" strokeWidth="2.4" strokeLinejoin="round">
            <path d={OUTLINE} />
            <path d={STEM} />
          </g>
          <g clipPath={`url(#level-${uid})`} className={`text-emerald-500 dark:text-emerald-300 ${ready ? 'animate-pulse' : ''}`}
            fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round">
            <path d={OUTLINE} />
            <path d={STEM} />
          </g>
        </svg>

        <div className={`lmc-figure font-mono text-3xl font-bold leading-none tabular-nums ${ready ? 'text-emerald-600 dark:text-emerald-300' : 'text-sky-700 dark:text-sky-300'}`}>
          {measurable ? `${shown}%` : '—'}
        </div>
        <div className="mt-1 text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
          {!measurable ? 'nothing to measure yet' : ready ? 'every question answered' : `${Math.round(answered)} of ${asked} answered`}
        </div>

        {/* How much of the WORK is done, which is a different question from how many
            questions have an answer. The figure above moves in whole steps and can sit
            still for days while collection grinds on; this one moves every time a row
            lands. Both are honest and neither replaces the other. */}
        {dataNeeded > 0 && (
          <div className="mt-3 w-full">
            <div className="h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
              <div className="h-full rounded-full bg-sky-500 transition-[width] duration-700 dark:bg-sky-400"
                   style={{ width: `${Math.min(100, (dataHeld / dataNeeded) * 100)}%` }} />
            </div>
            <div className="mt-1 font-mono text-[13px] font-semibold tabular-nums text-sky-700 dark:text-sky-300">
              {((dataHeld / dataNeeded) * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
              of all research data collected
            </div>
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <ul className="space-y-2">
          {tracks.map((g) => {
            const locked = g.total > 0 && g.answered >= g.total
            return (
              <li key={g.key} className="flex gap-2.5">
                <span
                  className={`mt-[3px] grid h-4 w-4 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                    locked
                      ? 'bg-emerald-500/15 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300'
                      : 'bg-sky-500/15 text-sky-600 dark:bg-sky-400/15 dark:text-sky-300'
                  }`}
                  aria-hidden
                >
                  {locked ? '✓' : '·'}
                </span>
                <span className="min-w-0 text-[13px] leading-relaxed">
                  <b className={locked ? 'text-neutral-900 dark:text-neutral-100' : 'text-sky-700 dark:text-sky-300'}>{g.label}</b>
                  <span className="font-mono text-[12px] text-neutral-500 dark:text-neutral-400">
                    {' '}{g.answered}/{g.total}
                    {!locked && g.evidence > 0 && (
                      <span className="text-sky-600/70 dark:text-sky-400/70">
                        {' '}+{Math.round(g.evidence * 100)}% data
                      </span>
                    )}
                  </span>
                  <span className="text-neutral-600 dark:text-neutral-400"> — {g.detail}</span>
                </span>
              </li>
            )
          })}
        </ul>
        {!ready && (
          <div className="mt-3 text-[12px] text-neutral-500">
            The brain cannot reach 100% while a question is still open. A hypothesis
            that comes back DEAD counts as answered — a ruled-out idea is information
            gathered, not information missing.
          </div>
        )}
      </div>
    </div>
  )
}
