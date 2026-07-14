import { Resend } from 'resend'
import { getEmail1Html, EMAIL2, EMAIL3, EMAIL4, EMAIL5 } from '@/lib/email-sequences'

const FROM = 'Lightning Mines <no-reply@lightningmines.com>'

function getResend(): Resend | null {
  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key
  if (!apiKey) return null
  return new Resend(apiKey)
}

async function send(email: string, subject: string, html: string): Promise<unknown> {
  const resend = getResend()
  if (!resend) {
    console.log('[send-email] No RESEND_API_KEY — email skipped for:', email, '|', subject)
    return
  }
  try {
    const result = await resend.emails.send({ from: FROM, to: email, subject, html })
    console.log('[send-email] Sent:', subject, '→', email, JSON.stringify(result))
    return result
  } catch (err) {
    console.error('[send-email] Error sending:', subject, '→', email, err)
  }
}

// ─── Email 1 — Immediate welcome ──────────────────────────────────────────

export async function sendWelcomeEmail(email: string): Promise<unknown> {
  const spreadsheetLink = process.env.SPREADSHEET_LINK || 'https://lightningmines.com/calculator'
  return send(email, '⚡ Your free Mining ROI Spreadsheet is here', getEmail1Html(spreadsheetLink))
}

// ─── Email 2 — Day 2 ──────────────────────────────────────────────────────

export async function sendEmail2MistakeEmail(email: string): Promise<unknown> {
  return send(email, EMAIL2.subject, EMAIL2.html)
}

// ─── Email 3 — Day 4 ──────────────────────────────────────────────────────

export async function sendEmail3HostingEmail(email: string): Promise<unknown> {
  return send(email, EMAIL3.subject, EMAIL3.html)
}

// ─── Email 4 — Day 7 ──────────────────────────────────────────────────────

export async function sendEmail4AuditPitchEmail(email: string): Promise<unknown> {
  return send(email, EMAIL4.subject, EMAIL4.html)
}

// ─── Email 5 — Day 14 ─────────────────────────────────────────────────────

export async function sendEmail5CaseStudyEmail(email: string): Promise<unknown> {
  return send(email, EMAIL5.subject, EMAIL5.html)
}

// ─── Transactional emails ─────────────────────────────────────────────────

export async function sendDealAnalysisEmail(email: string, minerSlug: string, score: number): Promise<unknown> {
  const verdict = score >= 70 ? 'STRONG DEAL' : score >= 50 ? 'DECENT DEAL' : 'HIGH RISK'
  const verdictColor = score >= 70 ? '#00d4aa' : score >= 50 ? '#f59e0b' : '#ef4444'

  const html = `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      <div style="color:#f59e0b;font-size:22px;font-weight:bold;margin-bottom:24px;">⚡ Lightning Mines</div>
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:16px;">Your Deal Analysis Results</h1>
      <div style="background:#111111;border:1px solid #1e293b;border-radius:8px;padding:24px;margin:24px 0;text-align:center;">
        <div style="color:#94a3b8;font-size:14px;margin-bottom:8px;">OVERALL DEAL SCORE</div>
        <div style="color:${verdictColor};font-size:64px;font-weight:900;line-height:1;">${score}</div>
        <div style="color:${verdictColor};font-size:18px;font-weight:bold;margin-top:8px;">${verdict}</div>
      </div>
      ${score < 70 ? `
      <div style="background:#1a0a0a;border-left:4px solid #ef4444;padding:16px;margin:16px 0;border-radius:4px;">
        <div style="color:#ef4444;font-weight:bold;margin-bottom:8px;">⚠️ This deal carries risk</div>
        <p style="color:#94a3b8;margin:0;">A score below 70 means real concerns with this deal. Before committing capital, get a professional audit.</p>
      </div>
      <a href="https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;font-weight:bold;padding:16px 32px;border-radius:8px;text-decoration:none;margin:16px 0;">Book $97 Expert Audit →</a>
      ` : `
      <div style="background:#0a1a0a;border-left:4px solid #00d4aa;padding:16px;margin:16px 0;border-radius:4px;">
        <div style="color:#00d4aa;font-weight:bold;margin-bottom:8px;">✅ Solid fundamentals</div>
        <p style="color:#94a3b8;margin:0;">Your deal scores well. A professional audit can verify these numbers and catch anything you might have missed.</p>
      </div>
      <a href="https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01" style="display:inline-block;background:#111111;color:#f59e0b;font-weight:bold;padding:16px 32px;border-radius:8px;text-decoration:none;margin:16px 0;border:1px solid #f59e0b;">Book a $97 Audit for Peace of Mind →</a>
      `}
      <a href="https://lightningmines.com/calculator" style="display:inline-block;color:#94a3b8;font-size:14px;margin-top:16px;">Run another analysis →</a>
      <p style="color:#64748b;font-size:14px;margin-top:32px;">— Jacob H., Founder of Lightning Mines</p>
    </div>
  `
  return send(email, `Your mining deal analysis: ${score}/100 — ${verdict}`, html)
}

