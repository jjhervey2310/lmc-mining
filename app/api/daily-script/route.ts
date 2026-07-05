import { NextResponse } from 'next/server'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers, buildDailyDrop } from '@/lib/daily-content'
import { createServiceClient } from '@/lib/supabase'

// Public JSON feed of the day's content. Marketing copy + public network numbers
// only — nothing sensitive. Consumed by the local video-render pipeline so the
// rendered video always matches the emailed script.
export async function GET() {
  const live = await getLivePriceData()
  if (!live || 'error' in live) {
    return NextResponse.json({ error: 'Live price data unavailable' }, { status: 503 })
  }
  const numbers = computeDailyNumbers(live.price, live.difficulty)
  const drop = buildDailyDrop(numbers, new Date())

  // 7-day BTC price trend for the on-screen chart (from our own snapshots).
  let chart: { label: string; points: number[] } | null = null
  const supabase = createServiceClient()
  if (supabase) {
    const since = new Date(Date.now() - 8 * 864e5).toISOString().split('T')[0]
    const { data } = await supabase
      .from('hashprice_snapshots')
      .select('snapshot_date, btc_price')
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: true })
    if (data && data.length >= 2) {
      const points = data.map(r => Number(r.btc_price))
      // ensure the very latest live price is the last point
      if (points[points.length - 1] !== live.price) points.push(live.price)
      chart = { label: 'BTC · LAST 7 DAYS', points: points.slice(-7) }
    }
  }

  return NextResponse.json({
    theme: drop.theme,
    video: drop.video,
    chart,
    captions: drop.captions,
    numbers: {
      btcPrice: numbers.btcPrice,
      difficulty: numbers.difficulty,
      hashpricePerThDay: numbers.hashpricePerThDay,
      s21NetDay: numbers.s21NetDay,
      profitable: numbers.profitable,
    },
  })
}

export const dynamic = 'force-dynamic'
