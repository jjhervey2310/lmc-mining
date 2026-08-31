// Live market quotes for the terminal ticker and the trading-competition panel.
// Crypto (incl. SPX6900 — Jacob's "SPX") from CoinGecko; the Mag 7 from Yahoo's
// chart endpoint (the v7 quote endpoint is auth-walled now, v8 chart is not).
// In-memory caches: crypto moves fast and CoinGecko tolerates ~10s polling for
// one viewer; Yahoo throttles harder and equities move slower, so 60s there.
// On a failed refresh the last good snapshot is served rather than nothing.

export interface Quote {
  symbol: string
  price: number
  changePct: number
  kind: 'crypto' | 'equity'
  /** When this price was actually fetched — NOT when it was read. A failed
   *  refresh serves the last good snapshot, and without this the dashboard
   *  presented a stale tick as live (MSFT showed $487.46 against a $499.99
   *  Friday close, 2026-08-08). */
  fetchedAt: number
  /** Equity quote carried over from the last session (weekend/after-hours). */
  sessionClose?: boolean
}

/** A quote older than this is no longer presentable as "live". */
export const STALE_AFTER_MS = 10 * 60_000

export function isStale(q: Quote, now = Date.now()): boolean {
  return now - q.fetchedAt > STALE_AFTER_MS
}

/** US equities don't tick outside ~13:30–20:00 UTC on weekdays. */
export function marketClosed(d = new Date()): boolean {
  const day = d.getUTCDay()
  if (day === 0 || day === 6) return true
  const mins = d.getUTCHours() * 60 + d.getUTCMinutes()
  return mins < 13 * 60 + 30 || mins >= 20 * 60
}

const CRYPTO: [string, string][] = [
  ['bitcoin', 'BTC'],
  ['ethereum', 'ETH'],
  ['solana', 'SOL'],
  ['sui', 'SUI'],
  ['spx6900', 'SPX'], // SPX6900 (ETH memecoin) — Jacob's SPX, not the S&P 500
  ['hyperliquid', 'HYPE'], // held in the trading competition
  ['uniswap', 'UNI'], // held in the trading competition
]

// The Magnificent 7, plus tickers held in the trading competition.
const EQUITIES: [string, string][] = [
  ['NVDA', 'NVDA'],
  ['AAPL', 'AAPL'],
  ['MSFT', 'MSFT'],
  ['GOOGL', 'GOOGL'],
  ['AMZN', 'AMZN'],
  ['META', 'META'],
  ['TSLA', 'TSLA'],
  ['TQQQ', 'TQQQ'],
  ['SQQQ', 'SQQQ'],
]

const CRYPTO_TTL_MS = 10_000
const EQUITY_TTL_MS = 60_000
let cryptoCache: { at: number; quotes: Quote[] } | null = null
let equityCache: { at: number; quotes: Quote[] } | null = null

async function fetchCrypto(): Promise<Quote[]> {
  const ids = CRYPTO.map(([id]) => id).join(',')
  const base = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`
  const key = process.env.COINGECKO_API_KEY
  let res = await fetch(key ? `${base}&x_cg_demo_api_key=${key}` : base, { cache: 'no-store' })
  // A bad/expired demo key must not kill the feed — the keyless endpoint works.
  if (!res.ok && key && (res.status === 401 || res.status === 403)) {
    res = await fetch(base, { cache: 'no-store' })
  }
  if (!res.ok) throw new Error(`coingecko ${res.status}`)
  const data = await res.json()
  return CRYPTO.flatMap(([id, symbol]) => {
    const row = data?.[id]
    if (!row || typeof row.usd !== 'number') return []
    return [{ symbol, price: row.usd, changePct: Number(row.usd_24h_change) || 0, kind: 'crypto' as const, fetchedAt: Date.now() }]
  })
}

async function fetchEquity(yahoo: string, symbol: string): Promise<Quote> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?range=1d&interval=1d`,
    { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } },
  )
  if (!res.ok) throw new Error(`yahoo ${symbol} ${res.status}`)
  const meta = (await res.json())?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice
  const prev = meta?.chartPreviousClose ?? meta?.previousClose
  if (typeof price !== 'number') throw new Error(`yahoo ${symbol} no price`)
  return { symbol, price, changePct: prev ? ((price - prev) / prev) * 100 : 0, kind: 'equity', fetchedAt: Date.now(), sessionClose: marketClosed() }
}

