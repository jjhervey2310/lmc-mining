import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { event_type, event_data, page } = await req.json()
    if (!event_type) return NextResponse.json({ success: true })

    const supabase = createServiceClient()
    if (supabase) {
      await supabase.from('analytics_events').insert({ event_type, event_data, page })
    }
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}

export const dynamic = 'force-dynamic'
