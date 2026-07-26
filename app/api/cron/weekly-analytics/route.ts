import { NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createServiceClient } from '@/lib/supabase'
import { generateJSON, anthropicReady } from '@/content-engine/llm/anthropic'
import { reviewJSON, openaiReady } from '@/content-engine/llm/openai'

const RECIPIENT = 'jjhervey1@gmail.com'

// Weekly dual-brain analytics review (Sundays, via pg_cron). Snapshots per-video
// stats, has Claude propose lessons and GPT independently critique them, and keeps
// only the lessons BOTH models agree on. Stored lessons feed straight into the
// content generator's prompt (lib/make-content.ts), closing the learn-from-what-
// performs loop without anyone touching a laptop.

interface VideoStat {
  platform: string
  video_ref: string
  title: string
  published_at: string
  views: number
  likes: number
  comments: number
}

async function fetchYouTube(): Promise<VideoStat[]> {
  const key = process.env.YOUTUBE_API_KEY
  const channel = process.env.YOUTUBE_CHANNEL_ID
  if (!key || !channel) return []
  const search = await fetch(
    `https://www.googleapis.com/youtube/v3/search?part=id&channelId=${channel}&order=date&maxResults=25&type=video&key=${key}`
  )
  if (!search.ok) return []
  const ids = ((await search.json()).items || [])
    .map((i: { id?: { videoId?: string } }) => i.id?.videoId)
    .filter(Boolean)
  if (!ids.length) return []
  const stats = await fetch(
    `https://www.googleapis.com/youtube/v3/videos?part=statistics,snippet&id=${ids.join(',')}&key=${key}`
  )
  if (!stats.ok) return []
  return ((await stats.json()).items || []).map(
    (v: {
      id: string
      snippet?: { title?: string; publishedAt?: string }
      statistics?: { viewCount?: string; likeCount?: string; commentCount?: string }
    }) => ({
      platform: 'youtube',
      video_ref: v.id,
      title: v.snippet?.title || '',
      published_at: v.snippet?.publishedAt || '',
      views: Number(v.statistics?.viewCount || 0),
      likes: Number(v.statistics?.likeCount || 0),
      comments: Number(v.statistics?.commentCount || 0),
    })
  )
}

async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 })

  const stats = await fetchYouTube()
  if (stats.length) {
    await supabase.from('video_metrics').insert(stats)
  }

  let lessons: { lesson: string; rationale: string }[] = []
  let analysisNote = ''

  // BRAND.md's own rule: never react to a single video — only patterns across 5+.
  if (stats.length >= 5 && anthropicReady() && openaiReady()) {
    const table = stats
      .map((s) => `${s.published_at.slice(0, 10)} | ${s.views} views ${s.likes} likes ${s.comments} comments | ${s.title}`)
      .join('\n')
    try {
      const raw = await generateJSON(
        'You analyze short-form video performance for Lightning Mines, an honest Bitcoin mining channel. ' +
          'From the metrics table, find PATTERNS (hook style, topic, length, tone) that separate the better performers. ' +
          'Never conclude from a single video. Return ONLY JSON: {"lessons": [{"lesson": "<one actionable writing rule for future scripts>", "rationale": "<the pattern in the data>"}]} ' +
          'with AT MOST 2 lessons; return an empty array if the data is too thin or too uniform to be confident.',
        `Metrics (newest first):\n${table}`,
        1200
      )
      const start = raw.indexOf('{')
      const proposed = (JSON.parse(raw.slice(start)) as { lessons?: { lesson: string; rationale: string }[] }).lessons || []
      for (const p of proposed.slice(0, 2)) {
        const verdictRaw = await reviewJSON(
          'You are the skeptical second reviewer. Given video metrics and a proposed content lesson, decide if the data truly supports it. ' +
            'Reject anything based on tiny samples, noise, or confounds. Return ONLY JSON: {"agree": boolean, "reason": string}.',
          `Metrics:\n${table}\n\nProposed lesson: ${p.lesson}\nRationale: ${p.rationale}`
        )
        const verdict = JSON.parse(verdictRaw) as { agree?: boolean }
        if (verdict.agree) lessons.push(p)
      }
    } catch (e) {
      analysisNote = `analysis error: ${e instanceof Error ? e.message : e}`
    }
    if (lessons.length) {
      await supabase.from('content_lessons').insert(lessons.map((l) => ({ ...l, source: 'analytics' })))
    }
  } else if (!stats.length) {
    analysisNote = 'No metrics source connected yet — add YOUTUBE_API_KEY + YOUTUBE_CHANNEL_ID in Vercel to enable.'
  } else {
    analysisNote = `Only ${stats.length} videos with data — need 5+ before drawing lessons (brand rule).`
  }

  const apiKey = process.env.RESEND_API_KEY || process.env.resend_api_key
  if (apiKey) {
    const rows = stats
      .slice(0, 15)
      .map((s) => `<tr><td style="padding:4px 8px;">${s.published_at.slice(0, 10)}</td><td style="padding:4px 8px;">${s.views}</td><td style="padding:4px 8px;">${s.likes}</td><td style="padding:4px 8px;">${s.title}</td></tr>`)
      .join('')
    await new Resend(apiKey).emails.send({
      from: 'Lightning Mines <no-reply@lightningmines.com>',
      to: RECIPIENT,
      subject: `📊 Weekly video review — ${lessons.length ? `${lessons.length} new lesson(s) learned` : 'no new lessons'}`,
      html: `<div style="font-family:-apple-system,sans-serif;max-width:640px;margin:0 auto;padding:24px;">
<h2 style="margin:0 0 12px;">Weekly video review</h2>
${lessons.length ? `<h3>Lessons (both models agreed — now feeding every future script):</h3><ul>${lessons.map((l) => `<li><b>${l.lesson}</b><br><span style="color:#6b7280;">${l.rationale}</span></li>`).join('')}</ul>` : ''}
${analysisNote ? `<p style="color:#6b7280;">${analysisNote}</p>` : ''}
${rows ? `<table style="border-collapse:collapse;font-size:13px;"><tr><th style="padding:4px 8px;text-align:left;">Date</th><th style="padding:4px 8px;text-align:left;">Views</th><th style="padding:4px 8px;text-align:left;">Likes</th><th style="padding:4px 8px;text-align:left;">Title</th></tr>${rows}</table>` : ''}
<p style="color:#6b7280;font-size:13px;">Automatic Sunday review from lightningmines.com. TikTok/IG/X metrics: phase 2.</p>
</div>`,
    })
  }

  return NextResponse.json({ snapshots: stats.length, lessons, note: analysisNote })
}

export const GET = handle
export const POST = handle
export const dynamic = 'force-dynamic'
export const maxDuration = 120
