import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

export async function POST(req: NextRequest) {
  try {
    const { provider_name, destination_url, source_page, cooling_type_context } = await req.json()
    if (!destination_url) return NextResponse.json({ success: true })

    const supabase = createServiceClient()
    if (supabase) {
      await Promise.all([
        supabase.from('affiliate_clicks').insert({
          provider_name, destination_url, source_page, cooling_type_context,
        }),
        supabase.from('analytics_events').insert({
          event_type: 'affiliate_click',
          event_data: { provider_name, destination_url, cooling_type_context },
          page: source_page,
        }),
      ])
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}

export const dynamic = 'force-dynamic'
