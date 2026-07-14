import { NextResponse } from 'next/server'
import { getLivePriceData } from '@/lib/btc-price'

export async function GET() {
  const result = await getLivePriceData()
  if ('error' in result) {
    return NextResponse.json(result, { status: 503 })
  }
  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
  })
}

export const dynamic = 'force-dynamic'
