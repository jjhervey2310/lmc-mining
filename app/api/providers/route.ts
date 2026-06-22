import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { PROVIDERS_DATA } from '@/lib/data'

export async function GET() {
  const supabase = createServiceClient()

  if (!supabase) {
    return NextResponse.json({ providers: PROVIDERS_DATA })
  }

  const { data, error } = await supabase
    .from('hosting_providers')
    .select('*')
    .eq('is_active', true)
    .order('sort_order')
    .order('name')

  if (error) {
    console.error('Error fetching providers:', error)
    return NextResponse.json({ providers: PROVIDERS_DATA })
  }

  return NextResponse.json({ providers: data })
}

export const dynamic = 'force-dynamic'
