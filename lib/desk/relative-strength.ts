import { DAY_MS, completedDailyPoints, returnOver, type Bar } from './market-time'

// RELATIVE STRENGTH ON THE COMPLETED-BAR CLOCK. The breakout rule reads completed daily closes; its
// RS leg must read the same closes for both assets, joined by timestamp. A rolling intraday "7d
// change" from a quote API is a different clock and can flip the signal between two reads of the same
// day. The live price is deliberately not an input here.

type Pt = number[]   // [ts, close, ...] as stored in cg_history / returned by CoinGecko

/** Normalise [ts, close, …] points (ms or s) to completed daily bars keyed at UTC midnight. */
export function toDailyBars(points: Pt[], asOf = Date.now()): (Bar & { c: number })[] {
  const pts = points
    .filter((p) => Array.isArray(p) && p.length >= 2 && p[1] > 0)
    .map((p) => [p[0] < 1e12 ? p[0] * 1000 : p[0], p[1]] as [number, number])
  return completedDailyPoints(pts, asOf).map((p) => ({ t: Math.floor(p[0] / DAY_MS) * DAY_MS, c: p[1] }))
}

/** (sym N-day return − BTC N-day return) in percent, both over the same completed bars; null when
 *  either series lacks the start or end bar. */
export function rsCompletedPct(symPoints: Pt[], btcPoints: Pt[], days = 7, asOf = Date.now()): number | null {
  const s = toDailyBars(symPoints, asOf), b = toDailyBars(btcPoints, asOf)
  if (!s.length || !b.length) return null
  const tEnd = s[s.length - 1].t
  const rs = returnOver(s, tEnd, days), rb = returnOver(b, tEnd, days)
  return rs == null || rb == null ? null : (rs - rb) * 100
}
