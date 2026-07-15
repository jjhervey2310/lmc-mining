import fs from 'fs'
import path from 'path'
import { Script, PipelineResult } from './types'
import {
  HEYGEN_API_KEY,
  HEYGEN_TALKING_PHOTO_ID,
  HEYGEN_VOICE_ID,
  HEYGEN_SCALE,
  RENDER_WIDTH,
  RENDER_HEIGHT,
  SHORT_PLATFORMS,
} from './config'

const HEYGEN_API = 'https://api.heygen.com'
const POLL_INTERVAL_MS = 10_000
const RENDER_TIMEOUT_MS = 15 * 60_000

export function heygenReady(): boolean {
  return !!HEYGEN_API_KEY
}

// The voice reads URLs literally, so spell them out for speech.
function speechify(text: string): string {
  return text.replace(/lightningmines\.com/gi, 'lightning mines dot com')
}

/** What the avatar actually says: hook -> body -> the one CTA. */
export function spokenText(script: Script): string {
  return speechify([script.hook, script.body, script.cta].filter(Boolean).join(' '))
}

async function heygen<T = any>(pathname: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${HEYGEN_API}${pathname}`, {
    ...init,
    headers: { 'X-Api-Key': HEYGEN_API_KEY, 'Content-Type': 'application/json' },
  })
  const json: any = await res.json().catch(() => ({}))
  if (!res.ok || json.error) {
    throw new Error(`HeyGen ${pathname}: ${json.error?.message || `HTTP ${res.status}`}`)
  }
  return json.data as T
}

/**
 * Render one script as a vertical avatar video: submit -> poll -> download.
 * Returns the local MP4 path. Costs HeyGen quota — only call on approved scripts.
 */
export async function renderScriptVideo(script: Script, outFile: string, title: string): Promise<string> {
  if (!heygenReady()) throw new Error('HEYGEN_API_KEY not set in .env.local')

  const { video_id } = await heygen<{ video_id: string }>('/v2/video/generate', {
    method: 'POST',
    body: JSON.stringify({
      title,
      video_inputs: [
        {
          character: {
            type: 'talking_photo',
            talking_photo_id: HEYGEN_TALKING_PHOTO_ID,
            scale: HEYGEN_SCALE,
          },
          voice: { type: 'text', voice_id: HEYGEN_VOICE_ID, input_text: spokenText(script) },
        },
      ],
      dimension: { width: RENDER_WIDTH, height: RENDER_HEIGHT },
    }),
  })

  const deadline = Date.now() + RENDER_TIMEOUT_MS
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS))
    const st = await heygen<{ status: string; video_url?: string; error?: unknown }>(
      `/v1/video_status.get?video_id=${video_id}`
    )
    if (st.status === 'completed' && st.video_url) {
      const res = await fetch(st.video_url)
      if (!res.ok) throw new Error(`HeyGen video download failed: HTTP ${res.status}`)
      fs.mkdirSync(path.dirname(outFile), { recursive: true })
      fs.writeFileSync(outFile, Buffer.from(await res.arrayBuffer()))
      return outFile
    }
    if (st.status === 'failed') throw new Error(`HeyGen render failed: ${JSON.stringify(st.error)}`)
  }
  throw new Error(`HeyGen render timed out after ${RENDER_TIMEOUT_MS / 60_000} min (video_id ${video_id})`)
}

/**
 * CLI: render the day's approved short. One vertical asset serves all short
 * platforms; captions per platform come from the digest.
 *
 *   npm run content:render                  latest pipeline JSON in out/
 *   npm run content:render -- --date=2026-07-15
 *   npm run content:render -- --force       render even if a gate failed
 */
async function main() {
  const args = process.argv.slice(2)
  const dateArg = args.find((a) => a.startsWith('--date='))?.split('=')[1]
  const force = args.includes('--force')

  const outDir = path.resolve(process.cwd(), 'content-engine/out')
  const jsons = fs
    .readdirSync(outDir)
    .filter((f) => f.endsWith('.json') && (!dateArg || f.startsWith(dateArg)))
    .sort()
  const file = jsons[jsons.length - 1]
  if (!file) {
    throw new Error(`No pipeline JSON found in content-engine/out${dateArg ? ` for ${dateArg}` : ''} — run content:run first`)
  }

  const result: PipelineResult = JSON.parse(fs.readFileSync(path.join(outDir, file), 'utf8'))
  const short = result.reviewed.find((r) => SHORT_PLATFORMS.includes(r.script.platform))
  if (!short) throw new Error(`No short-platform script in ${file}`)
  if (!short.passedAll && !force) {
    throw new Error(`${file}: script has gate failures — fix or re-run, or pass --force`)
  }

  const outFile = path.join(outDir, `${result.brief.date}.mp4`)
  console.log(`🎬 Rendering ${result.brief.date} ${result.brief.pillar} (${short.script.platform}) via HeyGen...`)
  await renderScriptVideo(short.script, outFile, `LMC ${result.brief.date} — ${result.brief.pillar}`)
  console.log(`✅ Video written to ${path.relative(process.cwd(), outFile)}`)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('render failed:', e)
    process.exit(1)
  })
}
