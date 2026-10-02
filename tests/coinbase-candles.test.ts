import { describe, expect, it } from 'vitest'
import { candleWindow, parseCoinbaseCandles, MAX_BARS } from '@/lib/desk/coinbase-candles'
import { advanceCursor, type Cursor } from '@/lib/desk/md-backfill'

const H = 3_600_000, D = 86_400_000
const T0 = Date.UTC(2026, 0, 10)

describe('candleWindow', () => {
  it('holds at most 300 bars and aligns to the interval', () => {
    const w = candleWindow(T0 + 1234, 60)
    expect(w.endMs).toBe(T0)
    expect((w.endMs - w.startMs) / H + 1).toBe(MAX_BARS)
  })
})

describe('parseCoinbaseCandles', () => {
  const raw = [[(T0 + D) / 1000, 1, 3, 2, 2.5, 10], [T0 / 1000, 1, 3, 2, 2.4, 11], ['bad'], [(T0 - D) / 1000, 1, 3, 2, 0, 5]]
  it('drops the still-open bar, malformed rows, and zero closes', () => {
    const rows = parseCoinbaseCandles(raw, 'BTC', 1440, T0 + D + H)   // day T0+D is open for an hour
    expect(rows.map((r) => r.bar_time)).toEqual([new Date(T0).toISOString()])
    expect(rows[0]).toMatchObject({ venue: 'coinbase', symbol: 'BTC', interval_minutes: 1440, open: 2, high: 3, low: 1, close: 2.4, volume: 11 })
  })
  it('includes the bar once it has closed', () => {
    expect(parseCoinbaseCandles(raw, 'BTC', 1440, T0 + 2 * D)).toHaveLength(2)
  })
})

describe('advanceCursor', () => {
  const c: Cursor = { venue: 'coinbase', symbol: 'X', product_id: 'X-USD', interval_minutes: 1440, next_end: new Date(T0).toISOString(), target_start: new Date(T0 - 1000 * D).toISOString(), done: false, bars: 5, requests: 1, priority: 1, error: null, head_synced_at: null }
  const rows = parseCoinbaseCandles([[T0 / 1000, 1, 2, 1, 1, 1], [(T0 - D) / 1000, 1, 2, 1, 1, 1]], 'X', 1440, T0 + D)
  it('walks backwards from the oldest bar', () => {
    const s = advanceCursor(c, T0 - 299 * D, rows, false)
    expect(s).toMatchObject({ done: false, bars: 7, requests: 2, error: null })
    expect(s.next_end).toBe(new Date(T0 - 2 * D).toISOString())
  })
  it('finishes on an empty chunk (history exhausted) or past the target', () => {
    expect(advanceCursor(c, T0 - 299 * D, [], false).done).toBe(true)
    expect(advanceCursor(c, T0 - 1001 * D, rows, false).done).toBe(true)
  })
  it('a 404 ends the cursor with an error, never silently', () => {
    expect(advanceCursor(c, T0 - 299 * D, [], true)).toMatchObject({ done: true, error: 'product 404' })
  })
})
