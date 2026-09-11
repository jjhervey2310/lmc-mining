import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveIds, cgFetch, lastKnownPrices } from '@/lib/desk-cg'
import { gradeTiming, ANCHOR, type TimingInput } from '@/lib/desk-timing'
import { rhConfigured } from '@/lib/robinhood'

// TIMING CHECK for one symbol: up-to-date price + 24h volume + an A–F grade against the house laws
// and the tape, plus the ruled size and the stop the buy would carry. Read-only; secret-gated.
// Numbers: CoinGecko (price, volume, 24h/7d/30d, 30 days of daily bars). Book: live_holdings,
// desk_triggers, live_trades, desk_config. Shared with /api/fund/buy so the button and the order
// are graded by the same code.

export const dynamic = 'force-dynamic'
export const revalidate = 0

const DENVER_OFFSET_H = -6

export async function buildTiming(symbol: string) {
  const supabase = createServiceClient()
  if (!supabase) throw new Error('db unavailable')
  const sym = symbol.toUpperCase()
  const ids = await resolveIds([sym])
  const cgId = ids[sym]
  if (!cgId) throw new Error(`no CoinGecko id for ${sym}`)

  const weekStart = (() => {
    const now = new Date(Date.now() + DENVER_OFFSET_H * 3600e3)
    const dow = (now.getUTCDay() + 6) % 7                    // Monday = 0
    const mon = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow))
    return new Date(mon.getTime() - DENVER_OFFSET_H * 3600e3).toISOString()
  })()

  const [holdQ, trigQ, tradesQ, cfgQ, mkt, chart] = await Promise.all([
    supabase.from('live_holdings').select('symbol, qty, avg_cost'),
    supabase.from('desk_triggers').select('symbol, kind, level').eq('active', true),
    supabase.from('live_trades').select('symbol, side, traded_at').gte('traded_at', weekStart).eq('side', 'buy'),
    supabase.from('desk_config').select('key, value').in('key', ['loop_enabled', 'macro_half_size', 'entry_blackout']),
    cgFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${cgId},bitcoin&price_change_percentage=24h,7d,30d`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null),
    // Why the chart failed matters: a rate-limited fetch used to look identical to a
    // coin with no history, and both silently removed the RUNNING extension law from
    // the grade. Keep the status so the reason can be reported.
    cgFetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=30&interval=daily`, { cache: 'no-store' })
      .then(async (r) => r.ok ? { ok: true as const, data: await r.json() } : { ok: false as const, status: r.status })
      .catch((e) => ({ ok: false as const, status: 0, message: e instanceof Error ? e.message : String(e) })),
  ])
  type Mk = { id: string; current_price: number; total_volume: number; price_change_percentage_24h_in_currency?: number; price_change_percentage_7d_in_currency?: number; price_change_percentage_30d_in_currency?: number }
  const rows = (mkt ?? []) as Mk[]
  const me = rows.find((r) => r.id === cgId); const btc = rows.find((r) => r.id === 'bitcoin')
  if (!me?.current_price) throw new Error(`CoinGecko has no live price for ${sym}`)
  const chartData = chart.ok ? (chart.data as { prices?: [number, number][]; total_volumes?: [number, number][] }) : null
  const chartError = chart.ok ? null
    : chart.status === 429 ? 'CoinGecko rate-limited the 30-day chart (429)'
    : `CoinGecko chart fetch failed (${chart.status || 'network error'})`
  const prices = ((chartData?.prices ?? []) as [number, number][]).map((p) => p[1])
  const vols = ((chartData?.total_volumes ?? []) as [number, number][]).map((v) => v[1])
  const completedPx = prices.slice(0, -1), completedVol = vols.slice(0, -1)
  const hi20 = completedPx.length >= 5 ? Math.max(...completedPx.slice(-20)) : null
  const avgVol20 = completedVol.length >= 5 ? completedVol.slice(-20).reduce((a, b) => a + b, 0) / Math.min(20, completedVol.length) : null

  const holdings = (holdQ.data ?? []) as { symbol: string; qty: number; avg_cost: number }[]
  const cash = Number(holdings.find((h) => h.symbol === 'USD')?.qty ?? 0)
  const positions = holdings.filter((h) => h.symbol !== 'USD' && Number(h.qty) > 0)
  // Book value at CoinGecko prices for the held names (one more call; the page's own figure is client-side).
  const heldIds = await resolveIds(positions.map((p) => p.symbol))
  const heldIdList = [...new Set(positions.map((p) => heldIds[p.symbol]).filter(Boolean))]
  const heldMkt = positions.length ? await cgFetch(`https://api.coingecko.com/api/v3/simple/price?ids=${heldIdList.join(',')}&vs_currencies=usd`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : {}).catch(() => ({})) as Record<string, { usd: number }> : {}
  // A rate-limited price must NEVER value a position at zero: that collapses the book to cash, zeroes
  // the slot count and caps every grade at D (2026-09-10 defect). Fall back to the last known close.
  const missing = positions.filter((p) => !(heldMkt[heldIds[p.symbol]]?.usd > 0))
  const fallback = missing.length ? await lastKnownPrices(missing.map((p) => heldIds[p.symbol])) : {}
  const priceOf = (sym: string) => heldMkt[heldIds[sym]]?.usd || fallback[heldIds[sym]]?.usd || null
  const unpriced = positions.filter((p) => priceOf(p.symbol) == null).map((p) => p.symbol)
  const posValue = positions.reduce((s, p) => s + Number(p.qty) * (priceOf(p.symbol) ?? 0), 0)
  const book = posValue + cash
  const stalePriced = missing.filter((p) => fallback[heldIds[p.symbol]]).map((p) => p.symbol)
  const cfg = Object.fromEntries(((cfgQ.data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]))
  const nowIso = new Date().toISOString()
  const blackoutCfg = cfg.entry_blackout ?? '2026-09-14T00:00:00Z/2026-09-17T06:00:00Z|FOMC blackout Sept 13 18:00 MT – Sept 16 close'
  const [range, label] = blackoutCfg.split('|'); const [b0, b1] = range.split('/')
  const blackout = b0 && b1 && nowIso >= b0 && nowIso <= b1 ? (label ?? 'entry blackout') : null
  const halfSize = cfg.macro_half_size != null ? String(cfg.macro_half_size).toLowerCase() === 'true' : nowIso < '2026-09-17T00:00:00Z'

  const input: TimingInput = {
    symbol: sym, price: me.current_price,
    d1: me.price_change_percentage_24h_in_currency ?? null, d7: me.price_change_percentage_7d_in_currency ?? null, d30: me.price_change_percentage_30d_in_currency ?? null,
    vol24h: me.total_volume ?? null, avgVol20, hi20,
    tapeError: chartError,
    rs7VsBtc: me.price_change_percentage_7d_in_currency != null && btc?.price_change_percentage_7d_in_currency != null ? me.price_change_percentage_7d_in_currency - btc.price_change_percentage_7d_in_currency : null,
    armed: ((trigQ.data ?? []) as { symbol: string; kind: string; level: number }[]).filter((t) => t.symbol === sym).map((t) => ({ kind: t.kind, level: Number(t.level) })),
    cashUsd: cash, bookUsd: book,
    sleeveCount: positions.filter((p) => !ANCHOR.has(p.symbol)).length, slots: Math.min(7, Math.floor(book / 150)), holdingsCount: positions.length,
    weeklyEntries: new Set(((tradesQ.data ?? []) as { symbol: string }[]).map((t) => t.symbol).filter((s) => !ANCHOR.has(s))).size,
    blackout, halted: String(cfg.loop_enabled ?? 'true').toLowerCase() !== 'true',
    halfSize, held: positions.some((p) => p.symbol === sym),
  }
  const result = gradeTiming(input)
  return {
    symbol: sym, cgId, at: nowIso,
    price: me.current_price, vol24h: me.total_volume ?? null, avgVol20, volX: me.total_volume && avgVol20 ? me.total_volume / avgVol20 : null,
    d1: input.d1, d7: input.d7, d30: input.d30, hi20, extPct: hi20 ? (me.current_price / hi20 - 1) * 100 : null, rs7VsBtc: input.rs7VsBtc,
    tapeError: chartError,
    book, cash, slots: input.slots, sleeveCount: input.sleeveCount, weeklyEntries: input.weeklyEntries, blackout, halfSize,
    book_health: { unpriced, stale_priced: stalePriced, trustworthy: unpriced.length === 0 },
    ...result,
    rh_configured: rhConfigured(),
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-admin-secret') || url.searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const symbol = (url.searchParams.get('symbol') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  try {
    return NextResponse.json(await buildTiming(symbol), { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
