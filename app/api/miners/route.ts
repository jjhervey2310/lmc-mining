import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { MINERS_DATA } from '@/lib/data'

export async function GET() {
  const supabase = createServiceClient()

  if (!supabase) {
    return NextResponse.json({ miners: MINERS_DATA })
  }

  const { data, error } = await supabase
    .from('miners')
    .select('*')
    .eq('is_active', true)
    .order('cooling_type')
    .order('default_hashrate_th', { ascending: false })

  if (error) {
    console.error('Error fetching miners:', error)
    return NextResponse.json({ miners: MINERS_DATA })
  }

  return NextResponse.json({ miners: data })
}

export const dynamic = 'force-dynamic'
