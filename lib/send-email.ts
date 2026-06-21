import { Resend } from 'resend'
import { getEmail1Html, EMAIL2, EMAIL3, EMAIL4, EMAIL5 } from '@/lib/email-sequences'

const FROM = 'LMC Mining <noreply@lightningmines.com>'

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key
  if (!apiKey) return null
  return new Resend(apiKey)
}

async function send(email: string, subject: string, html: string): Promise<unknown> {
  const resend = getResend()
  if (!resend) {
    console.log('[send-email] No RESEND_API_KEY â email skipped for:', email, '|', subject)
    return
  }
  try {
    const result = await resend.emails.send({ from: FROM, to: email, subject, html })
    console.log('[send-email] Sent:', subject, 'â', email, JSON.stringify(result))
    return result
  } catch (err) {
    console.error('[send-email] Error sending:', subject, 'â', email, err)
  }
}

// âââ Email 1 â Immediate welcome ââââââââââââââââââââââââââââââââââââââââââ

export async function sendWelcomeEmail(email: string): Promise<unknown> {
  const spreadsheetLink = process.env.SPREADSHEET_LINK || 'https://lmc-mining.vercel.app/deal-analyzer'
  return send(email, 'â¡ Your free Mining ROI Spreadsheet is here', getEmail1Html(spreadsheetLink))
}

// âââ Email 2 â Day 2 ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function sendEmail2MistakeEmail(email: string): Promise<unknown> {
  return send(email, EMAIL2.subject, EMAIL2.html)
}

// âââ Email 3 â Day 4 ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function sendEmail3HostingEmail(email: string): Promise<unknown> {
  return send(email, EMAIL3.subject, EMAIL3.html)
}

// âââ Email 4 â Day 7 ââââââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function sendEmail4AuditPitchEmail(email: string): Promise<unknown> {
  return send(email, EMAIL4.subject, EMAIL4.html)
}

// âââ Email 5 â Day 14 âââââââââââââââââââââââââââââââââââââââââââââââââââââ

export async function sendEmail5CaseStudyEmail(email: string): Promise<unknown> {
  return send(email, EMAIL5.subject, EMAIL5.html)
}

// âââ Transactional emails âââââââââââââââââââââââââââââââââââââââââââââââââ

export async function sendDealAnalysisEmail(email: string, minerSlug: string, score: number): Promise<unknown> {
  const verdict = score >= 70 ? 'STRONG DEAL' : score >= 50 ? 'DECENT DEAL' : 'HIGH RISK'
  const verdictColor = score >= 70 ? '#00d4aa' : score >= 50 ? '#f59e0b' : '#ef4444'

  const html = `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      <div style="color:#f59e0b;font-size:22px;font-weight:bold;margin-bottom:24px;">â¡ LMC Mining Intelligence</div>
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:16px;">Your Deal Analysis Results</h1>
      <div style="background:#111111;border:1px solid #1e293b;border-radius:8px;padding:24px;margin:24px 0;text-align:center;">
        <div style="color:#94a3b8;font-size:14px;margin-bottom:8px;">OVERALL DEAL SCORE</div>
        <div style="color:${verdictColor};font-size:64px;font-weight:900;line-height:1;">${score}</div>
        <div style="color:${verdictColor};font-size:18px;font-weight:bold;margin-top:8px;">${verdict}</div>
      </div>
      ${score < 70 ? `
      <div style="background:#1a0a0a;border-left:4px solid #ef4444;padding:16px;margin:16px 0;border-radius:4px;">
        <div style="color:#ef4444;font-weight:bold;margin-bottom:8px;">â ï¸ This deal carries risk</div>
        <p style="color:#94a3b8;margin:0;">A score below 70 means real concerns with this deal. Before committing capital, get a professional audit.</p>
      </div>
      <a href="https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;font-weight:bold;padding:16px 32px;border-radius:8px;text-decoration:none;margin:16px 0;">Book $97 Expert Audit â</a>
      ` : `
      <div style="background:#0a1a0a;border-left:4px solid #00d4aa;padding:16px;margin:16px 0;border-radius:4px;">
        <div style="color:#00d4aa;font-weight:bold;margin-bottom:8px;">â Solid fundamentals</div>
        <p style="color:#94a3b8;margin:0;">Your deal scores well. A professional audit can verify these numbers and catch anything you might have missed.</p>
      </div>
      <a href="https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01" style="display:inline-block;background:#111111;color:#f59e0b;font-weight:bold;padding:16px 32px;border-radius:8px;text-decoration:none;margin:16px 0;border:1px solid #f59e0b;">Book a $97 Audit for Peace of Mind â</a>
      `}
      <a href="https://lmc-mining.vercel.app/deal-analyzer" style="display:inline-block;color:#94a3b8;font-size:14px;margin-top:16px;">Run another analysis â</a>
      <p style="color:#64748b;font-size:14px;margin-top:32px;">â Jacob H., Founder of LMC Mining Intelligence</p>
    </div>
  `
  return send(email, `Your mining deal analysis: ${score}/100 â ${verdict}`, html)
}

export async function sendAuditConfirmationEmail(email: string, name: string | null, tier: string): Promise<unknown> {
  const isDeepDive = tier.includes('297') || tier.toLowerCase().includes('deep')
  const tierLabel = isDeepDive ? 'Deep Dive ($297)' : 'Standard ($97)'
  const stripeLink = isDeepDive
    ? 'https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00'
    : 'https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01'

  const html = `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      <div style="color:#f59e0b;font-size:22px;font-weight:bold;margin-bottom:24px;">â¡ LMC Mining Intelligence</div>
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:16px;">Audit Request Received</h1>
      <p style="color:#94a3b8;font-size:16px;line-height:1.6;">Hi ${name ?? 'there'}, thanks for submitting your audit request. I'll review your details and send a payment link within a few hours.</p>
      <div style="background:#111111;border:1px solid #1e293b;border-radius:8px;padding:24px;margin:24px 0;">
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:12px;">What happens next:</div>
        <ol style="color:#94a3b8;line-height:2.2;padding-left:20px;">
          <li>I review your submission (usually within 2 hours)</li>
          <li>You receive a payment link for the ${tierLabel} Audit</li>
          <li>After payment, analysis begins immediately</li>
          <li>Written report delivered within ${isDeepDive ? '72' : '48'} hours</li>
          ${isDeepDive ? '<li>30-minute video call scheduled to walk through findings</li>' : ''}
        </ol>
      </div>
      <p style="color:#94a3b8;font-size:14px;">Or pay now to skip the wait:</p>
      <a href="${stripeLink}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;font-weight:bold;padding:16px 32px;border-radius:8px;text-decoration:none;margin:8px 0;">Pay Now â ${tierLabel} â</a>
      <p style="color:#64748b;font-size:14px;margin-top:32px;">100% money-back guarantee if you don't get at least one concrete actionable insight.</p>
      <p style="color:#64748b;font-size:14px;">â Jacob H., Founder of LMC Mining Intelligence</p>
    </div>
  `
  return send(email, `Your ${tierLabel} Mining Audit request received â`, html)
}
