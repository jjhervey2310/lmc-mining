// Derived Bitcoin mining-economics series.
//
// These are the series the terminal exists for — no public charting product
// carries them, and they are the numbers that actually decide whether a
// hosting contract makes money.
//
// Nothing here is bought. Network difficulty and per-block fee history come
// from mempool.space; BTC price history comes from Kraken. Hashprice is then
// computed rather than sourced, so the methodology is inspectable:
//
//   network hashrate (H/s) = difficulty x 2^32 / 600
//   block subsidy (BTC)    = 50 / 2^floor(height / 210_000)
//   daily network revenue  = 144 x (subsidy + average fees per block)
//   hashprice ($/PH/day)   = daily revenue x BTC price / network PH/s
//
// NOTE ON CONSISTENCY: app/api/cron/hashprice-snapshot hardcodes 2.7e20, which
// unpacks to a flat 450 BTC/day — i.e. subsidy only (144 x 3.125), fees
// excluded, and the current halving epoch frozen as a constant. This module
// derives the subsidy from actual block height and includes real fees, so its
// hashprice runs slightly above that snapshot and stays correct across the
// 2028 halving. The two should be reconciled; see the PR description.

import type { Candle, Point } from './types'

const HASHES_PER_DIFFICULTY = 2 ** 32
const BLOCK_TARGET_SECONDS = 600
const BLOCKS_PER_DAY = 144
const HALVING_INTERVAL = 210_000
const SATS_PER_BTC = 1e8
const DAY_SECONDS = 86_400

/** Block subsidy in BTC at a given height. */
export function blockSubsidy(height: number): number {
  const epoch = Math.floor(height / HALVING_INTERVAL)
  // After 33 halvings the subsidy underflows to zero in integer satoshis.
  if (epoch >= 33) return 0
  return 50 / 2 ** epoch
}

/** Network hashrate in H/s implied by a difficulty value. */
export function hashrateFromDifficulty(difficulty: number): number {
  return (difficulty * HASHES_PER_DIFFICULTY) / BLOCK_TARGET_SECONDS
}

/**
 * Hashprice in USD per PH/s per day.
 *
 * @param feesPerBlockBtc average transaction fees per block, in BTC
 */
export function hashprice(
  difficulty: number,
  btcPrice: number,
  height: number,
  feesPerBlockBtc = 0,
): number {
  const networkPh = hashrateFromDifficulty(difficulty) / 1e15
  if (networkPh <= 0) return 0
  const dailyRevenueBtc = BLOCKS_PER_DAY * (blockSubsidy(height) + feesPerBlockBtc)
  return (dailyRevenueBtc * btcPrice) / networkPh
}

// ── Upstream shapes ─────────────────────────────────────────────────────

/** mempool.space: [timestamp, height, difficulty, changeRatio], newest first. */
type DifficultyAdjustment = [number, number, number, number]

/** mempool.space: average fees per block, in sats, sampled through time. */
interface FeeSample {
  avgHeight: number
  timestamp: number
  avgFees: number
}

interface Stepped {
  time: number
  height: number
  difficulty: number
}

// ── Cache ───────────────────────────────────────────────────────────────

interface MiningSeries {
  hashprice: Point[]
  difficulty: Point[]
  hashrate: Point[]
}

let cached: { at: number; series: MiningSeries } | null = null
const CACHE_MS = 60 * 60 * 1000 // difficulty retargets every ~2 weeks

// ── Fetchers ────────────────────────────────────────────────────────────

