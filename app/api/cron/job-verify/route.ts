import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// Job verification pass (Jacob 2026-08-06): "fix where the jobs are still posted
// and they get read through so I'm not applying for something that doesn't fit,
// or what posted more than two weeks ago."
//
// Feed metadata lies — an external LinkedIn writer supplies no post date at all,
// so 4-month-old listings were showing as "posted today". This fetches each
// listing, reads it, and retires anything that is closed, older than 14 days,
// out of region, or not a fit. Everything it keeps carries a real posted_at.

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const MAX_AGE_DAYS = 14
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36'

/** LinkedIn's top card carries the true age: <span class="posted-time-ago__text"> 4 months ago </span> */
function ageDaysFrom(html: string): number | null {
  const el = html.match(/posted-time-ago__text[^>]*>\s*([^<]+?)\s*</i)
  const text = el?.[1] || html.match(/([0-9]+\s+(?:minute|hour|day|week|month|year)s?\s+ago)/i)?.[1]
  if (!text) return null
  const m = text.match(/([0-9]+)\s+(minute|hour|day|week|month|year)s?\s+ago/i)
  if (!m) return null
  const n = Number(m[1])
  const per: Record<string, number> = { minute: 1 / 1440, hour: 1 / 24, day: 1, week: 7, month: 30.4, year: 365 }
  return n * (per[m[2].toLowerCase()] ?? 1)
}

/** Closed/expired postings should never sit on the wire. */
function isClosed(html: string): boolean {
  return /no longer accepting applications|this job is no longer available|position has been filled|posting has expired|job is closed/i.test(html)
}

/** Strip tags so the listing can be read as plain text. */
function textOf(html: string): string {
  const body = html.replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ')
  return body.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').slice(0, 12000)
}

// ── the same rules the sweep applies, now enforced against the real listing ──

const DENVER_METRO = ['denver', 'aurora', 'lakewood', 'englewood', 'littleton', 'centennial', 'westminster', 'thornton', 'arvada', 'broomfield', 'boulder', 'golden', 'greenwood village', 'commerce city', 'wheat ridge']
const OTHER_PLACES = ['sonoma', 'california', 'new york', 'texas', 'florida', 'washington', 'oregon', 'arizona', 'utah', 'nevada', 'illinois', 'georgia', 'massachusetts', 'virginia', 'carolina', 'ohio', 'michigan', 'minnesota', 'wisconsin', 'tennessee', 'missouri', 'indiana', 'maryland', 'new jersey', 'pennsylvania', 'connecticut', 'bay area', 'nyc', 'chicago', 'atlanta', 'seattle', 'austin', 'dallas', 'houston', 'phoenix', 'miami', 'boston', 'portland', 'san francisco', 'los angeles', 'san diego']
const RESIDENCY_RE = /(must (?:reside|live|be located|be based)|reside[sd]? in|residency|be based in|located in|candidates? (?:must )?(?:be )?(?:in|located)|local to|onsite in|on-site in|hybrid in)([^.;)]{0,80})/gi
const FIT_BAD = ['nurse', 'nursing', 'clinical', 'cdl', 'driver', 'physician', 'dental', 'therap', 'patient', 'pharmac', 'surgical', 'customer service rep', 'part-time', 'part time', 'internship', 'unpaid']

function remoteElsewhere(text: string): boolean {
  const t = text.toLowerCase()
  if (!t) return false
  const co = t.includes('colorado') || /\bco\b/.test(t) || DENVER_METRO.some((c) => t.includes(c))
  for (const m of t.matchAll(RESIDENCY_RE)) {
    const clause = m[2] || ''
    if (OTHER_PLACES.some((p) => clause.includes(p)) && !(clause.includes('colorado') || /\bco\b/.test(clause))) return true
  }
  if (/remote[^.]{0,40}\bonly\b/.test(t) && !co && OTHER_PLACES.some((p) => t.includes(p))) return true
  return false
}

