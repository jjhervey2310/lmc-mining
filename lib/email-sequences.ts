// Email sequence content — subjects and HTML for each email in the 5-part welcome series.
// Imported by lib/send-email.ts which handles the actual Resend API calls.

const SITE = 'https://lmc-mining.vercel.app'
const AFFILIATE = 'https://abundantmines.com/ref/72/'
const STRIPE_97 = 'https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01'
const STRIPE_297 = 'https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00'

const header = (tagline?: string) => `
  <div style="margin-bottom:32px;">
    <div style="color:#f59e0b;font-size:22px;font-weight:bold;margin-bottom:4px;">⚡ LMC Mining Intelligence</div>
    ${tagline ? `<div style="color:#475569;font-size:13px;">${tagline}</div>` : ''}
  </div>
`

const footer = (disclosure?: string) => `
  <hr style="border:none;border-top:1px solid #1e293b;margin:32px 0;" />
  ${disclosure ? `<p style="color:#475569;font-size:12px;line-height:1.6;margin-bottom:16px;">${disclosure}</p>` : ''}
  <p style="color:#475569;font-size:13px;margin-bottom:4px;">— Jacob H., Founder of LMC Mining Intelligence</p>
  <p style="color:#334155;font-size:12px;margin:0;">You're receiving this because you signed up at lmc-mining.vercel.app. Reply to this email to unsubscribe.</p>
`

const cta = (href: string, text: string, style: 'gold' | 'teal' | 'ghost' = 'gold') => {
  const styles = {
    gold: 'background:linear-gradient(135deg,#f59e0b,#d97706);color:#000000;',
    teal: 'background:#00d4aa;color:#000000;',
    ghost: 'background:#111111;color:#f59e0b;border:1px solid #f59e0b;',
  }
  return `<a href="${href}" style="display:inline-block;${styles[style]}font-weight:bold;padding:14px 28px;border-radius:8px;text-decoration:none;font-size:15px;margin:8px 0;">${text}</a>`
}

const card = (content: string, borderColor = '#1e293b') =>
  `<div style="background:#111111;border:1px solid ${borderColor};border-radius:8px;padding:24px;margin:24px 0;">${content}</div>`

// ─── EMAIL 1 — Immediate ───────────────────────────────────────────────────
// getEmail1Html is called with the dynamic spreadsheet link from send-email.ts

export function getEmail1Html(spreadsheetLink: string): string {
  return `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      ${header('Independent Bitcoin mining data — no sponsored rankings')}
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:8px;">Your Mining ROI Spreadsheet is here</h1>
      <p style="color:#94a3b8;font-size:16px;line-height:1.6;margin-bottom:24px;">
        Welcome to LMC Mining Intelligence. As promised, here is your free Mining ROI Spreadsheet.
      </p>
      ${cta(spreadsheetLink, '📊 Access Your Free Spreadsheet →')}
      ${card(`
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:12px;">What the spreadsheet covers:</div>
        <ul style="color:#94a3b8;line-height:2;margin:0;padding-left:20px;">
          <li>Monthly profit calculator for any ASIC miner</li>
          <li>4 BTC price scenario columns ($60k / $80k / $100k / $150k)</li>
          <li>Break-even analysis</li>
          <li>ROI timeline at 12, 24, 36 months</li>
          <li>Hosting cost comparison (flat fee vs per kWh)</li>
        </ul>
      `)}
      ${card(`
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:8px;">👋 Quick intro from me</div>
        <p style="color:#94a3b8;font-size:14px;line-height:1.7;margin:0;">
          I'm Jacob — 8 years in Bitcoin mining. I built LMC Mining because I was frustrated with the biased information
          everywhere in this space. Every "review" was sponsored, every calculator was designed to make a deal look better
          than it was. This site is different: independent data, honest analysis, no incentives to steer you wrong.
        </p>
      `)}
      <div style="margin:24px 0;">
        <p style="color:#94a3b8;font-size:15px;margin-bottom:4px;"><strong style="color:#ffffff;">What to expect from this list:</strong></p>
        <ul style="color:#94a3b8;font-size:14px;line-height:2;padding-left:20px;">
          <li>Weekly Bitcoin mining profitability updates</li>
          <li>Honest deal breakdowns — the good and the bad</li>
          <li>No sponsored content, no paid rankings</li>
        </ul>
      </div>
      <p style="color:#94a3b8;font-size:15px;">While you're here — run your first deal analysis free:</p>
      ${cta(`${SITE}/deal-analyzer`, 'Analyze Your First Deal →', 'ghost')}
      ${footer()}
    </div>
  `
}

