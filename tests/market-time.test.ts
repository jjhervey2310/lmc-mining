import { describe, expect, it } from 'vitest'
import { DAY_MS, LookAheadError, alignIndex, assertCompleted, completedBars, completedDailyPoints, denverWeekStartIso, lastCompletedIndex, returnOver, zonedMidnightUtc } from '@/lib/desk/market-time'

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

describe('returnOver', () => {
  const series = Array.from({ length: 10 }, (_, k) => ({ t: T0 + k * DAY_MS, c: 100 + k }))
  it('7-bar return over calendar days', () => expect(returnOver(series, T0 + 9 * DAY_MS, 7)).toBeCloseTo(109 / 102 - 1, 12))
  it('a missing start day is no evidence, not a shorter window', () => {
    const gappy = series.filter((b) => b.t !== T0 + 2 * DAY_MS)
    expect(returnOver(gappy, T0 + 9 * DAY_MS, 7)).toBeNull()
    expect(returnOver(gappy, T0 + 8 * DAY_MS, 7)).not.toBeNull()
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
  // Compare formatted parts, not a locale string: ICU builds differ on punctuation.
  const local = (iso: string) => {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso))
    const get = (t: string) => parts.find((p) => p.type === t)?.value
    return [get('weekday'), get('hour'), get('minute')]
  }
  it('is Monday 00:00 Denver in MDT and MST', () => {
    expect(local(denverWeekStartIso(new Date('2026-07-15T12:00:00Z')))).toEqual(['Mon', '00', '00'])
    expect(local(denverWeekStartIso(new Date('2026-01-14T12:00:00Z')))).toEqual(['Mon', '00', '00'])
  })
  it('is correct on a DST-transition Sunday (review finding #6)', () => {
    // Sun 2026-03-08 14:00 MDT (DST began 02:00 that morning): Monday was 03-02 in MST → 07:00Z.
    expect(denverWeekStartIso(new Date('2026-03-08T20:00:00Z'))).toBe('2026-03-02T07:00:00.000Z')
    // Sun 2026-11-01 13:00 MST (DST ended 02:00 that morning): Monday was 10-26 in MDT → 06:00Z.
    expect(denverWeekStartIso(new Date('2026-11-01T20:00:00Z'))).toBe('2026-10-26T06:00:00.000Z')
    expect(new Date(zonedMidnightUtc(2026, 3, 9)).toISOString()).toBe('2026-03-09T06:00:00.000Z')
  })
  it('the old fixed -6h offset would have been an hour early in winter', () => {
    // 2026-01-12 06:30Z is Sunday 23:30 MST; 07:30Z is Monday 00:30 MST.
    expect(denverWeekStartIso(new Date('2026-01-12T06:30:00Z'))).toBe('2026-01-05T07:00:00.000Z')
    expect(denverWeekStartIso(new Date('2026-01-12T07:30:00Z'))).toBe('2026-01-12T07:00:00.000Z')
  })
})
