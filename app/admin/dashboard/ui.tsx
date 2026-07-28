// Shared terminal UI + data helpers for the /admin/dashboard mission control.
// Bloomberg style: dense black grid, amber text, green/red reserved for up/down.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import ChatWindow from './chat'

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
  const pts = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p - min) / span) * (h - 6) - 3])
  const xy = pts.map(([x, y]) => `${x},${y}`)
  const up = points[points.length - 1] >= points[0]
  const c = up ? '#22c55e' : '#ef4444'
  const gid = `g${Math.abs(points[0] * 7919 + points.length) | 0}${w}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="block">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={c} stopOpacity="0.35" />
          <stop offset="100%" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={`0,${h} ${xy.join(' ')} ${w},${h}`} fill={`url(#${gid})`} />
      <polyline points={xy.join(' ')} fill="none" stroke={c} strokeWidth="1.5" />
    </svg>
  )
}

export function Tile({
  label, value, tone = 'amber', sub, spark, prev, changePct,
}: {
  label: string
  value: string
  tone?: 'amber' | 'pos' | 'neg' | 'dim'
  sub?: string
  spark?: number[]
  prev?: string
  changePct?: number
}) {
  const color = tone === 'pos' ? 'text-green-600' : tone === 'neg' ? 'text-red-600' : tone === 'dim' ? 'text-neutral-700' : 'text-amber-500'
  const up = (changePct ?? 0) >= 0
  return (
    <div className="rounded-lg border border-neutral-200 border-t-4 border-t-amber-500 bg-white px-3 py-2 shadow-sm">
      <div className="text-[11px] uppercase tracking-widest text-neutral-600">{label}</div>
      <div className={`font-mono text-2xl leading-tight ${color}`}>{value}</div>
      {(prev !== undefined || changePct !== undefined) && (
        <div className="mt-0.5 flex gap-3 text-[11px] text-neutral-600">
          {prev !== undefined && <span>prev {prev}</span>}
          {changePct !== undefined && (
            <span className={up ? 'text-green-600' : 'text-red-600'}>{up ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}%</span>
          )}
        </div>
      )}
      {sub && <div className="text-[12px] text-neutral-600">{sub}</div>}
      {spark && spark.length > 1 && <div className="mt-1"><Spark points={spark} /></div>}
    </div>
  )
}

const DONUT_COLORS = ['#f59e0b', '#3b82f6', '#22c55e', '#a855f7', '#ef4444', '#14b8a6', '#eab308']

export function Legend({ data }: { data: { label: string; value: number }[] }) {
  return (
    <div className="space-y-1 text-[12px]">
      {data.map((d, i) => (
        <div key={d.label} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2" style={{ background: DONUT_COLORS[i % DONUT_COLORS.length] }} />
          <span className="text-neutral-700">{d.label}</span>
          <span className="ml-auto text-amber-600">{d.value}</span>
        </div>
      ))}
    </div>
  )
}

export function DonutChart({ data, size = 110, center }: { data: { label: string; value: number }[]; size?: number; center?: string }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <div className="text-[12px] text-neutral-500">no data</div>
  const r = size / 2 - 8
  const c = 2 * Math.PI * r
  let acc = 0
  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {data.map((d, i) => {
          const frac = d.value / total
          const off = acc
          acc += frac
          return (
            <circle key={d.label} cx={size / 2} cy={size / 2} r={r} fill="none"
              stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth="12"
              strokeDasharray={`${c * frac - 2} ${c}`} strokeDashoffset={-c * off}
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
          )
        })}
        {center && <text x={size / 2} y={size / 2 + 4} textAnchor="middle" fill="#f59e0b" fontSize="16" fontFamily="monospace" fontWeight="bold">{center}</text>}
      </svg>
      <Legend data={data} />
    </div>
  )
}

export function Panel({ title, children, right }: { title: string; children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-neutral-200 bg-white shadow-sm">
      <div className="flex items-baseline justify-between border-b border-neutral-200 px-3 py-1.5">
        <span className="text-[12px] font-bold uppercase tracking-widest text-amber-500">{title}</span>
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
  jobs: { title: string; company: string | null; url: string; source: string; found_at: string; salary?: string | null; posted_at?: string | null }[]
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
    <div className="min-h-screen bg-slate-100 font-sans text-neutral-800">
      {/* The terminal is full-screen: hide the public site chrome (ticker, navbar, footer, banners). */}
      <style>{`body > :not(#main) { display: none !important; } #main { padding-bottom: 0 !important; }`}</style>
      <div className="mx-auto max-w-[1400px] px-3 py-2">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-amber-500/40 pb-2">
          <div className="flex items-baseline gap-4">
            <span className="text-sm font-bold text-amber-500">⚡ LMC TERMINAL</span>
            <nav className="flex gap-3 text-[12px]">
              {tabs.map((t) => (
                <Link key={t.id} href={t.href}
                  className={t.id === active ? 'text-amber-600 underline underline-offset-4' : 'text-neutral-600 hover:text-amber-700'}>
                  {t.label}
                </Link>
              ))}
            </nav>
          </div>
          <span className="text-[11px] text-neutral-500">
            {new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} DEN · refresh 5m
          </span>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-neutral-100 py-1.5 text-[11px] uppercase tracking-wider">
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
            <a key={label} href={href} target="_blank" rel="noreferrer" className="text-neutral-600 hover:text-amber-700">↗ {label}</a>
          ))}
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_290px]">
          <div className="min-w-0">{children}</div>

          <aside className="space-y-3 lg:sticky lg:top-2 lg:self-start">
            <Panel title="🤖 PA — ask me anything">
              <ChatWindow secret={secret} />
            </Panel>
            <Panel title="💼 Job wire" right={<span className="text-[11px] text-neutral-500">today only · 6am sweep</span>}>
              {jobs.length ? (
                <div className="space-y-2">
                  {jobs.slice(0, 12).map((j) => (
                    <a key={j.url} href={j.url} target="_blank" rel="noreferrer" className="block border-l-2 border-amber-500/60 pl-2 hover:bg-amber-50">
                      <div className="text-[13px] leading-snug text-amber-700 underline decoration-amber-300 underline-offset-2 hover:text-amber-800">{j.title} ↗</div>
                      <div className="text-[11px] text-neutral-600">
                        {j.company || '—'}{j.salary ? ` · ${j.salary}` : ''} · posted {(j.posted_at || j.found_at).slice(5, 10)}
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <div className="text-[12px] text-neutral-600">No new postings yet today — the 6am sweep only shows jobs posted in the last day, and yesterday&apos;s list clears automatically.</div>
              )}
              <div className="mt-3 border-t border-neutral-200 pt-2 text-[12px]">
                <div className="mb-1 text-[11px] uppercase tracking-widest text-neutral-600">LinkedIn · last 24h · Denver</div>
                {['bitcoin', 'crypto', 'operations manager', 'data center operations'].map((q) => (
                  <a key={q} href={li(q)} target="_blank" rel="noreferrer" className="mr-3 text-amber-600 hover:underline">{q}</a>
                ))}
                <div className="mb-1 mt-2 text-[11px] uppercase tracking-widest text-neutral-600">Indeed · last 24h · Denver</div>
                {['bitcoin', 'crypto', 'operations manager', 'general manager'].map((q) => (
                  <a key={q} href={`https://www.indeed.com/jobs?q=${encodeURIComponent(q)}&l=Denver%2C+CO&fromage=1`} target="_blank" rel="noreferrer" className="mr-3 text-amber-600 hover:underline">{q}</a>
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
