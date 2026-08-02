import { NextResponse } from 'next/server'

// Market feed for the terminal ticker: crypto (CoinGecko) + SPX and the Mag 7
// (Yahoo's chart endpoint — the v7 quote endpoint is auth-walled now, v8 chart
// is not, so it's one call per symbol). Cached in memory for a minute; on a
// failed refresh the last good snapshot is served rather than an empty bar.

export const dynamic = 'force-dynamic'

export interface Quote {
  symbol: string
  price: number
  changePct: number
  kind: 'crypto' | 'index' | 'equity'
}

const CRYPTO: [string, string][] = [
  ['bitcoin', 'BTC'],
  ['ethereum', 'ETH'],
  ['solana', 'SOL'],
  ['sui', 'SUI'],
  ['spx6900', 'SPX'], // SPX6900 (ETH memecoin) — Jacob's SPX, not the S&P 500
]

// The Magnificent 7.
const EQUITIES: [string, string, Quote['kind']][] = [
  ['NVDA', 'NVDA', 'equity'],
  ['AAPL', 'AAPL', 'equity'],
  ['MSFT', 'MSFT', 'equity'],
  ['GOOGL', 'GOOGL', 'equity'],
  ['AMZN', 'AMZN', 'equity'],
  ['META', 'META', 'equity'],
  ['TSLA', 'TSLA', 'equity'],
]

const TTL_MS = 60_000
let cache: { at: number; quotes: Quote[] } | null = null

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

async function fetchEquity(yahoo: string, symbol: string, kind: Quote['kind']): Promise<Quote> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?range=1d&interval=1d`,
    { cache: 'no-store', headers: { 'User-Agent': 'Mozilla/5.0' } },
  )
  if (!res.ok) throw new Error(`yahoo ${symbol} ${res.status}`)
  const meta = (await res.json())?.chart?.result?.[0]?.meta
  const price = meta?.regularMarketPrice
  const prev = meta?.chartPreviousClose ?? meta?.previousClose
  if (typeof price !== 'number') throw new Error(`yahoo ${symbol} no price`)
  return { symbol, price, changePct: prev ? ((price - prev) / prev) * 100 : 0, kind }
}

export async function GET() {
  const now = Date.now()
  if (cache && now - cache.at < TTL_MS) {
    return NextResponse.json({ quotes: cache.quotes, at: cache.at, cached: true })
  }

  const settled = await Promise.allSettled([
    fetchCrypto(),
    ...EQUITIES.map(([y, s, k]) => fetchEquity(y, s, k)),
  ])

  const quotes: Quote[] = settled.flatMap((r) => {
    if (r.status !== 'fulfilled') return []
    return Array.isArray(r.value) ? r.value : [r.value]
  })

  if (!quotes.length) {
    if (cache) return NextResponse.json({ quotes: cache.quotes, at: cache.at, cached: true, stale: true })
    return NextResponse.json({ quotes: [], at: now, error: 'market data unavailable' }, { status: 503 })
  }

  cache = { at: now, quotes }
  return NextResponse.json({ quotes, at: now, cached: false })
}
