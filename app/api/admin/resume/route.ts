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

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!process.env.ADMIN_SECRET || body?.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let job = {
    title: String(body?.title || ''),
    company: (body?.company as string | null) ?? null,
    description: (body?.description as string | null) ?? null,
    location: (body?.location as string | null) ?? null,
  }

  // Prefer the stored row — it carries the description the wire's UI doesn't hold.
  const url = String(body?.url || '')
  if (url) {
    const supabase = createServiceClient()
    if (supabase) {
      const { data } = await supabase
        .from('job_finds')
        .select('title, company, description, location')
        .eq('url', url)
        .maybeSingle()
      if (data) job = { title: data.title || job.title, company: data.company, description: data.description, location: data.location }
    }
  }

  if (!job.title) return NextResponse.json({ error: 'need a job title' }, { status: 400 })

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
