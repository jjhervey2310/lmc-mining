import { NextResponse } from 'next/server'
import { getMarketQuotes } from '@/lib/markets'

// Market feed for the terminal ticker — see lib/markets.ts for sources/caching.

export const dynamic = 'force-dynamic'

export async function GET() {
  const quotes = await getMarketQuotes()
  if (!quotes.length) {
    return NextResponse.json({ quotes: [], at: Date.now(), error: 'market data unavailable' }, { status: 503 })
  }
  return NextResponse.json({ quotes, at: Date.now() })
}