// ─── EMAIL 2 — Day 2 ──────────────────────────────────────────────────────

export const EMAIL2 = {
  subject: 'The mistake that costs new miners $8,000+ (and how to avoid it)',
  html: `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      ${header()}
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:8px;">The #1 mistake new Bitcoin miners make</h1>
      <p style="color:#94a3b8;font-size:16px;line-height:1.6;">
        I've seen this cost miners $8,000+ and it's almost always the same mistake:
        <strong style="color:#ef4444;">buying hardware before locking in a hosting rate.</strong>
      </p>
      ${card(`
        <div style="color:#ef4444;font-weight:bold;font-size:16px;margin-bottom:12px;">⚠️ The mistake</div>
        <p style="color:#94a3b8;line-height:1.7;margin:0;">
          Someone sees an Antminer S21 XP on sale. They buy it for $5,500 because "it looks profitable." Then they spend
          two months trying to find hosting — and discover the only available slots charge $0.10/kWh. Suddenly the deal
          that "looked profitable" is losing money every month.
        </p>
      `, '#7f1d1d')}
      <h2 style="color:#ffffff;font-size:18px;margin-top:28px;margin-bottom:12px;">Why electricity rate changes everything</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;">
        The Antminer S21 XP runs at ~3,250 watts. At current network difficulty and $64k BTC,
        it earns roughly <strong style="color:#ffffff;">$7.50/day gross</strong>. Here's what happens to profit at different electricity rates:
      </p>
      ${card(`
        <table style="width:100%;border-collapse:collapse;font-size:14px;">
          <tr style="border-bottom:1px solid #1e293b;">
            <th style="color:#64748b;text-align:left;padding:8px 0;font-weight:normal;">Rate</th>
            <th style="color:#64748b;text-align:right;padding:8px 0;font-weight:normal;">Daily Cost</th>
            <th style="color:#64748b;text-align:right;padding:8px 0;font-weight:normal;">Daily Profit</th>
            <th style="color:#64748b;text-align:right;padding:8px 0;font-weight:normal;">Verdict</th>
          </tr>
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="color:#94a3b8;padding:10px 0;">$0.04/kWh</td>
            <td style="color:#94a3b8;text-align:right;padding:10px 0;">$3.12</td>
            <td style="color:#00d4aa;text-align:right;padding:10px 0;font-weight:bold;">+$4.38</td>
            <td style="color:#00d4aa;text-align:right;padding:10px 0;">✓ Profitable</td>
          </tr>
          <tr style="border-bottom:1px solid #1e293b;">
            <td style="color:#94a3b8;padding:10px 0;">$0.08/kWh</td>
            <td style="color:#94a3b8;text-align:right;padding:10px 0;">$6.24</td>
            <td style="color:#f59e0b;text-align:right;padding:10px 0;font-weight:bold;">+$1.26</td>
            <td style="color:#f59e0b;text-align:right;padding:10px 0;">⚠ Marginal</td>
          </tr>
          <tr>
            <td style="color:#94a3b8;padding:10px 0;">$0.12/kWh</td>
            <td style="color:#94a3b8;text-align:right;padding:10px 0;">$9.36</td>
            <td style="color:#ef4444;text-align:right;padding:10px 0;font-weight:bold;">-$1.86</td>
            <td style="color:#ef4444;text-align:right;padding:10px 0;">✗ Losing</td>
          </tr>
        </table>
        <p style="color:#475569;font-size:12px;margin:12px 0 0 0;">Based on S21 XP (216 TH/s, 3,250W) at $64k BTC and current network difficulty</p>
      `)}
      <h2 style="color:#ffffff;font-size:18px;margin-top:28px;margin-bottom:12px;">The framework: always work backwards</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;">
        Before you look at any hardware, answer this question first:
        <strong style="color:#ffffff;">"What electricity rate can I actually secure?"</strong>
      </p>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;">
        Then calculate the minimum BTC price at which you break even. That number is your floor.
        If BTC can't realistically stay above that floor, the deal isn't worth doing — regardless of how good the hardware looks.
      </p>
      ${card(`
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:8px;">The rule:</div>
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0;">
          Secure your hosting rate <em>first</em>. Evaluate hardware <em>second</em>.
          Never commit to hardware you can't affordably power.
        </p>
      `)}
      <p style="color:#94a3b8;font-size:15px;margin-top:24px;">
        The Deal Analyzer calculates your exact break-even BTC price based on your real electricity rate — free, no signup needed:
      </p>
      ${cta(`${SITE}/deal-analyzer`, 'Calculate Your Break-Even Price →')}
      ${footer()}
    </div>
  `,
}

