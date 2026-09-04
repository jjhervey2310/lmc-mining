'use client'

import { useEffect, useState } from 'react'
import { Panel, Spark } from './ui'
import HoldingChart from './holding-chart'

// The live half of the ROBINHOOD tab (v2, build request #4): holdings FIRST with
// thesis + gate under each, pole that can never name a held symbol, click a
// holding for its 1-year chart with entry/stop lines, staleness honesty, armed
// lines, watcher feed, session board — all re-fetched every 60s from
// /api/fund/state (authed) + CoinGecko for prices.

interface Holding { symbol: string; qty: number; avg_cost: number; synced_at: string }
interface Trigger { symbol: string; kind: string; level: number; band_pct: number | null; spec: string | null }
interface Alert { at: string; symbol: string; kind: string; level: number | null; price: number | null; sent: boolean | null; queued: boolean | null; note: string | null }
interface Board { fact: string; updated_at: string }
export interface Thesis { symbol: string; status: string; thesis: string | null; gate: string | null; updated_at: string | null }
export interface DeskState { holdings: Holding[] | null; triggers: Trigger[] | null; alerts: Alert[] | null; board: Board | null; strategy: Board | null; theses?: Thesis[] | null; loop_enabled?: boolean | null; at: string }

const fmt = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'

const denver = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const hoursOld = (iso?: string | null) => iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity

