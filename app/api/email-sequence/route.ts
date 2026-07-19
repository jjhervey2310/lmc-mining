/**
 * Email sequence cron — called daily at 9am UTC by Vercel Cron (vercel.json).
 *
 * Sends the correct follow-up email to each subscriber based on days since signup.
 * Tracks sent emails in the `sent_emails` jsonb column on the leads table.
 *
 * Required Supabase migration — run once in the Supabase SQL editor:
 *   ALTER TABLE leads ADD COLUMN IF NOT EXISTS sent_emails jsonb DEFAULT '[]';
 *
 * Schedule:
 *   Email 1 — Day  0 (immediate, sent by /api/leads on signup)
 *   Email 2 — Day  2 — The #1 mistake new miners make
 *   Email 3 — Day  4 — 12 questions to ask any hosting provider
 *   Email 4 — Day  7 — $97 audit pitch
 *   Email 5 — Day 14 — Good deal vs bad deal case study
 */

import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import {
  sendEmail2MistakeEmail,
  sendEmail3HostingEmail,
  sendEmail4AuditPitchEmail,
  sendEmail5CaseStudyEmail,
} from '@/lib/send-email'

const EMAIL_SCHEDULE = [
  { key: 'email2', days: 2,  fn: sendEmail2MistakeEmail },
  { key: 'email3', days: 4,  fn: sendEmail3HostingEmail },
  { key: 'email4', days: 7,  fn: sendEmail4AuditPitchEmail },
  { key: 'email5', days: 14, fn: sendEmail5CaseStudyEmail },
] as const

type Lead = {
  id: string
  email: string
  created_at: string
  sent_emails: unknown
}

export async function GET(request: NextRequest) {
  // Allow manual triggers with ?secret= for testing; Vercel cron passes Authorization header
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  if (!supabase) {
    console.error('[email-sequence] Supabase not configured')
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 500 })
  }

  const now = new Date()

  // Fetch email_capture leads created in the last 30 days (sequence window)
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, email, created_at, sent_emails')
    .eq('lead_type', 'email_capture')
    .gte('created_at', cutoff)
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    console.error('[email-sequence] DB error:', error)
    return NextResponse.json({ error: 'DB error', detail: error.message }, { status: 500 })
  }

  const results = { processed: 0, sent: 0, skipped: 0, errors: 0 }

  // Dedupe by email: a repeat signup creates a second lead row, and processing
  // rows independently re-runs the whole sequence for that person (observed:
  // duplicate email5 sends). Merge rows per email — earliest signup drives the
  // schedule, sent_emails is the union across rows, and updates write to every
  // row so the merged state stays consistent.
  type MergedLead = { ids: string[]; email: string; createdAt: Date; sentEmails: string[] }
  const byEmail = new Map<string, MergedLead>()
  for (const lead of (leads ?? []) as Lead[]) {
    const key = lead.email.toLowerCase().trim()
    const rowSent: string[] = Array.isArray(lead.sent_emails) ? (lead.sent_emails as string[]) : []
    const existing = byEmail.get(key)
    if (existing) {
      // Rows are ordered by created_at ascending, so `existing` keeps the earliest signup date
      existing.ids.push(lead.id)
      existing.sentEmails = [...new Set([...existing.sentEmails, ...rowSent])]
    } else {
      byEmail.set(key, {
        ids: [lead.id],
        email: lead.email,
        createdAt: new Date(lead.created_at),
        sentEmails: rowSent,
      })
    }
  }

  for (const lead of byEmail.values()) {
    results.processed++
    const daysSinceSignup = Math.floor(
      (now.getTime() - lead.createdAt.getTime()) / (1000 * 60 * 60 * 24)
    )
    let sentEmails = lead.sentEmails

    let anySentThisRun = false

    for (const { key, days, fn } of EMAIL_SCHEDULE) {
      if (daysSinceSignup < days) continue
      if (sentEmails.includes(key)) continue

      try {
        console.log(`[email-sequence] Sending ${key} to ${lead.email} (day ${daysSinceSignup})`)
        await fn(lead.email)
        sentEmails = [...sentEmails, key]
        anySentThisRun = true
        results.sent++
      } catch (err) {
        console.error(`[email-sequence] Error sending ${key} to ${lead.email}:`, err)
        results.errors++
      }
    }

    // Single DB update per person — write merged sent_emails to ALL their rows
    if (anySentThisRun) {
      await supabase
        .from('leads')
        .update({ sent_emails: sentEmails })
        .in('id', lead.ids)
        .then(({ error: updateErr }) => {
          if (updateErr) console.error('[email-sequence] Update error for', lead.ids.join(','), updateErr)
        })
    } else {
      results.skipped++
    }
  }

  console.log('[email-sequence] Run complete:', results)
  return NextResponse.json({ success: true, ...results, timestamp: now.toISOString() })
}

export const dynamic = 'force-dynamic'
