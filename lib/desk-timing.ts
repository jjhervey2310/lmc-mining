// TIMING GRADE — A/B/C/D/F for "is NOW a good moment to add this name", scored against the house
// laws (constitution v4.1 + AMENDMENT A9 / A9.1, 2026-09-06) and the tape. Deterministic, numbers
// only — never from thesis text.
// HARD bars are an F no button overrides: RUNNING (>15% above the 20-day high), the chase laws outside
// a BULL regime (+15%/24h, +70%/30d), the loop halted, the SLEEVE BREAKER tripped, already held.
// PROCESS bars cap the grade at D (Jacob's per-trade override territory, logged): no tested breakout
// signal (A9: the breakout rule is the ONLY sleeve entry; anything else is OWNER-BOOK), a CPI/FOMC
// blackout, the macro half-size window (a $50 entry needs the override until 09-16 16:00 MT), and a
// compliant size under the $50 minimum (A9.1: caps and the 5% uncommitted-cash floor beat targets —
// if the compliant size is below $50, SKIP). A / B / C = clear at the ruled size.

export const ANCHOR = new Set(['BTC', 'SOL'])   // v4: ETH out of the anchor
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
export type Regime = 'BULL' | 'NEUTRAL' | 'BEAR'

export const SLEEVE_CAP = 0.15        // A9 §3: sleeve = R&D budget, 15% of book
export const NAME_CAP = 0.10          // A9.1 §1: per-name 10%
export const CASH_FLOOR = 0.05        // A9 §5: 5% uncommitted cash below $2k
export const MIN_ENTRY = 50           // A9 §3 / A9.1 §1: $50 flat; below that, skip

export interface TimingInput {
  symbol: string
  price: number
  d1: number | null; d7: number | null; d30: number | null       // % changes
  vol24h: number | null; avgVol20: number | null                 // USD
  hi20: number | null                                            // highest close of the PRIOR 20 completed days (today excluded)
  lo20: number | null                                            // lowest close of the same window — the structural stop proxy
  rs7VsBtc: number | null                                        // 7d return minus BTC's, percentage points
  signal: boolean                                                // A9 breakout rule met on the last completed close
  signalWhy: string
  regime: Regime; regimeWhy: string
  armed: { kind: string; level: number }[]                       // desk_triggers rows for the symbol
  cashUsd: number; bookUsd: number
  sleeveUsd: number                                              // market value of every non-anchor holding
  nameUsd: number                                                // existing exposure in this name (position + known open buys)
  holdingsCount: number
  blackout: string | null                                        // reason text when inside a CPI/FOMC blackout
  halted: boolean                                                // loop kill switch off
  breaker: string | null                                         // A9 sleeve breaker: ISO since-timestamp when tripped
  halfSize: boolean                                              // macro modifier window
  held: boolean
}

