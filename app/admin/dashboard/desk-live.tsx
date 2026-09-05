'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Panel } from './ui'
import HoldingChart from './holding-chart'

// ROBINHOOD tab, live half — v3 (build requests #4 + #6, Jacob's spec):
//   1. HOLDINGS first: qty · entry · live · ▲/▼ · stop · thesis + gate; tap a row for its 1y chart.
//   2. POLE + WATCH with LIVE numbers (price, 24h/7d/30d, distance to armed entry lines, latest radar row).
//      Thesis text comes from desk_theses; numbers NEVER come from thesis text.
//   3. Portfolio chart (server-rendered, passed in), one realized-P&L line.
//   4. Armed lines, then collapsed panels. Compact: holdings + pole/watch fit a laptop screen.
// Everything re-fetches every 60s from /api/fund/state (authed) + CoinGecko for prices.

interface Holding { symbol: string; qty: number; avg_cost: number; synced_at: string }
interface Trigger { symbol: string; kind: string; level: number; band_pct: number | null; spec: string | null }
interface Alert { at: string; symbol: string; kind: string; level: number | null; price: number | null; sent: boolean | null; queued: boolean | null; note: string | null }
interface Board { fact: string; updated_at: string }
export interface Thesis { symbol: string; status: string; thesis: string | null; gate: string | null; updated_at: string | null }
export interface RadarRow { symbol: string; stage: string; score: number; turnover: number; d1: number; d7: number; d30: number; price: number; scan_date: string }
export interface DeskState {
  holdings: Holding[] | null; triggers: Trigger[] | null; alerts: Alert[] | null; board: Board | null; strategy: Board | null
  theses?: Thesis[] | null; radar?: RadarRow[] | null; loop_enabled?: boolean | null; at: string
}
export interface Realized { pnl: number; wins: number; losses: number; n: number }
interface Live { price: number; d1: number | null; d7: number | null; d30: number | null }

