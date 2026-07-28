import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers } from '@/lib/daily-content'
import { getMakeDrop } from '@/lib/make-content'

const RECIPIENT = 'jjhervey1@gmail.com'

// The daily PA (pg_cron, 6am Denver): checks the whole machine, FIXES what it can
// (missing day's content → regenerate), pulls new job listings into job_finds, and
// sends one short morning brief. Urgent problems it can't fix are flagged on top.

interface JobHit { title: string; company: string; url: string; source: string; location: string; salary: string | null; fit_score: number }

function keywords(): string[] {
  return (process.env.JOB_KEYWORDS || 'bitcoin,crypto,mining,web3')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

// Fit against Jacob's background: operator-leadership titles first, industry second.
// Strong = the roles he'd actually take; core = general signal; BAD = whole fields
// that keyword-match but are never a fit (healthcare ops, trucking "owner operators").
const FIT_STRONG = ['general manager', 'executive director', 'director of operations', 'head of operations', 'operations manager', 'chief of staff', 'business operations', 'procurement']
const FIT_CORE = ['operations', 'growth', 'founder', 'business development', 'account executive', 'sales']
const FIT_INDUSTRY = ['bitcoin', 'crypto', 'mining', 'data center', 'datacenter', 'web3', 'energy']
const FIT_BAD = ['nurse', 'nursing', 'clinical', 'cdl', 'driver', 'physician', 'dental', 'therap', 'medical', 'healthcare', 'patient', 'pharmac', 'surgical', 'csr', 'customer service rep', 'temporary', 'intern', 'part-time', 'part time']

function fitScore(title: string, company: string): number {
  const hay = `${title} ${company}`.toLowerCase()
  let score = 0
  for (const t of FIT_STRONG) if (hay.includes(t)) score += 4
  for (const t of FIT_CORE) if (hay.includes(t)) score += 2
  for (const t of FIT_INDUSTRY) if (hay.includes(t)) score += 1
  for (const t of FIT_BAD) if (hay.includes(t)) score -= 10
  return score
}

// Region rule (Jacob 2026-07-28): Denver metro or remote ONLY. Suburb names matter
// because postings say "Englewood, CO" rather than "Denver". Exception: an
// out-of-region role may ride on exceptional comp ("if I got offered $500k I would").
const RELOCATE_WORTHY_SALARY = 250_000
const DENVER_METRO = ['denver', 'aurora', 'lakewood', 'englewood', 'littleton', 'centennial', 'westminster', 'thornton', 'arvada', 'broomfield', 'boulder', 'golden', 'greenwood village', 'commerce city', 'wheat ridge']
function inRegion(location: string, title: string): boolean {
  const s = `${location} ${title}`.toLowerCase()
  return s.includes('remote') || DENVER_METRO.some((c) => s.includes(c))
}

/** Highest number that appears in a salary string, for ranking. */
function salaryMax(s: string | null): number {
  if (!s) return -1
  const nums = [...s.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, '')))
  return nums.length ? Math.max(...nums) : -1
}

// Adzuna aggregates Indeed and other major boards and exposes salary estimates —
// the legitimate route to salary data (Indeed has no public API; LinkedIn blocks bots).
// Free keys: developer.adzuna.com → ADZUNA_APP_ID + ADZUNA_APP_KEY in Vercel env.
async function fetchAdzuna(kw: string[], stats?: string[]): Promise<JobHit[]> {
  const id = process.env.ADZUNA_APP_ID
  const key = process.env.ADZUNA_APP_KEY
  if (!id || !key) { stats?.push('no adzuna keys'); return [] }
  const hits: JobHit[] = []
  // Fresh-daily contract (Jacob 2026-07-28): only postings from the last day, but cast
  // a wider net — industry keywords OR'd, plus operator-role title searches.
  const passes = [
    `what_or=${encodeURIComponent(kw.slice(0, 8).join(' '))}`,
    `title_only=${encodeURIComponent('operations')}`,
    `title_only=${encodeURIComponent('general manager')}`,
  ]
  for (const pass of passes) for (const where of ['Denver, Colorado', '']) {
    try {
      const res = await fetch(
        `https://api.adzuna.com/v1/api/jobs/us/search/1?app_id=${id}&app_key=${key}&results_per_page=50&${pass}${where ? `&where=${encodeURIComponent(where)}` : ''}&max_days_old=1&sort_by=date`,
        { cache: 'no-store' }
      )
      if (!res.ok) { stats?.push(`${pass} ${where || 'US'}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`); continue }
      const rows = ((await res.json()).results || []) as {
        title?: string; company?: { display_name?: string }; redirect_url?: string
        location?: { display_name?: string }; salary_min?: number; salary_max?: number
      }[]
      for (const r of rows) {
        if (!r.title || !r.redirect_url) continue
        const salary = r.salary_min || r.salary_max
          ? `$${Math.round(r.salary_min || r.salary_max || 0).toLocaleString()}${r.salary_max && r.salary_min && r.salary_max !== r.salary_min ? `–$${Math.round(r.salary_max).toLocaleString()}` : ''}`
          : null
        hits.push({
          title: r.title, company: r.company?.display_name || '', url: r.redirect_url,
          source: 'adzuna', location: r.location?.display_name || (where ? 'Denver' : 'US'),
          salary, fit_score: fitScore(r.title, r.company?.display_name || ''),
        })
      }
      stats?.push(`${pass} ${where || 'US'}: ${rows.length} rows`)
    } catch (e) { stats?.push(`${pass} ${where || 'US'}: ${e instanceof Error ? e.message.slice(0, 80) : 'error'}`) }
  }
  return hits
}

