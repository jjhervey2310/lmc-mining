import { NextResponse } from 'next/server'

import { createServiceClient } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

// The live pulse behind the LEVERAGE header strip.
//
// Separate from the page render on purpose: every dashboard page is force-dynamic and
// static once rendered, so a strip claiming to be live has to fetch for itself. It is
// gated by the same ADMIN_SECRET as the page — a route reporting what a private research
// desk is doing is not a public route, even though it carries no prices.
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const sb = createServiceClient()
  if (!sb) return NextResponse.json({ error: 'no research store' }, { status: 503 })

  // One missing table must not blank the strip; a partial answer beats none.
  const q = async <T,>(fn: () => PromiseLike<{ data: T | null }>): Promise<T | null> => {
    try { return (await fn()).data } catch { return null }
  }

  const [beat, verdicts] = await Promise.all([
    q<{ host: string; at: string; phase: string; cycle: number | null }[]>(
      () => sb.from('kr_heartbeat').select('host, at, phase, cycle')
        .order('at', { ascending: false }).limit(1)),
    q<{ status: string; observations: number; observations_needed: number }[]>(
      () => sb.from('kr_research_verdicts').select('status, observations, observations_needed')),
  ])

  const countOf = async (table: string): Promise<number> => {
    try {
      const { count } = await sb.from(table).select('*', { count: 'exact', head: true })
      return count ?? 0
    } catch { return 0 }
  }
  // The streams that actually accumulate. Registry-style tables are excluded because a
  // number that never moves reads as a stall.
  const observations = (await Promise.all([
    'kr_ohlcv', 'kr_funding', 'kr_book', 'kr_tape', 'kr_vol_surface', 'kr_stablecoins',
    'kr_market_stats', 'kr_deep_candles', 'kr_venue_funding', 'kr_wallet_fills',
    'kr_option_trades', 'kr_liquidation_events', 'kr_macro', 'kr_paper_positions',
  ].map(countOf))).reduce((a, b) => a + b, 0)

  const rows = verdicts ?? []
  const answered = rows.filter((v) => v.status === 'green' || v.status === 'red').length

  return NextResponse.json({
    phase: beat?.[0]?.phase ?? null,
    at: beat?.[0]?.at ?? null,
    cycle: beat?.[0]?.cycle ?? null,
    host: beat?.[0]?.host ?? null,
    observations,
    answered,
    hypotheses: rows.length,
  })
}
