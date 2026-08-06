import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// The PA's conversation, server-side — so the Mac and the phone app share one
// thread instead of each keeping its own localStorage brain.

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const secret = new URL(req.url).searchParams.get('secret') || ''
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ messages: [] })

  const { data } = await supabase
    .from('pa_chat')
    .select('role, content')
    .order('created_at', { ascending: false })
    .limit(30)

  return NextResponse.json({ messages: (data ?? []).reverse() })
}
