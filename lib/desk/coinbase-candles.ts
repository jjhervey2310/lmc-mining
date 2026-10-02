import { completedBars } from './market-time'

// COINBASE EXCHANGE CANDLES — keyless, full history including delisted USD pairs (the universe source).
// Hard limits verified 2026-10-02: at most 300 candles per request (start/end window must fit), and
// without a window the API returns the ~350 most recent. Candle rows come newest-first as
// [time_s, low, high, open, close, volume].

export const COINBASE = 'https://api.exchange.coinbase.com'
export const MAX_BARS = 300
const UA = { 'User-Agent': 'lmc-desk/1.0' }

export interface MdRow { venue: 'coinbase'; symbol: string; interval_minutes: number; bar_time: string; open: number; high: number; low: number; close: number; volume: number }
export interface Product { id: string; base_currency: string; quote_currency: string; status: string; trading_disabled: boolean }

/** The [start, end] window that ends at `endMs` and holds at most MAX_BARS bars of `intervalMin`. */
export function candleWindow(endMs: number, intervalMin: number, bars = MAX_BARS): { startMs: number; endMs: number } {
  const step = intervalMin * 60_000
  const end = Math.floor(endMs / step) * step
  return { startMs: end - (bars - 1) * step, endMs: end }
}

/** Raw Coinbase rows → md_candles rows, COMPLETED bars only (a bar is complete once open + interval <= asOf). */
export function parseCoinbaseCandles(raw: unknown, symbol: string, intervalMin: number, asOf = Date.now()): MdRow[] {
  if (!Array.isArray(raw)) return []
  const step = intervalMin * 60_000
  const rows = raw
    .filter((r): r is number[] => Array.isArray(r) && r.length >= 6 && Number.isFinite(r[0]))
    .map((r) => ({ t: r[0] * 1000, low: r[1], high: r[2], open: r[3], close: r[4], volume: r[5] }))
  return completedBars(rows, asOf, step)
    .filter((r) => r.close > 0)
    .map((r) => ({ venue: 'coinbase' as const, symbol, interval_minutes: intervalMin, bar_time: new Date(r.t).toISOString(), open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }))
}

export async function fetchProducts(): Promise<Product[]> {
  const res = await fetch(`${COINBASE}/products`, { headers: UA, cache: 'no-store' })
  if (!res.ok) throw new Error(`coinbase products ${res.status}`)
  return (await res.json()) as Product[]
}

/** One request. Returns null for a 404 (unknown product), throws on other failures. */
export async function fetchCandles(productId: string, intervalMin: number, startMs: number, endMs: number): Promise<unknown[] | null> {
  const g = intervalMin * 60
  const url = `${COINBASE}/products/${productId}/candles?granularity=${g}&start=${new Date(startMs).toISOString()}&end=${new Date(endMs).toISOString()}`
  const res = await fetch(url, { headers: UA, cache: 'no-store' })
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`coinbase candles ${productId} ${res.status}: ${(await res.text()).slice(0, 120)}`)
  return (await res.json()) as unknown[]
}
