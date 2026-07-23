import fs from 'fs'
import path from 'path'
import { PipelineResult, ReviewedScript, Platform } from './types'
import { POSTIZ_API_KEY, POSTIZ_API_URL } from './config'

// Postiz providerIdentifier for each engine platform. One vertical MP4 serves
// the three short platforms; X gets the text-native cut (no video required).
// Title for display surfaces: the dedicated title, else the hook cut at a word boundary.
export function titleFor(s: { title?: string; hook: string }): string {
  if (s.title && s.title.length <= 100) return s.title
  const h = s.hook.slice(0, 95)
  return h.length < s.hook.length ? h.slice(0, h.lastIndexOf(' ')) : h
}

const PROVIDER_BY_PLATFORM: Record<Platform, string> = {
  youtube_shorts: 'youtube',
  instagram_reels: 'instagram',
  tiktok: 'tiktok',
  x: 'x',
}

export function postizReady(): boolean {
  return !!POSTIZ_API_KEY
}

async function postiz<T = any>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${POSTIZ_API_URL}${pathname}`, {
    ...init,
    headers: {
      Authorization: POSTIZ_API_KEY,
      ...(init?.body && typeof init.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
  })
  if (!res.ok) throw new Error(`Postiz ${pathname}: HTTP ${res.status} ${await res.text()}`)
  return (await res.json()) as T
}

interface Integration {
  id: string
  name: string
  identifier: string // providerIdentifier, e.g. 'youtube' | 'instagram' | 'tiktok' | 'x'
  disabled?: boolean
}

export async function listIntegrations(): Promise<Integration[]> {
  const data = await postiz<any>('/integrations')
  return (Array.isArray(data) ? data : data.integrations || []).map((i: any) => ({
    id: i.id,
    name: i.name,
    identifier: i.identifier || i.providerIdentifier,
    disabled: i.disabled,
  }))
}

/** Upload the MP4 once; Postiz returns a media object reused across platforms. */
export async function uploadVideo(file: string): Promise<{ id: string; path: string }> {
  const form = new FormData()
  const buf = fs.readFileSync(file)
  form.append('file', new Blob([buf], { type: 'video/mp4' }), path.basename(file))
  return postiz('/upload', { method: 'POST', body: form as any })
}

/** Caption text for one platform: caption + hashtags + required disclosures. */
export function captionFor(r: ReviewedScript): string {
  const s = r.script
  return [s.caption, s.hashtags.join(' '), s.disclosures.join(' ')].filter(Boolean).join('\n\n')
}

/**
 * X long-form: the generator writes a distinct multi-paragraph piece for X (hook + body,
 * CTA already inside the body). Account has Premium, so long posts are allowed. The video
 * is attached as native media — bare link-card posts all render the same preview and read
 * as duplicates (and X downranks them).
 */
export function xPostFor(r: ReviewedScript): string {
  const s = r.script
  return [s.hook, s.body, s.hashtags.join(' ')].filter(Boolean).join('\n\n')
}

/** 280-char fallback if the long X post is rejected (e.g. Premium lapses). */
export function tweetFor(r: ReviewedScript): string {
  const s = r.script
  let text = [s.caption, s.hashtags.join(' ')].filter(Boolean).join('\n\n')
  if (text.length > 280) text = s.caption.length <= 280 ? s.caption : s.caption.slice(0, 279) + '…'
  return text
}

/**
 * Publish the day's approved content: the vertical MP4 to YouTube/IG/TikTok with
 * per-platform captions, and the text-native script to X. Running this command IS
 * the human approval tap — nothing calls it automatically.
 */
export async function publishDay(result: PipelineResult, videoFile: string, when?: Date): Promise<void> {
  const integrations = await listIntegrations()
  const media = await uploadVideo(videoFile)
  const date = (when || new Date()).toISOString()

  const posts: any[] = []
  for (const r of result.reviewed) {
    if (!r.passedAll) {
      console.log(`⚠ skipping ${r.script.platform}: gate failures`)
      continue
    }
    const provider = PROVIDER_BY_PLATFORM[r.script.platform]
    const integration = integrations.find((i) => i.identifier?.includes(provider) && !i.disabled)
    if (!integration) {
      console.log(`⚠ skipping ${r.script.platform}: no connected ${provider} channel in Postiz`)
      continue
    }

    const isVideoPlatform = r.script.platform !== 'x'

    // Per-provider settings blocks Postiz validates hard on (400s without them).
    const SETTINGS_BY_PLATFORM: Record<Platform, object | undefined> = {
      youtube_shorts: { title: titleFor(r.script), type: 'public' },
      instagram_reels: { post_type: 'post' },
      tiktok: {
        privacy_level: 'PUBLIC_TO_EVERYONE',
        duet: false,
        stitch: false,
        comment: true,
        autoAddMusic: 'no',
        brand_content_toggle: false,
        brand_organic_toggle: false,
        content_posting_method: 'DIRECT_POST',
      },
      x: { who_can_reply_post: 'everyone' },
    }
    const settings = SETTINGS_BY_PLATFORM[r.script.platform]

    posts.push({
      integration: { id: integration.id },
      value: [
        {
          // Every platform gets the video; X pairs it with its own written breakdown
          // instead of a caption, so the X feed never shows two identical link cards.
          content: isVideoPlatform ? captionFor(r) : xPostFor(r),
          image: [{ id: media.id, path: media.path }],
        },
      ],
      ...(settings ? { settings } : {}),
    })
  }

  if (!posts.length) throw new Error('Nothing to post — no passing scripts matched a connected channel')

  const send = (batch: any[]) =>
    postiz('/posts', {
      method: 'POST',
      body: JSON.stringify({ type: 'now', date, shortLink: false, tags: [], posts: batch }),
    })

  // X ships separately so a long-post rejection can fall back without re-posting the others.
  const xPost = posts.find((p) => integrations.find((i) => i.id === p.integration.id)?.identifier === 'x')
  const rest = posts.filter((p) => p !== xPost)

  if (rest.length) await send(rest)
  if (xPost) {
    try {
      await send([xPost])
    } catch (e) {
      console.log(`⚠ long X post rejected (${(e as Error).message.slice(0, 120)}) — retrying 280-char version`)
      const rx = result.reviewed.find((r) => r.script.platform === 'x')!
      xPost.value[0].content = tweetFor(rx)
      await send([xPost])
    }
  }
  console.log(`✅ Published ${posts.length} post(s) via Postiz`)
}

/** List what's actually scheduled/published in Postiz around today, grouped by day.
 * Answers "did everything go out?" without opening the dashboard. TikTok's 8pm ET
 * slot is stored as 00:00Z next day, so the range spans yesterday..+2 days. */
export async function printQueue(): Promise<void> {
  const start = new Date(); start.setUTCDate(start.getUTCDate() - 1)
  const end = new Date(); end.setUTCDate(end.getUTCDate() + 2)
  const qs = `?startDate=${start.toISOString()}&endDate=${end.toISOString()}`
  const data = await postiz<any>(`/posts${qs}`)
  const posts: any[] = Array.isArray(data) ? data : data.posts || []
  const integrations = await listIntegrations()

  if (!posts.length) {
    console.log('⚠ Postiz returned ZERO posts in the window (yesterday → +2 days). Nothing is queued.')
    return
  }
  const byDay = new Map<string, any[]>()
  for (const p of posts) {
    const when = p.publishDate || p.date || p.createdAt || ''
    const day = String(when).slice(0, 10) || 'unknown'
    byDay.set(day, [...(byDay.get(day) || []), p])
  }
  for (const day of [...byDay.keys()].sort()) {
    console.log(`\n${day}:`)
    for (const p of byDay.get(day)!) {
      const integ = integrations.find((i) => i.id === (p.integration?.id || p.integrationId))
      const label = integ?.identifier || p.integration?.providerIdentifier || 'unknown-channel'
      const time = String(p.publishDate || p.date || '').slice(11, 16)
      console.log(`  ${time}Z  ${label.padEnd(22)} ${p.state || p.status || ''}`)
    }
  }
  console.log('\nExpect 4/day: x · youtube · instagram · tiktok (tiktok 8pm ET shows as 00:00Z NEXT day).')
}

/**
 * CLI: post the day's rendered video + captions.
 *
 *   npm run content:post                   latest JSON + MP4 in out/
 *   npm run content:post -- --date=2026-07-15
 *   npm run content:post -- --check        list connected channels and exit
 *   npm run content:post -- --queue        show what's scheduled/published around today
 */
async function main() {
  if (!postizReady()) throw new Error('POSTIZ_API_KEY not set in .env.local')
  const args = process.argv.slice(2)

  if (args.includes('--check')) {
    const list = await listIntegrations()
    console.log('Connected Postiz channels:')
    for (const i of list) console.log(`  ${i.identifier}  ${i.name}${i.disabled ? '  (disabled)' : ''}`)
    return
  }

  if (args.includes('--queue')) {
    await printQueue()
    return
  }

  const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1]
  const videoArg = args.find((a) => a.startsWith('--video='))?.split('=')[1]
  const outDir = path.resolve(process.cwd(), 'content-engine/out')
  const jsons = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith('.json') && (!dateArg || f.startsWith(dateArg)))
    .sort()
  const file = jsons[jsons.length - 1]
  if (!file) throw new Error('No pipeline JSON in content-engine/out — run content:run first')

  const result: PipelineResult = JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'))
  // --video lets banked files (date-suffixed) or $0 motion-graphic MP4s ship with the day's captions.
  const videoFile = videoArg ? path.resolve(videoArg) : path.join(outDir, `${result.brief.date}.mp4`)
  if (!fs.existsSync(videoFile)) throw new Error(`${videoFile} not found — run content:render first (or pass --video=path)`)

  await publishDay(result, videoFile)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('post failed:', e)
    process.exit(1)
  })
}
