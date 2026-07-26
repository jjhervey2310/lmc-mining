import { NextResponse } from 'next/server'
import { getMakeDrop, jsonSafe } from '@/lib/make-content'

// Gate-passed daily content for the Make.com posting pipeline. Secret-protected:
// Make sends x-content-secret and receives the day's checked script + per-platform
// captions instead of generating its own. The `make` block is JSON-escaped for
// direct interpolation into Make's jsonString HTTP bodies (HeyGen, Postiz).
async function handle(req: Request) {
  const secret = req.headers.get('x-content-secret')
  if (!process.env.DAILY_CONTENT_SECRET || secret !== process.env.DAILY_CONTENT_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const refresh = new URL(req.url).searchParams.get('refresh') === '1'
    const drop = await getMakeDrop({ refresh })
    return NextResponse.json({
      ...drop,
      make: {
        title: jsonSafe(drop.title),
        script: jsonSafe(drop.script),
        captionYoutube: jsonSafe(drop.captions.youtube),
        captionInstagram: jsonSafe(drop.captions.instagram),
        captionTiktok: jsonSafe(drop.captions.tiktok),
        captionX: jsonSafe(drop.captions.x),
      },
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 503 })
  }
}

export const GET = handle
export const POST = handle
export const dynamic = 'force-dynamic'
export const maxDuration = 60
