import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers } from '@/lib/daily-content'
import { Shell, Panel, Tile, DonutChart, checkAdmin, fetchPostiz, fetchHeygenQuota, denverDate, denverTime, usd } from './ui'

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

const PLATFORM_ICON: Record<string, string> = { x: '𝕏', youtube: '▶', instagram: '📷', tiktok: '♪' }

export default async function Overview({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  const supabase = createServiceClient()
  const live = await getLivePriceData()
  const n = live && !('error' in live) ? computeDailyNumbers(live.price, live.difficulty) : null

  const today = denverDate()
  const weekEnd = new Date(Date.now() + 8 * 864e5).toISOString()
  const dayStart = new Date(Date.now() - 864e5).toISOString()

  const [snapshots, leads, cache, jobs, posts, quota] = await Promise.all([
    supabase?.from('hashprice_snapshots').select('snapshot_date, btc_price').order('snapshot_date', { ascending: false }).limit(14) ?? null,
    supabase?.from('leads').select('lead_type, created_at') ?? null,
    supabase?.from('make_content_cache').select('cache_date, source, payload').gte('cache_date', today).order('cache_date').limit(8) ?? null,
    supabase?.from('job_finds').select('title, company, url, source, found_at, salary').neq('status','applied').neq('status','hidden').order('fit_score', { ascending: false }).order('found_at', { ascending: false }).limit(25) ?? null,
    fetchPostiz(dayStart, weekEnd),
    fetchHeygenQuota(),
  ])

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

  const leadRows = leads?.data ?? []
  const leads7d = leadRows.filter((l) => Date.now() - new Date(l.created_at).getTime() < 7 * 864e5).length
  const leadsPrev7d = leadRows.filter((l) => {
    const age = Date.now() - new Date(l.created_at).getTime()
    return age >= 7 * 864e5 && age < 14 * 864e5
  }).length
  const btcSeries = (snapshots?.data ?? []).map((r) => Number(r.btc_price)).reverse()
  const cacheRows = (cache?.data ?? []) as { cache_date: string; source: string; payload: { theme?: string; hook?: string } }[]

  const health: { label: string; ok: boolean }[] = [
    { label: 'DATA FEED', ok: !!n },
    { label: 'CONTENT BANKED', ok: cacheRows.length > 0 },
    { label: 'QUEUE', ok: queued >= 4 },
    { label: 'RENDER BUDGET', ok: (quota ?? 0) >= 600 },
  ]

  return (
    <Shell secret={secret} active="overview" jobs={jobs?.data ?? []}>
      {/* Today's schedule: next-up focus + timeline strip */}
      <Panel
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
          <div className="mb-3 text-[13px] text-neutral-600">
            {todayPosts.length ? 'All of today’s posts are out.' : 'Nothing scheduled today — check the CONTENT tab.'}
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

      {/* Big numbers + deltas + sparklines */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="BTC" value={n ? `$${usd(n.btcPrice, 0)}` : '—'} spark={btcSeries}
          prev={btcSeries.length > 1 ? `$${usd(btcSeries[btcSeries.length - 2], 0)}` : undefined}
          changePct={n && btcSeries.length > 1 ? ((n.btcPrice - btcSeries[btcSeries.length - 2]) / btcSeries[btcSeries.length - 2]) * 100 : undefined} />
        <Tile label="Hashprice $/TH/d" value={n ? `$${usd(n.hashpricePerThDay, 4)}` : '—'} />
        <Tile label="S21 XP net/day" value={n ? `${n.profitable ? '+' : '-'}$${usd(Math.abs(n.s21NetDay))}` : '—'} tone={n?.profitable ? 'pos' : 'neg'} sub={n ? `breakeven $${usd(n.breakevenBtcPrice, 0)} · Abundant Mines $225/mo flat` : undefined} />
        <Tile label="Difficulty" value={n ? `${(n.difficulty / 1e12).toFixed(1)}T` : '—'} />
        <Tile label="Leads 7d" value={String(leads7d)} tone={leads7d >= leadsPrev7d ? 'pos' : 'neg'} prev={String(leadsPrev7d)}
          changePct={leadsPrev7d ? ((leads7d - leadsPrev7d) / leadsPrev7d) * 100 : undefined} sub={`total ${leadRows.length}`} />
        <Tile label="Posts queued" value={String(queued)} tone={queued >= 4 ? 'amber' : 'neg'} sub="next 7 days" />
        <Tile label="HeyGen units" value={quota !== null ? String(quota) : '—'} tone={(quota ?? 0) >= 600 ? 'amber' : (quota ?? 0) >= 300 ? 'dim' : 'neg'} sub="week burns ~300–550" />
        <Tile label="Content banked" value={`${cacheRows.length}d`} tone={cacheRows.length ? 'amber' : 'neg'} sub="gate-passed days ahead" />
      </div>

      {/* Proportions */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel title="Queue mix — by platform">
          <DonutChart center={String(queued)} data={Object.entries(
            allPosts.filter((p) => p.state === 'QUEUE').reduce<Record<string, number>>((a, p) => { a[p.platform] = (a[p.platform] || 0) + 1; return a }, {})
          ).map(([label, value]) => ({ label, value }))} />
        </Panel>
        <Panel title="Leads — by type">
          <DonutChart center={String(leadRows.length)} data={Object.entries(
            leadRows.reduce<Record<string, number>>((a, l) => { const t = (l as { lead_type?: string }).lead_type || '?'; a[t] = (a[t] || 0) + 1; return a }, {})
          ).map(([label, value]) => ({ label: label.replace('_', ' '), value }))} />
        </Panel>
      </div>

      {/* 18-rig fleet simulation (Jacob's fleet plan) */}
      <div className="mt-3">
        <Panel title="⛏ 18-rig fleet P&L — simulated" right={<span className="text-[11px] text-neutral-500">live price+difficulty · Abundant Mines $225/mo per rig</span>}>
          {n ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Tile label="Gross/day" value={`$${usd(18 * n.s21GrossDay)}`} />
              <Tile label="Hosting/day" value={`$${usd(18 * 7.5)}`} sub="$4,050/mo" />
              <Tile label="Net/day" value={`${18 * n.s21NetDay >= 0 ? '+' : '-'}$${usd(Math.abs(18 * n.s21NetDay))}`} tone={18 * n.s21NetDay >= 0 ? 'pos' : 'neg'} />
              <Tile label="Net/month" value={`${18 * n.s21NetDay >= 0 ? '+' : '-'}$${usd(Math.abs(18 * n.s21NetDay * 30), 0)}`} tone={18 * n.s21NetDay >= 0 ? 'pos' : 'neg'} />
              <Tile label="Net/year" value={`${18 * n.s21NetDay >= 0 ? '+' : '-'}$${usd(Math.abs(18 * n.s21NetDay * 365), 0)}`} tone={18 * n.s21NetDay >= 0 ? 'pos' : 'neg'} sub="difficulty drift not modeled" />
            </div>
          ) : <span className="text-[13px] text-red-600">Live data unavailable</span>}
        </Panel>
      </div>

      {/* Week strip */}
      <div className="mt-3">
        <Panel title="Week ahead — banked content">
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
            <span className="text-[13px] text-red-600">Nothing banked — the 6am watchdog regenerates; see CONTENT tab.</span>
          )}
        </Panel>
      </div>
    </Shell>
  )
}
