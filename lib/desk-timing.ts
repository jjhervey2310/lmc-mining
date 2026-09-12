// TIMING GRADE — A/B/C/D/F for "is NOW a good moment to add this name", scored against the house
// laws (constitution v4/v4.1) and the tape. Deterministic, numbers only — never from thesis text.
// HARD bars (chase laws, RUNNING extension, drawdown halt) are an F that no button can override:
// the constitution says chase-bar exemptions are refused in any regime. An UNMEASURABLE law is a
// hard bar too (2026-09-10): without the 20-day high the RUNNING extension check cannot run, and a
// rate-limited chart fetch used to drop that law silently — leaving a name that might be 40% above
// its 20-day high grading D and buyable on override. Not proven safe is not the same as safe. PROCESS bars (cash floor,
// slots, weekly count, blackout) cap the grade at D — override territory, which the constitution allows
// Jacob per trade, and the override is logged. A / B / C = clear to buy at the ruled size.

export const ANCHOR = new Set(['BTC', 'SOL'])   // v4: ETH out of the anchor
// '?' = COULD NOT GRADE (no live price). It is NOT an F. An F is a judgement about the entry;
// '?' means the grader was blind. Conflating them made five B-scoring names look like rejects
// when CoinGecko rate-limited us (Jacob 2026-09-11: "why are they all ranked D or F").
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F' | '?'

export interface TimingInput {
  symbol: string
  price: number
  d1: number | null; d7: number | null; d30: number | null       // % changes
  vol24h: number | null; avgVol20: number | null                 // USD
  hi20: number | null                                            // highest daily close of the prior 20 days
  tapeError?: string | null                                      // why the 30-day chart is missing, when it is
  rs7VsBtc: number | null                                        // 7d return minus BTC's, percentage points
  armed: { kind: string; level: number }[]                       // desk_triggers rows for the symbol
  cashUsd: number; bookUsd: number
  sleeveCount: number; slots: number; holdingsCount: number
  weeklyEntries: number                                          // sleeve buys since Monday 00:00 Denver
  blackout: string | null                                        // reason text when inside an entry blackout
  halted: boolean                                                // loop drawdown halt / kill switch off
  halfSize: boolean                                              // macro modifier active
  held: boolean
  priceStale?: { at: string } | null   // price came from cg_history, not a live quote
}

export interface TimingResult {
  grade: Grade; score: number
  hard: string[]; soft: string[]; plus: string[]
  size: { usd: number; pctBook: number; halfSize: boolean; cappedBy: string | null }
  stop: { price: number; source: string; pct: number }
  buyable: boolean            // no hard bar and score >= C
  overridable: boolean        // soft bars only
}

const round2 = (n: number) => Math.round(n * 100) / 100

