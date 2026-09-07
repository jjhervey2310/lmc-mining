import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Price history for the ROBINHOOD tab charts.
// Why this exists (2026-09-07): CoinGecko's free market_chart has no CORS header (browser fetches fail)
// and rate-limits Vercel's shared IPs (a page load of 18 names 429s). So:
//   1. DB FIRST — cg_history holds a year of daily closes per id, refreshed daily by the droplet
//      (history_sync.py). Any range up to 365d is a slice of that. Fresh if < 30h old.
//   2. LIVE ONLY when the DB has nothing for the id (or for 7d, where daily points are too coarse),
//      one upstream call at a time per instance, retried once, with a 10-min memory cache and
//      stale-on-failure. Secret-gated.

export const dynamic = 'force-dynamic'

type Pt = [number, number]
type Entry = { at: number; prices: Pt[] }
const g = globalThis as unknown as { __lmcHist?: Map<string, Entry>; __lmcHistChain?: Promise<unknown> }
const cache = (g.__lmcHist ??= new Map<string, Entry>())
const FRESH_MS = 10 * 60_000
const DB_FRESH_MS = 30 * 3600_000
const GAP_MS = 350

async function upstream(id: string, days: number): Promise<Pt[] | null> {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'lightningmines-dashboard/1.0' }, cache: 'no-store' })
    if (r.ok) {
      const j = (await r.json()) as { prices?: Pt[] }
      const raw = j.prices ?? []
      const step = Math.max(1, Math.ceil(raw.length / 240))
      return raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
    }
    if ((r.status === 429 || r.status >= 500) && attempt === 0) { await new Promise((res) => setTimeout(res, 1500)); continue }
    return null
  }
  return null
}
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__lmcHistChain ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(async () => { const v = await fn(); await new Promise((res) => setTimeout(res, GAP_MS)); return v })
  g.__lmcHistChain = next
  return next
}

async function fromDb(id: string, days: number): Promise<{ prices: Pt[]; updated_at: string } | null> {
  const sb = createServiceClient()
  if (!sb) return null
  const { data } = await sb.from('cg_history').select('prices, updated_at').eq('id', id).maybeSingle()
  if (!data?.prices) return null
  const all = data.prices as Pt[]
  const since = Date.now() - days * 86400e3
  const slice = all.filter((p) => p[0] >= since)
  return slice.length > 1 ? { prices: slice, updated_at: data.updated_at as string } : null
}

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-admin-secret') || url.searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = (url.searchParams.get('id') || '').toLowerCase()
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') || 90)))
  if (!/^[a-z0-9-]{2,64}$/.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  const key = `${id}:${days}`
  const hdr = { 'Cache-Control': 'private, max-age=120' }

  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < FRESH_MS) return NextResponse.json({ id, days, prices: hit.prices, source: 'memory' }, { headers: hdr })

  // 1. DB slice (daily closes) — the normal path for 30d/90d/1y and the fallback for 7d.
  const db = await fromDb(id, days).catch(() => null)
  const dbFresh = db && Date.now() - new Date(db.updated_at).getTime() < DB_FRESH_MS
  if (db && dbFresh && days > 7) {
    cache.set(key, { at: Date.now(), prices: db.prices })
    return NextResponse.json({ id, days, prices: db.prices, source: 'db', as_of: db.updated_at }, { headers: hdr })
  }
  // 2. Live (7d wants hourly points; or the DB has nothing / is stale).
  try {
    const prices = await serialized(() => upstream(id, days))
    if (prices && prices.length > 1) {
      cache.set(key, { at: Date.now(), prices })
      return NextResponse.json({ id, days, prices, source: 'live' }, { headers: hdr })
    }
  } catch { /* fall through to whatever we have */ }
  if (db) return NextResponse.json({ id, days, prices: db.prices, source: 'db-stale', as_of: db.updated_at }, { headers: hdr })
  if (hit) return NextResponse.json({ id, days, prices: hit.prices, source: 'memory-stale' }, { headers: hdr })
  return NextResponse.json({ error: 'no history: CoinGecko unavailable and nothing in cg_history for this id' }, { status: 502 })
}
