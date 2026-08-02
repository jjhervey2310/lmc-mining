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
}

const CRYPTO: [string, string][] = [
  ['bitcoin', 'BTC'],
  ['ethereum', 'ETH'],
  ['solana', 'SOL'],
  ['sui', 'SUI'],
  ['spx6900', 'SPX'], // SPX6900 (ETH memecoin) — Jacob's SPX, not the S&P 500
]

// The Magnificent 7.
const EQUITIES: [string, string][] = [
  ['NVDA', 'NVDA'],
  ['AAPL', 'AAPL'],
  ['MSFT', 'MSFT'],
  ['GOOGL', 'GOOGL'],
  ['AMZN', 'AMZN'],
  ['META', 'META'],
  ['TSLA', 'TSLA'],
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
    return [{ symbol, price: row.usd, changePct: Number(row.usd_24h_change) || 0, kind: 'crypto' as const }]
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
  return { symbol, price, changePct: prev ? ((price - prev) / prev) * 100 : 0, kind: 'equity' }
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
