import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { fetchProducts } from '@/lib/desk/coinbase-candles'

// UNIVERSE SYNC (daily): every Coinbase Exchange USD pair, online AND delisted, into universe_history,
// then seed md_backfill_cursor rows for daily (all) and hourly (priority ≤ 1) bars. Data-only.
// A delisting is recorded as the first day WE saw status=delisted — labelled observed, not actual.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const DAILY_TARGET = '2021-01-01T00:00:00Z'
const HOURLY_DAYS = 400

async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const sb = createServiceClient()
  if (!sb) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  const products = (await fetchProducts()).filter((p) => p.quote_currency === 'USD')
  const today = new Date().toISOString().slice(0, 10)
  const { data: existing } = await sb.from('universe_history').select('symbol, status, delisted_at, priority').eq('venue', 'coinbase')
  const prev = new Map((existing ?? []).map((r) => [r.symbol as string, r]))
  // Core names (held or in the Kraken lake) get priority 0 so their hourly history lands first.
  const { data: core } = await sb.from('kr_ohlcv').select('symbol').limit(1000)
  const coreSet = new Set((core ?? []).map((r) => String(r.symbol).replace(/\/USD$/, '')))

  const rows = products.map((p) => {
    const was = prev.get(p.base_currency)
    const delisted = p.status === 'delisted' || p.trading_disabled
    return {
      venue: 'coinbase', symbol: p.base_currency, product_id: p.id, status: p.status, trading_disabled: p.trading_disabled,
      delisted_at: delisted ? (was?.delisted_at ?? today) : null,
      priority: coreSet.has(p.base_currency) ? 0 : delisted ? 2 : 1,
      observed_at: new Date().toISOString(),
    }
  })
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('universe_history').upsert(rows.slice(i, i + 500), { onConflict: 'venue,symbol' })
    if (error) return NextResponse.json({ error: `universe upsert: ${error.message}` }, { status: 500 })
  }

  // Cursors: insert-only (ON CONFLICT DO NOTHING) so a running backfill is never reset.
  const now = new Date()
  const cursors = rows.flatMap((r) => {
    const base = { venue: 'coinbase', symbol: r.symbol, product_id: r.product_id, next_end: now.toISOString(), priority: r.priority }
    const daily = { ...base, interval_minutes: 1440, target_start: DAILY_TARGET }
    const hourly = { ...base, interval_minutes: 60, target_start: new Date(now.getTime() - HOURLY_DAYS * 86_400_000).toISOString() }
    return r.priority <= 1 ? [daily, hourly] : [daily]
  })
  let seeded = 0
  for (let i = 0; i < cursors.length; i += 500) {
    const { error, count } = await sb.from('md_backfill_cursor').upsert(cursors.slice(i, i + 500), { onConflict: 'venue,symbol,interval_minutes', ignoreDuplicates: true, count: 'exact' })
    if (error) return NextResponse.json({ error: `cursor seed: ${error.message}` }, { status: 500 })
    seeded += count ?? 0
  }
  const { data: refreshed } = await sb.rpc('universe_refresh_bars')

  return NextResponse.json({
    products: products.length, online: rows.filter((r) => r.status === 'online').length, delisted: rows.filter((r) => r.delisted_at).length,
    cursors_total: cursors.length, cursors_new: seeded, bars_refreshed: refreshed ?? null, day: today,
  })
}

export const GET = handle
export const POST = handle
