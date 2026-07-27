import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, checkAdmin, fetchPostiz, denverDate, denverTime } from '../ui'

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function ContentPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const supabase = createServiceClient()
  const today = denverDate()

  const [cache, jobs, posts] = await Promise.all([
    supabase?.from('make_content_cache').select('cache_date, source, payload').gte('cache_date', today).order('cache_date').limit(8) ?? null,
    supabase?.from('job_finds').select('title, company, url, source, found_at, salary').neq('status','applied').neq('status','hidden').order('fit_score', { ascending: false }).order('found_at', { ascending: false }).limit(25) ?? null,
    fetchPostiz(new Date(Date.now() - 864e5).toISOString(), new Date(Date.now() + 8 * 864e5).toISOString()),
  ])

  const cacheRows = (cache?.data ?? []) as {
    cache_date: string
    source: string
    payload: { theme?: string; hook?: string; script?: string; gates?: { gate: string; pass: boolean; score?: number }[]; captions?: Record<string, string> }
  }[]
  const byDay = (posts ?? []).reduce<Record<string, typeof posts>>((acc, p) => {
    const d = denverDate(new Date(p.publishDate))
    ;(acc[d] = acc[d] || []).push(p)
    return acc
  }, {})

  return (
    <Shell secret={secret} active="content" jobs={jobs?.data ?? []}>
      <Panel title="Queue — every scheduled post (Denver time)">
        {Object.keys(byDay).length ? (
          <div className="space-y-2">
            {Object.entries(byDay).sort().map(([d, list]) => (
              <div key={d}>
                <div className="text-[12px] font-bold text-amber-500">{d}</div>
                {(list ?? []).sort((a, b) => a.publishDate.localeCompare(b.publishDate)).map((p) => (
                  <div key={p.id} className="grid grid-cols-[70px_90px_70px_1fr] gap-2 text-[13px]">
                    <span className="text-neutral-600">{denverTime(p.publishDate)}</span>
                    <span className="text-neutral-800">{p.platform}</span>
                    <span className={p.state === 'QUEUE' ? 'text-yellow-600' : p.state === 'PUBLISHED' ? 'text-green-600' : 'text-red-600'}>{p.state}</span>
                    <span className="truncate text-neutral-500">{p.content.split('\n')[0].slice(0, 90)}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[13px] text-red-600">Postiz unreachable or queue empty.</span>
        )}
      </Panel>

      <div className="mt-3 space-y-3">
        {cacheRows.map((c) => (
          <Panel key={c.cache_date} title={`${c.cache_date} — ${c.payload?.theme || c.source}`}
            right={<span className={`text-[11px] ${c.source === 'engine' ? 'text-green-600' : 'text-yellow-600'}`}>{c.source}{c.payload?.gates ? ` · gates ${c.payload.gates.filter((g) => g.pass).length}/${c.payload.gates.length}` : ''}</span>}>
            <div className="text-[13px] text-amber-600">{c.payload?.hook}</div>
            <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-neutral-700">{c.payload?.script}</p>
          </Panel>
        ))}
      </div>
    </Shell>
  )
}
