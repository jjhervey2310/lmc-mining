// Shared terminal UI + data helpers for the /admin/dashboard mission control.
// Bloomberg style: dense black grid, amber text, green/red reserved for up/down.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import MarketTicker from './ticker'
import ChatFab from './chat-fab'
import ThemeToggle from './theme-toggle'

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

// Section accents — full literal class strings (Tailwind can't see computed names).
// Each section owns a colour: tinted header, gradient tile body, coloured border,
// and in dark mode a soft pastel-on-black treatment with a matching under-glow.
export type Accent = 'amber' | 'blue' | 'green' | 'purple' | 'pink' | 'teal' | 'cyan' | 'rose'
const ACCENT: Record<Accent, { border: string; text: string; head: string; tile: string; glow: string }> = {
  amber: { border: 'border-t-amber-500 dark:border-t-amber-400', text: 'text-amber-600 dark:text-amber-300', head: 'bg-amber-100 dark:bg-amber-400/10', tile: 'from-amber-50 dark:from-amber-400/10', glow: 'rgb(251 191 36 / .45)' },
  blue: { border: 'border-t-blue-500 dark:border-t-sky-400', text: 'text-blue-700 dark:text-sky-300', head: 'bg-blue-100 dark:bg-sky-400/10', tile: 'from-blue-50 dark:from-sky-400/10', glow: 'rgb(56 189 248 / .45)' },
  green: { border: 'border-t-green-500 dark:border-t-emerald-400', text: 'text-green-700 dark:text-emerald-300', head: 'bg-green-100 dark:bg-emerald-400/10', tile: 'from-green-50 dark:from-emerald-400/10', glow: 'rgb(52 211 153 / .45)' },
  purple: { border: 'border-t-purple-500 dark:border-t-violet-400', text: 'text-purple-700 dark:text-violet-300', head: 'bg-purple-100 dark:bg-violet-400/10', tile: 'from-purple-50 dark:from-violet-400/10', glow: 'rgb(167 139 250 / .5)' },
  pink: { border: 'border-t-pink-500 dark:border-t-pink-400', text: 'text-pink-700 dark:text-pink-300', head: 'bg-pink-100 dark:bg-pink-400/10', tile: 'from-pink-50 dark:from-pink-400/10', glow: 'rgb(244 114 182 / .45)' },
  teal: { border: 'border-t-teal-500 dark:border-t-teal-300', text: 'text-teal-700 dark:text-teal-200', head: 'bg-teal-100 dark:bg-teal-300/10', tile: 'from-teal-50 dark:from-teal-300/10', glow: 'rgb(94 234 212 / .45)' },
  cyan: { border: 'border-t-cyan-500 dark:border-t-cyan-300', text: 'text-cyan-700 dark:text-cyan-200', head: 'bg-cyan-100 dark:bg-cyan-300/10', tile: 'from-cyan-50 dark:from-cyan-300/10', glow: 'rgb(103 232 249 / .45)' },
  rose: { border: 'border-t-rose-500 dark:border-t-rose-300', text: 'text-rose-700 dark:text-rose-200', head: 'bg-rose-100 dark:bg-rose-300/10', tile: 'from-rose-50 dark:from-rose-300/10', glow: 'rgb(253 164 175 / .45)' },
}

