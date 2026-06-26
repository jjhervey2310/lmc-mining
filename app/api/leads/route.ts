import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { Resend } from 'resend'
import type { LeadType } from '@/lib/types'
import { sendWelcomeEmail, sendDealAnalysisEmail, sendAuditConfirmationEmail } from '@/lib/send-email'

function extractEntities(formData: Record<string, unknown>) {
  const text = JSON.stringify(formData).toLowerCase()

  const miners = [
    's21 pro', 's21', 's19 xp', 's19j pro+', 's19j pro', 's19 pro', 's19',
    'avalon a1566', 'avalon a1466', 'avalon a1366', 'avalon',
    'm60s', 'm63s', 'm50s',
  ]
  const miner_mentioned = miners.find((m) => text.includes(m)) || null

  const cooling_type_mentioned =
    text.includes('immersion') ? 'immersion' :
    text.includes('hydro') ? 'hydro' :
    text.includes('air') ? 'air' : null

  const providers = ['abundant miners', 'compass', 'core scientific', 'blockware', 'sabre56', 'bit5ive']
  const hosting_provider_mentioned = providers.find((p) => text.includes(p)) || null

  const budget_range = (formData.budget_range as string) || null

  return { miner_mentioned, cooling_type_mentioned, hosting_provider_mentioned, budget_range }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      name = null,
      email,
      lead_type = 'email_capture',
      form_data = null,
      source = null,
      notes = null,
    } = body as {
      name?: string | null
      email: string
      lead_type?: LeadType
      form_data?: Record<string, unknown> | null
      source?: string | null
      notes?: string | null
    }

    if (!email) {
      // Silently succeed — never break the UI
      return NextResponse.json({ success: true })
    }

    console.log('[Leads API] Email received:', email)
    console.log('[Leads API] RESEND_API_KEY present:', !!(process.env.RESEND_API_KEY || process.env.resend_api_key))

    const extracted_entities = form_data ? extractEntities(form_data) : {}
    const primary_concern = form_data
      ? ((form_data.primary_concern as string) || (extracted_entities as { miner_mentioned?: string | null }).miner_mentioned || null)
      : null

    const record = {
      name: name || null,
      email,
      lead_type,
      form_data: form_data || null,
      extracted_entities: form_data ? extracted_entities : null,
      primary_concern,
      question_category: form_data
        ? ((extracted_entities as { cooling_type_mentioned?: string | null }).cooling_type_mentioned ? 'Cooling' : primary_concern)
        : null,
      source: source || lead_type,
      notes: notes || null,
      status: 'new',
    }

    const supabase = createServiceClient()

    if (supabase) {
      const { data: insertedData, error } = await supabase.from('leads').insert(record).select('id')
      if (error) {
        console.error('[leads] DB insert error:', error)
        // Still return success — don't break the UI
      } else {
        // Analytics event (best-effort)
        try {
          await supabase.from('analytics_events').insert({
            event_type: 'lead_submitted',
            event_data: { lead_type, extracted_entities },
            page: `/${String(lead_type).replace('_', '-')}`,
          })
        } catch { /* non-critical */ }

        // Subscriber email (best-effort — never breaks form submission)
        try {
          console.log('[Leads API] Attempting to send welcome email...')
          let emailResult: unknown
          const leadId = (insertedData as Array<{ id: string }> | null)?.[0]?.id
          if (lead_type === 'email_capture' && typeof source === 'string' && source.startsWith('deal_analyzer_results')) {
            const parts = source.split('|')
            const minerSlug = parts[1] || 'unknown'
            const score = parseInt((parts[2] || 'score:0').replace('score:', ''), 10) || 0
            emailResult = await sendDealAnalysisEmail(email, minerSlug, score)
          } else if (lead_type === 'audit_inquiry') {
            const tier = typeof notes === 'string' && notes.includes('297') ? '$297 Deep Dive' : '$97 Basic'
            emailResult = await sendAuditConfirmationEmail(email, name, tier)
          } else if (lead_type === 'email_capture') {
            emailResult = await sendWelcomeEmail(email)
            // Track email1 so the cron sequence skips it
            if (leadId) {
              void supabase.from('leads').update({ sent_emails: ['email1'] }).eq('id', leadId)
            }
          }
          console.log('[Leads API] Email send result:', emailResult)
        } catch (emailErr) {
          console.error('[Leads API] Subscriber email error (non-fatal):', emailErr)
        }

        // Owner notification email (best-effort)
        const resendKey = process.env.RESEND_API_KEY || process.env.resend_api_key
        const notificationEmail = process.env.NOTIFICATION_EMAIL
        if (resendKey && notificationEmail) {
          const resend = new Resend(resendKey)
          await resend.emails.send({
            from: 'Lightning Mines <no-reply@lightningmines.com>',
            to: notificationEmail,
            subject: `New ${String(lead_type).replace('_', ' ')} lead: ${email}`,
            html: `
              <h2>New Lead: ${String(lead_type).replace('_', ' ')}</h2>
              <p><strong>Email:</strong> ${email}</p>
              ${name ? `<p><strong>Name:</strong> ${name}</p>` : ''}
              ${source ? `<p><strong>Source:</strong> ${source}</p>` : ''}
              ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ''}
              ${primary_concern ? `<p><strong>Primary Concern:</strong> ${primary_concern}</p>` : ''}
              ${form_data ? `<hr/><pre>${JSON.stringify(form_data, null, 2)}</pre>` : ''}
            `,
          }).catch((e: unknown) => console.error('[leads] Email send error:', e))
        }
      }
    } else {
      // Supabase not configured — log to console so the owner can see submissions
      console.log('[leads] Supabase not configured. Lead captured:', record)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[leads] Handler error:', error)
    // Always return success to the client — never break the UI
    return NextResponse.json({ success: true })
  }
}

export const dynamic = 'force-dynamic'