export function gradeTiming(i: TimingInput): TimingResult {
  const hard: string[] = [], soft: string[] = [], plus: string[] = []
  let score = 100
  let capD = false            // a process bar (no slot, weekly cap, blackout, cash floor) caps the grade at D: override territory, never a clean buy
  const ded = (pts: number, why: string) => { score -= pts; soft.push(`−${pts} ${why}`) }
  const add = (pts: number, why: string) => { score = Math.min(100, score + pts); plus.push(`+${pts} ${why}`) }

  // ── HARD BARS (law) ──
  if (i.d1 != null && i.d1 >= 15) hard.push(`chase law: +${i.d1.toFixed(1)}% in 24h (bar is +15%)`)
  if (i.d30 != null && i.d30 >= 70) hard.push(`chase law: +${i.d30.toFixed(0)}% in 30d (bar is +70%)`)
  const ext = i.hi20 ? (i.price / i.hi20 - 1) * 100 : null
  if (ext != null && ext > 15) hard.push(`RUNNING: ${ext.toFixed(0)}% above its 20-day high (no-entry zone past +15%)`)
  if (i.hi20 == null) hard.push(`RUNNING law UNCHECKABLE: no 20-day high${i.tapeError ? ` — ${i.tapeError}` : ' — not enough daily history'}. Extension is unknown, so no entry is cleared.`)
  if (i.halted) hard.push('desk loop halted or paused — no new entries')
  if (i.held) hard.push('already held — adds go through the deposit basket, not the queue')
  // A rate-limited quote falls back to the last daily close so the grade is still readable, but an
  // order must never be sized or stopped off a stale mark (2026-09-10: CoinGecko 429s blanked the tab).
  if (i.priceStale) hard.push(`stale price — last close from ${i.priceStale.at.slice(0, 16).replace('T', ' ')}Z, no live quote. Refresh before any order.`)

  // ── TAPE ──
  if (ext != null) {
    if (ext > 0) ded(Math.round(ext * 1.5), `${ext.toFixed(1)}% above the 20-day high (fresh breakout territory)`)
    else if (ext < -25) ded(15, `${Math.abs(ext).toFixed(0)}% below the 20-day high — in a drawdown, no base yet`)
    else if (ext >= -3) add(10, `at the 20-day high with no extension — cleanest breakout point`)
  }
  if (i.d30 != null && i.d30 >= 40) ded(20, `+${i.d30.toFixed(0)}% in 30d — most of the move may be behind it`)
  else if (i.d30 != null && i.d30 >= 20) ded(8, `+${i.d30.toFixed(0)}% in 30d`)
  if (i.d7 != null && i.d7 >= 25) ded(10, `+${i.d7.toFixed(0)}% in 7d — hot week, expect a pullback`)
  if (i.d1 != null && i.d1 >= 8) ded(10, `+${i.d1.toFixed(1)}% today — buying strength intraday`)
  if (i.d1 != null && i.d1 <= -8) ded(8, `${i.d1.toFixed(1)}% today — catching a falling day`)
  if (i.rs7VsBtc != null) {
    if (i.rs7VsBtc < 0) ded(10, `weaker than BTC over 7d (${i.rs7VsBtc.toFixed(1)} pts)`)
    else if (i.rs7VsBtc >= 5) add(5, `outperforming BTC over 7d (+${i.rs7VsBtc.toFixed(1)} pts)`)
  }
  if (i.vol24h != null && i.avgVol20) {
    const x = i.vol24h / i.avgVol20
    if (x >= 1.5) add(8, `volume ${x.toFixed(1)}x its 20-day average — move is confirmed`)
    else if (x < 0.7) ded(10, `volume ${x.toFixed(1)}x its 20-day average — no participation`)
  } else if (i.avgVol20 == null) {
    soft.push(`volume confirmation unchecked — no 20-day average volume${i.tapeError ? ` (${i.tapeError})` : ''}`)
  }
  const entryLines = i.armed.filter((a) => ['bid', 'entry', 'deep_rung', 'reclaim'].includes(a.kind))
  if (entryLines.length) {
    const nearest = entryLines.reduce((b, a) => Math.abs(a.level - i.price) < Math.abs(b.level - i.price) ? a : b)
    const away = (i.price / nearest.level - 1) * 100
    if (Math.abs(away) <= 3) add(10, `at the desk's armed ${nearest.kind} line ${nearest.level}`)
    else if (away > 10) ded(15, `${away.toFixed(0)}% above the desk's armed ${nearest.kind} line ${nearest.level} — paying up`)
  }

  // ── BOOK / PROCESS (soft, overridable) ──
  const floor = i.bookUsd * 0.10
  const openSlots = i.slots - i.sleeveCount
  if (openSlots <= 0) { ded(25, `no open sleeve slot (${i.sleeveCount}/${i.slots} filled)`); capD = true }
  // WEEKLY CAP REMOVED 2026-09-11 on Jacob's instruction ("there is no two entries per week cap if
  // there is take it out"). The rulebook contradicted itself: v3/3.1 listed "2 new entries/week" among
  // the process laws, a later amendment stated "weekly cap REPLACED by open slots", and a third clause
  // still said it applied. The grader was enforcing the retired half while the replacement (open sleeve
  // slots) was already live, so entries were being blocked twice by two versions of the same rule.
  // weeklyEntries is still reported for visibility; it no longer gates anything.
  if (i.blackout) { ded(40, `entry blackout: ${i.blackout}`); capD = true }
  if (i.holdingsCount >= 10) ded(15, `already at the ~10-holding target`)

  // ── SIZE (v4.1): 6% of book, $50 minimum at a $500+ book, 10% max, half while the macro modifier runs ──
  let usd = round2(Math.max(i.bookUsd >= 500 ? 50 : 10, i.bookUsd * 0.06))
  usd = Math.min(usd, round2(i.bookUsd * 0.10))
  let cappedBy: string | null = null
  if (i.halfSize) { usd = round2(Math.max(i.bookUsd >= 500 ? 50 : 10, usd / 2)); cappedBy = 'macro half-size (until the FOMC close 09-16)' }
  const spendable = round2(i.cashUsd - floor)
  if (usd > spendable) {
    ded(25, `would breach the 10% cash floor (cash $${i.cashUsd.toFixed(0)}, floor $${floor.toFixed(0)}, room $${Math.max(0, spendable).toFixed(0)})`)
    if (spendable >= (i.bookUsd >= 500 ? 50 : 10)) { usd = spendable; cappedBy = 'cash floor' } else capD = true
  }
  if (usd > i.cashUsd) { usd = round2(Math.max(0, i.cashUsd)); cappedBy = 'buying power' }

  // ── STOP: the desk's armed stop row for the name, else −20% (v4 sleeve rule) ──
  const armedStop = i.armed.find((a) => a.kind === 'stop')
  const stop = armedStop && armedStop.level < i.price ? { price: armedStop.level, source: 'desk_triggers stop row', pct: (armedStop.level / i.price - 1) * 100 }
    : { price: round2(i.price * 0.80 * 1e6) / 1e6, source: 'v4 default −20% from fill', pct: -20 }

  score = Math.max(0, Math.min(100, Math.round(score)))
  // A stale price means UNGRADEABLE, not failed: report '?' and keep the merit score visible so a
  // data outage is never mistaken for a bad name. The hard bar still stands — '?' is never buyable.
  const blind = i.priceStale != null || i.hi20 == null
  const meritHard = hard.filter((h) => !/^stale price|^RUNNING law UNCHECKABLE/.test(h))
  let grade: Grade = blind && meritHard.length === 0 ? '?'
    : meritHard.length || hard.length ? 'F'
    : score >= 80 ? 'A' : score >= 65 ? 'B' : score >= 50 ? 'C' : score >= 35 ? 'D' : 'F'
  if (capD && (grade === 'A' || grade === 'B' || grade === 'C')) grade = 'D'
  return {
    grade, score, hard, soft, plus,
    size: { usd, pctBook: i.bookUsd ? round2((usd / i.bookUsd) * 100) : 0, halfSize: i.halfSize, cappedBy },
    stop,
    buyable: hard.length === 0 && (grade === 'A' || grade === 'B' || grade === 'C') && usd > 0,   // D = override only, F = never
    overridable: hard.length === 0 && usd > 0,
  }
}
