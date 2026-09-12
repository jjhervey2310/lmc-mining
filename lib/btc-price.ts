import { COINGECKO_URL, BTC_PRICE_CACHE_MS } from '@/lib/constants'

export interface LivePriceData {
  price: number
  difficulty: number
  cached: boolean
  stale?: boolean
  last_updated: string
  warning?: string
}

// In-memory cache (survives across requests within a warm server instance)
let cached: { price: number; difficulty: number; timestamp: number } | null = null

// Last-resort network difficulty, used only if BOTH live sources fail.
// Difficulty only ever ratchets in ~2-week steps, and an understated value
// inflates mined BTC — the exact seller math this site exists to expose. A
// stale 90.67e12 sat here while the network was at 127.48e12, overstating
// revenue by 41%. Verified against blockchain.info + mempool.space 2026-08-24.
const STATIC_DIFFICULTY_FALLBACK = 127.48e12

async function fetchNetworkDifficulty(): Promise<number> {
  // Two independent live sources before the constant is ever considered.
  const sources: { url: string; parse: (raw: string) => number }[] = [
    {
      url: 'https://blockchain.info/q/getdifficulty',
      parse: (raw) => parseFloat(raw),
    },
    {
      // Note: /v1/difficulty-adjustment does NOT carry currentDifficulty —
      // it lives on the mining/hashrate endpoint. Verified 2026-08-24.
      url: 'https://mempool.space/api/v1/mining/hashrate/3d',
      parse: (raw) => Number(JSON.parse(raw)?.currentDifficulty),
    },
  ]

  for (const { url, parse } of sources) {
    try {
      const res = await fetch(url, { next: { revalidate: 7200 } })
      if (!res.ok) continue
      const difficulty = parse(await res.text())
      // Guard against a source returning 0, NaN, or an obviously wrong scale.
      if (!Number.isFinite(difficulty) || difficulty <= 1e12) continue
      return difficulty
    } catch {
      continue
    }
  }

  return STATIC_DIFFICULTY_FALLBACK
}

export async function getLivePriceData(): Promise<LivePriceData | { error: string }> {
  const now = Date.now()

  if (cached && now - cached.timestamp < BTC_PRICE_CACHE_MS) {
    return {
      price: cached.price,
      difficulty: cached.difficulty,
      cached: true,
      last_updated: new Date(cached.timestamp).toISOString(),
    }
  }

  try {
    const apiKey = process.env.COINGECKO_API_KEY
    const keyedUrl = apiKey ? `${COINGECKO_URL}&x_cg_demo_api_key=${apiKey}` : COINGECKO_URL

    const [firstRes, difficulty] = await Promise.all([
      fetch(keyedUrl, { next: { revalidate: 600 } }),
      fetchNetworkDifficulty(),
    ])

    // CoinGecko's public endpoint works WITHOUT a key. If a bad/expired demo key
    // triggers an auth error, transparently retry the keyless free endpoint so
    // live prices keep working (rotating the key later just raises rate limits).
    let priceRes = firstRes
    if (!priceRes.ok && apiKey && (priceRes.status === 401 || priceRes.status === 403)) {
      priceRes = await fetch(COINGECKO_URL, { next: { revalidate: 600 } })
    }

    if (!priceRes.ok) throw new Error(`CoinGecko error: ${priceRes.status}`)

    const priceData = await priceRes.json()
    const price = priceData?.bitcoin?.usd

    if (!price || typeof price !== 'number') throw new Error('Invalid price data')

    cached = { price, difficulty, timestamp: now }

    return {
      price,
      difficulty,
      cached: false,
      last_updated: new Date(now).toISOString(),
    }
  } catch (error) {
    if (cached) {
      return {
        price: cached.price,
        difficulty: cached.difficulty,
        cached: true,
        stale: true,
        last_updated: new Date(cached.timestamp).toISOString(),
        warning: 'Live data unavailable. Showing last cached values.',
      }
    }

    console.error('BTC price fetch failed:', error)
    return { error: 'Unable to fetch Bitcoin price data. Please try again.' }
  }
}
