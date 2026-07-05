import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers, buildDailyDrop } from '@/lib/daily-content'

const RECIPIENT = 'jjhervey1@gmail.com'

export async function POST(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key
  if (!apiKey) {
    return NextResponse.json({ error: 'Resend not configured' }, { status: 503 })
  }

  try {
    const live = await getLivePriceData()
    if (!live || 'error' in live) throw new Error('Live price data unavailable')

    const numbers = computeDailyNumbers(live.price, live.difficulty)
    const drop = buildDailyDrop(numbers, new Date())

    const dateLabel = new Date().toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver',
    })

    const section = (title: string, body: string) =>
      `<h2 style="color:#f59e0b;font-size:15px;margin:24px 0 8px;">${title}</h2><div style="white-space:pre-wrap;color:#e2e8f0;font-size:14px;line-height:1.6;background:#111111;border:1px solid #222;border-radius:8px;padding:14px;">${body}</div>`

    const html = `<div style="background:#0a0a0a;padding:32px;font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;">
<h1 style="color:#fff;font-size:20px;margin:0 0 4px;">⚡ Today's Post — ${dateLabel}</h1>
<p style="color:#9ca3af;font-size:13px;margin:0 0 4px;">${drop.theme} · numbers pulled live at send time & pre-checked against BRAND.md</p>
${section('🎬 Video Script (30–60s vertical)', drop.script)}
${section('📺 YouTube Shorts caption', drop.captions.youtube)}
${section('🎵 TikTok caption', drop.captions.tiktok)}
${section('📸 Instagram Reels caption', drop.captions.instagram)}
${section('𝕏 X post (text-native)', drop.captions.x)}
${section('✅ Posting checklist', drop.checklist.join('\n'))}
<p style="color:#6b7280;font-size:12px;margin-top:24px;">Lightning Mines daily content drop · reply to this email with feedback and the templates get updated.</p>
</div>`

    const resend = new Resend(apiKey)
    const result = await resend.emails.send({
      from: 'Lightning Mines Content Desk <no-reply@lightningmines.com>',
      to: RECIPIENT,
      subject: `⚡ Today's post: ${drop.theme} — S21 net ${numbers.profitable ? '+' : '-'}$${Math.abs(numbers.s21NetDay).toFixed(2)}/day`,
      html,
    })

    return NextResponse.json({ ok: true, theme: drop.theme, emailId: result.data?.id ?? null })
  } catch (err) {
    console.error('[cron/daily-content]', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

export const dynamic = 'force-dynamic'
