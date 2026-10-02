import { describe, expect, it } from 'vitest'
import { rsCompletedPct, toDailyBars } from '@/lib/desk/relative-strength'

const T0 = Date.UTC(2026, 0, 1)
const DAY = 86_400_000
const pts = (f: (k: number) => number, n = 12, jitterMs = 0) => Array.from({ length: n }, (_, k) => [T0 + k * DAY + jitterMs, f(k)])
const asOf = T0 + 12 * DAY + 3_600_000   // an hour into day 12: days 0..11 complete

describe('relative strength on the completed-bar clock', () => {
  it('matches the 7-day difference of completed closes', () => {
    const sym = pts((k) => 100 + 2 * k), btc = pts((k) => 100 + k)
    // completed days 0..11: sym 122 vs 108 (day 4), btc 111 vs 104
    const expected = (122 / 108 - 1 - (111 / 104 - 1)) * 100
    expect(rsCompletedPct(sym, btc, 7, asOf)).toBeCloseTo(expected, 9)
  })
  it('ignores the live/intraday price entirely — it is not an input', () => {
    const sym = pts((k) => 100 + 2 * k), btc = pts((k) => 100 + k)
    const a = rsCompletedPct(sym, btc, 7, asOf)
    const symWithTodayPartial = [...sym, [T0 + 12 * DAY, 9999]]   // today's partial point, huge move
    expect(rsCompletedPct(symWithTodayPartial, btc, 7, asOf)).toBe(a)
  })
  it('a missing day in BTC is no evidence', () => {
    const sym = pts((k) => 100 + k), btc = pts((k) => 100 + k).filter((p) => p[0] !== T0 + 4 * DAY)
    expect(rsCompletedPct(sym, btc, 7, asOf)).toBeNull()
  })
  it('accepts second-based timestamps and CoinGecko minute jitter', () => {
    const sec = pts((k) => 100 + k, 12, 45_000).map((p) => [Math.floor(p[0] / 1000), p[1]])
    expect(toDailyBars(sec, asOf)).toHaveLength(12)
    expect(toDailyBars(sec, asOf)[3].t).toBe(T0 + 3 * DAY)
  })
})
