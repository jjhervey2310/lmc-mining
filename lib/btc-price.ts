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

// Static network difficulty fallback (updated biweekly — current as of June 2026)
// Source: blockchain.info/q/getdifficulty
const STATIC_DIFFICULTY_FALLBACK = 90.67e12

async function fetchNetworkDifficulty(): Promise<number> {
  try {
    const res = await fetch('https://blockchain.info/q/getdifficulty', {
      next: { revalidate: 7200 }, // 2-hour cache via Next.js
    })
    if (!res.ok) throw new Error('Blockchain.info unavailable')
    const text = await res.text()
    const difficulty = parseFloat(text)
    if (isNaN(difficulty) || difficulty <= 0) throw new Error('Invalid difficulty value')
    return difficulty
  } catch {
    return STATIC_DIFFICULTY_FALLBACK
  }
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
    const url = apiKey ? `${COINGECKO_URL}&x_cg_demo_api_key=${apiKey}` : COINGECKO_URL

    const [priceRes, difficulty] = await Promise.all([
      fetch(url, { next: { revalidate: 600 } }),
      fetchNetworkDifficulty(),
    ])

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