export interface TimingResult {
  grade: Grade; score: number
  hard: string[]; soft: string[]; plus: string[]
  size: { usd: number; pctBook: number; halfSize: boolean; cappedBy: string | null; book: 'SLEEVE-RULE' | 'OWNER-BOOK' }
  stop: { price: number; source: string; pct: number }
  buyable: boolean            // no hard bar and grade A/B/C
  overridable: boolean        // soft bars only
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function gradeTiming(i: TimingInput): TimingResult {
  const hard: string[] = [], soft: string[] = [], plus: string[] = []
  let score = 100
  let capD = false
  const ded = (pts: number, why: string) => { score -= pts; soft.push(`−${pts} ${why}`) }
  const add = (pts: number, why: string) => { score = Math.min(100, score + pts); plus.push(`+${pts} ${why}`) }
  const bull = i.regime === 'BULL'

  // ── HARD BARS (law) ──
  const ext = i.hi20 ? (i.price / i.hi20 - 1) * 100 : null
  if (ext != null && ext > 15) hard.push(`RUNNING: ${ext.toFixed(0)}% above its 20-day high (no-entry zone past +15%)`)
  if (!bull && i.d1 != null && i.d1 >= 15) hard.push(`chase law (${i.regime} regime): +${i.d1.toFixed(1)}% in 24h (bar is +15%)`)
  if (!bull && i.d30 != null && i.d30 >= 70) hard.push(`chase law (${i.regime} regime): +${i.d30.toFixed(0)}% in 30d (bar is +70%)`)
  if (i.halted) hard.push('desk loop paused (kill switch) — no new entries')
  if (i.breaker) hard.push(`A9 SLEEVE BREAKER tripped ${i.breaker.slice(0, 10)} — no new sleeve entries until it clears`)
  if (i.held) hard.push('already held — adds go through the deposit basket, not the queue')

  // ── A9: the tested breakout rule is the ONLY sleeve entry ──
  if (i.signal) add(10, `A9 breakout signal on the last close (${i.signalWhy})`)
  else { ded(20, `no tested breakout signal (${i.signalWhy}) — A9 entry rule; a buy here is OWNER-BOOK`); capD = true }
  if (bull && i.d1 != null && i.d1 >= 15) ded(10, `+${i.d1.toFixed(1)}% day in BULL — size HALVED instead of barred (A9 §4)`)

  // ── TAPE ──
  if (ext != null) {
    if (ext > 0) ded(Math.round(ext * 1.5), `${ext.toFixed(1)}% above the 20-day high`)
    else if (ext < -25) ded(15, `${Math.abs(ext).toFixed(0)}% below the 20-day high — in a drawdown, no base yet`)
  }
  if (i.d30 != null && i.d30 >= 40) ded(bull ? 10 : 20, `+${i.d30.toFixed(0)}% in 30d — most of the move may be behind it`)
  if (i.d7 != null && i.d7 >= 25) ded(10, `+${i.d7.toFixed(0)}% in 7d — hot week, expect a pullback`)
  if (i.d1 != null && i.d1 >= 8 && i.d1 < 15) ded(8, `+${i.d1.toFixed(1)}% today — buying strength intraday`)
  if (i.d1 != null && i.d1 <= -8) ded(8, `${i.d1.toFixed(1)}% today — catching a falling day`)
  if (i.rs7VsBtc != null) {
    if (i.rs7VsBtc < 0) ded(10, `weaker than BTC over 7d (${i.rs7VsBtc.toFixed(1)} pts)`)
    else if (i.rs7VsBtc >= 5) add(5, `outperforming BTC over 7d (+${i.rs7VsBtc.toFixed(1)} pts)`)
  }
  if (i.vol24h != null && i.avgVol20) {
    const x = i.vol24h / i.avgVol20
    if (x >= 1.5) add(8, `volume ${x.toFixed(1)}x its 20-day average — participation confirmed`)
    else if (x < 0.7) ded(10, `volume ${x.toFixed(1)}x its 20-day average — no participation`)
  }
  const entryLines = i.armed.filter((a) => ['bid', 'entry', 'deep_rung', 'reclaim'].includes(a.kind))
  if (entryLines.length) {
    const nearest = entryLines.reduce((b, a) => Math.abs(a.level - i.price) < Math.abs(b.level - i.price) ? a : b)
    const away = (i.price / nearest.level - 1) * 100
    if (Math.abs(away) <= 3) add(5, `at the desk's armed ${nearest.kind} line ${nearest.level}`)
    else if (away > 10) ded(10, `${away.toFixed(0)}% above the desk's armed ${nearest.kind} line ${nearest.level}`)
  }
  if (i.regime !== 'BULL') ded(5, `regime ${i.regime} (${i.regimeWhy}) — both chase bars in force`)

  // ── PROCESS (calendar) ──
  if (i.blackout) { ded(40, `entry blackout: ${i.blackout}`); capD = true }
  if (i.holdingsCount >= 10) ded(10, `already at the ~10-holding target`)

  // ── SIZE — A9 §3 $50 flat, A9.1 §1 caps + floor take precedence; below $50 = SKIP ──
  const sleeveRoom = i.bookUsd * SLEEVE_CAP - i.sleeveUsd
  const nameRoom = i.bookUsd * NAME_CAP - i.nameUsd
  const cashRoom = i.cashUsd - i.bookUsd * CASH_FLOOR
  let usd = MIN_ENTRY
  let cappedBy: string | null = null
  const limits: [number, string][] = [[sleeveRoom, `sleeve cap 15% ($${(i.bookUsd * SLEEVE_CAP).toFixed(0)}, $${i.sleeveUsd.toFixed(0)} used)`], [nameRoom, `per-name cap 10%`], [cashRoom, `5% uncommitted-cash floor (cash $${i.cashUsd.toFixed(0)}, floor $${(i.bookUsd * CASH_FLOOR).toFixed(0)})`]]
  for (const [room, why] of limits) if (room < usd) { usd = round2(Math.max(0, room)); cappedBy = why }
  if (usd < MIN_ENTRY) { ded(25, `compliant size $${usd.toFixed(0)} is under the $${MIN_ENTRY} minimum (${cappedBy}) — A9.1: SKIP`); capD = true }
  const halveDay = bull && i.d1 != null && i.d1 >= 15
  if (i.halfSize || halveDay) {
    usd = round2(usd / 2); cappedBy = i.halfSize ? 'macro half-size window (until the FOMC close 09-16 16:00 MT)' : 'A9 §4: +15% day in BULL = half size'
    if (usd < MIN_ENTRY) { ded(10, `half-size $${usd.toFixed(0)} is under the $${MIN_ENTRY} minimum — a $50 entry needs Jacob's per-trade override here`); capD = true }
  }
  if (usd > i.cashUsd) { usd = round2(Math.max(0, i.cashUsd)); cappedBy = 'buying power' }

  // ── STOP — A9 §3: max(20-day low, −20%) at fill; the desk's armed stop row wins if it exists ──
  const armedStop = i.armed.find((a) => a.kind === 'stop')
  const structural = i.lo20 && i.lo20 < i.price ? Math.max(i.lo20, i.price * 0.80) : i.price * 0.80
  const stop = armedStop && armedStop.level < i.price
    ? { price: armedStop.level, source: 'desk_triggers stop row', pct: (armedStop.level / i.price - 1) * 100 }
    : { price: round2(structural * 1e6) / 1e6, source: i.lo20 && structural === i.lo20 ? 'A9: 20-day low (close proxy)' : 'A9: −20% from fill', pct: (structural / i.price - 1) * 100 }

  score = Math.max(0, Math.min(100, Math.round(score)))
  let grade: Grade = hard.length ? 'F' : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F'
  if (capD && (grade === 'A' || grade === 'B' || grade === 'C')) grade = 'D'
  return {
    grade, score, hard, soft, plus,
    size: { usd, pctBook: i.bookUsd ? round2((usd / i.bookUsd) * 100) : 0, halfSize: i.halfSize || halveDay, cappedBy, book: i.signal ? 'SLEEVE-RULE' : 'OWNER-BOOK' },
    stop,
    buyable: hard.length === 0 && (grade === 'A' || grade === 'B' || grade === 'C') && usd > 0,   // D = override only, F = never
    overridable: hard.length === 0 && usd > 0,
  }
}
