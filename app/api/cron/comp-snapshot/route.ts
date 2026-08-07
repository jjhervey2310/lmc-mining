import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getCompBooks } from '@/app/admin/dashboard/comp-data'

// Daily equity snapshot for the trading competition, so each contestant's book
// can be drawn as a curve instead of a single "today" number. Runs once a day;
// re-running the same day just overwrites that day's row.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret') || new URL(req.url).searchParams.get('secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  const books = await getCompBooks()
  // Denver date: the competition is scored on Jacob's calendar, not UTC.
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(new Date())

  const rows = books
    .filter((b) => b.total != null)
    .map((b) => ({ snapshot_date: day, contestant: b.key, total: b.total, cash: b.cash, holdings: b.holdings }))

  if (!rows.length) return NextResponse.json({ saved: 0, note: 'no priced books' })

  const { error } = await supabase.from('comp_snapshots').upsert(rows, { onConflict: 'snapshot_date,contestant' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: rows.length, day, totals: Object.fromEntries(rows.map((r) => [r.contestant, r.total])) })
}

export const GET = handle
export const POST = handle
