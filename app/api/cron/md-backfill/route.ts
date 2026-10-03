import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { runBackfillBatch } from '@/lib/desk/md-backfill'

// MD BACKFILL / FORWARD FILL (every few minutes via pg_cron): one bounded batch of Coinbase candle
// chunks into md_candles, plus a head refresh for finished cursors. Data-only; idempotent upserts.
// Progress is visible on the DESK tab (desk_status().backfill).

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = createServiceClient()
  if (!sb) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })
  const url = new URL(req.url)
  const chunks = Math.min(60, Math.max(1, Number(url.searchParams.get('chunks')) || 40))
  const heads = Math.min(200, Math.max(0, Number(url.searchParams.get('heads')) || 20))   // 150 heads ≈ 20s at 3-per-400ms; the daily close needs ~420 heads within the hour
  try {
    const started = Date.now()
    const r = await runBackfillBatch(sb, { chunks, heads })
    return NextResponse.json({ ...r, ms: Date.now() - started })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
