import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { resolveIds } from '@/lib/desk-cg'
import { gradeTiming, ANCHOR, type TimingInput, type Regime } from '@/lib/desk-timing'
import { rhConfigured } from '@/lib/robinhood'

// TIMING CHECK for one symbol: up-to-date price + 24h volume + an A–F grade against the house laws
// (v4.1 + A9/A9.1) and the tape, plus the ruled size and the stop the buy would carry. Read-only; secret-gated.
// Numbers: CoinGecko (price, volume, 24h/7d/30d, 30 days of daily bars for the breakout test, 365 days of BTC
// for the regime). Book: live_holdings, desk_triggers, desk_config (loop_enabled, sleeve_breaker, regime,
// macro_half_size, entry_blackout). Shared with /api/fund/buy so the button and the order are graded by the
// same code.

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

  const [holdQ, trigQ, cfgQ, mkt, chart, btcChart] = await Promise.all([
    supabase.from('live_holdings').select('symbol, qty, avg_cost'),
    supabase.from('desk_triggers').select('symbol, kind, level').eq('active', true),
    supabase.from('desk_config').select('key, value').in('key', ['loop_enabled', 'macro_half_size', 'entry_blackout', 'sleeve_breaker', 'regime']),
    fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${cgId},bitcoin&price_change_percentage=24h,7d,30d`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null),
    fetch(`https://api.coingecko.com/api/v3/coins/${cgId}/market_chart?vs_currency=usd&days=30&interval=daily`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : null),
    // BTC daily closes for the regime test (A9 §4 / #10 (i): BULL = BTC above a rising 200d). Cached an hour — it moves once a day.
    fetch('https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=365&interval=daily', { next: { revalidate: 3600 } }).then((r) => r.ok ? r.json() : null),
  ])
  type Mk = { id: string; current_price: number; total_volume: number; price_change_percentage_24h_in_currency?: number; price_change_percentage_7d_in_currency?: number; price_change_percentage_30d_in_currency?: number }
  const rows = (mkt ?? []) as Mk[]
  const me = rows.find((r) => r.id === cgId); const btc = rows.find((r) => r.id === 'bitcoin')
  if (!me?.current_price) throw new Error(`CoinGecko has no live price for ${sym}`)
  const prices = ((chart?.prices ?? []) as [number, number][]).map((p) => p[1])
  const vols = ((chart?.total_volumes ?? []) as [number, number][]).map((v) => v[1])
  // CoinGecko's last point is the live print; completed days are everything before it. The 20-day window is the
  // 20 completed days BEFORE the last completed close (#10 (a): today excluded from its own high).
  const completedPx = prices.slice(0, -1), completedVol = vols.slice(0, -1)
  const lastClose = completedPx.length ? completedPx[completedPx.length - 1] : null
  const lastVol = completedVol.length ? completedVol[completedVol.length - 1] : null
  const win = completedPx.slice(-21, -1), winV = completedVol.slice(-21, -1)
  const hi20 = win.length >= 5 ? Math.max(...win) : null
  const lo20 = win.length >= 5 ? Math.min(...win) : null
  const avgVol20 = winV.length >= 5 ? winV.reduce((a, b) => a + b, 0) / winV.length : null
  // A9 §3 breakout rule on the last COMPLETED close: close > 20d high, volume >= 1.5x 20d avg, 7d RS > BTC, <= 15% above the high.
  const rs7 = me.price_change_percentage_7d_in_currency != null && btc?.price_change_percentage_7d_in_currency != null ? me.price_change_percentage_7d_in_currency - btc.price_change_percentage_7d_in_currency : null
  const sigParts = {
    high: lastClose != null && hi20 != null && lastClose > hi20,
    vol: lastVol != null && avgVol20 != null && lastVol >= 1.5 * avgVol20,
    rs: rs7 != null && rs7 > 0,
    ext: lastClose != null && hi20 != null && lastClose / hi20 - 1 <= 0.15,
  }
  const signal = sigParts.high && sigParts.vol && sigParts.rs && sigParts.ext
  const signalWhy = [`close ${sigParts.high ? '>' : '≤'} 20d high`, `vol ${lastVol != null && avgVol20 ? (lastVol / avgVol20).toFixed(1) + 'x' : '?'} ${sigParts.vol ? '≥' : '<'} 1.5x`, `RS ${sigParts.rs ? '>' : '≤'} BTC`].join(', ')
  // REGIME: desk_config.regime overrides; else BTC last close vs a RISING 200d SMA (and 50d above 200d) from a year of closes.
  const btcCloses = ((btcChart?.prices ?? []) as [number, number][]).map((p) => p[1]).slice(0, -1)
  const sma = (arr: number[], n: number, back = 0) => arr.length >= n + back ? arr.slice(arr.length - n - back, arr.length - back).reduce((a, b) => a + b, 0) / n : null
  const s200 = sma(btcCloses, 200), s200prev = sma(btcCloses, 200, 20), s50 = sma(btcCloses, 50)
  const btcLast = btcCloses.length ? btcCloses[btcCloses.length - 1] : null
  const holdings = (holdQ.data ?? []) as { symbol: string; qty: number; avg_cost: number }[]
  const cash = Number(holdings.find((h) => h.symbol === 'USD')?.qty ?? 0)
  const positions = holdings.filter((h) => h.symbol !== 'USD' && Number(h.qty) > 0)
  // Book value at CoinGecko prices for the held names (one more call; the page's own figure is client-side).
  const heldIds = await resolveIds(positions.map((p) => p.symbol))
  const heldMkt = positions.length ? await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${[...new Set(positions.map((p) => heldIds[p.symbol]).filter(Boolean))].join(',')}&vs_currencies=usd`, { cache: 'no-store' }).then((r) => r.ok ? r.json() : {}) as Record<string, { usd: number }> : {}
  const posValue = positions.reduce((s, p) => s + Number(p.qty) * (heldMkt[heldIds[p.symbol]]?.usd ?? 0), 0)
  const book = posValue + cash
  const cfg = Object.fromEntries(((cfgQ.data ?? []) as { key: string; value: string }[]).map((r) => [r.key, r.value]))
  const nowIso = new Date().toISOString()
  // A9.1 §2: blackout law covers CPI and FOMC. Config entry_blackout = "startISO/endISO|label" entries separated by ';'.
  const blackoutCfg = cfg.entry_blackout ?? '2026-09-09T12:30:00Z/2026-09-11T15:30:00Z|CPI blackout Sept 9 06:30 MT – Sept 11 09:30 MT;2026-09-14T18:00:00Z/2026-09-16T22:00:00Z|FOMC blackout Sept 14 12:00 MT – Sept 16 16:00 MT'
  const blackout = blackoutCfg.split(';').map((e) => { const [range, label] = e.split('|'); const [b0, b1] = (range ?? '').split('/'); return b0 && b1 && nowIso >= b0 && nowIso <= b1 ? (label ?? 'entry blackout') : null }).find(Boolean) ?? null
  const halfSize = cfg.macro_half_size != null ? String(cfg.macro_half_size).toLowerCase() === 'true' : nowIso < '2026-09-16T22:00:00Z'
  const ov = String(cfg.regime ?? '').toUpperCase()
  const regime: Regime = ov === 'BULL' || ov === 'NEUTRAL' || ov === 'BEAR' ? (ov as Regime)
    : btcLast != null && s200 != null && s200prev != null && s50 != null ? (btcLast > s200 && s200 > s200prev && s50 > s200 ? 'BULL' : btcLast < s200 && s50 < s200 ? 'BEAR' : 'NEUTRAL') : 'NEUTRAL'
  const regimeWhy = ov ? 'desk_config override' : btcLast != null && s200 != null ? `BTC ${btcLast.toFixed(0)} vs 200d ${s200.toFixed(0)} (${s200prev != null && s200 > s200prev ? 'rising' : 'not rising'}), 50d ${s50?.toFixed(0) ?? '?'}` : 'no BTC history — bars applied in full'
  const sleeveUsd = positions.filter((p) => !ANCHOR.has(p.symbol)).reduce((s, p) => s + Number(p.qty) * (heldMkt[heldIds[p.symbol]]?.usd ?? 0), 0)
  const mine = positions.find((p) => p.symbol === sym)
  const nameUsd = mine ? Number(mine.qty) * (heldMkt[heldIds[sym]]?.usd ?? me.current_price) : 0

  const input: TimingInput = {
    symbol: sym, price: me.current_price,
    d1: me.price_change_percentage_24h_in_currency ?? null, d7: me.price_change_percentage_7d_in_currency ?? null, d30: me.price_change_percentage_30d_in_currency ?? null,
    vol24h: me.total_volume ?? null, avgVol20, hi20, lo20, rs7VsBtc: rs7,
    signal, signalWhy, regime, regimeWhy,
    armed: ((trigQ.data ?? []) as { symbol: string; kind: string; level: number }[]).filter((t) => t.symbol === sym).map((t) => ({ kind: t.kind, level: Number(t.level) })),
    cashUsd: cash, bookUsd: book, sleeveUsd, nameUsd, holdingsCount: positions.length,
    blackout, halted: String(cfg.loop_enabled ?? 'true').toLowerCase() !== 'true',
    breaker: cfg.sleeve_breaker ? String(cfg.sleeve_breaker) : null,
    halfSize, held: positions.some((p) => p.symbol === sym),
  }
  const result = gradeTiming(input)
  return {
    symbol: sym, cgId, at: nowIso,
    price: me.current_price, vol24h: me.total_volume ?? null, avgVol20, volX: me.total_volume && avgVol20 ? me.total_volume / avgVol20 : null,
    d1: input.d1, d7: input.d7, d30: input.d30, hi20, lo20, extPct: hi20 ? (me.current_price / hi20 - 1) * 100 : null, rs7VsBtc: rs7,
    signal, signalWhy, regime, regimeWhy,
    book, cash, sleeveUsd, sleeveCap: book * 0.15, blackout, halfSize, breaker: input.breaker,
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