/** Salary written in the listing body, e.g. "$95,000 - $120,000". Feeds the $75k floor. */
function salaryFromText(text: string): { label: string; max: number } | null {
  const m = text.match(/\$\s?([0-9]{2,3}),?([0-9]{3})(?:\s*(?:-|–|to)\s*\$\s?([0-9]{2,3}),?([0-9]{3}))?/)
  if (!m) return null
  const lo = Number(`${m[1]}${m[2]}`)
  const hi = m[3] ? Number(`${m[3]}${m[4]}`) : lo
  if (lo < 20_000 || hi > 1_000_000) return null
  return { label: hi !== lo ? `$${lo.toLocaleString()}–$${hi.toLocaleString()}` : `$${lo.toLocaleString()}`, max: hi }
}

async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret') || new URL(req.url).searchParams.get('secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  const limit = Math.min(60, Number(new URL(req.url).searchParams.get('limit')) || 40)
  const { data: jobs } = await supabase
    .from('job_finds')
    .select('id, title, company, url, location, salary, posted_at, verified_at')
    .not('status', 'in', '("applied","hidden","done")')
    .order('verified_at', { ascending: true, nullsFirst: true })
    .limit(limit)

  const results = { checked: 0, kept: 0, closed: 0, tooOld: 0, badRegion: 0, badFit: 0, lowPay: 0, unreachable: 0 }
  const dropped: string[] = []

  for (const j of jobs ?? []) {
    results.checked++
    let html = ''
    try {
      const res = await fetch(j.url, { headers: { 'User-Agent': UA }, redirect: 'follow', cache: 'no-store' })
      if (res.ok) html = await res.text()
      else if (res.status === 404 || res.status === 410) {
        await retire(j.id, `listing gone (HTTP ${res.status})`)
        results.closed++
        dropped.push(`${j.title} — gone`)
        continue
      }
    } catch { /* unreachable below */ }

    if (!html) {
      // Can't read it: leave it on the wire but stamp the attempt so we retry later.
      await supabase.from('job_finds').update({ verified_at: new Date().toISOString(), verify_note: 'unreachable — could not read listing' }).eq('id', j.id)
      results.unreachable++
      continue
    }

    const text = textOf(html)
    const ageDays = ageDaysFrom(html)

    if (isClosed(html)) {
      await retire(j.id, 'no longer accepting applications')
      results.closed++; dropped.push(`${j.title} — closed`); continue
    }
    if (ageDays !== null && ageDays > MAX_AGE_DAYS) {
      await retire(j.id, `posted ~${Math.round(ageDays)} days ago (over ${MAX_AGE_DAYS})`)
      results.tooOld++; dropped.push(`${j.title} — ${Math.round(ageDays)}d old`); continue
    }
    if (remoteElsewhere(`${j.location || ''} ${j.title} ${text}`)) {
      await retire(j.id, 'remote but requires residency outside Colorado')
      results.badRegion++; dropped.push(`${j.title} — residency elsewhere`); continue
    }
    const hay = `${j.title} ${text.slice(0, 3000)}`.toLowerCase()
    if (FIT_BAD.some((b) => hay.includes(b))) {
      await retire(j.id, 'listing content is outside Jacob\'s field')
      results.badFit++; dropped.push(`${j.title} — wrong field`); continue
    }
    const pay = salaryFromText(text)
    if (pay && pay.max < 75_000) {
      await retire(j.id, `listed pay ${pay.label} is under the $75k floor`)
      results.lowPay++; dropped.push(`${j.title} — ${pay.label}`); continue
    }

    // Survivor: record the REAL posted date and anything new we learned.
    const update: Record<string, unknown> = {
      verified_at: new Date().toISOString(),
      verify_note: `read ${new Date().toISOString().slice(0, 10)}${ageDays !== null ? ` · ~${Math.round(ageDays)}d old` : ' · age unknown'}`,
      description: text.slice(0, 4000),
    }
    if (ageDays !== null) update.posted_at = new Date(Date.now() - ageDays * 864e5).toISOString()
    if (!j.salary && pay) update.salary = pay.label
    await supabase.from('job_finds').update(update).eq('id', j.id)
    results.kept++
  }

  async function retire(id: number, note: string) {
    await supabase!.from('job_finds').update({ status: 'hidden', verified_at: new Date().toISOString(), verify_note: note }).eq('id', id)
  }

  return NextResponse.json({ ...results, dropped })
}

export const GET = handle
export const POST = handle
