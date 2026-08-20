import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, Tile, checkAdmin } from '../ui'
import JobWire from '../job-wire'

// JOBS — the full task-style job wire plus one-click searches. Tick = done,
// gone forever. $75k floor, Denver metro or Colorado-eligible remote only.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const supabase = createServiceClient()

  const jobs = await (supabase?.from('job_finds')
    .select('title, company, url, source, found_at, salary, posted_at')
    .gte('found_at', new Date(Date.now() - 7 * 864e5).toISOString())
    .neq('status', 'applied').neq('status', 'hidden').neq('status', 'done')
    .order('posted_at', { ascending: false, nullsFirst: false })
    .order('fit_score', { ascending: false })
    .limit(100) ?? null)

  // Salary band (Jacob 2026-08-19): $75k floor, $130k ceiling, unlisted kept.
  // Applied here as well as in the sweep so rows stored before the rule vanish too.
  const topOf = (sal?: string | null) => {
    if (!sal) return -1
    const nums = [...sal.matchAll(/\d[\d,]*/g)].map((m) => Number(m[0].replace(/,/g, '')))
    return nums.length ? Math.max(...nums) : -1
  }
  const rows = (jobs?.data ?? []).filter((j) => { const t = topOf(j.salary); return t < 0 || t <= 130_000 })
  const withSalary = rows.filter((j) => j.salary).length
  const li = (q: string) =>
    `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Denver%2C%20Colorado&f_TPR=r86400`

  return (
    <Shell secret={secret} active="jobs">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
        <Tile accent="blue" label="On the wire" value={String(rows.length)} sub="last 7 days · untucked" />
        <Tile accent="blue" label="With posted salary" value={String(withSalary)} sub="$75k floor · unlisted stays" />
        <Tile accent="blue" label="Sweep" value="6am" sub="Adzuna · broadened titles · never repeats" />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_320px]">
        <Panel accent="blue" title="💼 Job wire" right={<span className="text-[11px] text-neutral-500">Apply = opens + logs it · tick = not for me</span>}>
          <JobWire jobs={rows} secret={secret} />
        </Panel>

        <Panel accent="teal" title="One-click searches">
          <div className="text-[12px]">
            <div className="mb-1 text-[11px] uppercase tracking-widest text-neutral-600">LinkedIn · last 24h · Denver</div>
            {['bitcoin', 'crypto', 'operations manager', 'data center operations', 'general manager'].map((q) => (
              <a key={q} href={li(q)} target="_blank" rel="noreferrer" className="mr-3 text-amber-600 hover:underline">{q}</a>
            ))}
            <div className="mb-1 mt-3 text-[11px] uppercase tracking-widest text-neutral-600">Indeed · last 24h · Denver</div>
            {['bitcoin', 'crypto', 'operations manager', 'general manager', 'chief of staff'].map((q) => (
              <a key={q} href={`https://www.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Denver%2C+CO&fromage=1`} target="_blank" rel="noreferrer" className="mr-3 text-amber-600 hover:underline">{q}</a>
            ))}
            <div className="mb-1 mt-3 text-[11px] uppercase tracking-widest text-neutral-600">Built In Colorado</div>
            {[['operations', 'https://www.builtincolorado.com/jobs/operations'], ['sales', 'https://www.builtincolorado.com/jobs/sales'], ['all Denver', 'https://www.builtincolorado.com/jobs']].map(([label, href]) => (
              <a key={label} href={href} target="_blank" rel="noreferrer" className="mr-3 text-amber-600 hover:underline">{label}</a>
            ))}
            <div className="mt-3 border-t border-neutral-200 pt-2 text-[11px] text-neutral-500">
              Wire rules: Denver metro or Colorado-eligible remote · $75k posted-salary floor (unlisted kept) ·
              jobs persist 7 days or until you act on them · applied and dismissed jobs never return · every listing is re-read twice daily and dropped if it closes, ages past 14 days, or stops fitting.
            </div>
          </div>
        </Panel>
      </div>
    </Shell>
  )
}
