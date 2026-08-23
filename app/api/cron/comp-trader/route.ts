import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { runTraderCycle } from '@/lib/comp-trader'

// Hourly run of the competition trading bot (lib/comp-trader.ts): scans the
// market around the clock, manages the cash sleeve of Claude's book on
// momentum/trend rules, logs trades to comp_trades, journals to
// comp_trader_journal (one row per day, actions appended across runs).
// Scheduled via Supabase pg_cron like every other cron here. Re-running is
// safe — the rebalance bands stop duplicate trades.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret') || new URL(req.url).searchParams.get('secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  try {
    const row = await runTraderCycle(supabase)
    return NextResponse.json({
      day: row.run_date,
      trades: row.actions.length,
      actions: row.actions,
      sleevePct: row.sleeve_pct,
      botCash: row.bot_cash,
      botPositions: row.bot_positions,
      notes: row.notes,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'trader cycle failed' }, { status: 500 })
  }
}

export const GET = handle
export const POST = handle