export async function sendDealReviewConfirmationEmail(email: string, name: string | null): Promise<unknown> {
  const html = `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      <div style="color:#f59e0b;font-size:22px;font-weight:bold;margin-bottom:24px;">⚡ Lightning Mines</div>
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:16px;">Your Free Deal Review Is In</h1>
      <p style="color:#94a3b8;font-size:16px;line-height:1.6;">Hi ${name ?? 'there'}, thanks for sending over your deal. I personally review every submission and I'll get back to you with an honest <strong style="color:#ffffff;">pass or avoid</strong> verdict — usually within 1 business day.</p>
      <div style="background:#111111;border:1px solid #1e293b;border-radius:8px;padding:24px;margin:24px 0;">
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:12px;">What happens next:</div>
        <ol style="color:#94a3b8;line-height:2.2;padding-left:20px;">
          <li>I check your numbers against live BTC price and network difficulty</li>
          <li>You get a plain-English verdict with the reasoning</li>
          <li>No cost, no obligation, no sales pitch</li>
        </ol>
      </div>
      <p style="color:#94a3b8;font-size:14px;">While you wait, model your own numbers:</p>
      <a href="https://lightningmines.com/calculator" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;font-weight:bold;padding:16px 32px;border-radius:8px;text-decoration:none;margin:8px 0;">Open the Free ROI Calculator →</a>
      <p style="color:#64748b;font-size:14px;margin-top:32px;">— Jacob H., Founder of Lightning Mines</p>
    </div>
  `
  return send(email, 'Your free mining deal review — received ✓', html)
}

export async function sendAuditConfirmationEmail(email: string, name: string | null, tier: string): Promise<unknown> {
  const isDeepDive = tier.includes('297') || tier.toLowerCase().includes('deep')
  const tierLabel = isDeepDive ? 'Deep Dive ($297)' : 'Standard ($97)'
  const stripeLink = isDeepDive
    ? 'https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00'
    : 'https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01'

  const html = `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      <div style="color:#f59e0b;font-size:22px;font-weight:bold;margin-bottom:24px;">⚡ Lightning Mines</div>
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
      <a href="${stripeLink}" style="display:inline-block;background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;font-weight:bold;padding:16px 32px;border-radius:8px;text-decoration:none;margin:8px 0;">Pay Now — ${tierLabel} →</a>
      ${isDeepDive ? '' : `
      <div style="background:#111111;border:1px solid rgba(247,147,26,0.35);border-radius:8px;padding:20px;margin:24px 0;">
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:8px;">Deploying more than one machine, or using financing?</div>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 12px;">The Deep Dive ($297) adds a full deployment checklist, hardware purchase plan, financing evaluation, tax strategy, and a 30-minute call — delivered in 72 hours. Most multi-machine buyers start here. Reply to this email and I'll switch your request over, or book it directly:</p>
        <a href="https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00" style="display:inline-block;background:#111111;color:#f59e0b;font-weight:bold;padding:12px 24px;border-radius:8px;text-decoration:none;border:1px solid #f59e0b;">Upgrade to the $297 Build Plan →</a>
      </div>
      `}
      <p style="color:#64748b;font-size:14px;margin-top:32px;">100% money-back guarantee if you don't get at least one concrete actionable insight.</p>
      <p style="color:#64748b;font-size:14px;">— Jacob H., Founder of Lightning Mines</p>
    </div>
  `
  return send(email, `Your ${tierLabel} Mining Audit request received ✓`, html)
}
