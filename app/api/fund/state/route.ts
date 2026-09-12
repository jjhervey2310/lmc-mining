import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveIds, coinbaseSpot, lastKnownPrices } from '@/lib/desk-cg'
import { rhConfigured, bestBidAsk } from '@/lib/robinhood'

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

  const [h, t, a, b, st, le, th] = await Promise.all([
    supabase.from('live_holdings').select('symbol, qty, avg_cost, synced_at').order('symbol'),
    supabase.from('desk_triggers').select('symbol, kind, level, band_pct, spec').eq('active', true).order('symbol'),
    supabase.from('desk_alert_log').select('at, symbol, kind, level, price, sent, queued, note').order('at', { ascending: false }).limit(20),
    supabase.from('pa_memory').select('fact, updated_at').eq('topic', 'dashboard').maybeSingle(),
    supabase.from('pa_memory').select('fact, updated_at').eq('topic', 'house-strategy').maybeSingle(),
    supabase.from('desk_config').select('value, updated_at').eq('key', 'loop_enabled').maybeSingle(),
    // desk_theses (build request #4): thesis + gate under each holding, POLE/WATCH/BARRED for the pole panel.
    supabase.from('desk_theses').select('symbol, status, thesis, gate, updated_at').order('symbol'),
  ])
  // Latest radar scan (build request #6): stage/score/turnover beside each POLE/WATCH thesis. Numbers never come from thesis text.
  const latestScan = await supabase.from('fund_radar').select('scan_date').order('scan_date', { ascending: false }).limit(1).maybeSingle()
  const radar = latestScan.data?.scan_date
    ? await supabase.from('fund_radar').select('symbol, stage, score, turnover, d1, d7, d30, price, scan_date').eq('scan_date', latestScan.data.scan_date)
    : { data: null }

  // Latest flow radar (build request #8): flow score + stage beside each queue name.
  const latestFlow = await supabase.from('flow_radar').select('scan_date').order('scan_date', { ascending: false }).limit(1).maybeSingle()
  const flow = latestFlow.data?.scan_date
    ? await supabase.from('flow_radar').select('symbol, flow_score, stage, fees_wow, vol_wow, scan_date').eq('scan_date', latestFlow.data.scan_date)
    : { data: null }

  // PRICE THE BOOK SERVER-SIDE, ON THE SAME CHAIN AS EVERYTHING ELSE (Robinhood -> Coinbase -> last
  // close). The browser used to rebuild it from a client CoinGecko call with `?? 0` on a miss, so a
  // rate limit in Jacob's browser valued a position at nothing — SOL alone would understate the
  // account by $268 (2026-09-11, the fourth instance of failed-fetch-as-zero). A position we cannot
  // price goes in `unpriced` and `book` comes back NULL: unknown, never silently worth zero.
  const hold = (h.data ?? []) as { symbol: string; qty: number }[]
  const posSyms = hold.filter((x) => x.symbol !== 'USD' && Number(x.qty) > 0).map((x) => x.symbol)
  const cashUsd = Number(hold.find((x) => x.symbol === 'USD')?.qty ?? 0)
  const ids = await resolveIds(posSyms).catch(() => ({} as Record<string, string>))
  const priced: Record<string, { usd: number; src: string }> = {}
  for (const sym of posSyms) {
    if (rhConfigured()) {
      try {
        const q = await bestBidAsk(sym)
        const mid = Number(q.price) || (Number(q.bid_inclusive_of_sell_spread) + Number(q.ask_inclusive_of_buy_spread)) / 2
        if (mid > 0) { priced[sym] = { usd: mid, src: 'robinhood' }; continue }
      } catch { /* fall through */ }
    }
    const cb = await coinbaseSpot(sym)
    if (cb) { priced[sym] = { usd: cb.usd, src: 'coinbase' }; continue }
    const id = ids[sym]
    if (id) { const lk = await lastKnownPrices([id]); if (lk[id]) priced[sym] = { usd: lk[id].usd, src: 'cg_history (stale)' } }
  }
  const unpriced = posSyms.filter((sym) => !priced[sym])
  const posValue = posSyms.reduce((sum, sym) => sum + (priced[sym] ? Number(hold.find((x) => x.symbol === sym)!.qty) * priced[sym].usd : 0), 0)

  return NextResponse.json({
    holdings: h.data ?? null,
    triggers: t.data ?? null,
    alerts: a.data ?? null,
    board: b.data ?? null,
    strategy: st.data ?? null,
    theses: th.data ?? null,
    book: unpriced.length ? null : posValue + cashUsd,
    pos_value: unpriced.length ? null : posValue,
    cash_usd: cashUsd,
    prices: Object.fromEntries(Object.entries(priced).map(([k, v]) => [k, v.usd])),
    price_src: Object.fromEntries(Object.entries(priced).map(([k, v]) => [k, v.src])),
    unpriced,
    radar: radar.data ?? null,
    flow: flow.data ?? null,
    loop_enabled: le.data ? String(le.data.value).toLowerCase() === 'true' : null,
    at: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } })
}
