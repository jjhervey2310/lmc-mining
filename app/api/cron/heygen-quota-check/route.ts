import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const RECIPIENT = 'jjhervey1@gmail.com'
// A week of 7 renders burns roughly 300-550 units — alert when the balance
// can't safely cover the next Saturday batch.
const DEFAULT_THRESHOLD = 600

// Runs via pg_cron before each Saturday batch: checks the HeyGen balance and
// emails Jacob when it's too low to afford the coming week of posts.
async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const heygenKey = process.env.HEYGEN_API_KEY
  if (!heygenKey) return NextResponse.json({ error: 'HEYGEN_API_KEY not set' }, { status: 503 })

  const res = await fetch('https://api.heygen.com/v2/user/remaining_quota', {
    headers: { 'x-api-key': heygenKey },
  })
  if (!res.ok) return NextResponse.json({ error: `HeyGen returned ${res.status}` }, { status: 502 })
  const body = (await res.json()) as { data?: { remaining_quota?: number } }
  const quota = body.data?.remaining_quota ?? 0
  const threshold = Number(process.env.HEYGEN_QUOTA_ALERT_THRESHOLD || DEFAULT_THRESHOLD)
  const low = quota < threshold

  if (low) {
    const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key
    if (apiKey) {
      const resend = new Resend(apiKey)
      await resend.emails.send({
        from: 'Lightning Mines <no-reply@lightningmines.com>',
        to: RECIPIENT,
        subject: `⚠ HeyGen balance low: ${quota} units — top up before Saturday's batch`,
        html: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 8px;">HeyGen balance: ${quota} units</h2>
<p>A week of 7 videos burns roughly 300–550 units, so the next Saturday batch may not complete.</p>
<p><a href="https://app.heygen.com/settings?nav=API" style="color:#f59e0b;">Top up here</a> — $50 ≈ 3,000 units ≈ 3–4 weeks of posts.</p>
<p style="color:#6b7280;font-size:13px;">Automatic check from lightningmines.com (runs before each Saturday batch).</p>
</div>`,
      })
    }
  }

  return NextResponse.json({ quota, threshold, low, alerted: low })
}

export const GET = handle
export const POST = handle
export const dynamic = 'force-dynamic'
