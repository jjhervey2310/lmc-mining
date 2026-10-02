import { describe, expect, it } from 'vitest'
import { DAY_MS, LookAheadError, alignIndex, assertCompleted, completedBars, completedDailyPoints, denverWeekStartIso, lastCompletedIndex } from '@/lib/desk/market-time'

const T0 = Date.UTC(2026, 0, 1)
const bars = Array.from({ length: 5 }, (_, k) => ({ t: T0 + k * DAY_MS, c: 100 + k }))

describe('completed-bar rule', () => {
  it('excludes the bar that is still open at the decision time', () => {
    const asOf = T0 + 4 * DAY_MS + 12 * 3_600_000
    expect(completedBars(bars, asOf).map((b) => b.c)).toEqual([100, 101, 102, 103])
  })
  it('a bar completes exactly at its close', () => {
    expect(completedBars(bars, T0 + 5 * DAY_MS)).toHaveLength(5)
    expect(completedBars(bars, T0 + 5 * DAY_MS - 1)).toHaveLength(4)
  })
  it('lastCompletedIndex', () => {
    expect(lastCompletedIndex(bars, T0 + 2 * DAY_MS + 1)).toBe(1)
    expect(lastCompletedIndex(bars, T0)).toBe(-1)
  })
  it('refuses a signal on an incomplete bar', () => {
    expect(() => assertCompleted(bars[4], T0 + 4 * DAY_MS + 1)).toThrow(LookAheadError)
    expect(assertCompleted(bars[3], T0 + 4 * DAY_MS)).toBe(bars[3])
  })
  it('drops the partial point from a CoinGecko daily series', () => {
    const pts: [number, number][] = [[T0, 1], [T0 + DAY_MS, 2], [T0 + 2 * DAY_MS + 3_600_000, 3]]
    expect(completedDailyPoints(pts, T0 + 2 * DAY_MS + 7_200_000).map((p) => p[1])).toEqual([1, 2])
  })
})

describe('timestamp joins', () => {
  it('a missing day in one series does not shift the other', () => {
    const btc = bars.filter((b) => b.t !== T0 + DAY_MS)
    const k = alignIndex(btc, bars[3].t)
    expect(btc[k].t).toBe(bars[3].t)
  })
  it('throws when the aligned bar had not completed', () => {
    expect(() => alignIndex(bars, bars[3].t, { asOf: T0 + 3 * DAY_MS + 1 })).toThrow(LookAheadError)
  })
})

describe('denverWeekStartIso', () => {
  const local = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  it('is Monday 00:00 Denver in MDT and MST', () => {
    expect(local(denverWeekStartIso(new Date('2026-07-15T12:00:00Z')))).toBe('Mon, 00:00')
    expect(local(denverWeekStartIso(new Date('2026-01-14T12:00:00Z')))).toBe('Mon, 00:00')
  })
  it('the old fixed -6h offset would have been an hour early in winter', () => {
    // 2026-01-12 06:30Z is Sunday 23:30 MST; 07:30Z is Monday 00:30 MST.
    expect(denverWeekStartIso(new Date('2026-01-12T06:30:00Z'))).toBe('2026-01-05T07:00:00.000Z')
    expect(denverWeekStartIso(new Date('2026-01-12T07:30:00Z'))).toBe('2026-01-12T07:00:00.000Z')
  })
})
