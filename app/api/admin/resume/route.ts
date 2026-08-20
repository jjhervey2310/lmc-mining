import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { tailor, render, filename, fitOnePage, pageCount } from '@/lib/resume/tailor'

// Tailored-CV endpoint for the job wire.
//
// Jacob's recruiter (2026-08-12): tailor the CV to every posting. At 25 postings
// a day that only works if it costs one click, so this takes a job_finds url,
// reads whatever posting text we hold, and returns a finished .docx.
//
// The posting body: job_finds.description is populated by the verifier for the
// listings it could read (roughly a third — LinkedIn and some employer sites
// block server fetches). With no body we still tailor off the title, which
// carries most of the ATS keyword weight anyway.

export const dynamic = 'force-dynamic'
export const maxDuration = 60

interface Ask { secret?: string; url?: string; title?: string; company?: string | null; description?: string | null; location?: string | null }

/** Job boards store internal codes — "Supv-Operations", "Sr Mgr, Ops". Written out
 *  before tailoring, or the profile reads "I am a Supv-Operations" (Jacob 2026-08-20). */
function tidyTitle(raw: string): string {
  let t = raw.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim()
  const swaps: [RegExp, string][] = [
    [/\bsupv\b/gi, 'Supervisor'], [/\bsuprv\b/gi, 'Supervisor'],
    [/\bmgr\b/gi, 'Manager'], [/\bmgmt\b/gi, 'Management'],
    [/\bsr\b/gi, 'Senior'], [/\bjr\b/gi, 'Junior'],
    [/\bdir\b/gi, 'Director'], [/\bassoc\b/gi, 'Associate'],
    [/\basst\b/gi, 'Assistant'], [/\bcoord\b/gi, 'Coordinator'],
    [/\bops\b/gi, 'Operations'], [/\bexec\b/gi, 'Executive'],
    [/\bspec\b/gi, 'Specialist'], [/\badmin\b/gi, 'Administration'],
  ]
  for (const [re, to] of swaps) t = t.replace(re, to)
  // Drop trailing requisition noise: "Operations Manager - HRA - 128"
  t = t.replace(/\s*[-–]\s*\d{2,}\s*$/, '').replace(/\s*\(\s*\d+\s*\)\s*$/, '')
  // Reorder "Operations, Supervisor" -> "Supervisor Operations" reads worse; leave commas.
  return t.trim()
}

async function build(ask: Ask) {
  if (!process.env.ADMIN_SECRET || ask.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let job = {
    title: String(ask.title || ''),
    company: ask.company ?? null,
    description: ask.description ?? null,
    location: ask.location ?? null,
  }

  // Prefer the stored row — it carries the description the wire's UI doesn't hold.
  const url = String(ask.url || '')
  if (url) {
    const supabase = createServiceClient()
    if (supabase) {
      const { data } = await supabase
        .from('job_finds')
        .select('title, company, description, location')
        .eq('url', url)
        .maybeSingle()
      if (data) job = {
        // An explicitly passed title/company wins — the caller may have cleaned it.
        title: ask.title || data.title || job.title,
        company: ask.company ?? data.company,
        description: data.description,
        location: data.location,
      }
    }
  }

  if (!job.title) return NextResponse.json({ error: 'need a job title' }, { status: 400 })
  job.title = tidyTitle(job.title)

  const { result, fallback } = await tailor(job)
  const { fitted, dropped } = fitOnePage(result)
  const bytes = render(fitted)
  const name = filename(fitted, job.company)

  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${name.replace(/"/g, '')}"`,
      'Content-Length': String(bytes.length),
      // Read by the dashboard so it can tell him what the CV led with without
      // opening the file.
      'X-Resume-Angle': encodeURIComponent(fitted.angle),
      'X-Resume-Headline': encodeURIComponent(fitted.headline),
      'X-Resume-Pages': String(pageCount(fitted)),
      'X-Resume-Dropped': String(dropped.length),
      'X-Resume-Tailored': fallback ? 'no' : 'yes',
      'X-Resume-Body': job.description ? 'full' : 'title-only',
    },
  })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  return build({
    secret: body?.secret,
    url: body?.url,
    title: body?.title,
    company: body?.company,
    description: body?.description,
    location: body?.location,
  })
}

/** GET so the button can be a plain link. An installed PWA will not save a
 *  blob created by script, but it always handles a normal download navigation
 *  (Jacob: "the cvs seem to be going nowhere", 2026-08-18). */
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams
  return build({
    secret: q.get('secret') ?? undefined,
    url: q.get('url') ?? undefined,
    title: q.get('title') ?? undefined,
    company: q.get('company'),
  })
}
