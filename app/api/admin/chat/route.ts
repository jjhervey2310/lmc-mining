import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers } from '@/lib/daily-content'
import { getMakeDrop } from '@/lib/make-content'

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

Use the live SNAPSHOT JSON in each request to answer questions about current state. If something looks broken, say what, why it matters, and the exact next step. If data is missing from the snapshot, say so rather than guessing.

Adopt the expert lens each question calls for — data analyst for numbers, marketing strategist for content/growth, ops engineer for pipeline issues, recruiter for the job hunt — and answer as that expert would, still short and plain.

You can ACT, not just answer, via your tools: list the post queue, delete a queued post, regenerate a day's content through the gates, add a standing content lesson that shapes every future script, and update job statuses. Rules: before any DESTRUCTIVE action (deleting a post), state exactly what you'll do and get Jacob's explicit yes in this chat first — then act on his confirmation. Never invent post ids: list the queue first. regenerate_content refreshes the script/captions cache only; it does NOT re-render or re-queue the video (tell Jacob that part still runs through Saturday's batch or Claude). After acting, report what actually happened based on the tool result.`

// ── PA tools: the hands. Each runs server-side with the same keys the watchdog uses. ──

const PA_TOOLS = [
  { type: 'function' as const, function: { name: 'list_queue', description: 'List queued/scheduled posts for the next N days with ids, times (UTC), platforms, first caption line.', parameters: { type: 'object', properties: { days: { type: 'number', description: '1-14, default 7' } } } } },
  { type: 'function' as const, function: { name: 'delete_post', description: 'Delete ONE queued Postiz post by its id. DESTRUCTIVE — only after Jacob explicitly confirmed in this conversation.', parameters: { type: 'object', properties: { post_id: { type: 'string' } }, required: ['post_id'] } } },
  { type: 'function' as const, function: { name: 'regenerate_content', description: 'Regenerate a date\'s script+captions through all quality gates, overwriting the cached version. Does NOT re-render video.', parameters: { type: 'object', properties: { date: { type: 'string', description: 'YYYY-MM-DD' } }, required: ['date'] } } },
  { type: 'function' as const, function: { name: 'add_lesson', description: 'Add a standing content lesson/directive that is injected into every future script generation (e.g. "shorter hooks", "more humor").', parameters: { type: 'object', properties: { lesson: { type: 'string' }, rationale: { type: 'string' } }, required: ['lesson'] } } },
  { type: 'function' as const, function: { name: 'job_status', description: 'Update a job find\'s status: applied, seen, or hidden.', parameters: { type: 'object', properties: { url: { type: 'string' }, status: { type: 'string', enum: ['applied', 'seen', 'hidden'] } }, required: ['url', 'status'] } } },
  { type: 'function' as const, function: { name: 'check_balance', description: 'Get the current HeyGen render balance in units.', parameters: { type: 'object', properties: {} } } },
  { type: 'function' as const, function: { name: 'run_watchdog', description: 'Run the full watchdog sweep right now (health checks, auto-fixes, job sweep, sends Jacob the brief email).', parameters: { type: 'object', properties: {} } } },
  { type: 'function' as const, function: { name: 'recent_leads', description: 'List the most recent website leads (email, type, date).', parameters: { type: 'object', properties: { limit: { type: 'number', description: '1-25, default 10' } } } } },
]

async function runTool(name: string, args: Record<string, unknown>): Promise<string> {
  const supabase = createServiceClient()
  try {
    if (name === 'list_queue') {
      const days = Math.min(14, Math.max(1, Number(args.days) || 7))
      const res = await fetch(
        `https://api.postiz.com/public/v1/posts?startDate=${new Date().toISOString()}&endDate=${new Date(Date.now() + days * 864e5).toISOString()}`,
        { headers: { Authorization: process.env.POSTIZ_API_KEY || '' }, cache: 'no-store' }
      )
      if (!res.ok) return `Postiz error ${res.status}`
      const posts = (((await res.json()).posts || []) as { id: string; publishDate: string; state: string; content?: string; integration?: { providerIdentifier?: string } }[])
        .filter((p) => p.state === 'QUEUE')
        .sort((a, b) => a.publishDate.localeCompare(b.publishDate))
        .map((p) => ({ id: p.id, when_utc: p.publishDate, platform: (p.integration?.providerIdentifier || '?').replace('-standalone', ''), caption: (p.content || '').split('\n')[0].slice(0, 70) }))
      return JSON.stringify(posts)
    }
    if (name === 'delete_post') {
      const res = await fetch(`https://api.postiz.com/public/v1/posts/${args.post_id}`, {
        method: 'DELETE', headers: { Authorization: process.env.POSTIZ_API_KEY || '' },
      })
      return res.ok ? `Deleted post ${args.post_id}.` : `Delete failed: HTTP ${res.status}`
    }
    if (name === 'regenerate_content') {
      const drop = await getMakeDrop({ date: String(args.date), refresh: true })
      return JSON.stringify({ ok: true, date: drop.date, source: drop.source, hook: drop.hook, gates: drop.gates.map((g) => `${g.gate}: ${g.pass ? 'pass' : 'FAIL'}`) })
    }
    if (name === 'add_lesson') {
      if (!supabase) return 'Supabase unavailable'
      await supabase.from('content_lessons').insert({ lesson: String(args.lesson), rationale: String(args.rationale || 'Jacob, via PA chat'), source: 'jacob-pa' })
      return `Lesson saved — it now shapes every future script: "${args.lesson}"`
    }
    if (name === 'job_status') {
      if (!supabase) return 'Supabase unavailable'
      const { error } = await supabase.from('job_finds').update({ status: String(args.status) }).eq('url', String(args.url))
      return error ? `Update failed: ${error.message}` : `Marked ${args.status}.`
    }
    if (name === 'check_balance') {
      const res = await fetch('https://api.heygen.com/v2/user/remaining_quota', { headers: { 'x-api-key': process.env.HEYGEN_API_KEY || '' }, cache: 'no-store' })
      if (!res.ok) return `HeyGen error ${res.status}`
      return `HeyGen balance: ${(await res.json()).data?.remaining_quota} units (a week of 7 videos burns ~300-550; $50 buys ~3,000).`
    }
    if (name === 'run_watchdog') {
      const res = await fetch('https://www.lightningmines.com/api/cron/morning-brief', {
        method: 'POST', headers: { 'x-content-secret': process.env.DAILY_CONTENT_SECRET || '' }, cache: 'no-store',
      })
      return res.ok ? `Watchdog ran: ${await res.text()}` : `Watchdog failed: HTTP ${res.status}`
    }
    if (name === 'recent_leads') {
      if (!supabase) return 'Supabase unavailable'
      const { data } = await supabase.from('leads').select('email, lead_type, created_at').order('created_at', { ascending: false }).limit(Math.min(25, Number(args.limit) || 10))
      return JSON.stringify(data || [])
    }
    return `Unknown tool ${name}`
  } catch (e) {
    return `Tool error: ${e instanceof Error ? e.message : e}`
  }
}

