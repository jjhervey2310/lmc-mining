// Upstream OHLC adapters for the terminal.
//
// Two feeds, both free and keyless:
//   Kraken  — crypto OHLC with real volume, up to 720 bars per request.
//   Yahoo   — equities via the v8 chart endpoint (the v7 quote endpoint is
//             auth-walled now; v8 is not — same choice lib/markets.ts made).
//
// Each fetch is cached in-process. A failed refresh serves the last good
// snapshot rather than an empty chart, matching the staleness discipline in
// lib/markets.ts.

import type { Candle, Timeframe } from './types'
import type { ChartSymbol } from './symbols'

// ── Cache ───────────────────────────────────────────────────────────────

interface CacheEntry {
  at: number
  candles: Candle[]
}

const cache = new Map<string, CacheEntry>()

/** Intraday data goes stale fast; daily bars do not. */
function ttlFor(tf: Timeframe): number {
  return tf === '1h' || tf === '4h' ? 60_000 : 10 * 60_000
}

function cacheKey(symbol: ChartSymbol, tf: Timeframe): string {
  return `${symbol.id}:${tf}`
}

// ── Kraken ──────────────────────────────────────────────────────────────

const KRAKEN_INTERVAL: Record<Timeframe, number> = {
  '1h': 60,
  '4h': 240,
  '1D': 1440,
  '1W': 10080,
}

async function fetchKraken(symbol: ChartSymbol, tf: Timeframe): Promise<Candle[]> {
  const url = `https://api.kraken.com/0/public/OHLC?pair=${encodeURIComponent(symbol.sourceId)}&interval=${KRAKEN_INTERVAL[tf]}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new Error(`kraken ${symbol.id} ${res.status}`)

  const json = await res.json()
  if (Array.isArray(json?.error) && json.error.length) {
    throw new Error(`kraken ${symbol.id}: ${json.error.join(', ')}`)
  }

  // Kraken keys the payload by its own normalised pair name (XBTUSD comes back
  // as XXBTZUSD), so take the first array-valued key rather than guessing it.
  const result = json?.result
  const rows = result && Object.entries(result).find(([k, v]) => k !== 'last' && Array.isArray(v))?.[1]
  if (!Array.isArray(rows)) throw new Error(`kraken ${symbol.id}: no series`)

  const candles: Candle[] = []
  for (const r of rows) {
    // [time, open, high, low, close, vwap, volume, count]
    const time = Number(r[0])
    const open = Number(r[1])
    const high = Number(r[2])
    const low = Number(r[3])
    const close = Number(r[4])
    const volume = Number(r[6])
    if (!Number.isFinite(time) || !Number.isFinite(close)) continue
    candles.push({ time, open, high, low, close, volume: Number.isFinite(volume) ? volume : undefined })
  }
  return candles
}

// ── Yahoo ───────────────────────────────────────────────────────────────

/** Yahoo caps 60m history at 730d; daily and weekly can reach much further. */
const YAHOO_PARAMS: Partial<Record<Timeframe, { range: string; interval: string }>> = {
  '1h': { range: '730d', interval: '60m' },
  '1D': { range: '5y', interval: '1d' },
  '1W': { range: '10y', interval: '1wk' },
}

async function fetchYahoo(symbol: ChartSymbol, tf: Timeframe): Promise<Candle[]> {
  const params = YAHOO_PARAMS[tf]
  if (!params) throw new Error(`yahoo ${symbol.id}: unsupported timeframe ${tf}`)

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol.sourceId)}?range=${params.range}&interval=${params.interval}`
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`yahoo ${symbol.id} ${res.status}`)

  const result = (await res.json())?.chart?.result?.[0]
  const times: number[] = result?.timestamp ?? []
  const q = result?.indicators?.quote?.[0]
  if (!times.length || !q) throw new Error(`yahoo ${symbol.id}: no series`)

  const candles: Candle[] = []
  for (let i = 0; i < times.length; i++) {
    const open = q.open?.[i]
    const high = q.high?.[i]
    const low = q.low?.[i]
    const close = q.close?.[i]
    // Yahoo pads gaps (holidays, halts) with nulls — those are not bars.
    if (![open, high, low, close].every((v) => typeof v === 'number' && Number.isFinite(v))) continue
    const volume = q.volume?.[i]
    candles.push({
      time: times[i],
      open,
      high,
      low,
      close,
      volume: typeof volume === 'number' && Number.isFinite(volume) ? volume : undefined,
    })
  }
  return candles
}

// ── Public ──────────────────────────────────────────────────────────────

/**
 * Fetch bars for a symbol, serving the last good snapshot if the upstream
 * feed fails. Throws only when there is no cached data to fall back on.
 */
export async function fetchCandles(symbol: ChartSymbol, tf: Timeframe): Promise<Candle[]> {
  const key = cacheKey(symbol, tf)
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < ttlFor(tf)) return hit.candles

  try {
    const candles = symbol.source === 'kraken' ? await fetchKraken(symbol, tf) : await fetchYahoo(symbol, tf)
    if (!candles.length) throw new Error(`${symbol.id}: empty series`)
    // Upstreams are usually sorted, but a chart that receives unsorted bars
    // renders silently wrong rather than erroring, so sort defensively.
    candles.sort((a, b) => a.time - b.time)
    cache.set(key, { at: Date.now(), candles })
    return candles
  } catch (err) {
    if (hit) {
      console.error(`[chart] ${key} refresh failed, serving cached:`, err)
      return hit.candles
    }
    throw err
  }
}
