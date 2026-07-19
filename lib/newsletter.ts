// Weekly newsletter builder. All numbers come from our own hashprice_snapshots
// table — nothing scraped, nothing hallucinated. Featured guide rotates weekly
// from a pre-approved list (BRAND.md standards).
import { createHmac } from 'crypto'

export interface WeekSnapshot {
  snapshot_date: string
  btc_price: number
  difficulty: number
  hashprice_usd: number
}

const FEATURED_GUIDES: { slug: string; title: string }[] = [
  { slug: 'is-bitcoin-mining-profitable-2026', title: 'Is Bitcoin Mining Profitable in 2026?' },
  { slug: 'what-is-hashprice', title: 'Hashprice: The Only Mining Metric That Matters' },
  { slug: 'mining-contract-red-flags', title: 'Mining Contract Red Flags to Catch Before You Sign' },
  { slug: 'bitcoin-halving-effect-on-mining', title: 'How the 2028 Halving Will Hit Mining Profits' },
  { slug: 'what-is-network-difficulty', title: 'Network Difficulty, Explained' },
  { slug: 'antminer-s21-pro-review', title: 'Antminer S21 Pro Review: Still the Best Air-Cooled Miner?' },
  { slug: 'antminer-vs-whatsminer', title: 'Antminer vs Whatsminer: Which Brand Wins?' },
  { slug: 'how-to-calculate-bitcoin-mining-profitability', title: 'How to Calculate Mining Profitability (Step by Step)' },
]

const usd0 = (n: number) => Math.round(n).toLocaleString('en-US')
const pct = (n: number) => `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`

export function unsubscribeToken(email: string, secret: string): string {
  return createHmac('sha256', secret).update(email.toLowerCase()).digest('hex').slice(0, 24)
}

export function buildNewsletter(snapshots: WeekSnapshot[], date: Date) {
  const sorted = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]

  const priceChange = ((last.btc_price - first.btc_price) / first.btc_price) * 100
  const hpChange = ((last.hashprice_usd - first.hashprice_usd) / first.hashprice_usd) * 100
  const diffChanged = last.difficulty !== first.difficulty

  // S21 XP reference economics at week close ($225/mo hosting) — site-wide
  // reference machine is the Antminer S21 XP (270 TH/s), matching lib/daily-content.ts
  const dailyBtc = (270e12 * 86400 * 3.125) / (last.difficulty * 2 ** 32)
  const gross = dailyBtc * last.btc_price
  const net = gross - 7.5
  const breakeven = 7.5 / dailyBtc

  const verdict = net > 0
    ? `At week's close, a hosted S21 XP nets about $${net.toFixed(2)}/day — a thin but positive margin. Breakeven sits near $${usd0(breakeven)} BTC, so watch that line.`
    : `At week's close, a hosted S21 XP runs at a loss of about $${Math.abs(net).toFixed(2)}/day. Until BTC clears roughly $${usd0(breakeven)}, standard hosted mining stays underwater. That's not doom — it's the number to watch.`

  const guide = FEATURED_GUIDES[getISOWeek(date) % FEATURED_GUIDES.length]

  const subject = `⚡ Mining Week: BTC $${usd0(last.btc_price)} (${pct(priceChange)}) · S21 net ${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}/day`

  const row = (label: string, value: string) =>
    `<tr><td style="padding:8px 12px;color:#9ca3af;border-bottom:1px solid #1f2937;">${label}</td><td style="padding:8px 12px;color:#e2e8f0;text-align:right;border-bottom:1px solid #1f2937;font-weight:600;">${value}</td></tr>`

  const htmlBody = `<div style="background:#0a0a0a;padding:32px;font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;">
<h1 style="color:#fff;font-size:20px;margin:0 0 4px;">⚡ The Mining Week</h1>
<p style="color:#9ca3af;font-size:13px;margin:0 0 20px;">Your weekly profitability check from Lightning Mines — real numbers, no hype.</p>
<table style="width:100%;border-collapse:collapse;background:#111111;border:1px solid #222;border-radius:8px;">
${row('BTC price', `$${usd0(last.btc_price)} <span style="color:${priceChange >= 0 ? '#00d4aa' : '#ef4444'}">${pct(priceChange)} this week</span>`)}
${row('Hashprice', `$${(last.hashprice_usd / 1000).toFixed(4)}/TH/day <span style="color:${hpChange >= 0 ? '#00d4aa' : '#ef4444'}">${pct(hpChange)}</span>`)}
${row('Network difficulty', `${(last.difficulty / 1e12).toFixed(1)}T${diffChanged ? ' (adjusted this week)' : ' (no adjustment this week)'}`)}
${row('S21 XP net/day', `<span style="color:${net >= 0 ? '#00d4aa' : '#ef4444'}">${net >= 0 ? '+' : '-'}$${Math.abs(net).toFixed(2)}</span>`)}
${row('Operating breakeven', `~$${usd0(breakeven)} BTC`)}
</table>
<h2 style="color:#f59e0b;font-size:15px;margin:24px 0 8px;">What it means</h2>
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;">${verdict}</p>
<h2 style="color:#f59e0b;font-size:15px;margin:24px 0 8px;">This week's guide</h2>
<p style="color:#e2e8f0;font-size:14px;line-height:1.6;"><a href="https://www.lightningmines.com/university/${guide.slug}" style="color:#00d4aa;">${guide.title} →</a></p>
<div style="text-align:center;margin:28px 0;">
<a href="https://www.lightningmines.com/calculator" style="background:#f59e0b;color:#000;font-weight:700;padding:12px 28px;border-radius:10px;text-decoration:none;font-size:14px;">Run your own numbers free →</a>
</div>
<p style="color:#6b7280;font-size:11px;line-height:1.6;margin-top:28px;">You're receiving this because you signed up for weekly profitability alerts at lightningmines.com. Reference figures use an Antminer S21 XP at $225/month hosting; your results depend on your hardware and rates. Not financial advice.<br/><a href="__UNSUB_URL__" style="color:#6b7280;">Unsubscribe</a></p>
</div>`

  return { subject, htmlBody }
}

function getISOWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  return Math.ceil(((date.getTime() - yearStart.getTime()) / 864e5 + 1) / 7)
}