/** GPT with tools: acts, observes results, then answers. Bounded loop. */
async function gptWithTools(system: string, history: { role: string; content: string }[], key: string): Promise<string> {
  const msgs: Record<string, unknown>[] = [{ role: 'system', content: system }, ...history]
  for (let i = 0; i < 5; i++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', temperature: 0.4, max_tokens: 900, messages: msgs, tools: PA_TOOLS }),
    })
    if (!res.ok) throw new Error(`gpt ${res.status}`)
    const m = (await res.json()).choices?.[0]?.message as { content?: string; tool_calls?: { id: string; function: { name: string; arguments: string } }[] } | undefined
    if (!m) throw new Error('gpt empty response')
    if (m.tool_calls?.length) {
      msgs.push(m as Record<string, unknown>)
      for (const tc of m.tool_calls) {
        let parsed: Record<string, unknown> = {}
        try { parsed = JSON.parse(tc.function.arguments || '{}') } catch { /* empty args */ }
        const out = await runTool(tc.function.name, parsed)
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: out })
      }
      continue
    }
    return m.content || ''
  }
  return 'I hit my action limit on this one — ask me to continue.'
}

async function askClaude(system: string, messages: { role: string; content: string }[], key: string): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.CE_GENERATOR_MODEL || 'claude-sonnet-5', max_tokens: 1200, system, messages }),
  })
  if (!res.ok) throw new Error(`claude ${res.status}`)
  const data = (await res.json()) as { content?: { type: string; text?: string }[] }
  // Join ALL text blocks — answers can arrive split, and taking only the first truncates them.
  return (data.content || []).filter((b) => b.type === 'text').map((b) => b.text || '').join('')
}

/** Claude cross-checks GPT's draft against the same snapshot. Null when it agrees. */
async function claudeObjections(snapJson: string, question: string, draft: string): Promise<string | null> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) return null
  try {
    const raw = await askClaude(
      'You are the independent second brain checking a PA\'s answer against live system data. Be the same kind of expert the question demands. Verify every factual claim against the snapshot and the logic of the advice. Return ONLY JSON: {"agree": boolean, "objections": string}. Object only to real errors or misleading framing — style is not your business.',
      [{ role: 'user', content: `SNAPSHOT:\n${snapJson}\n\nQUESTION: ${question}\n\nPA ANSWER TO CHECK:\n${draft}` }],
      key
    )
    const start = raw.indexOf('{')
    const v = JSON.parse(raw.slice(start)) as { agree?: boolean; objections?: string }
    return v.agree ? null : v.objections || 'unspecified objection'
  } catch {
    return null
  }
}

export async function POST(req: Request) {
  const body = (await req.json()) as { secret?: string; messages?: { role: 'user' | 'assistant'; content: string }[] }
  if (!process.env.ADMIN_SECRET || body.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const key = process.env.OPENAI_API_KEY
  if (!key) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 503 })

  const snap = await snapshot()
  const history = (body.messages || []).slice(-12)
  if (!history.length || history[history.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'No user message' }, { status: 400 })
  }

  const snapJson = JSON.stringify(snap)
  const system = `${SYSTEM}\n\nSNAPSHOT (live, just fetched):\n${snapJson}`
  const question = history[history.length - 1].content

  try {
    // Dual-brain, Jacob's arrangement: ChatGPT is the voice AND the hands (tools),
    // Claude is the silent checker — GPT revises until Claude has no objections.
    let reply = await gptWithTools(system, history, key)
    let rounds = 0
    for (; rounds < 2; rounds++) {
      const objections = await claudeObjections(snapJson, question, reply)
      if (!objections) break
      reply = await gptWithTools(
        system,
        [...history, { role: 'assistant', content: reply }, { role: 'user', content: `An independent reviewer checked your answer against the live data and objects: "${objections}". Rewrite the answer fixing every valid objection (you may use tools to re-check facts). Answer only — no meta-commentary.` }],
        key
      )
    }
    return NextResponse.json({ reply, checked: rounds === 0 ? 'agreed first pass' : `agreed after ${rounds} revision(s)` })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'model error' }, { status: 502 })
  }
}

export const dynamic = 'force-dynamic'
// Tool loops (especially regenerate_content's full gate run) can take minutes.
export const maxDuration = 300
