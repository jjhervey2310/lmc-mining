import { NextResponse } from 'next/server'
import { getLivePriceData } from '@/lib/btc-price'

export async function GET() {
  const result = await getLivePriceData()
  if ('error' in result) {
    return NextResponse.json(result, { status: 503 })
  }
  return NextResponse.json(result)
}

export const dynamic = 'force-dynamic'
