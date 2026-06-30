import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { COINGECKO_URL } from '@/lib/constants'

function calcHashprice(btcPrice: number, difficulty: number): number {
  return (2.7e20 * btcPrice) / (difficulty * 4294967296)
}

export async function POST(req: Request) {
  const secret = req.headers.get('x-cron-secret')
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })
  }

  try {
    const apiKey = process.env.COINGECKO_API_KEY
    const cgUrl = apiKey ? `${COINGECKO_URL}&x_cg_demo_api_key=${apiKey}` : COINGECKO_URL

    const [priceRes, diffRes] = await Promise.all([
      fetch(cgUrl, { cache: 'no-store' }),
      fetch('https://blockchain.info/q/getdifficulty', { cache: 'no-store' }),
    ])

    if (!priceRes.ok) throw new Error(`CoinGecko ${priceRes.status}`)
    if (!diffRes.ok) throw new Error(`blockchain.info ${diffRes.status}`)

    const priceData = await priceRes.json()
    const btcPrice: number = priceData?.bitcoin?.usd
    const difficulty = parseFloat(await diffRes.text())

    if (!btcPrice || isNaN(difficulty) || difficulty <= 0) {
      throw new Error('Invalid upstream data')
    }

    const hashprice = calcHashprice(btcPrice, difficulty)
    const snapshotDate = new Date().toISOString().split('T')[0]

    const { error } = await supabase.from('hashprice_snapshots').upsert(
      { snapshot_date: snapshotDate, btc_price: btcPrice, difficulty, hashprice_usd: hashprice },
      { onConflict: 'snapshot_date' }
    )

    if (error) throw error

    return NextResponse.json({ ok: true, date: snapshotDate, btcPrice, difficulty, hashprice })
  } catch (err) {
    console.error('[cron/hashprice-snapshot]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
