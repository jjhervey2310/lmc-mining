import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, checkAdmin } from '../ui'

// DESK — status of the crypto desk's data foundation (Phase 1). Everything here is read from one SQL
// function (desk_status) so the page cannot drift from the database. Live data is a prerequisite for
// every later engine; this tab exists so a stalled feed is seen the day it stalls, not weeks later.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true }, title: 'Desk — data status' }
export const dynamic = 'force-dynamic'

type Status = {
  at: string
  collector: { host: string; last_beat: string; age_s: number; cycle: number; phase: string } | null
  health: { component: string; status: string; heartbeat_age_s: number | null; data_age_s: number | null; checked_at: string }[]
  md: { venue: string; interval: number; rows: number; symbols: number; first: string; last: string }[]
  backfill: { interval: number; done: number; total: number; bars: number; requests: number; errors: number }[]
  universe: { online: number; delisted: number; total: number; last_sync: string | null }
  fund: { last_date: string | null; rows_last: number; days: number }
  sentiment: { snapshot_date: string; fear_greed: number; classification: string } | null
  features: { last_date: string | null; rows_last: number; days: number }
  token_map: { rows: number; with_gecko: number }
  cron: { job: string; schedule: string; active: boolean; last_run: string | null }[]
  watchlist: { symbol: string; stage: string; thesis: string; entry_plan: string | null; invalidation: string; target: string | null; horizon_days: number | null; confidence: number | null; base_rate_note: string | null; source: string; written_at: string; updated_at: string }[]
  paper: { open: number; closed: number; wins: number; avg_pnl_pct: number | null; rows: { id: number; symbol: string; opened_at: string; entry_px: number; stop_px: number | null; target_px: number | null; size_usd: number; status: string; exit_px: number | null; exit_reason: string | null; pnl_pct: number | null; notes: string | null }[] }
}
const STAGE: Record<string, string> = { BREAKOUT: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300', STRONG: 'bg-sky-500/15 text-sky-700 dark:text-sky-300', EARLY: 'bg-violet-500/15 text-violet-700 dark:text-violet-300', WATCH: 'bg-amber-500/15 text-amber-700 dark:text-amber-300', AVOID: 'bg-rose-500/15 text-rose-700 dark:text-rose-300' }

// Ages are measured against the database's own clock (desk_status().at) so the render stays pure.
const fmtS = (sec: number | null | undefined) => sec == null ? '—' : sec < 90 ? `${sec}s` : sec < 5400 ? `${Math.round(sec / 60)}m` : sec < 172800 ? `${Math.round(sec / 3600)}h` : `${Math.round(sec / 86400)}d`
const age = (iso: string | null | undefined, nowMs: number) => (!iso || !nowMs ? '—' : fmtS(Math.max(0, Math.round((nowMs - new Date(iso).getTime()) / 1000))))
const n = (v: number | null | undefined) => (v == null ? '—' : v.toLocaleString('en-US'))
const dot = (ok: boolean | null) => <span className={`inline-block h-2.5 w-2.5 rounded-full ${ok == null ? 'bg-neutral-400' : ok ? 'bg-emerald-500' : 'bg-rose-500'}`} />

export default async function DeskPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const sb = createServiceClient()
  const { data, error } = sb ? await sb.rpc('desk_status') : { data: null, error: { message: 'db unavailable' } }
  const s = (data ?? null) as Status | null
  const nowMs = s?.at ? new Date(s.at).getTime() : 0
  const collectorOk = s?.collector ? s.collector.age_s < 600 : null
  const ivl = (m: number) => (m === 1440 ? '1d' : m === 240 ? '4h' : m === 60 ? '1h' : `${m}m`)

  return (
    <Shell secret={secret} active="desk">
      {error && <div className="mb-3 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">desk_status failed: {error.message} — apply supabase/v4-desk-data.sql.</div>}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <Panel title="kr_* collector" accent={collectorOk == null ? 'amber' : collectorOk ? 'green' : 'rose'} right={dot(collectorOk)}>
          {s?.collector ? (
            <dl className="grid grid-cols-2 gap-y-1 text-sm">
              <dt className="text-neutral-500">host</dt><dd className="truncate font-mono text-xs">{s.collector.host}</dd>
              <dt className="text-neutral-500">last beat</dt><dd>{age(s.collector.last_beat, nowMs)} ago</dd>
              <dt className="text-neutral-500">cycle / phase</dt><dd>{s.collector.cycle} · {s.collector.phase}</dd>
              {s.health.filter((h) => h.component === 'kr_collector').map((h) => (
                <><dt key="w" className="text-neutral-500">watchdog</dt><dd key="wv">{h.status} · data {fmtS(h.data_age_s)} old · checked {age(h.checked_at, nowMs)} ago</dd></>
              ))}
            </dl>
          ) : <p className="text-sm text-neutral-500">No heartbeat rows.</p>}
          <p className="mt-2 text-xs text-neutral-500">Runs on a laptop. Source code not in this repo — docs/COLLECTOR-UNKNOWN.md.</p>
        </Panel>

        <Panel title="Candles (md_candles)" accent="blue">
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-neutral-500"><th>venue</th><th>ivl</th><th className="text-right">rows</th><th className="text-right">syms</th><th>first</th><th>last</th></tr></thead>
            <tbody>{(s?.md ?? []).map((m) => (
              <tr key={`${m.venue}-${m.interval}`} className="border-t border-neutral-200/60 dark:border-white/5"><td>{m.venue}</td><td>{ivl(m.interval)}</td><td className="text-right font-mono">{n(m.rows)}</td><td className="text-right font-mono">{m.symbols}</td><td className="text-xs">{m.first?.slice(0, 10)}</td><td className="text-xs">{age(m.last, nowMs)} ago</td></tr>
            ))}</tbody></table>
          {!s?.md?.length && <p className="text-sm text-neutral-500">Empty — run universe-sync, then md-backfill.</p>}
        </Panel>

        <Panel title="Backfill progress" accent="purple">
          {(s?.backfill ?? []).map((b) => {
            const pct = b.total ? Math.round((100 * b.done) / b.total) : 0
            return (
              <div key={b.interval} className="mb-2">
                <div className="flex justify-between text-sm"><span>{ivl(b.interval)} · {b.done}/{b.total} cursors</span><span className="font-mono">{pct}%</span></div>
                <div className="h-2 w-full rounded bg-neutral-200 dark:bg-white/10"><div className="h-2 rounded bg-violet-500" style={{ width: `${pct}%` }} /></div>
                <div className="mt-0.5 text-xs text-neutral-500">{n(b.bars)} bars · {n(b.requests)} requests · {b.errors} errors</div>
              </div>
            )
          })}
          {!s?.backfill?.length && <p className="text-sm text-neutral-500">No cursors yet.</p>}
        </Panel>

        <Panel title="Universe (Coinbase USD)" accent="teal">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-neutral-500">online</dt><dd className="font-mono">{n(s?.universe?.online)}</dd>
            <dt className="text-neutral-500">delisted</dt><dd className="font-mono">{n(s?.universe?.delisted)}</dd>
            <dt className="text-neutral-500">last sync</dt><dd>{s?.universe?.last_sync ? `${age(s.universe.last_sync, nowMs)} ago` : '—'}</dd>
          </dl>
          <p className="mt-2 text-xs text-neutral-500">Delisted names stay in the universe so backtests cannot forget the coins that died.</p>
        </Panel>

        <Panel title="Fundamentals (DeFiLlama)" accent="cyan">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-neutral-500">last snapshot</dt><dd>{s?.fund?.last_date ?? '—'}</dd>
            <dt className="text-neutral-500">protocols that day</dt><dd className="font-mono">{n(s?.fund?.rows_last)}</dd>
            <dt className="text-neutral-500">days captured</dt><dd className="font-mono">{n(s?.fund?.days)}</dd>
            <dt className="text-neutral-500">token map</dt><dd className="font-mono">{n(s?.token_map?.rows)} ({n(s?.token_map?.with_gecko)} w/ gecko)</dd>
            <dt className="text-neutral-500">fear &amp; greed</dt><dd>{s?.sentiment ? `${s.sentiment.fear_greed} · ${s.sentiment.classification} (${s.sentiment.snapshot_date})` : '—'}</dd>
          </dl>
          <p className="mt-2 text-xs text-neutral-500">Point-in-time only from the first snapshot date; anything earlier is indicative.</p>
        </Panel>

        <Panel title="Features (features_daily)" accent="pink">
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-neutral-500">last date</dt><dd>{s?.features?.last_date ?? '—'}</dd>
            <dt className="text-neutral-500">symbols that day</dt><dd className="font-mono">{n(s?.features?.rows_last)}</dd>
            <dt className="text-neutral-500">days</dt><dd className="font-mono">{n(s?.features?.days)}</dd>
          </dl>
        </Panel>

        <Panel title="Scheduler (pg_cron)" accent="amber">
          <table className="w-full text-sm"><tbody>{(s?.cron ?? []).map((c) => (
            <tr key={c.job} className="border-t border-neutral-200/60 dark:border-white/5"><td className="py-0.5">{dot(c.active)}</td><td className="font-mono text-xs">{c.job}</td><td className="font-mono text-xs text-neutral-500">{c.schedule}</td><td className="text-right text-xs">{c.last_run ? `${age(c.last_run, nowMs)} ago` : 'never'}</td></tr>
          ))}</tbody></table>
        </Panel>
      </div>
      <div className="mt-3 grid gap-3 xl:grid-cols-[3fr_2fr]">
        <Panel title="Watchlist & theses" accent="green" right={<span className="text-xs text-neutral-500">{s?.watchlist?.length ?? 0} active · discretionary until the scanner scores them</span>}>
          {(s?.watchlist ?? []).map((w) => (
            <div key={w.symbol} className="border-t border-neutral-200/60 py-2 first:border-t-0 dark:border-white/5">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-base font-bold">{w.symbol}</span>
                <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide ${STAGE[w.stage] ?? 'bg-neutral-500/15'}`}>{w.stage}</span>
                {w.confidence != null && <span className="text-xs text-neutral-500">confidence {w.confidence}/100</span>}
                {w.horizon_days != null && <span className="text-xs text-neutral-500">· {w.horizon_days}d horizon</span>}
                <span className="ml-auto text-xs text-neutral-500">{w.source} · {w.updated_at.slice(0, 10)}</span>
              </div>
              <p className="mt-1 text-sm">{w.thesis}</p>
              <dl className="mt-1 grid gap-x-4 gap-y-0.5 text-xs sm:grid-cols-2">
                {w.entry_plan && <><dt className="text-neutral-500">entry</dt><dd>{w.entry_plan}</dd></>}
                <dt className="text-neutral-500">wrong if</dt><dd>{w.invalidation}</dd>
                {w.target && <><dt className="text-neutral-500">target</dt><dd>{w.target}</dd></>}
                {w.base_rate_note && <><dt className="text-neutral-500">base rate</dt><dd>{w.base_rate_note}</dd></>}
              </dl>
            </div>
          ))}
          {!s?.watchlist?.length && <p className="text-sm text-neutral-500">No theses yet.</p>}
        </Panel>
        <Panel title="Shadow paper ledger" accent="amber" right={<span className="text-xs text-neutral-500">{s?.paper ? `${s.paper.open} open · ${s.paper.closed} closed · ${s.paper.closed ? Math.round((100 * s.paper.wins) / s.paper.closed) : 0}% win · avg ${s.paper.avg_pnl_pct ?? '—'}%` : ''}</span>}>
          <table className="w-full text-xs"><thead><tr className="text-left text-neutral-500"><th>sym</th><th>opened</th><th className="text-right">entry</th><th className="text-right">stop</th><th className="text-right">target</th><th>status</th><th className="text-right">pnl</th></tr></thead>
            <tbody>{(s?.paper?.rows ?? []).map((p) => (
              <tr key={p.id} className="border-t border-neutral-200/60 dark:border-white/5"><td className="font-bold">{p.symbol}</td><td>{p.opened_at.slice(0, 10)}</td><td className="text-right font-mono">{p.entry_px}</td><td className="text-right font-mono">{p.stop_px ?? '—'}</td><td className="text-right font-mono">{p.target_px ?? '—'}</td><td>{p.status}{p.exit_reason ? ` · ${p.exit_reason}` : ''}</td><td className={`text-right font-mono ${p.pnl_pct == null ? '' : p.pnl_pct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{p.pnl_pct == null ? '—' : `${p.pnl_pct}%`}</td></tr>
            ))}</tbody></table>
          {!s?.paper?.rows?.length && <p className="text-sm text-neutral-500">No paper positions yet. Every thesis above becomes one.</p>}
          <p className="mt-2 text-xs text-neutral-500">$100 notional each, no broker, no real money. Graded on exit against the thesis written at entry.</p>
        </Panel>
      </div>
      <p className="mt-3 text-xs text-neutral-500">Rendered {s?.at ? new Date(s.at).toISOString() : '—'} · docs/CRYPTO-DESK-ARCHITECTURE.md §3 · Phase 1</p>
    </Shell>
  )
}