async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  const fixes: string[] = []
  const alerts: string[] = []

  // 1. Live data feed
  const live = await getLivePriceData()
  const numbers = live && !('error' in live) ? computeDailyNumbers(live.price, live.difficulty) : null
  if (!numbers) alerts.push('Live BTC price feed is down — site data pages and content generation are degraded.')

  // 2. Today's content banked? If not, regenerate it right now (the fix, not the alert).
  const today = new Date().toISOString().slice(0, 10)
  if (supabase) {
    const { data } = await supabase.from('make_content_cache').select('cache_date').eq('cache_date', today).maybeSingle()
    if (!data) {
      try {
        const drop = await getMakeDrop({ date: today })
        fixes.push(`Today's content was missing — regenerated it (${drop.source}, "${drop.hook.slice(0, 60)}…").`)
      } catch (e) {
        alerts.push(`Today's content is missing and regeneration failed: ${e instanceof Error ? e.message : e}`)
      }
    }
  }

  // 3. Postiz queue depth
  let queueTotal = -1
  if (process.env.POSTIZ_API_KEY) {
    try {
      const res = await fetch(
        `https://api.postiz.com/public/v1/posts?startDate=${new Date().toISOString()}&endDate=${new Date(Date.now() + 8 * 864e5).toISOString()}`,
        { headers: { Authorization: process.env.POSTIZ_API_KEY }, cache: 'no-store' }
      )
      if (res.ok) {
        queueTotal = ((await res.json()).posts || []).filter((p: { state: string }) => p.state === 'QUEUE').length
      }
    } catch { /* leave queueTotal at -1 */ }
    if (queueTotal === 0) alerts.push('Postiz queue is EMPTY — no posts scheduled. The Saturday batch may have failed; check Make → LMC Weekly Batch history.')
    else if (queueTotal < 0) alerts.push('Could not reach Postiz to check the queue.')
  }

  // 4. HeyGen balance (weekly alert exists; only escalate here when critically low)
  let quota: number | null = null
  if (process.env.HEYGEN_API_KEY) {
    try {
      const res = await fetch('https://api.heygen.com/v2/user/remaining_quota', { headers: { 'x-api-key': process.env.HEYGEN_API_KEY }, cache: 'no-store' })
      if (res.ok) quota = (await res.json()).data?.remaining_quota ?? null
    } catch { /* ignore */ }
    if (quota !== null && quota < 300) alerts.push(`HeyGen balance critically low: ${quota} units — Saturday's batch will NOT complete. Top up: app.heygen.com/settings?nav=API`)
  }

  // 5. Jobs sweep → job_finds (dedup on url), ranked by fit then salary (nulls last)
  const kw = keywords()
  const adzunaConfigured = !!(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY)
  const sweepStats: string[] = []
  const found = await fetchAdzuna(kw, sweepStats)
  let newJobs: JobHit[] = []
  if (supabase && found.length) {
    const { data: existing } = await supabase.from('job_finds').select('url').in('url', found.map((j) => j.url))
    const known = new Set((existing || []).map((r) => r.url))
    const seen = new Set<string>()
    // Minimum fit bar (never below 2 — empty beats noise) + region rule: in-region
    // (Denver/CO/remote) gets a boost; out-of-region only rides on exceptional comp.
    newJobs = found
      .filter((j) => j.fit_score >= 2 && !known.has(j.url) && !seen.has(j.url) && (seen.add(j.url), true))
      .filter((j) => inRegion(j.location, j.title) || salaryMax(j.salary) >= RELOCATE_WORTHY_SALARY)
      .map((j) => ({ ...j, fit_score: j.fit_score + (inRegion(j.location, j.title) ? 3 : 0) }))
      .sort((a, b) => b.fit_score - a.fit_score || salaryMax(b.salary) - salaryMax(a.salary))
    if (newJobs.length) {
      // Cap the daily insert so one broad sweep can't flood the wire.
      await supabase.from('job_finds').insert(newJobs.slice(0, 40).map((j) => ({ ...j, status: 'new' })))
    }
  }

  // 6. The brief (manual/debug runs pass ?nomail=1 to skip the duplicate email)
  const nomail = new URL(req.url).searchParams.get('nomail') === '1'
  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key
  if (apiKey && !nomail) {
    const li = (q: string) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Denver%2C%20Colorado`
    const html = `<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 4px;">${alerts.length ? '⚠ Needs you' : '✅ All running'} — morning brief</h2>
<p style="color:#6b7280;font-size:13px;margin:0 0 16px;">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/Denver' })}</p>
${alerts.length ? `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:12px;margin-bottom:14px;"><b>Needs your attention:</b><ul style="margin:6px 0 0 18px;">${alerts.map((a) => `<li>${a}</li>`).join('')}</ul></div>` : ''}
${fixes.length ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px;margin-bottom:14px;"><b>Fixed for you overnight:</b><ul style="margin:6px 0 0 18px;">${fixes.map((f) => `<li>${f}</li>`).join('')}</ul></div>` : ''}
<p style="font-size:14px;margin:0 0 14px;">
${numbers ? `⛏ BTC $${Math.round(numbers.btcPrice).toLocaleString()} · S21 XP ${numbers.profitable ? '+' : '-'}$${Math.abs(numbers.s21NetDay).toFixed(2)}/day · ` : ''}
📬 ${queueTotal >= 0 ? `${queueTotal} posts queued` : 'queue unknown'} · 🎬 ${quota ?? '?'} HeyGen units
</p>
${newJobs.length ? `<h3 style="margin:16px 0 6px;">💼 Top ${Math.min(10, newJobs.length)} job matches (ranked by fit, then salary)</h3><table style="border-collapse:collapse;font-size:13px;"><tr><th style="padding:3px 8px;text-align:left;">Role</th><th style="padding:3px 8px;text-align:left;">Salary</th><th style="padding:3px 8px;text-align:left;">Fit</th></tr>${newJobs.slice(0, 10).map((j) => `<tr><td style="padding:3px 8px;"><a href="${j.url}">${j.title}</a> — ${j.company}</td><td style="padding:3px 8px;">${j.salary || '—'}</td><td style="padding:3px 8px;">${j.fit_score}</td></tr>`).join('')}</table>` : adzunaConfigured ? '<p style="color:#6b7280;font-size:13px;">💼 No new job matches today.</p>' : '<p style="color:#b45309;font-size:13px;">💼 Job sweep needs keys: grab free ADZUNA_APP_ID + ADZUNA_APP_KEY at developer.adzuna.com (2 min) — Adzuna aggregates Indeed and majors WITH salary data. Paste both to Claude to wire in.</p>'}
<p style="font-size:13px;">Quick searches — LinkedIn: ${kw.slice(0, 3).map((k) => `<a href="${li(k)}">${k}</a>`).join(' · ')} · Indeed: ${kw.slice(0, 3).map((k) => `<a href="https://www.indeed.com/jobs?q=${encodeURIComponent(k)}&l=Denver%2C+CO&fromage=1">${k}</a>`).join(' · ')}</p>
<p style="color:#6b7280;font-size:12px;margin-top:16px;">Full picture: lightningmines.com/admin/dashboard (your secret link). Reply-worthy issues only — everything else was handled.</p>
</div>`
    await new Resend(apiKey).emails.send({
      from: 'Lightning Mines PA <no-reply@lightningmines.com>',
      to: RECIPIENT,
      subject: alerts.length ? `⚠ Morning brief — ${alerts.length} thing(s) need you` : `✅ Morning brief — all running${newJobs.length ? `, ${newJobs.length} new jobs` : ''}`,
      html,
    })
  }

  return NextResponse.json({ alerts, fixes, queueTotal, quota, newJobs: newJobs.length, foundTotal: found.length, sweepStats })
}

export const GET = handle
export const POST = handle
export const dynamic = 'force-dynamic'
export const maxDuration = 300
