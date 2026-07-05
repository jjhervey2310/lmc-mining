import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { unsubscribeToken } from '@/lib/newsletter'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const email = url.searchParams.get('e')?.toLowerCase().trim()
  const token = url.searchParams.get('t')

  const page = (title: string, body: string) =>
    new NextResponse(
      `<!DOCTYPE html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head><body style="background:#0a0a0a;color:#e2e8f0;font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;"><div style="text-align:center;padding:32px;"><h1 style="color:#f59e0b;font-size:22px;">${title}</h1><p style="color:#9ca3af;">${body}</p></div></body></html>`,
      { headers: { 'Content-Type': 'text/html' } }
    )

  if (!email || !token || !process.env.DAILY_CONTENT_SECRET) {
    return page('Invalid link', 'This unsubscribe link is missing information. Reply to any of our emails and we’ll remove you manually.')
  }
  if (token !== unsubscribeToken(email, process.env.DAILY_CONTENT_SECRET)) {
    return page('Invalid link', 'This unsubscribe link is invalid or expired. Reply to any of our emails and we’ll remove you manually.')
  }

  const supabase = createServiceClient()
  if (!supabase) return page('Something went wrong', 'Please try again later.')

  await supabase.from('email_suppressions').upsert({ email }, { onConflict: 'email' })

  return page('You’re unsubscribed', 'You won’t receive the weekly newsletter anymore. Changed your mind? Sign up again anytime at lightningmines.com.')
}

export const dynamic = 'force-dynamic'
