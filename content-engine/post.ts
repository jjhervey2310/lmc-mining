import fs from 'fs'
import path from 'path'
import { PipelineResult, ReviewedScript, Platform } from './types'
import { POSTIZ_API_KEY, POSTIZ_API_URL } from './config'

// Postiz providerIdentifier for each engine platform. One vertical MP4 serves
// the three short platforms; X gets the text-native cut (no video required).
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
    posts.push({
      integration: { id: integration.id },
      value: [
        {
          content: isVideoPlatform ? captionFor(r) : [r.script.hook, r.script.body, r.script.cta, captionFor(r)].join('\n\n'),
          ...(isVideoPlatform ? { image: [{ id: media.id, path: media.path }] } : {}),
        },
      ],
      ...(r.script.platform === 'youtube_shorts'
        ? { settings: { title: r.script.hook.slice(0, 95), type: 'public' } }
        : {}),
    })
  }

  if (!posts.length) throw new Error('Nothing to post — no passing scripts matched a connected channel')

  await postiz('/posts', {
    method: 'POST',
    body: JSON.stringify({ type: 'now', date, shortLink: false, posts }),
  })
  console.log(`✅ Published ${posts.length} post(s) via Postiz`)
}

/**
 * CLI: post the day's rendered video + captions.
 *
 *   npm run content:post                   latest JSON + MP4 in out/
 *   npm run content:post -- --date=2026-07-15
 *   npm run content:post -- --check        list connected channels and exit
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

  const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1]
  const outDir = path.resolve(process.cwd(), 'content-engine/out')
  const jsons = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith('.json') && (!dateArg || f.startsWith(dateArg)))
    .sort()
  const file = jsons[jsons.length - 1]
  if (!file) throw new Error('No pipeline JSON in content-engine/out — run content:run first')

  const result: PipelineResult = JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'))
  const videoFile = path.join(outDir, `${result.brief.date}.mp4`)
  if (!fs.existsSync(videoFile)) throw new Error(`${videoFile} not found — run content:render first`)

  await publishDay(result, videoFile)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('post failed:', e)
    process.exit(1)
  })
}
