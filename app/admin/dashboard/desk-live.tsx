'use client'

import { useEffect, useState } from 'react'
import { Panel, Spark } from './ui'

// The live half of the ROBINHOOD tab: ★ pole banner, staleness honesty,
// position tiles, armed lines, watcher feed, session board — all re-fetched
// every 60s from /api/fund/state (authed) + CoinGecko for prices, so an
// open tab can never show confidently-stale numbers.

interface Holding { symbol: string; qty: number; avg_cost: number; synced_at: string }
interface Trigger { symbol: string; kind: string; level: number; band_pct: number | null; spec: string | null }
interface Alert { at: string; symbol: string; kind: string; level: number | null; price: number | null; sent: boolean | null; queued: boolean | null; note: string | null }
interface Board { fact: string; updated_at: string }
export interface DeskState { holdings: Holding[] | null; triggers: Trigger[] | null; alerts: Alert[] | null; board: Board | null; at: string }

const fmt = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'

const denver = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

const hoursOld = (iso?: string) => iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity

export default function DeskLive({ initial, secret, cg, sparks }: {
  initial: DeskState
  secret: string
  cg: Record<string, string>
  sparks: Record<string, number[]>
}) {
  const [state, setState] = useState<DeskState>(initial)
  const [prices, setPrices] = useState<Record<string, number>>({})
  const [degraded, setDegraded] = useState(false)

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

  // 60s: live prices for held symbols.
  useEffect(() => {
    const syms = (state.holdings ?? []).map((h) => h.symbol).filter((s) => s !== 'USD')
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
  }, [state.holdings, cg])

  const holdings = state.holdings ?? []
  const positions = holdings.filter((h) => h.symbol !== 'USD')
  const cash = Number(holdings.find((h) => h.symbol === 'USD')?.qty ?? 0)
  const board = state.board?.fact ?? ''
  const poleLine = board.split('\n').find((l) => l.trim().startsWith('★')) ?? ''
  const newestSync = positions.length ? Math.min(...positions.map((h) => hoursOld(h.synced_at))) : Infinity
  const oldestSync = positions.length ? Math.max(...positions.map((h) => hoursOld(h.synced_at))) : Infinity
  const boardAge = hoursOld(state.board?.updated_at)
  const stale = oldestSync > 12 || boardAge > 36
  const stopFor = (sym: string) => (state.triggers ?? []).find((t) => t.symbol === sym && t.kind === 'stop')?.level ?? null

  return (
    <div>
      {(stale || degraded) && (
        <div className="mb-3 rounded-xl border border-amber-500 bg-amber-100 px-3 py-2 text-[13px] font-medium text-amber-900 dark:border-amber-400/60 dark:bg-amber-400/15 dark:text-amber-200">
          ⚠ {degraded ? 'Live refresh failing — numbers below are from the last successful load. ' : ''}
          {stale ? `Data may be stale (holdings synced ${oldestSync.toFixed(0)}h ago${boardAge > 36 ? `, board ${boardAge.toFixed(0)}h old` : ''}) — open a desk session to refresh.` : ''}
        </div>
      )}

      {poleLine && (
        <div className="mb-3 rounded-xl border border-amber-400 bg-amber-50 px-3 py-2 dark:border-amber-400/40 dark:bg-amber-400/10">
          <pre className="whitespace-pre-wrap font-sans text-[13px] font-medium leading-relaxed text-amber-800 dark:text-amber-200">{poleLine.trim()}</pre>
        </div>
      )}

      <Panel accent="rose" title="🔴 Robinhood — live holdings"
        right={<span className="text-[11px] text-neutral-500">synced {state.holdings?.[0] ? denver([...positions].sort((a, b) => +new Date(b.synced_at) - +new Date(a.synced_at))[0]?.synced_at ?? state.at) : ''} DEN · prices 60s</span>}>
        {state.holdings === null ? (
          <span className="text-[13px] text-red-600">Holdings unreachable — fetch failed, not empty.</span>
        ) : (
          <div>
            <div className="grid gap-2 sm:grid-cols-2">
              {positions.map((p) => {
                const now = prices[p.symbol] ?? null
                const value = now !== null ? Number(p.qty) * now : null
                const pct = now !== null && Number(p.avg_cost) > 0 ? ((now - Number(p.avg_cost)) / Number(p.avg_cost)) * 100 : null
                const stop = stopFor(p.symbol)
                return (
                  <details key={p.symbol} className="group rounded-xl border border-neutral-200 dark:border-white/10">
                    <summary className="flex cursor-pointer list-none items-baseline gap-2 px-3 py-2 [&::-webkit-details-marker]:hidden">
                      <span className="text-[15px] font-bold text-rose-600 dark:text-rose-300">{p.symbol}</span>
                      <span className="font-mono text-[15px] font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{now !== null ? fmt(now) : '…'}</span>
                      {pct !== null && (
                        <span className={`font-mono text-[13px] tabular-nums ${pct >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>
                          {pct >= 0 ? '▲' : '▼'}{Math.abs(pct).toFixed(1)}%
                        </span>
                      )}
                      <span className="ml-auto font-mono text-[13px] tabular-nums text-neutral-600 dark:text-neutral-400">{value !== null ? `$${value.toFixed(2)}` : ''}</span>
                      <span className="text-[11px] text-neutral-400 transition-transform group-open:rotate-90">▶</span>
                    </summary>
                    <div className="border-t border-neutral-100 px-3 py-2 text-[12px] text-neutral-600 dark:border-white/5 dark:text-neutral-400">
                      <div className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
                        <span>qty <b className="font-mono text-neutral-800 dark:text-neutral-200">{p.qty}</b></span>
                        <span>entry <b className="font-mono text-neutral-800 dark:text-neutral-200">{Number(p.avg_cost) > 0 ? fmt(Number(p.avg_cost)) : 'n/a'}</b></span>
                        {stop !== null && <span>stop <b className="font-mono text-amber-700 dark:text-amber-300">{fmt(Number(stop))}</b></span>}
                        {now !== null && (
                          <span className="text-neutral-500">est. buy <b className="font-mono">{fmt(now * 1.0095)}</b> · est. sell <b className="font-mono">{fmt(now * 0.9905)}</b> <span className="text-[10px]">(±0.95% of mid, estimate)</span></span>
                        )}
                      </div>
                      {sparks[p.symbol] && sparks[p.symbol].length > 1 ? (
                        <div className="mt-2 overflow-x-auto"><Spark points={sparks[p.symbol]} w={620} h={140} /></div>
                      ) : null}
                    </div>
                  </details>
                )
              })}
            </div>
            <div className="mt-2 flex items-center justify-between px-1 text-[13px] tabular-nums">
              <span><span className="font-bold text-neutral-600 dark:text-neutral-400">CASH</span> <span className="font-mono">${cash.toFixed(2)}</span></span>
            </div>
          </div>
        )}
      </Panel>

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
          </Panel>
        </div>
      )}
    </div>
  )
}
