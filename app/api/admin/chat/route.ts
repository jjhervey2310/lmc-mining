import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers } from '@/lib/daily-content'

// The PA behind the terminal's chat window. Every request gets a fresh snapshot of
// the whole operation, so answers are grounded in what is actually happening.

async function snapshot() {
  const supabase = createServiceClient()
  const live = await getLivePriceData()
  const n = live && !('error' in live) ? computeDailyNumbers(live.price, live.difficulty) : null
  const today = new Date().toISOString().slice(0, 10)

  const [cache, lessons, metrics, jobs, leads] = await Promise.all([
    supabase?.from('make_content_cache').select('cache_date, source, payload').gte('cache_date', today).order('cache_date').limit(8) ?? null,
    supabase?.from('content_lessons').select('lesson').eq('active', true).limit(5) ?? null,
    supabase?.from('video_metrics').select('title, views, likes, captured_at').order('captured_at', { ascending: false }).limit(15) ?? null,
    supabase?.from('job_finds').select('title, company, url, found_at').order('found_at', { ascending: false }).limit(10) ?? null,
    supabase?.from('leads').select('created_at') ?? null,
  ])

  let queue: { total: number; byDay: Record<string, number> } | null = null
  if (process.env.POSTIZ_API_KEY) {
    try {
      const res = await fetch(
        `https://api.postiz.com/public/v1/posts?startDate=${new Date().toISOString()}&endDate=${new Date(Date.now() + 8 * 864e5).toISOString()}`,
        { headers: { Authorization: process.env.POSTIZ_API_KEY }, cache: 'no-store' }
      )
      if (res.ok) {
        const posts = ((await res.json()).posts || []).filter((p: { state: string }) => p.state === 'QUEUE')
        const byDay: Record<string, number> = {}
        for (const p of posts) byDay[(p.publishDate || '').slice(0, 10)] = (byDay[(p.publishDate || '').slice(0, 10)] || 0) + 1
        queue = { total: posts.length, byDay }
      }
    } catch { /* snapshot stays null */ }
  }

  let heygenUnits: number | null = null
  if (process.env.HEYGEN_API_KEY) {
    try {
      const res = await fetch('https://api.heygen.com/v2/user/remaining_quota', { headers: { 'x-api-key': process.env.HEYGEN_API_KEY }, cache: 'no-store' })
      if (res.ok) heygenUnits = (await res.json()).data?.remaining_quota ?? null
    } catch { /* ignore */ }
  }

  const leadRows = leads?.data ?? []
  return {
    now_denver: new Date().toLocaleString('en-US', { timeZone: 'America/Denver' }),
    mining: n,
    contentBanked: (cache?.data ?? []).map((c) => ({ date: c.cache_date, source: c.source, theme: (c.payload as { theme?: string })?.theme, hook: (c.payload as { hook?: string })?.hook })),
    postizQueue: queue,
    heygenUnits,
    videoStats: metrics?.data ?? [],
    activeLessons: (lessons?.data ?? []).map((l) => l.lesson),
    jobFinds: jobs?.data ?? [],
    leads: { total: leadRows.length, last7d: leadRows.filter((l) => Date.now() - new Date(l.created_at).getTime() < 7 * 864e5).length },
  }
}

const SYSTEM = `You are Jacob's personal assistant for Lightning Mines (lightningmines.com), living inside his private terminal dashboard. Speak short, plain, and honest — no fluff, no hedging. He is in Denver (Mountain Time).

How his machine works (all automatic, no laptop involved):
- Saturdays 5pm MT: HeyGen balance check emails him if under 600 units (a week of 7 videos burns ~300–550; $50 ≈ 3,000 units).
- Saturdays 6–7pm MT: the next 7 days of posts are generated (Claude writes, deterministic fact/brand/evergreen/variety gates + GPT review check), rendered in HeyGen (his AI likeness + cloned voice, rotating outfits), and queued in Postiz — 4 posts/day: X 7:30am, YouTube noon, Instagram 4pm, TikTok 6:30pm MT.
- Sundays 8pm MT: analytics review snapshots YouTube stats; Claude proposes lessons, GPT vets them; agreed lessons feed all future scripts.
- Daily 6am MT: the PA watchdog checks everything, fixes what it can (e.g. regenerates missing content), sweeps job boards into his job wire, and emails a morning brief.
- Content rules: price numbers only in Sunday's post (rest evergreen); every hook names Bitcoin mining; every caption has the CTA "Run your own numbers free at lightningmines.com" and an AI-presenter disclosure.
- Money: revenue = Abundant Mines hosting affiliate + $97/$297 audits; a $997 Done-With-You Setup tier is in progress. Jacob's first income goal is $3,000 and he is also job hunting (the job wire helps).
- Known quirk: Postiz's calendar shows queued videos with no preview thumbnail — cosmetic; the video files are attached and publish fine.

Use the live SNAPSHOT JSON in each request to answer questions about current state. If something looks broken, say what, why it matters, and the exact next step. If data is missing from the snapshot, say so rather than guessing.`

export async function POST(req: Request) {
  const body = (await req.json()) as { secret?: string; messages?: { role: 'user' | 'assistant'; content: string }[] }
  if (!process.env.ADMIN_SECRET || body.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not set' }, { status: 503 })

  const snap = await snapshot()
  const history = (body.messages || []).slice(-12)
  if (!history.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'No user message' }, { status: 400 })
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: process.env.CE_GENERATOR_MODEL || 'claude-sonnet-5',
      max_tokens: 1000,
      system: `${SYSTEM}\n\nSNAPSHOT (live, just fetched):\n${JSON.stringify(snap)}`,
      messages: history,
    }),
  })
  if (!res.ok) {
    return NextResponse.json({ error: `model error ${res.status}` }, { status: 502 })
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  const reply = (data.content || []).find((b) => b.type === 'text')?.text || ''
  return NextResponse.json({ reply })
}

export const dynamic = 'force-dynamic'
export const maxDuration = 60