export default function DeskLive({ initial, secret, cg, sparks }: {
  initial: DeskState
  secret: string
  cg: Record<string, string>
  sparks: Record<string, number[]>
}) {
  const [state, setState] = useState<DeskState>(initial)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [degraded, setDegraded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [chart, setChart] = useState<string | null>(null)
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

  // 60s: fresh desk state from the DB (authed route, no-store).
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

  // 60s: live prices for held + pole/candidate symbols.
  const theses = state.theses ?? []
  const poleSyms = theses.filter((t) => t.status === 'POLE' || t.status === 'WATCH').map((t) => t.symbol)
  const priceSyms = [...new Set([...(state.holdings ?? []).map((h) => h.symbol), ...poleSyms])].filter((s) => s !== 'USD')
  const priceKey = priceSyms.join(',')
  useEffect(() => {
    const syms = priceKey ? priceKey.split(',') : []
    const ids = [...new Set(syms.map((s) => cg[s.toUpperCase()]).filter(Boolean))]
    if (!ids.length) return
    let dead = false
    const pull = async () => {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids.join(',')}&vs_currencies=usd`)
        if (!r.ok) return
        const j = (await r.json()) as Record<string, { usd?: number }>
        if (dead) return
        setPrices((prev) => {
          const next = { ...prev }
          for (const s of syms) { const id = cg[s.toUpperCase()]; if (id && j[id]?.usd) next[s] = j[id].usd as number }
          return next
        })
      } catch { /* keep last good */ }
    }
    pull()
    const iv = setInterval(pull, 60_000)
    return () => { dead = true; clearInterval(iv) }
  }, [priceKey, cg])

  const holdings = state.holdings ?? []
  const positions = holdings.filter((h) => h.symbol !== 'USD' && Number(h.qty) > 0)
  const held = new Set(positions.map((p) => p.symbol))
  const cash = Number(holdings.find((h) => h.symbol === 'USD')?.qty ?? 0)
  const board = state.board?.fact ?? ''
  const boardPole = board.split('\n').find((l) => l.trim().startsWith('★')) ?? ''
  const boardPoleSym = boardPole.match(/POLE:\s*([A-Z0-9]{2,10})/)?.[1] ?? null
  const newestSync = positions.length ? Math.min(...positions.map((h) => hoursOld(h.synced_at))) : Infinity
  const oldestSync = positions.length ? Math.max(...positions.map((h) => hoursOld(h.synced_at))) : Infinity
  const boardAge = hoursOld(state.board?.updated_at)
  const stale = oldestSync > 12 || boardAge > 36
  const stopFor = (sym: string) => (state.triggers ?? []).find((t) => t.symbol === sym && t.kind === 'stop')?.level ?? null
  const thesisFor = (sym: string) => theses.find((t) => t.symbol === sym) ?? null
  // Pole rule (#4 §2): a held symbol can never be pole. Take the desk's POLE row unless it's held.
  const poleRow = theses.find((t) => t.status === 'POLE' && !held.has(t.symbol)) ?? null
  const heldPole = theses.find((t) => t.status === 'POLE' && held.has(t.symbol)) ?? null
  const candidates = theses.filter((t) => t.status === 'WATCH' && !held.has(t.symbol))
  const barred = theses.filter((t) => t.status === 'BARRED')
  const posValue = positions.reduce((s, p) => s + (prices[p.symbol] ? Number(p.qty) * prices[p.symbol] : 0), 0)
  const allPriced = positions.every((p) => prices[p.symbol] != null)
  const chartPos = chart ? positions.find((p) => p.symbol === chart) ?? null : null

  return (
    <div>
      {chartPos && (
        <HoldingChart symbol={chartPos.symbol} cgId={cg[chartPos.symbol.toUpperCase()] ?? null}
          entry={Number(chartPos.avg_cost) > 0 ? Number(chartPos.avg_cost) : null}
          stop={stopFor(chartPos.symbol) != null ? Number(stopFor(chartPos.symbol)) : null}
          onClose={() => setChart(null)} />
      )}

      {(stale || degraded) && (
        <div className="mb-3 rounded-xl border border-amber-500 bg-amber-100 px-3 py-2 text-[13px] font-medium text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-200">
          ⚠ {degraded ? 'Live refresh failing — numbers below are from the last successful load. ' : ''}
          {stale ? `Data may be stale (holdings synced ${oldestSync.toFixed(0)}h ago${boardAge > 36 ? `, board ${boardAge.toFixed(0)}h old` : ''}) — open a desk session to refresh.` : ''}
        </div>
      )}

      {/* ── 1. HOLDINGS FIRST (#4 §1): qty, entry, live, ▲/▼, stop, thesis + gate; tap for the chart ── */}
      <Panel accent="rose" title="🔴 Holdings — Robinhood, live"
        right={<span className="text-[11px] text-neutral-500">{positions.length ? `synced ${denver([...positions].sort((a, b) => +new Date(b.synced_at) - +new Date(a.synced_at))[0].synced_at)} DEN · ` : ''}prices 60s · tap a row for its chart</span>}>
        {state.holdings === null ? (
          <span className="text-[13px] text-red-600">Holdings unreachable — fetch failed, not empty.</span>
        ) : positions.length === 0 ? (
          <span className="text-[13px] text-neutral-500">No open positions. Cash ${cash.toFixed(2)}.</span>
        ) : (
          <div>
            <div className="space-y-2">
              {positions.map((p) => {
                const now = prices[p.symbol] ?? null
                const value = now !== null ? Number(p.qty) * now : null
                const pct = now !== null && Number(p.avg_cost) > 0 ? ((now - Number(p.avg_cost)) / Number(p.avg_cost)) * 100 : null
                const stop = stopFor(p.symbol)
                const th = thesisFor(p.symbol)
                const stopPct = stop != null && now != null ? ((Number(stop) - now) / now) * 100 : null
                return (
                  <div key={p.symbol} className="rounded-xl border border-neutral-200 dark:border-white/10">
                    <button type="button" onClick={() => setChart(p.symbol)} className="flex w-full items-baseline gap-2 px-3 py-2 text-left">
                      <span className="text-[16px] font-bold text-rose-600 dark:text-rose-300">{p.symbol}</span>
                      <span className="font-mono text-[15px] font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{now !== null ? fmt(now) : '…'}</span>
                      {pct !== null && (
                        <span className={`font-mono text-[13px] tabular-nums ${pct >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>
                          {pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[13px] tabular-nums text-neutral-600 dark:text-neutral-400">{value !== null ? `$${value.toFixed(2)}` : ''}</span>
                      <span className="text-[11px] text-neutral-400">📈</span>
                    </button>
                    <div className="border-t border-neutral-100 px-3 py-2 text-[12px] text-neutral-600 dark:border-white/5 dark:text-neutral-400">
                      <div className="flex flex-wrap gap-x-4 gap-y-1 tabular-nums">
                        <span>qty <b className="font-mono text-neutral-800 dark:text-neutral-200">{p.qty}</b></span>
                        <span>entry <b className="font-mono text-neutral-800 dark:text-neutral-200">{Number(p.avg_cost) > 0 ? fmt(Number(p.avg_cost)) : 'n/a'}</b></span>
                        {stop !== null
                          ? <span>stop <b className="font-mono text-amber-700 dark:text-amber-300">{fmt(Number(stop))}</b>{stopPct !== null && <span className="text-neutral-500"> ({stopPct.toFixed(1)}%)</span>}</span>
                          : <span className="font-bold text-red-600 dark:text-rose-300">NO STOP ARMED</span>}
                      </div>
                      {th ? (
                        <div className="mt-1.5 border-t border-neutral-100 pt-1.5 dark:border-white/5">
                          <div className="text-[12px] leading-relaxed text-neutral-700 dark:text-neutral-300"><span className="mr-1.5 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-rose-700 dark:bg-rose-400/15 dark:text-rose-300">{th.status}</span>{th.thesis}</div>
                          {th.gate && <div className="mt-0.5 text-[12px] text-teal-700 dark:text-teal-300">gate → {th.gate}</div>}
                        </div>
                      ) : (
                        <div className="mt-1.5 text-[11px] text-neutral-500">no thesis row in desk_theses — desk to add</div>
                      )}
                      {sparks[p.symbol] && sparks[p.symbol].length > 1 ? (
                        <div className="mt-1.5 overflow-x-auto opacity-80"><Spark points={sparks[p.symbol]} w={620} h={60} /></div>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 px-1 text-[13px] tabular-nums">
              <span><span className="font-bold text-neutral-600 dark:text-neutral-400">CASH</span> <span className="font-mono">${cash.toFixed(2)}</span></span>
              <span className="text-neutral-500">positions <span className="font-mono text-neutral-700 dark:text-neutral-300">{allPriced ? `$${posValue.toFixed(2)}` : 'pricing…'}</span> · book <span className="font-mono font-bold text-neutral-800 dark:text-neutral-100">{allPriced ? `$${(posValue + cash).toFixed(2)}` : '…'}</span></span>
            </div>
          </div>
        )}
      </Panel>

      {/* ── kill switch ── */}
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-neutral-200 px-3 py-1.5 text-[12px] dark:border-white/10">
        <span className="text-neutral-600 dark:text-neutral-400">
          24/7 desk loop: {state.loop_enabled == null ? <span className="text-neutral-500">unknown</span>
            : state.loop_enabled ? <span className="font-bold text-green-600 dark:text-emerald-300">● RUNNING</span>
            : <span className="font-bold text-red-600 dark:text-rose-300">■ PAUSED</span>}
        </span>
        <button onClick={toggleLoop} disabled={toggling || state.loop_enabled == null}
          className={`rounded-lg px-3 py-1 text-[12px] font-bold ${state.loop_enabled === false ? 'bg-green-600 text-white' : 'bg-red-600 text-white'} disabled:opacity-50`}>
          {toggling ? '…' : state.loop_enabled === false ? 'RESUME LOOP' : 'KILL SWITCH — PAUSE LOOP'}
        </button>
      </div>

      {/* ── 2. POLE (#4 §2): from desk_theses, never a held symbol ── */}
      <div className="mt-3">
        <Panel accent="amber" title="★ POLE — next buy (standing approval, A3)"
          right={<span className="text-[11px] text-neutral-500">desk_theses · holdings excluded by rule{poleRow?.updated_at ? ` · ${denver(poleRow.updated_at)} DEN` : ''}</span>}>
          {state.theses === null ? (
            <span className="text-[13px] text-red-600">Theses unreachable — fetch failed, not empty.</span>
          ) : poleRow ? (
            <div>
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-[18px] font-black text-amber-700 dark:text-amber-300">{poleRow.symbol}</span>
                {prices[poleRow.symbol] != null && <span className="font-mono text-[14px] tabular-nums text-neutral-800 dark:text-neutral-100">{fmt(prices[poleRow.symbol])}</span>}
              </div>
              <div className="mt-1 text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">{poleRow.thesis}</div>
              {poleRow.gate && <div className="mt-1 text-[13px] font-bold text-teal-700 dark:text-teal-300">gate → {poleRow.gate}</div>}
            </div>
          ) : (
            <div className="text-[13px] text-amber-800 dark:text-amber-200">
              Pole is VACANT{heldPole ? ` — desk_theses names ${heldPole.symbol} as POLE but it is already held ("if we hold it, it doesn't make the cut"). Desk must promote a candidate.` : ' — no POLE row in desk_theses.'}
            </div>
          )}
          {boardPoleSym && held.has(boardPoleSym) && (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
              Session board still names {boardPoleSym} as pole, but it is held — board line suppressed here by the holdings rule; desk to refresh the board.
            </div>
          )}
          {candidates.length > 0 && (
            <div className="mt-2 border-t border-neutral-100 pt-2 dark:border-white/5">
              <div className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">Candidates (WATCH)</div>
              <div className="mt-1 space-y-1">
                {candidates.map((c) => (
                  <div key={c.symbol} className="text-[12px]">
                    <span className="font-bold text-amber-700 dark:text-amber-300">{c.symbol}</span>
                    {prices[c.symbol] != null && <span className="ml-1.5 font-mono text-neutral-500">{fmt(prices[c.symbol])}</span>}
                    <span className="ml-1.5 text-neutral-600 dark:text-neutral-400">{c.thesis}</span>
                    {c.gate && <span className="ml-1 text-teal-700 dark:text-teal-300">→ {c.gate}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
          {barred.length > 0 && (
            <div className="mt-2 text-[11px] text-neutral-500">Barred: {barred.map((b) => b.symbol).join(', ')}</div>
          )}
        </Panel>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel accent="teal" title="⚡ Armed lines — watcher targets" right={<span className="text-[11px] text-neutral-500">monitored every 15 min</span>}>
          {state.triggers === null ? (
            <span className="text-[13px] text-red-600">Triggers unreachable — fetch failed, not empty.</span>
          ) : state.triggers.length === 0 ? (
            <span className="text-[13px] text-neutral-500">No armed lines.</span>
          ) : (
            <div className="space-y-1.5">
              {state.triggers.map((t, i) => (
                <div key={i} className="text-[13px] tabular-nums">
                  <span className="font-bold text-teal-700 dark:text-teal-300">{t.symbol}</span>
                  <span className="ml-2 rounded bg-neutral-100 px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-neutral-600 dark:bg-white/10 dark:text-neutral-300">{t.kind}</span>
                  <span className="ml-2 font-mono">{fmt(Number(t.level))}</span>
                  {t.band_pct != null && <span className="ml-1 text-[11px] text-neutral-500">±{Number(t.band_pct)}%</span>}
                  {t.spec && <div className="text-[12px] text-neutral-500">{t.spec}</div>}
                </div>
              ))}
            </div>
          )}
        </Panel>
        <Panel accent="cyan" title="Watcher activity" right={<span className="text-[11px] text-neutral-500">latest 20 · proof of life</span>}>
          {state.alerts === null ? (
            <span className="text-[13px] text-red-600">Alert log unreachable — fetch failed, not empty.</span>
          ) : state.alerts.length === 0 ? (
            <span className="text-[13px] text-neutral-500">No watcher events logged yet.</span>
          ) : (
            <div className="max-h-64 space-y-1 overflow-y-auto">
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
        </Panel>
      </div>

      {board && (
        <div className="mt-3">
          <Panel accent="cyan" title="📋 Session board — live agent" right={<span className="text-[11px] text-neutral-500">{state.board ? `updated ${denver(state.board.updated_at)} DEN` : ''}</span>}>
            <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-[13px] leading-relaxed tabular-nums text-neutral-700 dark:text-neutral-300">{board}</pre>
            {state.strategy && (
              <details className="mt-2 border-t border-neutral-100 pt-2 dark:border-white/5">
                <summary className="cursor-pointer text-[12px] font-bold uppercase tracking-wider text-neutral-500">House strategy — as of {denver(state.strategy.updated_at)} DEN · tap to expand</summary>
                <pre className="mt-1 max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-[12px] leading-relaxed text-neutral-600 dark:text-neutral-400">{state.strategy.fact}</pre>
              </details>
            )}
          </Panel>
        </div>
      )}
    </div>
  )
}
