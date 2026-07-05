import { NextResponse } from 'next/server'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers, buildDailyDrop } from '@/lib/daily-content'

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
  return NextResponse.json({
    theme: drop.theme,
    video: drop.video,
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