// ─── EMAIL 3 — Day 4 ──────────────────────────────────────────────────────

export const EMAIL3 = {
  subject: '12 questions to ask any hosting provider before you sign',
  html: `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      ${header()}
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:8px;">How to evaluate a hosting provider (before you sign anything)</h1>
      <p style="color:#94a3b8;font-size:16px;line-height:1.6;">
        Most hosting contracts are one-sided. These 12 questions cut through the sales pitch and tell you
        exactly what you're signing up for.
      </p>
      ${card(`
        <div style="color:#f59e0b;font-weight:bold;font-size:15px;margin-bottom:16px;">📋 The 12 Questions</div>
        <ol style="color:#94a3b8;font-size:14px;line-height:2.2;padding-left:20px;margin:0;">
          <li>Is pricing flat-fee per machine or per kWh? <span style="color:#64748b;">(flat-fee = predictable costs)</span></li>
          <li>What is the all-in monthly cost per machine, including cooling?</li>
          <li>What uptime guarantee do you offer, and what's the SLA if you miss it?</li>
          <li>What is the contract minimum term, and is there an early exit option?</li>
          <li>How much is the security deposit, and when is it returned?</li>
          <li>What power source do you use? <span style="color:#64748b;">(hydro = cheap &amp; stable)</span></li>
          <li>What cooling type — air, immersion, or hydro?</li>
          <li>Do you have photos or video of the actual facility?</li>
          <li>Who do I contact if my miner goes offline at 2am?</li>
          <li>Can I visit the facility before signing?</li>
          <li>Do you hold my hardware, or do I retain ownership throughout?</li>
          <li>Have you ever had downtime longer than 48 hours? What caused it?</li>
        </ol>
      `)}
      ${card(`
        <div style="color:#ef4444;font-weight:bold;margin-bottom:12px;">🚩 Red flags to watch for</div>
        <ul style="color:#94a3b8;font-size:14px;line-height:2;padding-left:20px;margin:0;">
          <li>No clear answer on electricity rate or billing method</li>
          <li>Large non-refundable deposits (&gt;$1,000)</li>
          <li>No uptime guarantee in the contract</li>
          <li>Refused to let you visit or provide facility photos</li>
          <li>Contract auto-renews with no notice requirement</li>
          <li>No named emergency contact for hardware issues</li>
        </ul>
      `, '#7f1d1d')}
      <h2 style="color:#ffffff;font-size:17px;margin-top:28px;margin-bottom:8px;">What good hosting actually looks like</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;">
        To give you a concrete example — here's what the hosting provider we recommend most looks like:
      </p>
      ${card(`
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:12px;">Abundant Mines — Cascade Locks, Oregon</div>
        <ul style="color:#94a3b8;font-size:14px;line-height:2;padding-left:20px;margin:0 0 16px 0;">
          <li><strong style="color:#ffffff;">$225/month flat fee</strong> — no electricity bill surprises</li>
          <li>Columbia River hydro power — cheap, renewable, stable</li>
          <li>Air-cooled facility, miner-friendly setup process</li>
          <li>Financing available up to $140k for hardware</li>
          <li>Clear uptime commitment, responsive support team</li>
        </ul>
        <a href="${SITE}/hosts/abundant-miners" style="color:#f59e0b;font-size:14px;">See our full Abundant Mines analysis →</a>
      `)}
      ${cta(AFFILIATE, 'Get Started with Abundant Mines →')}
      ${footer(`<strong>Affiliate disclosure:</strong> We earn approximately $200 per machine deployed if you sign up through our link. We recommend Abundant Mines because we believe the deal is genuinely good — not because of the commission. You can find our full analysis at ${SITE}/hosts/abundant-miners.`)}
    </div>
  `,
}

