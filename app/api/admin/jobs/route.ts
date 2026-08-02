import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Tick-off endpoint for the job wire: marks a job done/applied/hidden so it
// leaves the wire forever (dedup on url means the sweep never re-adds it).

export const dynamic = 'force-dynamic'

const STATUSES = ['done', 'applied', 'seen', 'hidden'] as const

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!process.env.ADMIN_SECRET || body?.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const url = String(body?.url || '')
  const status = String(body?.status || 'done')
  if (!url || !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return NextResponse.json({ error: 'need url and status (done|applied|seen|hidden)' }, { status: 400 })
  }
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })
  const { error } = await supabase.from('job_finds').update({ status }).eq('url', url)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
