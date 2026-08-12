// Technical indicators.
//
// Pure functions over Candle[] returning time-aligned Point[], so results drop
// straight into a lightweight-charts line series. Every series omits its
// warm-up period rather than emitting zeros or nulls — a moving average that
// starts at 0 draws a cliff on the chart and misleads the eye.
//
// Conventions follow the standard definitions (Wilder's smoothing for RSI,
// population standard deviation for Bollinger) so values match what traders
// see elsewhere.

import type { Candle, Point } from './types'

const DAY_SECONDS = 86_400

/** Simple moving average. */
export function sma(candles: Candle[], period: number): Point[] {
  if (period < 1 || candles.length < period) return []
  const out: Point[] = []
  let sum = 0
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close
    if (i >= period) sum -= candles[i - period].close
    if (i >= period - 1) out.push({ time: candles[i].time, value: sum / period })
  }
  return out
}

/**
 * Exponential moving average, seeded with the SMA of the first `period` bars
 * (the conventional seed — seeding with the first close alone biases the
 * early series toward that single value).
 */
export function ema(candles: Candle[], period: number): Point[] {
  if (period < 1 || candles.length < period) return []
  const k = 2 / (period + 1)
  const out: Point[] = []

  let seed = 0
  for (let i = 0; i < period; i++) seed += candles[i].close
  let prev = seed / period
  out.push({ time: candles[period - 1].time, value: prev })

  for (let i = period; i < candles.length; i++) {
    prev = candles[i].close * k + prev * (1 - k)
    out.push({ time: candles[i].time, value: prev })
  }
  return out
}

/** EMA over a bare value series — used to build the MACD signal line. */
function emaOfValues(points: Point[], period: number): Point[] {
  if (period < 1 || points.length < period) return []
  const k = 2 / (period + 1)
  const out: Point[] = []

  let seed = 0
  for (let i = 0; i < period; i++) seed += points[i].value
  let prev = seed / period
  out.push({ time: points[period - 1].time, value: prev })

  for (let i = period; i < points.length; i++) {
    prev = points[i].value * k + prev * (1 - k)
    out.push({ time: points[i].time, value: prev })
  }
  return out
}

/** Relative Strength Index using Wilder's smoothing. */
export function rsi(candles: Candle[], period = 14): Point[] {
  if (candles.length <= period) return []
  const out: Point[] = []

  let gain = 0
  let loss = 0
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close
    if (change >= 0) gain += change
    else loss -= change
  }
  let avgGain = gain / period
  let avgLoss = loss / period

  const toRsi = (g: number, l: number) => (l === 0 ? 100 : 100 - 100 / (1 + g / l))
  out.push({ time: candles[period].time, value: toRsi(avgGain, avgLoss) })

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close
    const up = change > 0 ? change : 0
    const down = change < 0 ? -change : 0
    avgGain = (avgGain * (period - 1) + up) / period
    avgLoss = (avgLoss * (period - 1) + down) / period
    out.push({ time: candles[i].time, value: toRsi(avgGain, avgLoss) })
  }
  return out
}

export interface MacdResult {
  macd: Point[]
  signal: Point[]
  histogram: Point[]
}

/** MACD (fast EMA - slow EMA), its signal line, and the histogram. */
export function macd(candles: Candle[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const fastEma = ema(candles, fast)
  const slowEma = ema(candles, slow)
  if (!fastEma.length || !slowEma.length) return { macd: [], signal: [], histogram: [] }

  // The fast EMA starts earlier; align both to the slow EMA's first bar.
  const fastByTime = new Map(fastEma.map((p) => [p.time, p.value]))
  const macdLine: Point[] = []
  for (const s of slowEma) {
    const f = fastByTime.get(s.time)
    if (f === undefined) continue
    macdLine.push({ time: s.time, value: f - s.value })
  }

  const signal = emaOfValues(macdLine, signalPeriod)
  const signalByTime = new Map(signal.map((p) => [p.time, p.value]))
  const histogram: Point[] = []
  for (const m of macdLine) {
    const s = signalByTime.get(m.time)
    if (s === undefined) continue
    histogram.push({ time: m.time, value: m.value - s })
  }

  return { macd: macdLine, signal, histogram }
}

export interface BollingerResult {
  upper: Point[]
  middle: Point[]
  lower: Point[]
}

/** Bollinger Bands: SMA +/- `mult` population standard deviations. */
export function bollinger(candles: Candle[], period = 20, mult = 2): BollingerResult {
  if (period < 1 || candles.length < period) return { upper: [], middle: [], lower: [] }
  const upper: Point[] = []
  const middle: Point[] = []
  const lower: Point[] = []

  for (let i = period - 1; i < candles.length; i++) {
    let sum = 0
    for (let j = i - period + 1; j <= i; j++) sum += candles[j].close
    const mean = sum / period

    let variance = 0
    for (let j = i - period + 1; j <= i; j++) {
      const d = candles[j].close - mean
      variance += d * d
    }
    const sd = Math.sqrt(variance / period)

    const time = candles[i].time
    middle.push({ time, value: mean })
    upper.push({ time, value: mean + mult * sd })
    lower.push({ time, value: mean - mult * sd })
  }
  return { upper, middle, lower }
}

/**
 * Session-anchored VWAP, reset at each UTC day boundary.
 *
 * Only meaningful on intraday bars — on daily-or-slower bars each "session"
 * holds a single candle and VWAP degenerates to the typical price, so callers
 * should not offer it there.
 */
export function vwap(candles: Candle[]): Point[] {
  const out: Point[] = []
  let cumPv = 0
  let cumVol = 0
  let session = -1

  for (const c of candles) {
    const day = Math.floor(c.time / DAY_SECONDS)
    if (day !== session) {
      session = day
      cumPv = 0
      cumVol = 0
    }
    const volume = c.volume ?? 0
    const typical = (c.high + c.low + c.close) / 3
    cumPv += typical * volume
    cumVol += volume
    // Before any volume accumulates the ratio is undefined; the typical price
    // is the correct degenerate value.
    out.push({ time: c.time, value: cumVol > 0 ? cumPv / cumVol : typical })
  }
  return out
}