const fmt = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'
const denver = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const hoursOld = (iso?: string | null) => iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity
const Pct = ({ v, d = 1 }: { v: number | null | undefined; d?: number }) =>
  v == null ? <span className="text-neutral-400">—</span>
  : <span className={`font-mono tabular-nums ${v >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{v >= 0 ? '+' : ''}{v.toFixed(d)}%</span>

export default function DeskLive({ initial, secret, cg, chart, realized, bottom }: {
  initial: DeskState
  secret: string
  cg: Record<string, string>
  chart: ReactNode
  realized: Realized | null
  bottom: ReactNode
}) {
  const [state, setState] = useState<DeskState>(initial)
  const [live, setLive] = useState<Record<string, Live>>({})
  const [degraded, setDegraded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [open, setOpen] = useState<string | null>(null)

  const toggleLoop = async () => {
    if (toggling) return
    const on = state.loop_enabled !== false
    if (!confirm(on ? 'PAUSE the 24/7 desk loop? (stops at the broker stay in place)' : 'RESUME the 24/7 desk loop?')) return
    setToggling(true)
    try {
      const r = await fetch(`/api/fund/loop-toggle?secret=${encodeURIComponent(secret)}`, { method: 'POST' })
      if (r.ok) { const j = await r.json(); setState((s) => ({ ...s, loop_enabled: j.loop_enabled })) }
    } finally { setToggling(false) }
  }

  // 60s: desk state (DB, authed, no-store).
  useEffect(() => {
    let dead = false
    const pull = async () => {
      try {
        const r = await fetch(`/api/fund/state?secret=${encodeURIComponent(secret)}`, { cache: 'no-store' })
        if (!r.ok) { setDegraded(true); return }
        const j = (await r.json()) as DeskState
        if (!dead) { setState(j); setDegraded(false) }
      } catch { setDegraded(true) }
    }
    const iv = setInterval(pull, 60_000)
    return () => { dead = true; clearInterval(iv) }
  }, [secret])

  const theses = state.theses ?? []
  const holdings = state.holdings ?? []
  const positions = holdings.filter((h) => h.symbol !== 'USD' && Number(h.qty) > 0)
  const held = new Set(positions.map((p) => p.symbol))
  const watchRows = theses.filter((t) => (t.status === 'POLE' || t.status === 'WATCH') && !held.has(t.symbol))
    .sort((a, b) => (a.status === 'POLE' ? -1 : 0) - (b.status === 'POLE' ? -1 : 0))
  const liveSyms = [...new Set([...positions.map((p) => p.symbol), ...watchRows.map((t) => t.symbol)])]
  const liveKey = liveSyms.join(',')

  // 60s: live price + 24h/7d/30d for held and watched symbols (one CoinGecko markets call).
  useEffect(() => {
    const syms = liveKey ? liveKey.split(',') : []
    const ids = [...new Set(syms.map((s) => cg[s.toUpperCase()]).filter(Boolean))]
    if (!ids.length) return
    let dead = false
    const pull = async () => {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=24h,7d,30d&per_page=250`)
        if (!r.ok) return
        const rows = (await r.json()) as { id: string; current_price: number; price_change_percentage_24h_in_currency?: number; price_change_percentage_7d_in_currency?: number; price_change_percentage_30d_in_currency?: number }[]
        if (dead) return
        const byId = Object.fromEntries(rows.map((x) => [x.id, x]))
        setLive((prev) => {
          const next = { ...prev }
          for (const s of syms) {
            const x = byId[cg[s.toUpperCase()]]
            if (x?.current_price) next[s] = { price: x.current_price, d1: x.price_change_percentage_24h_in_currency ?? null, d7: x.price_change_percentage_7d_in_currency ?? null, d30: x.price_change_percentage_30d_in_currency ?? null }
          }
          return next
        })
      } catch { /* keep last good */ }
    }
    pull()
    const iv = setInterval(pull, 60_000)
    return () => { dead = true; clearInterval(iv) }
  }, [liveKey, cg])

  const cash = Number(holdings.find((h) => h.symbol === 'USD')?.qty ?? 0)
  const board = state.board?.fact ?? ''
  const boardPoleSym = (board.split('\n').find((l) => l.trim().startsWith('★')) ?? '').match(/POLE:\s*([A-Z0-9]{2,10})/)?.[1] ?? null
  const oldestSync = positions.length ? Math.max(...positions.map((h) => hoursOld(h.synced_at))) : Infinity
  const boardAge = hoursOld(state.board?.updated_at)
  const stale = oldestSync > 12 || boardAge > 36
  const trig = (sym: string, kinds: string[]) => (state.triggers ?? []).filter((t) => t.symbol === sym && kinds.includes(t.kind))
  const stopFor = (sym: string) => trig(sym, ['stop'])[0]?.level ?? null
  const thesisFor = (sym: string) => theses.find((t) => t.symbol === sym) ?? null
  const radarFor = (sym: string) => (state.radar ?? []).find((r) => r.symbol === sym) ?? null
  const heldPole = theses.find((t) => t.status === 'POLE' && held.has(t.symbol)) ?? null
  const posValue = positions.reduce((s, p) => s + (live[p.symbol] ? Number(p.qty) * live[p.symbol].price : 0), 0)
  const allPriced = positions.every((p) => live[p.symbol] != null)
  const openPos = open ? positions.find((p) => p.symbol === open) ?? null : null
  const synced = positions.length ? [...positions].sort((a, b) => +new Date(b.synced_at) - +new Date(a.synced_at))[0].synced_at : null

  return (
    <div className="space-y-2">
      {openPos && (
        <HoldingChart symbol={openPos.symbol} cgId={cg[openPos.symbol.toUpperCase()] ?? null}
          entry={Number(openPos.avg_cost) > 0 ? Number(openPos.avg_cost) : null}
          stop={stopFor(openPos.symbol) != null ? Number(stopFor(openPos.symbol)) : null}
          onClose={() => setOpen(null)} />
      )}

      {(stale || degraded) && (
        <div className="rounded-xl border border-amber-500 bg-amber-100 px-3 py-1.5 text-[12px] font-medium text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-200">
          ⚠ {degraded ? 'Live refresh failing — numbers are from the last successful load. ' : ''}
          {stale ? `Data may be stale (holdings synced ${oldestSync.toFixed(0)}h ago${boardAge > 36 ? `, board ${boardAge.toFixed(0)}h old` : ''}).` : ''}
        </div>
      )}

      {/* ── 1. HOLDINGS ── */}
      <Panel accent="rose" title="🔴 Holdings — Robinhood, live"
        right={<span className="flex items-center gap-2 text-[11px] text-neutral-500">
          {synced ? `synced ${denver(synced)}` : ''} · 60s · tap for chart
          <button onClick={toggleLoop} disabled={toggling || state.loop_enabled == null} title="24/7 desk loop"
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${state.loop_enabled === false ? 'bg-red-600' : 'bg-green-600'} disabled:opacity-50`}>
            {toggling ? '…' : state.loop_enabled == null ? 'LOOP ?' : state.loop_enabled ? '● LOOP ON' : '■ LOOP PAUSED'}
          </button>
        </span>}>
        {state.holdings === null ? (
          <span className="text-[13px] text-red-600">Holdings unreachable — fetch failed, not empty.</span>
        ) : positions.length === 0 ? (
          <span className="text-[13px] text-neutral-500">No open positions. Cash ${cash.toFixed(2)}.</span>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-white/5">
            {positions.map((p) => {
              const lv = live[p.symbol]
              const now = lv?.price ?? null
              const value = now !== null ? Number(p.qty) * now : null
              const pct = now !== null && Number(p.avg_cost) > 0 ? ((now - Number(p.avg_cost)) / Number(p.avg_cost)) * 100 : null
              const stop = stopFor(p.symbol)
              const th = thesisFor(p.symbol)
              return (
                <div key={p.symbol} className="py-1.5">
                  <button type="button" onClick={() => setOpen(p.symbol)} className="flex w-full flex-wrap items-baseline gap-x-2 text-left">
                    <span className="w-12 text-[15px] font-bold text-rose-600 dark:text-rose-300">{p.symbol}</span>
                    <span className="font-mono text-[14px] font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{now !== null ? fmt(now) : '…'}</span>
                    {pct !== null && <span className={`font-mono text-[12px] tabular-nums ${pct >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%</span>}
                    <span className="text-[11px] text-neutral-500 tabular-nums">qty <b className="font-mono text-neutral-700 dark:text-neutral-300">{p.qty}</b> · entry <b className="font-mono text-neutral-700 dark:text-neutral-300">{Number(p.avg_cost) > 0 ? fmt(Number(p.avg_cost)) : 'n/a'}</b> · {stop !== null ? <>stop <b className="font-mono text-amber-700 dark:text-amber-300">{fmt(Number(stop))}</b>{now !== null && <span> ({(((Number(stop) - now) / now) * 100).toFixed(1)}%)</span>}</> : <b className="text-red-600 dark:text-rose-300">NO STOP</b>}</span>
                    <span className="ml-auto font-mono text-[12px] tabular-nums text-neutral-600 dark:text-neutral-400">{value !== null ? `$${value.toFixed(2)}` : ''}</span>
                  </button>
                  {th ? (
                    <div className="mt-0.5 text-[12px] leading-snug text-neutral-600 dark:text-neutral-400">
                      <span className="mr-1 rounded bg-rose-100 px-1 py-px text-[9px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">{th.status}</span>{th.thesis}
                      {th.gate && <span className="text-teal-700 dark:text-teal-300"> · gate → {th.gate}</span>}
                    </div>
                  ) : <div className="text-[11px] text-neutral-500">no thesis row in desk_theses</div>}
                </div>
              )
            })}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 text-[12px] tabular-nums">
              <span><span className="font-bold text-neutral-600 dark:text-neutral-400">CASH</span> <span className="font-mono">${cash.toFixed(2)}</span></span>
              <span className="text-neutral-500">positions <span className="font-mono text-neutral-700 dark:text-neutral-300">{allPriced ? `$${posValue.toFixed(2)}` : 'pricing…'}</span> · book <span className="font-mono font-bold text-neutral-800 dark:text-neutral-100">{allPriced ? `$${(posValue + cash).toFixed(2)}` : '…'}</span></span>
            </div>
            {/* A8 structure strip: anchor ≥55% · sleeve ≤45% across ~7 slots (≤10% each) · cash floor 10% */}
            {allPriced && (posValue + cash) > 0 && (() => {
              const book = posValue + cash
              const ANCHOR = new Set(['BTC', 'SOL', 'ETH'])
              const val = (p: Holding) => Number(p.qty) * (live[p.symbol]?.price ?? 0)
              const anchor = positions.filter((p) => ANCHOR.has(p.symbol)).reduce((s, p) => s + val(p), 0)
              const sleeve = positions.filter((p) => !ANCHOR.has(p.symbol))
              const sleeveV = sleeve.reduce((s, p) => s + val(p), 0)
              const aPct = (anchor / book) * 100, sPct = (sleeveV / book) * 100, cPct = (cash / book) * 100
              const fat = sleeve.filter((p) => val(p) / book > 0.10).map((p) => p.symbol)
              const flags = [aPct < 55 ? `anchor ${aPct.toFixed(0)}% < 55%` : '', cPct < 10 ? `cash ${cPct.toFixed(0)}% < 10% floor — no new sleeve entries` : '', fat.length ? `over 10%: ${fat.join(', ')}` : ''].filter(Boolean)
              return (
                <div className="mt-1.5 border-t border-neutral-100 pt-1.5 dark:border-white/5">
                  <div className="flex h-2 w-full overflow-hidden rounded bg-neutral-100 dark:bg-white/10" title="anchor · sleeve · cash">
                    <div className="bg-rose-400/80" style={{ width: `${aPct}%` }} />
                    <div className="bg-amber-400/80" style={{ width: `${sPct}%` }} />
                    <div className="bg-neutral-400/60" style={{ width: `${cPct}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">
                    <span>A8 structure:</span>
                    <span><b className="text-rose-600 dark:text-rose-300">anchor</b> BTC/SOL/ETH <span className="font-mono">{aPct.toFixed(0)}%</span> <span className="text-neutral-400">(≥55%)</span></span>
                    <span><b className="text-amber-700 dark:text-amber-300">sleeve</b> <span className="font-mono">{sPct.toFixed(0)}%</span> · slots <span className="font-mono">{sleeve.length}/7</span> <span className="text-neutral-400">(≤45%, ≤10% each)</span></span>
                    <span><b>cash</b> <span className="font-mono">{cPct.toFixed(0)}%</span> <span className="text-neutral-400">(floor 10%)</span></span>
                    <span className="text-neutral-400">holdings {positions.length}/10</span>
                  </div>
                  {flags.length > 0 && <div className="mt-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">⚠ {flags.join(' · ')}</div>}
                </div>
              )
            })()}
          </div>
        )}
      </Panel>

      {/* ── 2. POLE + WATCH — live numbers beside each thesis; a held symbol never appears here ── */}
      <Panel accent="amber" title="★ POLE + WATCH — in before the move"
        right={<span className="text-[11px] text-neutral-500">desk_theses · numbers live, never from thesis text · holdings excluded</span>}>
        {state.theses === null ? (
          <span className="text-[13px] text-red-600">Theses unreachable — fetch failed, not empty.</span>
        ) : watchRows.length === 0 ? (
          <span className="text-[13px] text-amber-800 dark:text-amber-200">Nothing on watch{heldPole ? ` — desk_theses names ${heldPole.symbol} as POLE but it is held; desk must promote a candidate` : ''}.</span>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-white/5">
            {heldPole && <div className="pb-1 text-[11px] text-amber-800 dark:text-amber-200">desk_theses POLE row is {heldPole.symbol}, which is held — suppressed; first WATCH row below is not a pole until the desk promotes it.</div>}
            {watchRows.map((t) => {
              const lv = live[t.symbol]; const r = radarFor(t.symbol)
              const lines = trig(t.symbol, ['bid', 'deep_rung', 'entry', 'dump'])
              return (
                <div key={t.symbol} className="py-1.5">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                    <span className={`w-12 text-[15px] font-black ${t.status === 'POLE' ? 'text-amber-700 dark:text-amber-300' : 'text-neutral-700 dark:text-neutral-200'}`}>{t.status === 'POLE' ? '★ ' : ''}{t.symbol}</span>
                    <span className="font-mono text-[14px] font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{lv ? fmt(lv.price) : '…'}</span>
                    <span className="text-neutral-500">24h <Pct v={lv?.d1} /> · 7d <Pct v={lv?.d7} /> · 30d <Pct v={lv?.d30} /></span>
                    {lines.map((l, i) => (
                      <span key={i} className="text-teal-700 dark:text-teal-300">{l.kind} <b className="font-mono">{fmt(Number(l.level))}</b>{lv && <span className="text-neutral-500"> ({(((Number(l.level) - lv.price) / lv.price) * 100).toFixed(1)}% away)</span>}</span>
                    ))}
                    {r ? <span className="ml-auto text-[11px] text-neutral-500">radar {r.stage} · score {Number(r.score).toFixed(0)} · turn {Number(r.turnover).toFixed(0)}% · {r.scan_date.slice(5)}</span>
                       : <span className="ml-auto text-[11px] text-neutral-400">no radar row</span>}
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-neutral-600 dark:text-neutral-400">{t.thesis}{t.gate && <span className="text-teal-700 dark:text-teal-300"> · gate → {t.gate}</span>}</div>
                </div>
              )
            })}
          </div>
        )}
        {boardPoleSym && held.has(boardPoleSym) && (
          <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">Session board still names {boardPoleSym} as pole but it is held — desk to refresh the board.</div>
        )}
      </Panel>

      {/* ── 3. PORTFOLIO CHART (server-rendered) + one realized line ── */}
      {chart}
      <div className="px-1 text-[12px] tabular-nums text-neutral-600 dark:text-neutral-400">
        {realized ? (
          <>Realized P&L to date <b className={`font-mono ${realized.pnl >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{realized.pnl >= 0 ? '+' : '−'}${Math.abs(realized.pnl).toFixed(2)}</b> · {realized.n} closed trade{realized.n === 1 ? '' : 's'} <span className="font-mono">{realized.wins}W-{realized.losses}L</span> · full ledger below</>
        ) : <span className="text-red-600">Tax ledger unreachable — realized P&L unknown, not zero.</span>}
      </div>

      {/* ── 4. ARMED LINES ── */}
      <Panel accent="teal" title="⚡ Armed lines — watcher targets" right={<span className="text-[11px] text-neutral-500">every 15 min on the box</span>}>
        {state.triggers === null ? (
          <span className="text-[13px] text-red-600">Triggers unreachable — fetch failed, not empty.</span>
        ) : state.triggers.length === 0 ? (
          <span className="text-[13px] text-neutral-500">No armed lines.</span>
        ) : (
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {state.triggers.map((t, i) => (
              <div key={i} className="text-[12px] tabular-nums leading-snug">
                <span className="font-bold text-teal-700 dark:text-teal-300">{t.symbol}</span>
                <span className="ml-1.5 rounded bg-neutral-100 px-1 py-px text-[9px] uppercase tracking-wide text-neutral-600 dark:bg-white/10 dark:text-neutral-300">{t.kind}</span>
                <span className="ml-1.5 font-mono">{fmt(Number(t.level))}</span>
                {t.band_pct != null && <span className="ml-1 text-[10px] text-neutral-500">±{Number(t.band_pct)}%</span>}
                {t.spec && <span className="ml-1.5 text-[11px] text-neutral-500">{t.spec.length > 110 ? t.spec.slice(0, 110) + '…' : t.spec}</span>}
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── 5. COLLAPSED ── */}
      <details className="rounded-xl border border-neutral-200 px-3 py-1.5 dark:border-white/10">
        <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-wider text-neutral-500">Watcher feed — latest 20</summary>
        {state.alerts === null ? <span className="text-[13px] text-red-600">Alert log unreachable.</span> : state.alerts.length === 0 ? <span className="text-[12px] text-neutral-500">No events yet.</span> : (
          <div className="mt-1 max-h-64 space-y-0.5 overflow-y-auto">
            {state.alerts.map((a, i) => (
              <div key={i} className="flex items-baseline gap-2 text-[12px] tabular-nums">
                <span className="whitespace-nowrap text-neutral-500">{denver(a.at)}</span>
                <span className="font-bold text-neutral-800 dark:text-neutral-200">{a.symbol}</span>
                <span className="text-neutral-500">{a.kind}{a.level != null ? ` @ ${fmt(Number(a.level))}` : ''}</span>
                {a.price != null && <span className="font-mono text-neutral-600 dark:text-neutral-400">{fmt(Number(a.price))}</span>}
                {a.sent ? <span className="text-green-600 dark:text-emerald-300">sent</span> : a.queued ? <span className="text-amber-600 dark:text-amber-300">queued</span> : null}
                {a.note && <span className="truncate text-neutral-500">{a.note}</span>}
              </div>
            ))}
          </div>
        )}
      </details>
      {board && (
        <details className="rounded-xl border border-neutral-200 px-3 py-1.5 dark:border-white/10">
          <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-wider text-neutral-500">Rules — session board{state.board ? ` (${denver(state.board.updated_at)})` : ''} + house strategy</summary>
          <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed tabular-nums text-neutral-700 dark:text-neutral-300">{board}</pre>
          {state.strategy && (
            <details className="mt-1 border-t border-neutral-100 pt-1 dark:border-white/5">
              <summary className="cursor-pointer text-[11px] font-bold uppercase tracking-wider text-neutral-500">House strategy — as of {denver(state.strategy.updated_at)}</summary>
              <pre className="mt-1 max-h-72 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-400">{state.strategy.fact}</pre>
            </details>
          )}
        </details>
      )}
      {bottom}
    </div>
  )
}