export async function getMarketQuotes(): Promise<Quote[]> {
  const now = Date.now()
  const wantCrypto = !cryptoCache || now - cryptoCache.at >= CRYPTO_TTL_MS
  const wantEquity = !equityCache || now - equityCache.at >= EQUITY_TTL_MS

  const [cryptoRes, ...equityRes] = await Promise.allSettled([
    wantCrypto ? fetchCrypto() : Promise.resolve<Quote[]>([]),
    ...(wantEquity ? EQUITIES.map(([y, s]) => fetchEquity(y, s)) : []),
  ])

  // Refresh each cache only on success — a failed poll serves the last snapshot.
  if (wantCrypto && cryptoRes.status === 'fulfilled' && cryptoRes.value.length) {
    cryptoCache = { at: now, quotes: cryptoRes.value }
  }
  if (wantEquity) {
    const eq = equityRes.flatMap((r) => (r.status === 'fulfilled' ? [r.value as Quote] : []))
    if (eq.length) equityCache = { at: now, quotes: eq }
  }

  return [...(cryptoCache?.quotes ?? []), ...(equityCache?.quotes ?? [])]
}

// ── price history ──
//
// Powers the per-holding chart on the TRADING page: click a position and see
// what it has done since the day that book bought it. Crypto history comes from
// CoinGecko's market_chart range, equities from the same keyless Yahoo v8 chart
// endpoint the live quotes use.

export type Resolved =
  | { kind: 'crypto'; id: string }
  | { kind: 'equity'; ticker: string }

/** Map a book symbol to a feed. Unknown symbols are treated as Yahoo tickers,
 *  which covers any equity a rival relays that we don't already track. */
export function resolveSymbol(symbol: string): Resolved | null {
  const s = symbol.trim().toUpperCase()
  if (!s) return null
  const coin = CRYPTO.find(([, sym]) => sym === s)
  if (coin) return { kind: 'crypto', id: coin[0] }
  if (!/^[A-Z0-9.\-]{1,10}$/.test(s)) return null
  return { kind: 'equity', ticker: s }
}

export interface HistoryPoint { date: string; close: number }

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10)

/** Last close per calendar day, oldest first. */
function toDaily(pairs: [number, number][]): HistoryPoint[] {
  const byDay = new Map<string, number>()
  for (const [ms, price] of pairs) {
    if (!isFinite(ms) || !isFinite(price)) continue
    byDay.set(day(ms), price)
  }
  return [...byDay.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, close]) => ({ date, close }))
}

export async function getHistory(symbol: string, fromMs: number): Promise<HistoryPoint[]> {
  const r = resolveSymbol(symbol)
  if (!r) return []
  // Always ask for at least a couple of days so a same-day entry still plots.
  const from = Math.min(fromMs, Date.now() - 2 * 864e5)
  const to = Date.now()

  if (r.kind === 'crypto') {
    const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(r.id)}/market_chart/range`
      + `?vs_currency=usd&from=${Math.floor(from / 1000)}&to=${Math.floor(to / 1000)}`
    const key = process.env.COINGECKO_API_KEY
    const res = await fetch(url, {
      next: { revalidate: 300 },
      headers: key ? { 'x-cg-demo-api-key': key } : {},
    })
    if (!res.ok) throw new Error(`coingecko history ${r.id} ${res.status}`)
    const prices = (await res.json())?.prices
    return Array.isArray(prices) ? toDaily(prices as [number, number][]) : []
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(r.ticker)}`
    + `?period1=${Math.floor(from / 1000)}&period2=${Math.floor(to / 1000)}&interval=1d`
  const res = await fetch(url, { next: { revalidate: 300 }, headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`yahoo history ${r.ticker} ${res.status}`)
  const result = (await res.json())?.chart?.result?.[0]
  const stamps: number[] = result?.timestamp ?? []
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? []
  const pairs = stamps
    .map((t, i) => [t * 1000, closes[i]] as [number, number | null])
    .filter((p): p is [number, number] => typeof p[1] === 'number')
  return toDaily(pairs)
}
