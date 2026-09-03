import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Live desk state for the ROBINHOOD tab's 60s client refresh.
// Same auth + service-client pattern as the page; read-only; never cached.

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-admin-secret') || url.searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  const [h, t, a, b, st, le] = await Promise.all([
    supabase.from('live_holdings').select('symbol, qty, avg_cost, synced_at').order('symbol'),
    supabase.from('desk_triggers').select('symbol, kind, level, band_pct, spec').eq('active', true).order('symbol'),
    supabase.from('desk_alert_log').select('at, symbol, kind, level, price, sent, queued, note').order('at', { ascending: false }).limit(20),
    supabase.from('pa_memory').select('fact, updated_at').eq('topic', 'dashboard').maybeSingle(),
    supabase.from('pa_memory').select('fact, updated_at').eq('topic', 'house-strategy').maybeSingle(),
    supabase.from('desk_config').select('value, updated_at').eq('key', 'loop_enabled').maybeSingle(),
  ])

  return NextResponse.json({
    holdings: h.data ?? null,
    triggers: t.data ?? null,
    alerts: a.data ?? null,
    board: b.data ?? null,
    strategy: st.data ?? null,
    loop_enabled: le.data ? String(le.data.value).toLowerCase() === 'true' : null,
    at: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
