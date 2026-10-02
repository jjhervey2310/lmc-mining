import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// FEATURES (daily, after the backfill head refresh): runs compute_features_daily(date) in Postgres —
// completed daily bars only, one preferred venue per symbol, RS vs BTC by date. The heavy lifting is
// SQL (supabase/v4-desk-data.sql) so no bar data crosses the wire. ?date=YYYY-MM-DD recomputes a day;
// ?days=N recomputes the last N days (bounded, for backfilling features once candles exist).

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = createServiceClient()
  if (!sb) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })
  const url = new URL(req.url)
  const one = url.searchParams.get('date')
  const days = Math.min(60, Math.max(1, Number(url.searchParams.get('days')) || 1))
  // Yesterday UTC is the last completed daily bar.
  const end = one ? new Date(`${one}T00:00:00Z`) : new Date(Date.now() - 86_400_000)
  const out: Record<string, number | string> = {}
  for (let i = 0; i < (one ? 1 : days); i++) {
    const d = new Date(end.getTime() - i * 86_400_000).toISOString().slice(0, 10)
    const { data, error } = await sb.rpc('compute_features_daily', { p_date: d })
    out[d] = error ? `error: ${error.message}` : Number(data)
  }
  return NextResponse.json({ computed: out })
}

export const GET = handle
export const POST = handle
