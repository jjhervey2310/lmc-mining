import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, Tile, checkAdmin } from '../ui'

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function VideosPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const supabase = createServiceClient()

  const [metrics, lessons, jobs] = await Promise.all([
    supabase?.from('video_metrics').select('platform, video_ref, title, published_at, views, likes, comments, captured_at').order('captured_at', { ascending: false }).limit(60) ?? null,
    supabase?.from('content_lessons').select('lesson, rationale, created_at').eq('active', true).order('created_at', { ascending: false }) ?? null,
    supabase?.from('job_finds').select('title, company, url, source, found_at').order('found_at', { ascending: false }).limit(12) ?? null,
  ])

  // newest snapshot per video
  const latest = new Map<string, NonNullable<typeof metrics>['data'] extends (infer T)[] | null ? T : never>()
  for (const m of metrics?.data ?? []) if (!latest.has(m.video_ref)) latest.set(m.video_ref, m)
  const vids = [...latest.values()].sort((a, b) => Number(b.views) - Number(a.views))
  const totalViews = vids.reduce((s, v) => s + Number(v.views), 0)

  return (
    <Shell secret={secret} active="videos" jobs={jobs?.data ?? []}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Videos tracked" value={String(vids.length)} sub="YouTube · weekly snapshot" />
        <Tile label="Total views" value={String(totalViews)} />
        <Tile label="Best video" value={String(vids[0]?.views ?? 0)} sub={vids[0]?.title?.slice(0, 30)} />
        <Tile label="Active lessons" value={String((lessons?.data ?? []).length)} sub="feeding every script" />
      </div>

      <div className="mt-3">
        <Panel title="Per-video (latest snapshot, Sundays 8pm)">
          <table className="w-full text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-widest text-neutral-500"><th>published</th><th>title</th><th className="text-right">views</th><th className="text-right">likes</th><th className="text-right">comments</th></tr></thead>
            <tbody>
              {vids.map((v) => (
                <tr key={v.video_ref} className="border-t border-neutral-100">
                  <td className="py-0.5 text-neutral-600">{(v.published_at || '').slice(0, 10)}</td>
                  <td className="max-w-[380px] truncate pr-2">
                    <a href={`https://youtube.com/watch?v=${v.video_ref}`} target="_blank" rel="noreferrer" className="text-neutral-800 hover:text-amber-700">{v.title}</a>
                  </td>
                  <td className="text-right text-amber-600">{v.views}</td>
                  <td className="text-right text-neutral-700">{v.likes}</td>
                  <td className="text-right text-neutral-700">{v.comments}</td>
                </tr>
              ))}
              {!vids.length && <tr><td colSpan={5} className="py-2 text-neutral-600">First snapshot lands Sunday 8pm.</td></tr>}
            </tbody>
          </table>
        </Panel>
      </div>

      {(lessons?.data ?? []).length > 0 && (
        <div className="mt-3">
          <Panel title="Lessons learned (dual-model confirmed)">
            {(lessons?.data ?? []).map((l) => (
              <div key={l.lesson} className="mb-2 text-[13px]">
                <div className="text-amber-600">{l.lesson}</div>
                <div className="text-neutral-600">{l.rationale}</div>
              </div>
            ))}
          </Panel>
        </div>
      )}
    </Shell>
  )
}
