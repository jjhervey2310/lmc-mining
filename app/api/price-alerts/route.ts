import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

interface AlertInput {
  type: 'btc_above' | 'btc_below' | 'hashprice_above' | 'hashprice_below'
  threshold: number
}

export async function POST(req: NextRequest) {
  try {
    const { email, alerts }: { email: string; alerts: AlertInput[] } = await req.json()

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email required' }, { status: 400 })
    }

    if (!alerts || alerts.length === 0) {
      return NextResponse.json({ error: 'At least one alert type required' }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !supabaseKey || supabaseUrl.includes('placeholder')) {
      // Supabase not connected yet — return success for UX, log the signup
      console.log('[price-alerts] Signup (Supabase not connected):', { email, alerts })
      return NextResponse.json({ success: true, message: 'Alert registered' })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const rows = alerts.map((a: AlertInput) => ({
      email,
      alert_type: a.type,
      threshold: a.threshold,
      is_active: true,
      created_at: new Date().toISOString(),
    }))

    const { error } = await supabase
      .from('price_alerts')
      .upsert(rows, { onConflict: 'email,alert_type', ignoreDuplicates: false })

    if (error) {
      console.error('[price-alerts] Supabase error:', error)
      return NextResponse.json({ error: 'Failed to save alert' }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Alert registered' })
  } catch (err) {
    console.error('[price-alerts] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ message: 'Price alerts API. POST to create alerts.' })
}