// ─── EMAIL 4 — Day 7 ──────────────────────────────────────────────────────

export const EMAIL4 = {
  subject: "I'll review your mining deal for $97 (money-back guarantee)",
  html: `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      ${header()}
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:8px;">Want me to personally review your mining deal?</h1>
      <p style="color:#94a3b8;font-size:16px;line-height:1.6;">
        If you're seriously considering a mining investment — hardware, hosting, or a full deployment — I offer a personal
        review of your specific deal for $97. Here's what you get:
      </p>
      ${card(`
        <div style="color:#00d4aa;font-weight:bold;margin-bottom:12px;">✓ Standard Audit — $97</div>
        <ul style="color:#94a3b8;font-size:14px;line-height:2.2;padding-left:20px;margin:0;">
          <li>Full profitability calculation for your specific miner and hosting setup</li>
          <li>Hosting provider recommendation based on your situation</li>
          <li>12-month ROI projection at 3 BTC price scenarios</li>
          <li>Go / no-go recommendation with reasoning</li>
          <li>Written report delivered within 48 hours</li>
        </ul>
      `, '#064e3b')}
      <h2 style="color:#ffffff;font-size:17px;margin-top:28px;margin-bottom:8px;">Why $97 is the cheapest due diligence you can buy</h2>
      ${card(`
        <p style="color:#94a3b8;font-size:15px;line-height:1.7;margin:0;">
          The average first-time hosted mining deployment costs <strong style="color:#ffffff;">$7,900</strong>
          (hardware + first year hosting). At $97, a Standard Audit is just
          <strong style="color:#f59e0b;">1.2% of your investment</strong> — and it tells you before you commit
          whether the deal actually works at current difficulty and BTC prices.
        </p>
      `)}
      ${card(`
        <div style="color:#f59e0b;font-weight:bold;margin-bottom:8px;">⚡ Limited to 8 audits per month</div>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
          Every audit is completed personally — not an AI-generated report. Because of this,
          I limit slots to 8 per month to maintain quality. Spots typically fill by mid-month.
        </p>
      `)}
      ${cta(STRIPE_97, 'Book $97 Standard Audit →')}
      <p style="color:#94a3b8;font-size:14px;margin-top:8px;">
        Need a 24-month cash flow model, exit strategy, and a 30-minute video call? That's the Deep Dive:
      </p>
      ${cta(STRIPE_297, 'Book $297 Deep Dive Audit →', 'ghost')}
      ${card(`
        <div style="color:#00d4aa;font-weight:bold;margin-bottom:8px;">100% Money-Back Guarantee</div>
        <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0;">
          If your audit doesn't give you at least one concrete, actionable insight about your mining deal,
          I'll refund you in full. No questions asked.
        </p>
      `, '#064e3b')}
      ${footer()}
    </div>
  `,
}

// ─── EMAIL 5 — Day 14 ─────────────────────────────────────────────────────

