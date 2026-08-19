import { NextResponse } from 'next/server'
import { getSymbol } from '@/lib/chart/symbols'
import { fetchCandles } from '@/lib/chart/sources'
import { getMiningSeries, pointsToCandles } from '@/lib/chart/mining'
import type { ChartSeriesResponse, Timeframe } from '@/lib/chart/types'

/**
 * Unified bar feed for the terminal.
 *
 * GET /api/chart/ohlc?symbol=BTCUSD&tf=1D
 *
 * Market symbols are proxied from Kraken/Yahoo; mining symbols are derived
 * (see lib/chart/mining.ts). Proxying rather than calling upstreams from the
 * browser keeps the API key optional, the caching shared across visitors, and
 * CORS out of the picture.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const symbol = getSymbol(searchParams.get('symbol'))
  if (!symbol) {
    return NextResponse.json({ error: 'Unknown symbol' }, { status: 400 })
  }

  const tf = (searchParams.get('tf') ?? '1D') as Timeframe
  if (!symbol.timeframes.includes(tf)) {
    return NextResponse.json(
      { error: `${symbol.id} does not support ${tf}`, supported: symbol.timeframes },
      { status: 400 },
    )
  }

  try {
    let candles
    if (symbol.source === 'mining') {
      const series = await getMiningSeries()
      const points = series[symbol.sourceId as keyof typeof series]
      candles = pointsToCandles(points ?? [])
    } else {
      candles = await fetchCandles(symbol, tf)
    }

    const body: ChartSeriesResponse = {
      symbol: symbol.id,
      timeframe: tf,
      shape: symbol.shape,
      candles,
    }
    return NextResponse.json(body)
  } catch (err) {
    console.error('[api/chart/ohlc]', symbol.id, tf, err)
    // The terminal renders an explicit "feed unavailable" state, so a failure
    // must not masquerade as a symbol that simply has no data.
    const body: ChartSeriesResponse = {
      symbol: symbol.id,
      timeframe: tf,
      shape: symbol.shape,
      candles: [],
      error: 'Upstream feed unavailable',
    }
    return NextResponse.json(body, { status: 502 })
  }
}

export const dynamic = 'force-dynamic'
