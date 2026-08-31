import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { getLivePriceData } from '@/lib/btc-price'
import { Shell, Panel, Tile, DonutChart, checkAdmin, fetchPostiz, fetchHeygenQuota, denverDate, denverTime } from '../ui'

// POSTS — everything about the content machine on one page: today's schedule,
// pipeline health, the full queue, and every banked script.

// Installable phone app: standalone display, home-screen icon, and a manifest
// whose start_url carries the secret so the app opens straight into the terminal.
export async function generateMetadata({ searchParams }: { searchParams: Promise<{ secret?: string }> }): Promise<Metadata> {
  const { secret = '' } = await searchParams
  return {
    robots: { index: false, follow: false, nocache: true },
    title: 'LMC Terminal',
    manifest: secret ? `/api/admin/manifest?secret=${encodeURIComponent(secret)}` : undefined,
    appleWebApp: { capable: true, title: 'LMC Terminal', statusBarStyle: 'black-translucent' },
  }
}
export const dynamic = 'force-dynamic'

const PLATFORM_ICON: Record<string, string> = { x: '𝕏', youtube: '▶', instagram: '📷', tiktok: '♪' }

export default async function Posts({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  const supabase = createServiceClient()
  const live = await getLivePriceData()
  const feedOk = !!(live && !('error' in live))

  const today = denverDate()
  const weekEnd = new Date(Date.now() + 8 * 864e5).toISOString()
  const dayStart = new Date(Date.now() - 864e5).toISOString()

  const [cache, posts, quota] = await Promise.all([
    supabase?.from('make_content_cache').select('cache_date, source, payload').gte('cache_date', today).order('cache_date').limit(8) ?? null,
    fetchPostiz(dayStart, weekEnd),
    fetchHeygenQuota(),
  ])

  // posts === null means the Postiz fetch itself failed (bad key, API down) — that is
  // NOT an empty queue, and the dashboard must never dress one up as the other.
  const pzDown = posts === null
  const allPosts = posts ?? []
  const todayPosts = allPosts
    .filter((p) => denverDate(new Date(p.publishDate)) === today)
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate))
  const nowMs = Date.now()
  const nextPost = todayPosts.find((p) => new Date(p.publishDate).getTime() > nowMs && p.state === 'QUEUE')
  const queued = allPosts.filter((p) => p.state === 'QUEUE').length
  const countdown = nextPost
    ? (() => {
        const mins = Math.round((new Date(nextPost.publishDate).getTime() - nowMs) / 60000)
        return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
      })()
    : null

  const cacheRows = (cache?.data ?? []) as {
    cache_date: string
    source: string
    payload: { theme?: string; hook?: string; script?: string; gates?: { gate: string; pass: boolean }[] }
  }[]

  const byDay = allPosts.reduce<Record<string, typeof allPosts>>((acc, p) => {
    const d = denverDate(new Date(p.publishDate))
    ;(acc[d] = acc[d] || []).push(p)
    return acc
  }, {})

  const health: { label: string; ok: boolean }[] = [
    { label: 'DATA FEED', ok: feedOk },
    { label: 'CONTENT BANKED', ok: cacheRows.length > 0 },
    pzDown ? { label: 'POSTIZ UNREACHABLE', ok: false } : { label: 'QUEUE', ok: queued >= 4 },
    { label: 'RENDER BUDGET', ok: (quota ?? 0) >= 600 },
  ]

  return (
    <Shell secret={secret} active="posts">
      {/* Today's schedule: next-up focus + timeline strip */}
      <Panel
        accent="blue"
        title="Today's posts"
        right={<span className="text-[11px] text-neutral-500">{today} DEN</span>}
      >
        {nextPost ? (
          <div className="mb-3 flex flex-wrap items-baseline gap-3 border border-amber-400 bg-amber-50 px-3 py-2">
            <span className="text-[11px] uppercase tracking-widest text-neutral-600">Next up</span>
            <span className="text-2xl text-amber-600">{denverTime(nextPost.publishDate)} {PLATFORM_ICON[nextPost.platform] || ''} {nextPost.platform.toUpperCase()}</span>
            <span className="text-lg text-green-600">T-{countdown}</span>
            <span className="w-full truncate text-[12px] text-neutral-600 sm:w-auto sm:flex-1">{nextPost.content.split('\n')[0].slice(0, 80)}</span>
          </div>
        ) : (
          <div className={`mb-3 text-[13px] ${pzDown ? 'text-red-600' : 'text-neutral-600'}`}>
            {pzDown ? 'Postiz unreachable — today’s schedule unknown (posts may still fire; Make posts with its own key).' : todayPosts.length ? 'All of today’s posts are out.' : 'Nothing scheduled today.'}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {todayPosts.map((p) => {
            const past = new Date(p.publishDate).getTime() <= nowMs || p.state === 'PUBLISHED'
            const isNext = p.id === nextPost?.id
            return (
              <div key={p.id}
                className={`border px-2 py-1 text-[13px] ${isNext ? 'border-amber-500 text-amber-600' : past ? 'border-neutral-200 text-neutral-500' : 'border-neutral-300 text-neutral-800'}`}>
                {denverTime(p.publishDate)} {PLATFORM_ICON[p.platform] || ''} {p.platform}{past ? ' ✓' : ''}
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Health line */}
      <div className="my-3 flex flex-wrap gap-4 border border-neutral-200 bg-white px-3 py-1.5 text-[12px]">
        {health.map((h) => (
          <span key={h.label} className={h.ok ? 'text-green-600' : 'text-red-600'}>● {h.label}</span>
        ))}
        <span className="text-neutral-500">PA watchdog 6am — fixes first, emails only when needed</span>
      </div>

      {/* Pipeline numbers */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile accent="blue" label="Next post" value={nextPost ? `T-${countdown}` : todayPosts.length ? 'done ✓' : '—'} sub={nextPost ? `${denverTime(nextPost.publishDate)} ${nextPost.platform}` : undefined} />
        <Tile accent="pink" label="Posts queued" value={pzDown ? '?' : String(queued)} tone={!pzDown && queued >= 4 ? 'amber' : 'neg'} sub={pzDown ? 'Postiz unreachable — check key' : 'next 7 days'} />
        <Tile accent="rose" label="HeyGen units" value={quota !== null ? String(quota) : '—'} tone={(quota ?? 0) >= 600 ? 'amber' : (quota ?? 0) >= 300 ? 'dim' : 'neg'} sub="week burns ~300–550" />
        <Tile accent="teal" label="Content banked" value={`${cacheRows.length}d`} tone={cacheRows.length ? 'amber' : 'neg'} sub="gate-passed days ahead" />
      </div>

      {/* Queue mix + week ahead */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel accent="pink" title="Queue mix — by platform">
          <DonutChart center={pzDown ? '?' : String(queued)} data={Object.entries(
            allPosts.filter((p) => p.state === 'QUEUE').reduce<Record<string, number>>((a, p) => { a[p.platform] = (a[p.platform] || 0) + 1; return a }, {})
          ).map(([label, value]) => ({ label, value }))} />
        </Panel>
        <Panel accent="rose" title="Week ahead — banked content">
          {cacheRows.length ? (
            <div className="space-y-1">
              {cacheRows.map((c) => (
                <div key={c.cache_date} className="grid grid-cols-[70px_120px_1fr] gap-2 text-[13px]">
                  <span className="text-amber-500">{c.cache_date.slice(5)}</span>
                  <span className={c.source === 'engine' ? 'text-green-600' : 'text-yellow-600'}>{c.payload?.theme || c.source}</span>
                  <span className="truncate text-neutral-600">{c.payload?.hook}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[13px] text-red-600">Nothing banked — the 6am watchdog regenerates.</span>
          )}
        </Panel>
      </div>

      {/* Full queue, day by day */}
      <div className="mt-3">
        <Panel accent="blue" title="Queue — every scheduled post (Denver time)">
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
            <span className="text-[13px] text-red-600">{pzDown ? 'Postiz unreachable (dead POSTIZ_API_KEY or API outage) — queue unknown, not empty.' : 'Queue is empty — check Make → LMC Weekly Batch.'}</span>
          )}
        </Panel>
      </div>

      {/* Banked scripts, in full */}
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
