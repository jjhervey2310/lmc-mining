import { NextResponse } from 'next/server'
import { getHistory } from '@/lib/markets'

// Daily price history for one holding, from the day a book bought it.
// Feeds the click-through chart on the TRADING page.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (!process.env.ADMIN_SECRET || searchParams.get('secret') !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const symbol = (searchParams.get('symbol') || '').trim()
  if (!symbol) return NextResponse.json({ error: 'need a symbol' }, { status: 400 })

  // `from` is the entry date. Bad or missing dates fall back to 90 days so the
  // chart still draws something rather than erroring at the user.
  const parsed = Date.parse(searchParams.get('from') || '')
  const fromMs = isFinite(parsed) ? parsed : Date.now() - 90 * 864e5

  try {
    const points = await getHistory(symbol, fromMs)
    if (!points.length) {
      return NextResponse.json({ error: `no price history for ${symbol}` }, { status: 404 })
    }
    return NextResponse.json({ symbol, points })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'history failed' }, { status: 502 })
  }
}
