// Shared terminal UI + data helpers for the /admin/dashboard mission control.
// Bloomberg style: dense black grid, amber text, green/red reserved for up/down.

import Link from 'next/link'
import { notFound } from 'next/navigation'

export const AMBER = '#f59e0b'

export function checkAdmin(secret?: string) {
  // Fail closed: no configured secret means no access, not open access.
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) notFound()
}

// ── data helpers ──

export interface PzPost {
  id: string
  content: string
  publishDate: string
  state: string
  platform: string
}

export async function fetchPostiz(startISO: string, endISO: string): Promise<PzPost[] | null> {
  const key = process.env.POSTIZ_API_KEY
  if (!key) return null
  try {
    const res = await fetch(`https://api.postiz.com/public/v1/posts?startDate=${startISO}&endDate=${endISO}`, {
      headers: { Authorization: key },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (((await res.json()).posts || []) as {
      id: string; content?: string; publishDate: string; state: string
      integration?: { providerIdentifier?: string }
    }[]).map((p) => ({
      id: p.id,
      content: p.content || '',
      publishDate: p.publishDate,
      state: p.state,
      platform: (p.integration?.providerIdentifier || '?').replace('-standalone', ''),
    }))
  } catch {
    return null
  }
}

export async function fetchHeygenQuota(): Promise<number | null> {
  const key = process.env.HEYGEN_API_KEY
  if (!key) return null
  try {
    const res = await fetch('https://api.heygen.com/v2/user/remaining_quota', {
      headers: { 'x-api-key': key },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return (await res.json()).data?.remaining_quota ?? null
  } catch {
    return null
  }
}

export const denverDate = (d = new Date()) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(d)

export const denverTime = (iso: string) =>
  new Date(iso).toLocaleTimeString('en-US', { timeZone: 'America/Denver', hour: 'numeric', minute: '2-digit' })

export const usd = (n: number, d = 2) =>
  n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })

// ── components ──

export function Spark({ points, w = 120, h = 34 }: { points: number[]; w?: number; h?: number }) {
  if (points.length < 2) return <div style={{ height: h }} />
  const min = Math.min(...points)
  const max = Math.max(...points)
  const span = max - min || 1
  const xy = points.map((p, i) => `${(i / (points.length - 1)) * w},${h - ((p - min) / span) * (h - 6) - 3}`)
  const up = points[points.length - 1] >= points[0]
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <polyline points={xy.join(' ')} fill="none" stroke={up ? '#22c55e' : '#ef4444'} strokeWidth="1.5" />
    </svg>
  )
}

export function Tile({
  label, value, tone = 'amber', sub, spark,
}: {
  label: string
  value: string
  tone?: 'amber' | 'pos' | 'neg' | 'dim'
  sub?: string
  spark?: number[]
}) {
  const color = tone === 'pos' ? 'text-green-500' : tone === 'neg' ? 'text-red-500' : tone === 'dim' ? 'text-neutral-400' : 'text-amber-500'
  return (
    <div className="border border-neutral-800 bg-black px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-neutral-500">{label}</div>
      <div className={`font-mono text-2xl leading-tight ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-neutral-500">{sub}</div>}
      {spark && spark.length > 1 && <div className="mt-1"><Spark points={spark} /></div>}
    </div>
  )
}

export function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="border border-neutral-800 bg-black">
      <div className="flex items-baseline justify-between border-b border-neutral-800 px-3 py-1.5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-amber-500">{title}</span>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

export function Shell({
  secret, active, jobs, children,
}: {
  secret: string
  active: 'overview' | 'content' | 'mining' | 'website' | 'videos'
  jobs: { title: string; company: string | null; url: string; source: string; found_at: string }[]
  children: React.ReactNode
}) {
  const tabs = [
    { id: 'overview', label: 'OVERVIEW', href: `/admin/dashboard?secret=${secret}` },
    { id: 'content', label: 'CONTENT', href: `/admin/dashboard/content?secret=${secret}` },
    { id: 'mining', label: 'MINING', href: `/admin/dashboard/mining?secret=${secret}` },
    { id: 'website', label: 'WEBSITE', href: `/admin/dashboard/website?secret=${secret}` },
    { id: 'videos', label: 'VIDEOS', href: `/admin/dashboard/videos?secret=${secret}` },
  ]
  const li = (q: string) =>
    `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(q)}&location=Denver%2C%20Colorado&f_TPR=r86400`
  return (
    <div className="min-h-screen bg-black font-mono text-neutral-300">
      {/* The terminal is full-screen: hide the public site chrome (ticker, navbar, footer, banners). */}
      <style>{`body > :not(#main) { display: none !important; } #main { padding-bottom: 0 !important; }`}</style>
      <div className="mx-auto max-w-[1400px] px-3 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-500/40 pb-2">
          <div className="flex items-baseline gap-4">
            <span className="text-sm font-bold text-amber-500">⚡ LMC TERMINAL</span>
            <nav className="flex gap-3 text-[11px]">
              {tabs.map((t) => (
                <Link key={t.id} href={t.href}
                  className={t.id === active ? 'text-amber-400 underline underline-offset-4' : 'text-neutral-500 hover:text-amber-400'}>
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
          <span className="text-[10px] text-neutral-600">
            {new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} DEN · refresh 5m
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-neutral-900 py-1.5 text-[10px] uppercase tracking-wider">
          {[
            ['Gmail', 'https://mail.google.com'],
            ['Calendar', 'https://calendar.google.com'],
            ['Postiz', 'https://platform.postiz.com'],
            ['Make', 'https://eu1.make.com'],
            ['HeyGen', 'https://app.heygen.com'],
            ['YT Studio', 'https://studio.youtube.com'],
            ['LinkedIn Jobs', 'https://www.linkedin.com/jobs/'],
            ['Vercel', 'https://vercel.com'],
            ['Supabase', 'https://supabase.com/dashboard'],
            ['Stripe', 'https://dashboard.stripe.com'],
          ].map(([label, href]) => (
            <a key={label} href={href} target="_blank" rel="noreferrer" className="text-neutral-500 hover:text-amber-400">↗ {label}</a>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_290px]">
          <div className="min-w-0">{children}</div>

          <aside className="lg:sticky lg:top-2 lg:self-start">
            <Panel title="💼 Job wire" right={<span className="text-[10px] text-neutral-600">6am sweep</span>}>
              {jobs.length ? (
                <div className="space-y-2">
                  {jobs.slice(0, 12).map((j) => (
                    <a key={j.url} href={j.url} target="_blank" rel="noreferrer" className="block border-l-2 border-amber-500/60 pl-2 hover:bg-neutral-900">
                      <div className="text-[12px] leading-snug text-neutral-200">{j.title}</div>
                      <div className="text-[10px] text-neutral-500">
                        {j.company || '—'} · {j.source} · {j.found_at.slice(5, 10)}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-[11px] text-neutral-500">No matches banked yet — first sweep runs 6am.</div>
              )}
              <div className="mt-3 border-t border-neutral-800 pt-2 text-[11px]">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-neutral-500">LinkedIn · last 24h · Denver</div>
                {['bitcoin', 'crypto', 'data center operations'].map((q) => (
                  <a key={q} href={li(q)} target="_blank" rel="noreferrer" className="mr-3 text-amber-400 hover:underline">{q}</a>
                ))}
              </div>
            </Panel>
          </aside>
        </div>
      </div>
      <meta httpEquiv="refresh" content="300" />
    </div>
  )
}
