import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

interface Row {
  snapshot_date: string
  btc_price: number
  hashprice_usd: number
}

let cached: { rows: Row[]; timestamp: number } | null = null
const CACHE_MS = 60 * 60 * 1000 // 1 hour — data changes once per day

export async function GET() {
  const now = Date.now()
  if (cached && now - cached.timestamp < CACHE_MS) {
    return NextResponse.json({ rows: cached.rows, cached: true })
  }

  const supabase = getSupabaseClient()
  if (!supabase) {
    return NextResponse.json({ rows: [] })
  }

  const since = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const { data, error } = await supabase
    .from('hashprice_snapshots')
    .select('snapshot_date, btc_price, hashprice_usd')
    .gte('snapshot_date', since)
    .order('snapshot_date', { ascending: true })

  if (error) {
    console.error('[hashprice-history]', error.message)
    return NextResponse.json({ rows: [] })
  }

  const rows = (data ?? []) as Row[]
  cached = { rows, timestamp: now }
  return NextResponse.json({ rows, cached: false })
}

export const dynamic = 'force-dynamic'