async function fetchDifficultyAdjustments(): Promise<Stepped[]> {
  const res = await fetch('https://mempool.space/api/v1/mining/difficulty-adjustments/3y', {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`mempool difficulty ${res.status}`)
  const rows: DifficultyAdjustment[] = await res.json()
  return rows
    .filter((r) => Array.isArray(r) && Number.isFinite(r[0]) && Number.isFinite(r[2]) && r[2] > 0)
    .map((r) => ({ time: r[0], height: r[1], difficulty: r[2] }))
    .sort((a, b) => a.time - b.time)
}

async function fetchFeeSamples(): Promise<FeeSample[]> {
  // Fees are a refinement, not a dependency — a failure here degrades to a
  // subsidy-only hashprice rather than taking the whole series down.
  try {
    const res = await fetch('https://mempool.space/api/v1/mining/blocks/fees/3y', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`mempool fees ${res.status}`)
    const rows: FeeSample[] = await res.json()
    return rows
      .filter((r) => Number.isFinite(r?.timestamp) && Number.isFinite(r?.avgFees))
      .sort((a, b) => a.timestamp - b.timestamp)
  } catch (err) {
    console.error('[chart/mining] fee history unavailable, using subsidy only:', err)
    return []
  }
}

/** Daily BTC closes from Kraken (720 bars ~= 2 years). */
async function fetchBtcDailyCloses(): Promise<Candle[]> {
  const res = await fetch('https://api.kraken.com/0/public/OHLC?pair=XBTUSD&interval=1440', {
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`kraken btc ${res.status}`)
  const json = await res.json()
  if (Array.isArray(json?.error) && json.error.length) {
    throw new Error(`kraken btc: ${json.error.join(', ')}`)
  }
  const rows = json?.result && Object.entries(json.result).find(([k, v]) => k !== 'last' && Array.isArray(v))?.[1]
  if (!Array.isArray(rows)) throw new Error('kraken btc: no series')
  return rows
    .map((r): Candle => ({
      time: Number(r[0]),
      open: Number(r[1]),
      high: Number(r[2]),
      low: Number(r[3]),
      close: Number(r[4]),
    }))
    .filter((c) => Number.isFinite(c.time) && Number.isFinite(c.close) && c.close > 0)
    .sort((a, b) => a.time - b.time)
}

// ── Derivation ──────────────────────────────────────────────────────────

/**
 * Builds a lookup that returns the most recent entry at or before a given
 * time. Both inputs are sorted, so callers stepping forward in time get
 * amortised O(1) per probe instead of a binary search each call.
 */
function forwardFill<T extends { time: number }>(sorted: T[]) {
  let i = 0
  return (t: number): T | undefined => {
    if (!sorted.length || t < sorted[0].time) return undefined
    while (i + 1 < sorted.length && sorted[i + 1].time <= t) i++
    // Guard against a caller probing backwards (shouldn't happen, but a stale
    // cursor would silently return the wrong epoch).
    if (sorted[i].time > t) {
      let j = i
      while (j > 0 && sorted[j].time > t) j--
      return sorted[j].time <= t ? sorted[j] : undefined
    }
    return sorted[i]
  }
}

function buildSeries(
  adjustments: Stepped[],
  fees: FeeSample[],
  btc: Candle[],
): MiningSeries {
  const diffAt = forwardFill(adjustments)
  const feeAt = forwardFill(fees.map((f) => ({ time: f.timestamp, avgFees: f.avgFees })))

  const hashpricePoints: Point[] = []
  const difficultyPoints: Point[] = []
  const hashratePoints: Point[] = []

  for (const bar of btc) {
    // Normalise to a UTC day boundary so every series shares an x-axis.
    const day = Math.floor(bar.time / DAY_SECONDS) * DAY_SECONDS

    const epoch = diffAt(day)
    if (!epoch) continue // price history predates our difficulty window

    const feeSample = feeAt(day)
    const feesBtc = feeSample ? feeSample.avgFees / SATS_PER_BTC : 0

    // Height advances ~144 blocks/day beyond the retarget that opened the
    // epoch; without this the subsidy would lag by up to two weeks at a
    // halving boundary.
    const height = epoch.height + Math.floor((day - epoch.time) / BLOCK_TARGET_SECONDS)

    const hp = hashprice(epoch.difficulty, bar.close, height, feesBtc)
    if (!Number.isFinite(hp) || hp <= 0) continue

    hashpricePoints.push({ time: day, value: hp })
    difficultyPoints.push({ time: day, value: epoch.difficulty / 1e12 })
    hashratePoints.push({ time: day, value: hashrateFromDifficulty(epoch.difficulty) / 1e18 })
  }

  return { hashprice: hashpricePoints, difficulty: difficultyPoints, hashrate: hashratePoints }
}

/** Fetches and derives all mining series, cached for an hour. */
export async function getMiningSeries(): Promise<MiningSeries> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.series

  try {
    const [adjustments, fees, btc] = await Promise.all([
      fetchDifficultyAdjustments(),
      fetchFeeSamples(),
      fetchBtcDailyCloses(),
    ])
    const series = buildSeries(adjustments, fees, btc)
    if (!series.hashprice.length) throw new Error('derived an empty series')
    cached = { at: Date.now(), series }
    return series
  } catch (err) {
    if (cached) {
      console.error('[chart/mining] refresh failed, serving cached:', err)
      return cached.series
    }
    throw err
  }
}

/** A mining series as flat-OHLC candles, so one chart path serves every symbol. */
export function pointsToCandles(points: Point[]): Candle[] {
  return points.map((p) => ({ time: p.time, open: p.value, high: p.value, low: p.value, close: p.value }))
}
