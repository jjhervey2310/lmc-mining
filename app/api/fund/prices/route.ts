import { NextResponse } from 'next/server'
import { resolveIds, cgFetch, coinbaseSpot } from '@/lib/desk-cg'

// BUILD REQUEST #14(a) — ONE price call for the whole tab, cached on the server.
//
// The browser used to call CoinGecko itself, once per tab, every 60s, for every symbol. Every open
// tab was its own client of a rate-limited anonymous endpoint, so the feed simply stopped updating
// and the tab went on showing old numbers with no way to tell (Jacob, 2026-09-11: "live prices are
// not updating"). Now: one upstream call per 45s for ALL symbols, shared by every tab, carrying the
// demo key, with Coinbase spot as the fallback for price.
//
// The contract that matters is honesty about age, not freshness:
//   • `at`      — when the numbers in this response were actually fetched upstream (NOT now()).
//   • `stale`   — true when `at` is older than 3 minutes. The tab shows a banner and keeps the
//                 numbers on screen, because silent stale prices are worse than no prices.
//   • `error`   — the upstream failure, carried alongside the last good values rather than
//                 replacing them with nothing. A missing symbol is absent from `prices`; it is
//                 never a zero.
//
// Auth and cache headers match /api/fund/state.

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface LivePrice { price: number; d1: number | null; d7: number | null; d30: number | null; vol: number | null; src: string }

const TTL_MS = 45_000
const STALE_MS = 180_000

// Per-symbol so a call for a different symbol set still reuses what we already hold. Survives for
// the life of the serverless instance — shared by every tab that instance serves.
const cache = new Map<string, { v: LivePrice; at: number }>()
let lastError: { at: number; message: string } | null = null

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-admin-secret') || url.searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const symbols = [...new Set((url.searchParams.get('symbols') ?? '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))]
    .filter((s) => s !== 'USD')
    .slice(0, 120)
  if (!symbols.length) return NextResponse.json({ at: null, stale: true, error: 'no symbols requested', prices: {} }, { headers: { 'Cache-Control': 'no-store' } })

  const now = Date.now()
  const missing = symbols.filter((s) => { const c = cache.get(s); return !c || now - c.at > TTL_MS })

  if (missing.length) {
    try {
      const ids = await resolveIds(missing)
      const wanted = [...new Set(missing.map((s) => ids[s]).filter(Boolean))]
      if (wanted.length) {
        const res = await cgFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${wanted.join(',')}&price_change_percentage=24h,7d,30d&per_page=250`, { cache: 'no-store' })
        if (!res.ok) throw new Error(`CoinGecko ${res.status}`)
        const rows = (await res.json()) as { id: string; current_price: number; total_volume?: number
          price_change_percentage_24h_in_currency?: number; price_change_percentage_7d_in_currency?: number; price_change_percentage_30d_in_currency?: number }[]
        const byId = Object.fromEntries(rows.map((r) => [r.id, r]))
        const at = Date.now()
        for (const sym of missing) {
          const r = byId[ids[sym]]
          if (r?.current_price) cache.set(sym, { at, v: {
            price: r.current_price,
            d1: r.price_change_percentage_24h_in_currency ?? null,
            d7: r.price_change_percentage_7d_in_currency ?? null,
            d30: r.price_change_percentage_30d_in_currency ?? null,
            vol: r.total_volume ?? null, src: 'coingecko',
          } })
        }
        lastError = null
      }
    } catch (e) {
      lastError = { at: Date.now(), message: e instanceof Error ? e.message : 'price fetch failed' }
    }

    // Fallback: Coinbase spot for anything still unpriced (or priced only by a cache entry older than
    // the stale line). Price only — Coinbase's spot endpoint carries no 24h/7d/30d, and an invented
    // percentage would be worse than a dash.
    const stillMissing = missing.filter((s) => { const c = cache.get(s); return !c || Date.now() - c.at > STALE_MS })
    for (const sym of stillMissing.slice(0, 12)) {
      try {
        const cb = await coinbaseSpot(sym)
        if (cb?.usd) cache.set(sym, { at: Date.now(), v: { price: cb.usd, d1: null, d7: null, d30: null, vol: null, src: 'coinbase' } })
      } catch { /* leave it absent — a symbol with no price must not appear with one */ }
    }
  }

  const prices: Record<string, LivePrice> = {}
  let oldest = 0
  for (const sym of symbols) {
    const c = cache.get(sym)
    if (!c) continue
    prices[sym] = c.v
    oldest = oldest === 0 ? c.at : Math.min(oldest, c.at)
  }
  const at = oldest || null
  return NextResponse.json({
    at: at ? new Date(at).toISOString() : null,
    stale: at == null || Date.now() - at > STALE_MS,
    error: lastError && Date.now() - lastError.at < 10 * 60_000 ? lastError.message : null,
    missing: symbols.filter((s) => !prices[s]),
    prices,
  }, { headers: { 'Cache-Control': 'no-store' } })
}
