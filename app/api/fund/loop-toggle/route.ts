import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Kill switch for the 24/7 desk loop: flips desk_config.loop_enabled.
// Secret-gated like the rest of the terminal. This is the ONE write the
// ROBINHOOD tab makes — a safety control, never a trade.

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-admin-secret') || url.searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })
  const { data } = await supabase.from('desk_config').select('value').eq('key', 'loop_enabled').maybeSingle()
  const next = String(data?.value ?? 'true').toLowerCase() === 'true' ? 'false' : 'true'
  const { error } = await supabase.from('desk_config').upsert({ key: 'loop_enabled', value: next, updated_at: new Date().toISOString() }, { onConflict: 'key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ loop_enabled: next === 'true' }, { headers: { 'Cache-Control': 'no-store' } })
}
