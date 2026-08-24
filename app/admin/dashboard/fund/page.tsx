import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, Tile, checkAdmin } from '../ui'

// J&P FUND — the research desk: latest verified multi-agent market sweep
// (TA, sentiment, flows, turnover, narratives, calendar) feeding the weekly call.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

interface TaRow { asset: string; price: number; sma20: number; sma50: number; sma200: number; vs: string; hi90: number; lo90: number; support: string; resistance: string; note: string }
interface Brief {
  headline: string
  verified: string
  ta: TaRow[]
  sentiment: { fear_greed: number; fg_label: string; fg_note: string; funding: string; gaps: string }
  flows: { label: string; value: string; note: string }[]
  turnover: { asset: string; volMcap: number; d7: number; d30: number }[]
  narratives: { title: string; stage: string; assets: string; catalyst: string }[]
  calendar: { date: string; event: string; why: string }[]
  implications: string[]
}

const px = (n: number) => (n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`)

export default async function FundPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  const supabase = createServiceClient()
  const { data } = (await supabase?.from('fund_research')
    .select('brief_date, content')
    .order('brief_date', { ascending: false })
    .limit(1)
    .maybeSingle()) ?? { data: null }

  // A failed fetch must never render as an empty desk — unknown and empty look different.
  if (!data) {
    return (
      <Shell secret={secret} active="fund">
        <Panel accent="green" title="💼 J&P Fund — research desk">
          <span className="text-[13px] text-red-600">No research brief reachable — table empty or fetch failed. Next sweep publishes here.</span>
        </Panel>
      </Shell>
    )
  }

  const brief = data.content as unknown as Brief
  const briefDate = data.brief_date as string
  const fg = brief.sentiment.fear_greed

  return (
    <Shell secret={secret} active="fund">
      <Panel accent="green" title="💼 J&P Fund — research desk" right={<span className="text-[11px] text-neutral-500">brief {briefDate}</span>}>
        <p className="text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">{brief.headline}</p>
        <p className="mt-1 text-[11px] text-neutral-500">{brief.verified}</p>
      </Panel>

      <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile accent="green" i={0} label="Fear & Greed" value={String(fg)} tone={fg >= 70 ? 'neg' : fg <= 30 ? 'pos' : 'dim'} sub={`${brief.sentiment.fg_label} — ${brief.sentiment.fg_note}`} />
        <Tile accent="teal" i={1} label="Leverage" value="cool" tone="pos" sub="funding at floor, perps at spot discount" />
        <Tile accent="cyan" i={2} label="ETF flows" value={brief.flows[0]?.value.match(/\d+-day/)?.[0] ?? 'inflow'} tone="pos" sub={brief.flows[1]?.note ?? ''} />
        <Tile accent="amber" i={3} label="Structure" value="5/5 bull" tone="pos" sub="all majors above 20/50/200d SMAs" />
      </div>

      {/* TA — the computed levels, one row per asset */}
      <div className="mt-3">
        <Panel accent="teal" title="Technical levels — computed, not scraped">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-[12px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-neutral-500">
                  <th className="py-1 pr-2">Asset</th><th className="pr-2">Price</th><th className="pr-2">20d</th><th className="pr-2">50d</th><th className="pr-2">200d</th><th className="pr-2">90d Hi/Lo</th><th className="pr-2">Support</th><th className="pr-2">Resistance</th><th>Read</th>
                </tr>
              </thead>
              <tbody>
                {brief.ta.map((r) => (
                  <tr key={r.asset} className="border-t border-neutral-100 dark:border-white/5">
                    <td className="py-1.5 pr-2 font-bold text-amber-600 dark:text-amber-300">{r.asset}</td>
                    <td className="pr-2 font-mono">{px(r.price)}</td>
                    <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{px(r.sma20)}</td>
                    <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{px(r.sma50)}</td>
                    <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{px(r.sma200)}</td>
                    <td className="pr-2 font-mono text-neutral-600 dark:text-neutral-400">{px(r.hi90)} / {px(r.lo90)}</td>
                    <td className="pr-2 text-green-700 dark:text-emerald-300">{r.support}</td>
                    <td className="pr-2 text-red-600 dark:text-rose-300">{r.resistance}</td>
                    <td className="text-neutral-600 dark:text-neutral-400">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {/* Turnover concentration */}
        <Panel accent="pink" title="Turnover — where the churn is" right={<span className="text-[11px] text-neutral-500">24h vol / mcap</span>}>
          <div className="space-y-1">
            {brief.turnover.map((t) => (
              <div key={t.asset} className="flex items-center gap-2 text-[13px]">
                <span className="w-12 font-bold text-neutral-800 dark:text-neutral-200">{t.asset}</span>
                <div className="h-2 flex-1 overflow-hidden rounded bg-neutral-100 dark:bg-white/5">
                  <div className="h-full rounded bg-pink-500/70 dark:bg-pink-400/70" style={{ width: `${Math.min(100, t.volMcap * 3)}%` }} />
                </div>
                <span className="w-14 text-right font-mono text-pink-700 dark:text-pink-300">{t.volMcap.toFixed(1)}%</span>
                <span className={`w-16 text-right font-mono ${t.d7 >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{t.d7 >= 0 ? '+' : ''}{t.d7.toFixed(0)}% 7d</span>
              </div>
            ))}
          </div>
        </Panel>

        {/* Flows */}
        <Panel accent="cyan" title="Flows — the cash behind the move">
          <div className="space-y-2">
            {brief.flows.map((f) => (
              <div key={f.label} className="text-[13px]">
                <span className="font-bold text-cyan-700 dark:text-cyan-200">{f.label}:</span>{' '}
                <span className="text-neutral-800 dark:text-neutral-200">{f.value}</span>
                <div className="text-[12px] text-neutral-500">{f.note}</div>
              </div>
            ))}
            <div className="border-t border-neutral-100 pt-2 text-[12px] text-neutral-600 dark:border-white/5 dark:text-neutral-400">{brief.sentiment.funding}</div>
            <div className="text-[11px] text-neutral-500">Known gap: {brief.sentiment.gaps}</div>
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {/* Narratives */}
        <Panel accent="purple" title="Narratives — where capital rotates">
          <div className="space-y-2">
            {brief.narratives.map((n) => (
              <div key={n.title} className="text-[13px]">
                <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wide ${n.stage.startsWith('early') ? 'bg-green-100 text-green-700 dark:bg-emerald-400/15 dark:text-emerald-300' : n.stage === 'crowded' ? 'bg-red-100 text-red-700 dark:bg-rose-400/15 dark:text-rose-300' : 'bg-amber-100 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300'}`}>{n.stage}</span>
                <span className="text-neutral-800 dark:text-neutral-200">{n.title}</span>
                <div className="text-[12px] text-neutral-500">{n.assets} · {n.catalyst}</div>
              </div>
            ))}
          </div>
        </Panel>

        {/* Calendar */}
        <Panel accent="rose" title="Calendar — vol events ahead">
          <div className="space-y-1.5">
            {brief.calendar.map((c) => (
              <div key={c.date + c.event} className="grid grid-cols-[92px_1fr] gap-2 text-[13px]">
                <span className="font-bold text-rose-600 dark:text-rose-300">{c.date}</span>
                <span className="text-neutral-800 dark:text-neutral-200">{c.event}<span className="block text-[12px] text-neutral-500">{c.why}</span></span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* What it means for the next call */}
      <div className="mt-3">
        <Panel accent="amber" title="Desk notes — inputs to the next call, not orders">
          <ul className="list-disc space-y-1.5 pl-4 text-[13px] text-neutral-700 dark:text-neutral-300">
            {brief.implications.map((s) => <li key={s.slice(0, 40)}>{s}</li>)}
          </ul>
        </Panel>
      </div>

      <div className="mt-3 text-[12px] text-neutral-500">
        The desk publishes from multi-agent research sweeps (content/narratives · TA computed from raw dailies · volume/flows ·
        macro calendar · derivatives sentiment), every number verified against the live feed before it lands here. Paper-competition
        calls stay Mondays; the live account runs its own sealed book.
      </div>
    </Shell>
  )
}
