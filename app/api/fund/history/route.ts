import { NextResponse } from 'next/server'

// Price history for the ROBINHOOD tab's click-a-name chart. CoinGecko's free tier blocks
// market_chart from the browser (no CORS header for this origin — 2026-09-07 finding), so the
// page asks us and we ask CoinGecko server-side, cached 5 minutes per id+range. Secret-gated.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-admin-secret') || url.searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = (url.searchParams.get('id') || '').toLowerCase()
  const days = Math.min(365, Math.max(1, Number(url.searchParams.get('days') || 90)))
  if (!/^[a-z0-9-]{2,64}$/.test(id)) return NextResponse.json({ error: 'bad id' }, { status: 400 })
  try {
    const r = await fetch(`https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=${days}`, {
      headers: { 'User-Agent': 'lightningmines-dashboard/1.0' },
      next: { revalidate: 300 },
    })
    if (!r.ok) return NextResponse.json({ error: `coingecko ${r.status}` }, { status: 502 })
    const j = (await r.json()) as { prices?: [number, number][] }
    const raw = j.prices ?? []
    const step = Math.max(1, Math.ceil(raw.length / 240))
    const prices = raw.filter((_, i) => i % step === 0 || i === raw.length - 1)
    return NextResponse.json({ id, days, prices }, { headers: { 'Cache-Control': 'private, max-age=120' } })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'fetch failed' }, { status: 502 })
  }
}
