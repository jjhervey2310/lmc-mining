import type { Metadata } from 'next'
import Link from 'next/link'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, Tile, checkAdmin } from '../ui'

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function WebsitePage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const supabase = createServiceClient()

  const [leads, jobs] = await Promise.all([
    supabase?.from('leads').select('lead_type, source, created_at').order('created_at', { ascending: false }) ?? null,
    supabase?.from('job_finds').select('title, company, url, source, found_at').order('found_at', { ascending: false }).limit(12) ?? null,
  ])
  const rows = leads?.data ?? []
  const last7 = rows.filter((l) => Date.now() - new Date(l.created_at).getTime() < 7 * 864e5).length
  const last30 = rows.filter((l) => Date.now() - new Date(l.created_at).getTime() < 30 * 864e5).length
  const byType = rows.reduce<Record<string, number>>((a, l) => { a[l.lead_type] = (a[l.lead_type] || 0) + 1; return a }, {})
  const bySource = rows.reduce<Record<string, number>>((a, l) => { const s = l.source || 'direct'; a[s] = (a[s] || 0) + 1; return a }, {})
  // weekly buckets, oldest → newest, last 8 weeks
  const weekly = Array.from({ length: 8 }, () => 0)
  for (const l of rows) {
    const weeksAgo = Math.floor((Date.now() - new Date(l.created_at).getTime()) / (7 * 864e5))
    if (weeksAgo >= 0 && weeksAgo < 8) weekly[7 - weeksAgo]++
  }

  return (
    <Shell secret={secret} active="website" jobs={jobs?.data ?? []}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="Leads total" value={String(rows.length)} />
        <Tile label="Last 7 days" value={String(last7)} tone={last7 > 0 ? 'pos' : 'dim'} />
        <Tile label="Last 30 days" value={String(last30)} />
        <Tile label="Weekly trend" value={weekly[7] ? `+${weekly[7]}` : '0'} spark={weekly} sub="8-week bucket counts" />
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel title="By type">
          {Object.entries(byType).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[13px]"><span className="text-neutral-700">{k.replace('_', ' ')}</span><span className="text-amber-600">{v}</span></div>
          ))}
        </Panel>
        <Panel title="By source">
          {Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([k, v]) => (
            <div key={k} className="flex justify-between text-[13px]"><span className="truncate text-neutral-700">{k}</span><span className="text-amber-600">{v}</span></div>
          ))}
        </Panel>
      </div>

      <p className="mt-3 text-[12px] text-neutral-600">
        Full lead list: <Link href={`/admin/leads?secret=${secret}`} className="text-amber-600 hover:underline">/admin/leads</Link> ·
        GA4 traffic + revenue counters: phase 2.
      </p>
    </Shell>
  )
}