export function Tile({
  label, value, tone = 'amber', sub, spark, prev, changePct, accent = 'amber', i = 0,
}: {
  label: string
  value: string
  tone?: 'amber' | 'pos' | 'neg' | 'dim'
  sub?: string
  spark?: number[]
  prev?: string
  changePct?: number
  accent?: Accent
  /** stagger index — tiles fade in one after another */
  i?: number
}) {
  const color = tone === 'pos' ? 'text-green-600 dark:text-emerald-300'
    : tone === 'neg' ? 'text-red-600 dark:text-rose-300'
    : tone === 'dim' ? 'text-neutral-700 dark:text-neutral-300'
    : ACCENT[accent].text
  const up = (changePct ?? 0) >= 0
  return (
    <div
      style={{ ['--lmc-glow' as string]: ACCENT[accent].glow, ['--lmc-i' as string]: i }}
      className={`lmc-card lmc-lift lmc-rise rounded-xl border border-neutral-200 border-t-4 ${ACCENT[accent].border} bg-gradient-to-b ${ACCENT[accent].tile} to-white px-3 py-2 dark:border-white/10 dark:to-neutral-900/60`}
    >
      <div className="text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">{label}</div>
      <div className={`lmc-figure font-mono text-2xl font-bold leading-tight ${color}`}>{value}</div>
      {(prev !== undefined || changePct !== undefined) && (
        <div className="mt-0.5 flex gap-3 text-[11px] text-neutral-600 dark:text-neutral-400">
          {prev !== undefined && <span>prev {prev}</span>}
          {changePct !== undefined && (
            <span className={up ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}>{up ? '▲' : '▼'} {Math.abs(changePct).toFixed(1)}%</span>
          )}
        </div>
      )}
      {sub && <div className="text-[12px] text-neutral-600 dark:text-neutral-400">{sub}</div>}
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

export function Panel({ title, children, right, accent = 'amber' }: { title: string; children: React.ReactNode; right?: React.ReactNode; accent?: Accent }) {
  return (
    <div
      style={{ ['--lmc-glow' as string]: ACCENT[accent].glow }}
      className={`lmc-lift lmc-rise rounded-xl border border-neutral-200 border-t-4 ${ACCENT[accent].border} bg-white dark:border-white/10 dark:bg-neutral-900/70`}
    >
      <div className={`flex items-baseline justify-between rounded-t-[8px] border-b border-neutral-200 ${ACCENT[accent].head} px-3 py-1.5 dark:border-white/10`}>
        <span className={`text-[12px] font-bold uppercase tracking-widest ${ACCENT[accent].text}`}>{title}</span>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

export function Shell({
  secret, active, children,
}: {
  secret: string
  active: 'posts' | 'mining' | 'trading' | 'jobs' | 'website' | 'videos'
  children: React.ReactNode
}) {
  const tabs = [
    { id: 'posts', label: 'POSTS', href: `/admin/dashboard?secret=${secret}` },
    { id: 'mining', label: 'MINE SIM', href: `/admin/dashboard/mining?secret=${secret}` },
    { id: 'trading', label: 'TRADING', href: `/admin/dashboard/trading?secret=${secret}` },
    { id: 'jobs', label: 'JOBS', href: `/admin/dashboard/jobs?secret=${secret}` },
    { id: 'website', label: 'WEBSITE', href: `/admin/dashboard/website?secret=${secret}` },
    { id: 'videos', label: 'VIDEOS', href: `/admin/dashboard/videos?secret=${secret}` },
  ]
  return (
    <div className="lmc-scene min-h-screen bg-slate-100 font-sans text-neutral-800 transition-colors duration-500 dark:bg-[#07070b] dark:text-neutral-200">
      {/* The terminal is full-screen: hide the public site chrome (ticker, navbar, footer, banners). */}
      <style>{`body > :not(#main) { display: none !important; } #main { padding-bottom: 0 !important; }`}</style>
      {/* Ambient depth: two soft colour pools behind the cards (dark mode only). */}
      <div aria-hidden className="pointer-events-none fixed inset-0 hidden dark:block">
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-violet-600/10 blur-3xl" />
        <div className="absolute -bottom-52 -right-40 h-[34rem] w-[34rem] rounded-full bg-sky-500/10 blur-3xl" />
      </div>
      <MarketTicker />
      <div className="relative mx-auto max-w-[1400px] px-3 py-2">
        {/* Header: on a phone the wordmark/clock sit on one line and the tabs get
            their own full-width row that scrolls sideways — squeezing them beside
            the wordmark clipped VIDEOS off the screen entirely (Jacob 2026-08-06). */}
        <div className="border-b border-amber-500/40 pb-2 dark:border-amber-400/25">
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap text-sm font-bold text-amber-500 dark:text-amber-300">⚡ LMC TERMINAL</span>
            <span className="flex shrink-0 items-center gap-2 text-[11px] text-neutral-500 dark:text-neutral-400">
              <span className="lmc-pulse inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
              <span className="hidden sm:inline">{new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })} DEN · refresh 5m</span>
              <span className="sm:hidden">{denverTime(new Date().toISOString())}</span>
              <ThemeToggle />
            </span>
          </div>
          <nav className="-mx-3 mt-1.5 flex gap-4 overflow-x-auto px-3 pb-0.5 text-[13px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {tabs.map((t) => (
              <Link key={t.id} href={t.href}
                className={`whitespace-nowrap ${t.id === active
                  ? 'font-bold text-amber-600 underline underline-offset-4 dark:text-amber-300'
                  : 'text-neutral-600 transition-colors hover:text-amber-700 dark:text-neutral-400 dark:hover:text-amber-300'}`}>
                {t.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 border-b border-neutral-100 py-1.5 text-[11px] uppercase tracking-wider dark:border-white/5">
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
            <a key={label} href={href} target="_blank" rel="noreferrer" className="text-neutral-600 transition-colors hover:text-amber-700 dark:text-neutral-500 dark:hover:text-amber-300">↗ {label}</a>
          ))}
        </div>

        <div className="mt-3">{children}</div>
      </div>
      {/* PA lives in the corner of every page — click the bubble to pop it open */}
      <ChatFab secret={secret} />
      <meta httpEquiv="refresh" content="300" />
    </div>
  )
}
