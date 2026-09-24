// Checks the indicator library against reference values and edge cases.
// Run: npx ts-node --project tsconfig.scripts.json scripts/verify-indicators.ts

import { sma, ema, rsi, macd, bollinger, vwap } from '../lib/chart/indicators'
import type { Candle } from '../lib/chart/types'

function check(label: string, ok: boolean, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`)
  if (!ok) process.exitCode = 1
}

const close = (values: number[], startTime = 0, step = 86400): Candle[] =>
  values.map((v, i) => ({ time: startTime + i * step, open: v, high: v, low: v, close: v }))

// ── SMA ─────────────────────────────────────────────────────────────────
const ramp = close([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
const s3 = sma(ramp, 3)
check('SMA length skips warm-up', s3.length === 8, `${s3.length} of 10 bars`)
check('SMA first value', s3[0].value === 2, `${s3[0].value}`)
check('SMA last value', s3[7].value === 9, `${s3[7].value}`)
check('SMA aligns to bar time', s3[0].time === ramp[2].time)
check('SMA insufficient data returns empty', sma(close([1, 2]), 5).length === 0)

// ── EMA ─────────────────────────────────────────────────────────────────
const flat = close(new Array(30).fill(50))
const e = ema(flat, 10)
check('EMA of a constant series is that constant', e.every((p) => Math.abs(p.value - 50) < 1e-9))
const eRamp = ema(ramp, 3)
check('EMA seeds with SMA', Math.abs(eRamp[0].value - 2) < 1e-9, `${eRamp[0].value}`)
check('EMA tracks an uptrend upward', eRamp[eRamp.length - 1].value > eRamp[0].value)

// ── RSI (Wilder's reference series) ─────────────────────────────────────
const wilder = close([
  44.3389, 44.0902, 44.1497, 43.6124, 44.3278, 44.8264, 45.0955, 45.4245,
  45.8433, 46.0826, 45.8931, 46.0328, 45.614, 46.282, 46.282,
])
const r = rsi(wilder, 14)
check('RSI matches Wilder reference (~70.53)', Math.abs(r[0].value - 70.53) < 0.1, `${r[0].value.toFixed(2)}`)
check('RSI of a monotonic rise is 100', rsi(close([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]), 14)[0].value === 100)
const allDown = rsi(close([15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]), 14)
check('RSI of a monotonic fall is 0', allDown[0].value === 0, `${allDown[0].value}`)
check('RSI stays within 0-100', rsi(wilder, 14).every((p) => p.value >= 0 && p.value <= 100))

// ── MACD ────────────────────────────────────────────────────────────────
const m = macd(flat, 12, 26, 9)
check('MACD of a constant series is 0', m.macd.every((p) => Math.abs(p.value) < 1e-9), `${m.macd.length} points`)
const trend = close(Array.from({ length: 120 }, (_, i) => 100 + i))
const mt = macd(trend, 12, 26, 9)
check('MACD is positive in an uptrend', mt.macd[mt.macd.length - 1].value > 0, `${mt.macd[mt.macd.length - 1].value.toFixed(3)}`)
check('MACD lines are time-aligned', mt.histogram.every((h, i) => h.time === mt.signal[i].time))
check('histogram equals macd - signal', mt.histogram.every((h) => {
  const mv = mt.macd.find((p) => p.time === h.time)!.value
  const sv = mt.signal.find((p) => p.time === h.time)!.value
  return Math.abs(h.value - (mv - sv)) < 1e-9
}))

// ── Bollinger ───────────────────────────────────────────────────────────
const b = bollinger(flat, 20, 2)
check('Bollinger bands collapse on a constant series',
  b.upper.every((p, i) => Math.abs(p.value - b.lower[i].value) < 1e-9))
const bRamp = bollinger(ramp, 3, 2)
check('Bollinger middle equals SMA', bRamp.middle.every((p, i) => Math.abs(p.value - s3[i].value) < 1e-9))
check('Bollinger upper > lower on real data', bRamp.upper.every((p, i) => p.value > bRamp.lower[i].value))

// ── VWAP ────────────────────────────────────────────────────────────────
const intraday: Candle[] = [
  { time: 0, open: 10, high: 12, low: 8, close: 10, volume: 100 },
  { time: 3600, open: 10, high: 14, low: 10, close: 12, volume: 300 },
  { time: 86400, open: 20, high: 20, low: 20, close: 20, volume: 50 }, // next UTC day
]
const v = vwap(intraday)
check('VWAP first bar equals typical price', Math.abs(v[0].value - 10) < 1e-9, `${v[0].value}`)
check('VWAP is volume-weighted', Math.abs(v[1].value - (10 * 100 + 12 * 300) / 400) < 1e-9, `${v[1].value.toFixed(4)}`)
check('VWAP resets at the UTC day boundary', Math.abs(v[2].value - 20) < 1e-9, `${v[2].value}`)
check('VWAP survives zero-volume bars',
  vwap([{ time: 0, open: 5, high: 5, low: 5, close: 5 }])[0].value === 5)

console.log('\nDone.')
