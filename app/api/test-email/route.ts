import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function GET() {
  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key

  if (!apiKey) {
    return NextResponse.json({
      error: 'No API key found',
      env: Object.keys(process.env).filter(k => k.toLowerCase().includes('resend')),
    })
  }

  const resend = new Resend(apiKey)

  try {
    const result = await resend.emails.send({
      from: 'Lightning Mines <onboarding@resend.dev>',
      to: 'jjhervey1@gmail.com',
      subject: 'Lightning Mines Email Test ⚡',
      html: '<div style="background:#0a0a0a;color:#ffffff;padding:40px;font-family:sans-serif;"><h1 style="color:#f59e0b;">⚡ Email system working!</h1><p style="color:#94a3b8;">Lightning Mines email integration is live. Resend is connected and sending correctly.</p></div>',
    })
    return NextResponse.json({ success: true, result })
  } catch (error) {
    return NextResponse.json({ success: false, error: String(error) })
  }
}

export const dynamic = 'force-dynamic'
