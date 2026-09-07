import { NextResponse } from 'next/server'

// Price history for the ROBINHOOD tab charts. CoinGecko's free tier blocks market_chart from the
// browser (no CORS header for this origin — 2026-09-07 finding), so the page asks us and we ask
// CoinGecko server-side. The free tier also rate-limits (~30/min): we keep a per-instance memory
// cache (10 min fresh, stale served on upstream failure), retry once on 429/5xx, and serialize
// upstream calls so a page load of 18 names never fans out into a burst. Secret-gated.

export const dynamic = 'force-dynamic'

type Entry = { at: number; prices: [number, number][] }
const g = globalThis as unknown as { __lmcHist?: Map<string, Entry>; __lmcHistChain?: Promise<unknown> }
const cache = (g.__lmcHist ??= new Map<string, Entry>())
const FRESH_MS = 10 * 60_000
const GAP_MS = 350   // minimum spacing between upstream calls from this instance

async function upstream(id: string, days: number): Promise<[number, number][] | null> {
  const url = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`
  for (let attempt = 0; attempt < 2; attempt++) {
    const r = await fetch(url, { headers: { 'User-Agent': 'lightningmines-dashboard/1.0' }, cache: 'no-store' })
    if (r.ok) {
      const j = (await r.json()) as { prices?: [number, number][] }
      const raw = j.prices ?? []
      const step = Math.max(1, Math.ceil(raw.length / 240))
      return raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
    }
    if ((r.status === 429 || r.status >= 500) && attempt === 0) { await new Promise((res) => setTimeout(res, 1500)); continue }
    return null
  }
  return null
}

// One upstream call at a time per instance, spaced GAP_MS apart.
function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const prev = g.__lmcHistChain ?? Promise.resolve()
  const next = prev.catch(() => undefined).then(async () => { const v = await fn(); await new Promise((res) => setTimeout(res, GAP_MS)); return v })
  g.__lmcHistChain = next
  return next
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
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < FRESH_MS) {
    return NextResponse.json({ id, days, prices: hit.prices, cached: true }, { headers: { 'Cache-Control': 'private, max-age=120' } })
  }
  try {
    const prices = await serialized(() => upstream(id, days))
    if (prices && prices.length > 1) {
      cache.set(key, { at: Date.now(), prices })
      return NextResponse.json({ id, days, prices }, { headers: { 'Cache-Control': 'private, max-age=120' } })
    }
    if (hit) return NextResponse.json({ id, days, prices: hit.prices, stale: true }, { headers: { 'Cache-Control': 'private, max-age=60' } })
    return NextResponse.json({ error: 'coingecko unavailable (rate-limited or down); no cached copy' }, { status: 502 })
  } catch (e) {
    if (hit) return NextResponse.json({ id, days, prices: hit.prices, stale: true })
    return NextResponse.json({ error: e instanceof Error ? e.message : 'fetch failed' }, { status: 502 })
  }
}
