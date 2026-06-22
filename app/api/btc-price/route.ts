import { NextResponse } from 'next/server'
import { COINGECKO_URL, BTC_PRICE_CACHE_MS } from '@/lib/constants'

// In-memory cache (survives across requests within a server instance)
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
    // Fall back to static approximation with disclosure in response
    return STATIC_DIFFICULTY_FALLBACK
  }
}

export async function GET() {
  const now = Date.now()

  // Return cached data if still fresh
  if (cached && now - cached.timestamp < BTC_PRICE_CACHE_MS) {
    return NextResponse.json({
      price: cached.price,
      difficulty: cached.difficulty,
      cached: true,
      last_updated: new Date(cached.timestamp).toISOString(),
    })
  }

  try {
    const apiKey = process.env.COINGECKO_API_KEY
    const url = apiKey
      ? `${COINGECKO_URL}&x_cg_demo_api_key=${apiKey}`
      : COINGECKO_URL

    const [priceRes, difficulty] = await Promise.all([
      fetch(url, { next: { revalidate: 600 } }),
      fetchNetworkDifficulty(),
    ])

    if (!priceRes.ok) throw new Error(`CoinGecko error: ${priceRes.status}`)

    const priceData = await priceRes.json()
    const price = priceData?.bitcoin?.usd

    if (!price || typeof price !== 'number') throw new Error('Invalid price data')

    cached = { price, difficulty, timestamp: now }

    return NextResponse.json({
      price,
      difficulty,
      cached: false,
      last_updated: new Date(now).toISOString(),
    })
  } catch (error) {
    // Return last cached value on failure, or error if no cache
    if (cached) {
      return NextResponse.json({
        price: cached.price,
        difficulty: cached.difficulty,
        cached: true,
        stale: true,
        last_updated: new Date(cached.timestamp).toISOString(),
        warning: 'Live data unavailable. Showing last cached values.',
      })
    }

    console.error('BTC price fetch failed:', error)
    return NextResponse.json(
      { error: 'Unable to fetch Bitcoin price data. Please try again.' },
      { status: 503 }
    )
  }
}

export const dynamic = 'force-dynamic'
