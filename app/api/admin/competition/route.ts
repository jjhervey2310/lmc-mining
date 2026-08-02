import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Log a rival's weekly cash total for the trading competition (Jacob enters
// these from the terminal panel). Guarded by ADMIN_SECRET like the PA chat.

export const dynamic = 'force-dynamic'

const CONTESTANTS = ['gpt', 'gemini'] as const // Perplexity dropped out 2026-08-01

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!process.env.ADMIN_SECRET || body?.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const contestant = String(body?.contestant || '')
  const cashTotal = Number(body?.cashTotal)
  if (!CONTESTANTS.includes(contestant as (typeof CONTESTANTS)[number]) || !isFinite(cashTotal) || cashTotal < 0) {
    return NextResponse.json({ error: 'need contestant (gpt|gemini) and cashTotal >= 0' }, { status: 400 })
  }

  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  // week_of = Monday of the current week (Denver-ish; date precision is enough here)
  const now = new Date()
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((now.getUTCDay() + 6) % 7))
  const weekOf = monday.toISOString().slice(0, 10)

  const { error } = await supabase
    .from('comp_weekly')
    .upsert({ week_of: weekOf, contestant, cash_total: cashTotal, reported_at: now.toISOString() }, { onConflict: 'week_of,contestant' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, weekOf, contestant, cashTotal })
}
