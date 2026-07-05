import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'
import { buildNewsletter, unsubscribeToken, type WeekSnapshot } from '@/lib/newsletter'

export async function POST(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key
  const supabase = createServiceClient()
  if (!apiKey || !supabase) {
    return NextResponse.json({ error: 'Not configured' }, { status: 503 })
  }

  try {
    const since = new Date(Date.now() - 8 * 864e5).toISOString().split('T')[0]
    const { data: snapshots, error: snapErr } = await supabase
      .from('hashprice_snapshots')
      .select('snapshot_date, btc_price, difficulty, hashprice_usd')
      .gte('snapshot_date', since)
      .order('snapshot_date', { ascending: true })
    if (snapErr) throw snapErr
    if (!snapshots || snapshots.length < 2) throw new Error('Not enough snapshot data')

    const [{ data: leads }, { data: subs }, { data: suppressed }] = await Promise.all([
      supabase.from('leads').select('email'),
      supabase.from('email_subscribers').select('email'),
      supabase.from('email_suppressions').select('email'),
    ])

    const blocked = new Set((suppressed ?? []).map(s => s.email.toLowerCase()))
    const recipients = [...new Set(
      [...(leads ?? []), ...(subs ?? [])]
        .map(r => r.email?.toLowerCase().trim())
        .filter((e): e is string => !!e && e.includes('@') && !blocked.has(e))
    )]

    if (recipients.length === 0) {
      return NextResponse.json({ ok: true, sent: 0, note: 'No recipients' })
    }

    const { subject, htmlBody } = buildNewsletter(
      snapshots.map(s => ({
        snapshot_date: s.snapshot_date,
        btc_price: Number(s.btc_price),
        difficulty: Number(s.difficulty),
        hashprice_usd: Number(s.hashprice_usd),
      }) satisfies WeekSnapshot),
      new Date()
    )

    const resend = new Resend(apiKey)
    let sent = 0
    const failures: string[] = []
    for (const email of recipients) {
      const token = unsubscribeToken(email, process.env.DAILY_CONTENT_SECRET)
      const unsubUrl = `https://www.lightningmines.com/api/unsubscribe?e=${encodeURIComponent(email)}&t=${token}`
      const { error } = await resend.emails.send({
        from: 'Lightning Mines <no-reply@lightningmines.com>',
        to: email,
        subject,
        html: htmlBody.replace('__UNSUB_URL__', unsubUrl),
        headers: { 'List-Unsubscribe': `<${unsubUrl}>` },
      })
      if (error) failures.push(email)
      else sent++
      // Resend free tier allows 2 req/s — stay well under it
      await new Promise(r => setTimeout(r, 600))
    }

    return NextResponse.json({ ok: true, sent, failed: failures.length })
  } catch (err) {
    console.error('[cron/weekly-newsletter]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