export const EMAIL5 = {
  subject: 'Good deal vs bad deal: a real Bitcoin mining comparison',
  html: `
    <div style="background:#0a0a0a;color:#ffffff;font-family:sans-serif;padding:40px;max-width:600px;margin:0 auto;">
      ${header()}
      <h1 style="color:#ffffff;font-size:26px;margin-bottom:8px;">What a good mining deal looks like vs a bad one</h1>
      <p style="color:#94a3b8;font-size:16px;line-height:1.6;">
        Two deals. One profitable, one not. The difference isn't luck — it's hardware generation and hosting rate.
      </p>

      ${card(`
        <div style="color:#ef4444;font-weight:bold;font-size:16px;margin-bottom:16px;">❌ DEAL A — Losing money every month</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px;">
          <tr><td style="color:#64748b;padding:6px 0;">Hardware</td><td style="color:#94a3b8;text-align:right;">Antminer S19 Pro (110 TH/s)</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Setup</td><td style="color:#94a3b8;text-align:right;">Home mining, $0.12/kWh</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Hardware price</td><td style="color:#94a3b8;text-align:right;">$2,800</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Monthly electricity</td><td style="color:#94a3b8;text-align:right;">$234 (3,250W × 720h × $0.10)</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Monthly revenue at $64k BTC</td><td style="color:#94a3b8;text-align:right;">~$180</td></tr>
          <tr style="border-top:1px solid #1e293b;"><td style="color:#ef4444;padding:8px 0;font-weight:bold;">Monthly loss</td><td style="color:#ef4444;text-align:right;font-weight:bold;">-$54/month</td></tr>
        </table>
        <p style="color:#64748b;font-size:13px;margin:0;">
          At this rate: losing $648/year on electricity alone. The S19 Pro is a 5th-gen miner — its efficiency
          (29.5 J/TH) can't compete at residential electricity rates.
        </p>
      `, '#7f1d1d')}

      ${card(`
        <div style="color:#00d4aa;font-weight:bold;font-size:16px;margin-bottom:16px;">✅ DEAL B — Profitable today</div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:12px;">
          <tr><td style="color:#64748b;padding:6px 0;">Hardware</td><td style="color:#94a3b8;text-align:right;">Antminer S21 XP (216 TH/s)</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Setup</td><td style="color:#94a3b8;text-align:right;">Hosted at Abundant Mines, $225/mo flat</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Hardware price</td><td style="color:#94a3b8;text-align:right;">$5,500</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Monthly hosting</td><td style="color:#94a3b8;text-align:right;">$225 flat</td></tr>
          <tr><td style="color:#64748b;padding:6px 0;">Monthly revenue at $64k BTC</td><td style="color:#94a3b8;text-align:right;">~$340</td></tr>
          <tr style="border-top:1px solid #1e293b;"><td style="color:#00d4aa;padding:8px 0;font-weight:bold;">Monthly profit</td><td style="color:#00d4aa;text-align:right;font-weight:bold;">~$115/month</td></tr>
        </table>
        <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:8px;">
          <tr><td style="color:#64748b;padding:4px 0;">Payback period at $64k BTC</td><td style="color:#94a3b8;text-align:right;">~38 months</td></tr>
          <tr><td style="color:#64748b;padding:4px 0;">Payback period at $100k BTC</td><td style="color:#94a3b8;text-align:right;">~19 months</td></tr>
          <tr><td style="color:#64748b;padding:4px 0;">Payback period at $150k BTC</td><td style="color:#94a3b8;text-align:right;">~12 months</td></tr>
        </table>
        <p style="color:#64748b;font-size:13px;margin:0;">
          The S21 XP is 7th-gen hardware (15 J/TH efficiency). At flat-fee hosted rates, profitability
          improves dramatically if BTC appreciates — you keep all the upside.
        </p>
      `, '#064e3b')}

      <h2 style="color:#ffffff;font-size:17px;margin-top:28px;margin-bottom:8px;">The lesson</h2>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;">
        <strong style="color:#ffffff;">Hardware generation and hosting rate matter more than anything else.</strong>
        A 5th-gen miner at residential rates is almost always a money-loser at current difficulty.
        A 7th-gen miner at a flat-fee hosted facility can be profitable today and much more profitable if BTC rises.
      </p>
      <p style="color:#94a3b8;font-size:15px;line-height:1.6;">
        Before you commit to anything, run your specific deal through the analyzer:
      </p>
      ${cta(`${SITE}/deal-analyzer`, 'Run Your Own Deal Comparison →')}
      <div style="margin-top:16px;">
        ${cta(AFFILIATE, 'Get Started with Abundant Mines →', 'ghost')}
      </div>
      <div style="margin-top:8px;">
        ${cta(STRIPE_97, 'Have Jacob Review Your Specific Deal →', 'ghost')}
      </div>
      ${footer(`<strong>Affiliate disclosure:</strong> The Abundant Mines link above is an affiliate link. We earn a commission if you sign up. Numbers in this email are estimates based on current network difficulty and BTC price — actual results will vary.`)}
    </div>
  `,
}
