'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { Panel } from './ui'
import HoldingChart from './holding-chart'
import PerfChart, { type PerfItem } from './perf-chart'

// ROBINHOOD tab, live half — v4 (Jacob 2026-09-06: "easily readable", "the crypto up in line", "one chart with
// all the holdings", "a button for up-to-date price + volume with an A–F timing rating", "buy right now if I click").
//   1. HOLDINGS as a proper table: price · 24h · qty · entry · value + weight · P&L vs entry · stop + distance · role.
//      Tap the symbol for its 1y chart; thesis + gate under a toggle. Then cash, account value, the deposit-adjusted
//      Trading P&L headline (build request #7) and the v4.1 structure strip.
//   2. UP NEXT — the queue (POLE → WATCH → VERIFYING from desk_theses, holdings excluded) with live numbers, the
//      armed entry lines, flow-radar and radar chips, a TIMING button (/api/fund/timing: live price, 24h volume,
//      A–F grade against the house laws + the tape, ruled size, stop) and a BUY button (/api/fund/buy: market order
//      for the ruled size + stop-limit on 100% of the units, only on a human tap, hard bars never overridable).
//      One PerfChart under it: every holding (solid) and every queue name (dashed), indexed to the window start.
//   3. Portfolio chart (server-rendered) + realized line.  4. Armed lines.  5. Collapsed panels.
// Numbers never come from thesis text. Everything re-fetches every 60s from /api/fund/state + CoinGecko.

interface Holding { symbol: string; qty: number; avg_cost: number; synced_at: string }
interface Trigger { symbol: string; kind: string; level: number; band_pct: number | null; spec: string | null }
interface Alert { at: string; symbol: string; kind: string; level: number | null; price: number | null; sent: boolean | null; queued: boolean | null; note: string | null }
interface Board { fact: string; updated_at: string }
export interface Thesis { symbol: string; status: string; thesis: string | null; gate: string | null; updated_at: string | null }
export interface RadarRow { symbol: string; stage: string; score: number; turnover: number; d1: number; d7: number; d30: number; price: number; scan_date: string }
export interface FlowRow { symbol: string; flow_score: number | null; stage: string | null; fees_wow: number | null; vol_wow: number | null; scan_date: string }
export interface DeskState {
  holdings: Holding[] | null; triggers: Trigger[] | null; alerts: Alert[] | null; board: Board | null; strategy: Board | null
  theses?: Thesis[] | null; radar?: RadarRow[] | null; flow?: FlowRow[] | null; loop_enabled?: boolean | null; at: string
}
export interface Realized { pnl: number; wins: number; losses: number; n: number }
export interface Capital {
  reachable: boolean
  baseline: { date: string; usd: number } | null
  net_flows: number                       // Σdeposits − Σwithdrawals since the baseline
  flows: { date: string; amount: number; kind: string; note: string | null }[]
}
interface Live { price: number; d1: number | null; d7: number | null; d30: number | null; vol: number | null }
interface Timing {
  symbol: string; at: string; price: number; vol24h: number | null; avgVol20: number | null; volX: number | null
  d1: number | null; d7: number | null; d30: number | null; hi20: number | null; extPct: number | null; rs7VsBtc: number | null
  tapeError: string | null; hi20Source: 'cg_history' | 'coingecko' | null
  book: number; cash: number; slots: number; sleeveCount: number; weeklyEntries: number; blackout: string | null; halfSize: boolean
  grade: 'A' | 'B' | 'C' | 'D' | 'F' | '?'; score: number; hard: string[]; soft: string[]; plus: string[]
  size: { usd: number; pctBook: number; halfSize: boolean; cappedBy: string | null }
  stop: { price: number; source: string; pct: number }
  buyable: boolean; overridable: boolean; rh_configured: boolean
}
interface BuyResult { ok?: boolean; state?: string; order_id?: string; qty?: number; avg_price?: number; notional?: number; stop?: { order_id: string; stop: string; limit: string } | null; stop_error?: string | null; ledger_errors?: string[]; error?: string; message?: string }

const ANCHOR = new Set(['BTC', 'SOL'])   // v4: ETH out of the anchor (Jacob 09-05)
const fmt = (n: number) =>
  n >= 1000 ? `$${Math.round(n).toLocaleString('en-US')}`
  : n >= 1 ? `$${n.toFixed(2)}`
  : n >= 0.01 ? `$${n.toFixed(4)}`
  : n > 0 ? `$${n.toPrecision(3)}`
  : '$0'
const usd2 = (n: number) => `${n < 0 ? '−' : ''}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const big = (n: number) => n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}k` : `$${n.toFixed(0)}`
const denver = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { timeZone: 'America/Denver', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
const hoursOld = (iso?: string | null) => iso ? (Date.now() - new Date(iso).getTime()) / 36e5 : Infinity
const Pct = ({ v, d = 1 }: { v: number | null | undefined; d?: number }) =>
  v == null ? <span className="text-neutral-400">—</span>
  : <span className={`font-mono tabular-nums ${v >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{v >= 0 ? '+' : ''}{v.toFixed(d)}%</span>
const GRADE: Record<string, string> = {
  A: 'bg-emerald-500 text-white', B: 'bg-green-500 text-white', C: 'bg-amber-400 text-black', D: 'bg-orange-500 text-white', F: 'bg-rose-600 text-white',
  '?': 'bg-neutral-400 text-white',   // could not grade (no live price) — never a judgement on the name
}
const STATUS: Record<string, string> = {
  POLE: 'bg-amber-100 text-amber-800 dark:bg-amber-400/20 dark:text-amber-200', WATCH: 'bg-sky-100 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200',
  VERIFYING: 'bg-violet-100 text-violet-800 dark:bg-violet-400/20 dark:text-violet-200',
}

export default function DeskLive({ initial, secret, cg, chart, realized, capital, bottom }: {
  initial: DeskState
  secret: string
  cg: Record<string, string>
  chart: ReactNode
  realized: Realized | null
  capital: Capital
  bottom: ReactNode
}) {
  const [state, setState] = useState<DeskState>(initial)
  const [live, setLive] = useState<Record<string, Live>>({})
  const [degraded, setDegraded] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const [thesisOpen, setThesisOpen] = useState<Record<string, boolean>>({})
  const [showBelowC, setShowBelowC] = useState(false)
  const [timing, setTiming] = useState<Record<string, Timing | { error: string } | 'loading' | undefined>>({})
  const [buying, setBuying] = useState<Record<string, BuyResult | 'working' | undefined>>({})

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
  const RANK: Record<string, number> = { POLE: 0, WATCH: 1, VERIFYING: 2 }
  const queue = theses.filter((t) => t.status in RANK && !held.has(t.symbol)).sort((a, b) => RANK[a.status] - RANK[b.status] || a.symbol.localeCompare(b.symbol))
  // AUTO-GRADE THE QUEUE. The C+ filter was inert because a name is only graded when you tap Timing,
  // so an ungraded list showed everything (Jacob 2026-09-11, with a screenshot of the unfiltered list).
  // Grading is cheap now that prices come from Coinbase/Robinhood rather than a rate-limited CoinGecko.
  // Staggered so eighteen names do not arrive as one burst; failures are left ungraded, never hidden.
  const queueKey = queue.map((t) => t.symbol).join(',')
  useEffect(() => {
    const syms = queueKey ? queueKey.split(',') : []
    if (!syms.length) return
    let dead = false
    ;(async () => {
      for (const sym of syms) {
        if (dead) return
        const already = await new Promise<unknown>((res) => setTiming((t) => { res(t[sym]); return t }))
        if (already !== undefined) continue
        setTiming((t) => ({ ...t, [sym]: 'loading' }))
        try {
          const r = await fetch(`/api/fund/timing?secret=${encodeURIComponent(secret)}&symbol=${sym}`, { cache: 'no-store' })
          const j = await r.json()
          if (!dead) setTiming((t) => ({ ...t, [sym]: r.ok ? (j as Timing) : { error: j.error ?? `HTTP ${r.status}` } }))
        } catch (e) {
          if (!dead) setTiming((t) => ({ ...t, [sym]: { error: e instanceof Error ? e.message : 'fetch failed' } }))
        }
        await new Promise((res) => setTimeout(res, 600))
      }
    })()
    return () => { dead = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queueKey, secret])

  // RANK BY GRADE, NOT BY STATUS (Jacob 2026-09-11: "shouldnt the ones you gave 100 be at the top").
  // `queue` stays in its stable desk order so the auto-grade effect's key does not churn as grades
  // land; this is a separate view for rendering. Best score first, ungraded next (they are still
  // resolving, not rejected), then '?' which could not be graded, and D/F last — those collapse.
  const gradeRank = (sym: string) => {
    const tm = timing[sym]
    const T = tm && tm !== 'loading' && !('error' in tm) ? tm : null
    if (!T) return { tier: 1, score: 0 }                 // ungraded / still loading
    if (T.grade === 'D' || T.grade === 'F') return { tier: 3, score: T.score }
    if (T.grade === '?') return { tier: 2, score: T.score }
    return { tier: 0, score: T.score }                   // A/B/C ranked by score
  }
  const queueRanked = [...queue].sort((a, b) => {
    const ra = gradeRank(a.symbol), rb = gradeRank(b.symbol)
    return ra.tier - rb.tier || rb.score - ra.score || RANK[a.status] - RANK[b.status] || a.symbol.localeCompare(b.symbol)
  })
  // POLE IS DERIVED, NOT DECLARED (Jacob 2026-09-11: "the pole should be the best available to trade").
  // Best available means BOTH legs: the best live grade AND a thesis someone has actually verified.
  // Grade alone measures entry timing against the laws — it says nothing about whether value reaches
  // the holder, so on grade alone a narrative name with no mechanism outranks a verified one that is
  // merely below its base. A thesis counts as verified when it cites a mechanism (fee switch, buyback,
  // revenue, burn, fee share) and its gate is not still asking for that verification.
  const verified = (sym: string) => {
    const t = theses.find((x) => x.symbol === sym)
    if (!t) return false
    const txt = `${t.thesis ?? ''}`.toLowerCase()
    const gate = `${t.gate ?? ''}`.toLowerCase()
    const hasMechanism = /(fee switch|buyback|revenue|burn|fee[- ]share|accru)/.test(txt)
    const stillAsking = /(unverified|verify|unproven)/.test(txt + ' ' + gate)
    return hasMechanism && !stillAsking
  }
  const poleSym = queueRanked.find((t) => {
    const tm = timing[t.symbol]
    const T = tm && tm !== 'loading' && !('error' in tm) ? tm : null
    return T != null && ['A', 'B', 'C'].includes(T.grade) && verified(t.symbol)
  })?.symbol ?? null
  // The best-graded name overall, so the page can say WHY it is not pole rather than silently skipping it.
  const topGraded = queueRanked.find((t) => {
    const tm = timing[t.symbol]
    const T = tm && tm !== 'loading' && !('error' in tm) ? tm : null
    return T != null && ['A', 'B', 'C'].includes(T.grade)
  })?.symbol ?? null
  const liveSyms = [...new Set([...positions.map((p) => p.symbol), ...queue.map((t) => t.symbol)])]
  const liveKey = liveSyms.join(',')

  // 60s: live price + 24h/7d/30d + 24h volume for held and queued symbols (one CoinGecko markets call).
  useEffect(() => {
    const syms = liveKey ? liveKey.split(',') : []
    const ids = [...new Set(syms.map((s) => cg[s.toUpperCase()]).filter(Boolean))]
    if (!ids.length) return
    let dead = false
    const pull = async () => {
      try {
        const r = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(',')}&price_change_percentage=24h,7d,30d&per_page=250`)
        if (!r.ok) return
        const rows = (await r.json()) as { id: string; current_price: number; total_volume?: number; price_change_percentage_24h_in_currency?: number; price_change_percentage_7d_in_currency?: number; price_change_percentage_30d_in_currency?: number }[]
        if (dead) return
        const byId = Object.fromEntries(rows.map((x) => [x.id, x]))
        setLive((prev) => {
          const next = { ...prev }
          for (const s of syms) {
            const x = byId[cg[s.toUpperCase()]]
            if (x?.current_price) next[s] = { price: x.current_price, d1: x.price_change_percentage_24h_in_currency ?? null, d7: x.price_change_percentage_7d_in_currency ?? null, d30: x.price_change_percentage_30d_in_currency ?? null, vol: x.total_volume ?? null }
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
  const flowFor = (sym: string) => (state.flow ?? []).find((r) => r.symbol === sym) ?? null
  const heldPole = theses.find((t) => t.status === 'POLE' && held.has(t.symbol)) ?? null
  const val = (p: Holding) => Number(p.qty) * (live[p.symbol]?.price ?? 0)
  const posValue = positions.reduce((s, p) => s + val(p), 0)
  const allPriced = positions.every((p) => live[p.symbol] != null)
  const book = posValue + cash
  const openPos = open ? positions.find((p) => p.symbol === open) ?? null : null
  const synced = positions.length ? [...positions].sort((a, b) => +new Date(b.synced_at) - +new Date(a.synced_at))[0].synced_at : null

  const checkTiming = async (sym: string) => {
    // A second tap CLOSES the panel (Jacob 2026-09-10: "when you click it again it should close it,
    // just refreshes right now"). Re-opening re-fetches, so nothing is lost by closing.
    if (timing[sym] && timing[sym] !== 'loading') { setTiming((t) => ({ ...t, [sym]: undefined })); return }
    setTiming((t) => ({ ...t, [sym]: 'loading' }))
    try {
      const r = await fetch(`/api/fund/timing?secret=${encodeURIComponent(secret)}&symbol=${sym}`, { cache: 'no-store' })
      const j = await r.json()
      setTiming((t) => ({ ...t, [sym]: r.ok ? (j as Timing) : { error: j.error ?? `HTTP ${r.status}` } }))
    } catch (e) { setTiming((t) => ({ ...t, [sym]: { error: e instanceof Error ? e.message : 'fetch failed' } })) }
  }
  const buy = async (sym: string, t: Timing, override: boolean) => {
    const lines = [
      `BUY ${sym} at market — about $${t.size.usd.toFixed(2)} (${t.size.pctBook.toFixed(1)}% of the book${t.size.cappedBy ? `, capped by ${t.size.cappedBy}` : ''})`,
      `Live ${fmt(t.price)} · timing grade ${t.grade} (${t.score}/100)`,
      `A stop-limit on 100% of the units goes in at fill: ${fmt(t.stop.price)} (${t.stop.pct.toFixed(0)}%, ${t.stop.source})`,
      override ? `\nOVERRIDE of soft bars: ${t.soft.join('; ')}` : '',
      '\nThis places a real order on Robinhood. Continue?',
    ].join('\n')
    if (!confirm(lines)) return
    if (override && prompt('Type OVERRIDE to confirm you are overriding the desk rules for this trade:') !== 'OVERRIDE') return
    setBuying((b) => ({ ...b, [sym]: 'working' }))
    try {
      const r = await fetch(`/api/fund/buy?secret=${encodeURIComponent(secret)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol: sym, override }) })
      const j = (await r.json()) as BuyResult
      setBuying((b) => ({ ...b, [sym]: j }))
      if (j.ok) {
        const s = await fetch(`/api/fund/state?secret=${encodeURIComponent(secret)}`, { cache: 'no-store' })
        if (s.ok) setState(await s.json())
      }
    } catch (e) { setBuying((b) => ({ ...b, [sym]: { error: 'network', message: e instanceof Error ? e.message : 'request failed' } })) }
  }

  const perfItems: PerfItem[] = [
    ...positions.map((p): PerfItem => ({ symbol: p.symbol, cgId: cg[p.symbol.toUpperCase()] ?? null, kind: 'held', entry: Number(p.avg_cost) > 0 ? Number(p.avg_cost) : null })),
    ...queue.map((t): PerfItem => ({ symbol: t.symbol, cgId: cg[t.symbol.toUpperCase()] ?? null, kind: 'queue', entry: null, status: t.status })),
  ]

  return (
    <div className="space-y-2">
      {openPos && (
        <HoldingChart symbol={openPos.symbol} cgId={cg[openPos.symbol.toUpperCase()] ?? null}
          entry={Number(openPos.avg_cost) > 0 ? Number(openPos.avg_cost) : null}
          stop={stopFor(openPos.symbol) != null ? Number(stopFor(openPos.symbol)) : null}
          others={perfItems.map((i) => ({ symbol: i.symbol, cgId: i.cgId }))}
          secret={secret}
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
          {synced ? `synced ${denver(synced)}` : ''} · 60s
          <button type="button" onClick={toggleLoop} disabled={toggling || state.loop_enabled == null} title="24/7 desk loop"
            className={`rounded-md px-2 py-0.5 text-[10px] font-bold text-white ${state.loop_enabled === false ? 'bg-red-600' : 'bg-green-600'} disabled:opacity-50`}>
            {toggling ? '…' : state.loop_enabled == null ? 'LOOP ?' : state.loop_enabled ? '● LOOP ON' : '■ LOOP PAUSED'}
          </button>
        </span>}>
        {state.holdings === null ? (
          <span className="text-[13px] text-red-600">Holdings unreachable — fetch failed, not empty.</span>
        ) : positions.length === 0 ? (
          <span className="text-[13px] text-neutral-500">No open positions. Cash ${cash.toFixed(2)}.</span>
        ) : (
          <>
            <div className="mb-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-white/5">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">Cash held</div>
                <div className="font-mono text-[28px] font-black leading-tight text-neutral-800 dark:text-neutral-100">{usd2(cash)}</div>
                <div className="text-[10px] text-neutral-500">{book > 0 ? `${((cash / book) * 100).toFixed(0)}% of book · floor 10%` : ''}</div>
              </div>
              <div className="rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-white/5">
                <div className="text-[11px] uppercase tracking-wider text-neutral-500">Account value</div>
                <div className="font-mono text-[28px] font-black leading-tight text-neutral-800 dark:text-neutral-100">{allPriced ? usd2(book) : '…'}</div>
                {allPriced && (() => {
                  // MARKET MOVE ONLY. Each position's value 24h ago = value / (1 + d1); cash is carried at its
                  // CURRENT level on both sides so a deposit cancels out and can never appear as a gain.
                  // Jacob 2026-09-11, on a $100 deposit that lifted the book $103: "that should never read as a gain".
                  const prev = positions.reduce((s, p) => { const d = live[p.symbol]?.d1; return s + (d == null ? val(p) : val(p) / (1 + d / 100)) }, 0) + cash
                  const chg = book - prev; const pct = prev > 0 ? (chg / prev) * 100 : 0
                  const today = new Date(Date.now() - 6 * 3600e3).toISOString().slice(0, 10)   // Denver date
                  const inToday = (capital.flows ?? []).filter((f) => f.date >= today)
                  const depToday = inToday.reduce((a, f) => a + (/deposit|transfer_in|in/i.test(f.kind) ? Number(f.amount) : -Number(f.amount)), 0)
                  return (
                    <>
                      <div className={`font-mono text-[13px] font-bold ${chg >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>
                        {chg >= 0 ? '\u25b2' : '\u25bc'} {usd2(Math.abs(chg))} ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%) <span className="font-normal text-neutral-500">market today</span>
                      </div>
                      {depToday !== 0 && (
                        <div className="mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 font-mono text-[11px] font-bold text-amber-900 dark:bg-amber-400/20 dark:text-amber-200">
                          {depToday > 0 ? '+' : '\u2212'}{usd2(Math.abs(depToday))} deposited today \u2014 YOUR money, not a gain
                        </div>
                      )}
                    </>
                  )
                })()}
                <div className="text-[10px] text-neutral-500">positions {allPriced ? usd2(posValue) : 'pricing…'} + cash · the headline number is size, not performance</div>
              </div>
              <div className="rounded-xl bg-neutral-50 px-3 py-2.5 dark:bg-white/5">
                <div className="text-[10px] uppercase tracking-wider text-neutral-500">Trading P&L{capital.baseline ? ` since ${new Date(capital.baseline.date + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}` : ''}</div>
                {/* Build request #7: the ONLY headline P&L — deposit-adjusted. value − baseline − net flows since the baseline. */}
                {!capital.reachable ? <div className="text-[12px] text-red-600 dark:text-rose-300">capital_flows unreachable — unknown, not zero</div>
                : !capital.baseline ? <div className="text-[12px] text-amber-800 dark:text-amber-200">no baseline row in capital_flows</div>
                : allPriced ? (() => {
                    const capIn = capital.baseline.usd + capital.net_flows
                    const pnl = book - capIn
                    const pct = capIn > 0 ? (pnl / capIn) * 100 : 0
                    return (
                      <>
                        <div className={`font-mono text-[28px] font-black leading-tight ${pnl >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>{usd2(pnl)} <span className="text-[14px]">({pnl >= 0 ? '+' : ''}{pct.toFixed(1)}%)</span></div>
                        <div className="text-[10px] text-neutral-500">capital in {usd2(capIn)} = baseline {usd2(capital.baseline.usd)} {capital.net_flows >= 0 ? '+' : '−'} {usd2(Math.abs(capital.net_flows))} deposits · deposit-adjusted</div>
                      </>
                    )
                  })()
                : <div className="text-[12px] text-neutral-500">pricing…</div>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[12px] tabular-nums">
                <thead>
                  <tr className="text-left text-[10px] uppercase tracking-wider text-neutral-500">
                    <th className="py-1 pr-2">Asset</th><th className="pr-2 text-right">Price</th><th className="pr-2 text-right">24h</th><th className="pr-2 text-right">Qty</th>
                    <th className="pr-2 text-right">Entry</th><th className="pr-2 text-right">Value · weight</th><th className="pr-2 text-right">P&L vs entry</th><th className="pr-2 text-right">Stop</th><th className="text-right">Thesis</th>
                  </tr>
                </thead>
                <tbody>
                  {[...positions].sort((a, b) => val(b) - val(a)).map((p) => {
                    const lv = live[p.symbol]; const now = lv?.price ?? null
                    const value = now !== null ? Number(p.qty) * now : null
                    const entry = Number(p.avg_cost) > 0 ? Number(p.avg_cost) : null
                    const pnl = value !== null && entry ? value - Number(p.qty) * entry : null
                    const pct = now !== null && entry ? ((now - entry) / entry) * 100 : null
                    const stop = stopFor(p.symbol)
                    const weight = value !== null && book > 0 ? (value / book) * 100 : null
                    const th = thesisFor(p.symbol)
                    const role = ANCHOR.has(p.symbol) ? 'anchor' : 'sleeve'
                    return (
                      <>
                        <tr key={p.symbol} className="border-t border-neutral-100 dark:border-white/5">
                          <td className="py-1.5 pr-2">
                            <button type="button" onClick={() => setOpen(p.symbol)} className="text-left" title="1-year chart with entry and stop">
                              <span className="text-[15px] font-black text-rose-600 dark:text-rose-300">{p.symbol}</span>
                              <span className={`ml-1.5 rounded px-1 py-px text-[9px] font-bold uppercase tracking-wide ${role === 'anchor' ? 'bg-rose-100 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300' : 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200'}`}>{role}</span>
                            </button>
                          </td>
                          <td className="pr-2 text-right font-mono text-[13px] font-bold text-neutral-800 dark:text-neutral-100">{now !== null ? fmt(now) : '…'}</td>
                          <td className="pr-2 text-right"><Pct v={lv?.d1} /></td>
                          <td className="pr-2 text-right font-mono text-neutral-700 dark:text-neutral-300">{p.qty}</td>
                          <td className="pr-2 text-right font-mono text-neutral-700 dark:text-neutral-300">{entry ? fmt(entry) : 'n/a'}</td>
                          <td className="pr-2 text-right">
                            <span className="font-mono text-neutral-800 dark:text-neutral-100">{value !== null ? usd2(value) : '…'}</span>
                            {weight !== null && (
                              <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
                                <span className="inline-block h-1.5 w-12 overflow-hidden rounded bg-neutral-100 dark:bg-white/10"><span className={`block h-full ${role === 'anchor' ? 'bg-rose-400' : 'bg-amber-400'}`} style={{ width: `${Math.min(100, weight)}%` }} /></span>
                                <span className="font-mono text-[10px] text-neutral-500">{weight.toFixed(0)}%</span>
                              </span>
                            )}
                          </td>
                          <td className="pr-2 text-right">
                            {pnl !== null && pct !== null ? (
                              <span className={`inline-block rounded-md px-1.5 py-px font-mono font-bold ${pnl >= 0 ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-400/15 dark:text-rose-300'}`}>{usd2(pnl)} · {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%</span>
                            ) : <span className="text-neutral-400">—</span>}
                          </td>
                          <td className="pr-2 text-right">
                            {stop !== null ? <span className="font-mono text-amber-700 dark:text-amber-300">{fmt(Number(stop))}{now !== null && <span className="text-[10px] text-neutral-500"> ({(((Number(stop) - now) / now) * 100).toFixed(1)}%)</span>}</span>
                              : <span className="rounded bg-rose-600 px-1 py-px text-[10px] font-bold text-white">NO STOP</span>}
                          </td>
                          <td className="text-right">
                            {th ? <button type="button" onClick={() => setThesisOpen((o) => ({ ...o, [p.symbol]: !o[p.symbol] }))} className="rounded-md bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-neutral-600 hover:bg-neutral-200 dark:bg-white/10 dark:text-neutral-300">{thesisOpen[p.symbol] ? 'hide' : th.status}</button>
                              : <span className="text-[10px] text-neutral-400">none</span>}
                          </td>
                        </tr>
                        {th && thesisOpen[p.symbol] && (
                          <tr key={`${p.symbol}-th`}>
                            <td colSpan={9} className="pb-1.5 text-[12px] leading-snug text-neutral-600 dark:text-neutral-400">{th.thesis}{th.gate && <span className="text-teal-700 dark:text-teal-300"> · gate → {th.gate}</span>}</td>
                          </tr>
                        )}
                      </>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Constitution v4/v4.1 structure strip: anchor BTC+SOL ≥55% · sleeve ≤45% across min(7, floor(book/$150)) slots (≤10% each, $50 min) · cash floor 10% · anchor tilt */}
            {allPriced && book > 0 && (() => {
              const anchor = positions.filter((p) => ANCHOR.has(p.symbol)).reduce((s, p) => s + val(p), 0)
              const sleeve = positions.filter((p) => !ANCHOR.has(p.symbol))
              const sleeveV = sleeve.reduce((s, p) => s + val(p), 0)
              const aPct = (anchor / book) * 100, sPct = (sleeveV / book) * 100, cPct = (cash / book) * 100
              const slots = Math.min(7, Math.floor(book / 150))              // v4.1 §2 slot formula
              const minPos = book >= 500 ? 50 : null                          // minimum sleeve position once the book is ≥ $500
              const fat = sleeve.filter((p) => val(p) / book > 0.10).map((p) => p.symbol)
              const solD30 = live['SOL']?.d30 ?? null, btcD30 = live['BTC']?.d30 ?? null
              const tilt = solD30 != null && btcD30 != null ? (solD30 > btcD30 ? '60/40 SOL/BTC' : '50/50') : null   // v4.1 §4 anchor tilt on the 30d SOL/BTC ratio
              const flags = [
                aPct < 55 ? `anchor ${aPct.toFixed(0)}% < 55%` : '',
                cPct < 10 ? `cash ${cPct.toFixed(0)}% < 10% floor — no new sleeve entries` : '',
                sleeve.length > slots ? `sleeve ${sleeve.length} names > ${slots} slots` : '',
                fat.length ? `over 10%: ${fat.join(', ')}` : '',
              ].filter(Boolean)
              return (
                <div className="mt-2">
                  <div className="flex h-2 w-full overflow-hidden rounded bg-neutral-100 dark:bg-white/10" title="anchor · sleeve · cash">
                    <div className="bg-rose-400/80" style={{ width: `${aPct}%` }} />
                    <div className="bg-amber-400/80" style={{ width: `${sPct}%` }} />
                    <div className="bg-neutral-400/60" style={{ width: `${cPct}%` }} />
                  </div>
                  <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-neutral-600 dark:text-neutral-400">
                    <span>v4.1 structure:</span>
                    <span><b className="text-rose-600 dark:text-rose-300">anchor</b> BTC/SOL <span className="font-mono">{aPct.toFixed(0)}%</span> <span className="text-neutral-400">(≥55%{tilt ? ` · basket ${tilt}` : ''})</span></span>
                    <span><b className="text-amber-700 dark:text-amber-300">sleeve</b> <span className="font-mono">{sPct.toFixed(0)}%</span> · slots <span className="font-mono">{sleeve.length}/{slots}</span> <span className="text-neutral-400">(≤45%, ≤10% each{minPos ? `, $${minPos} min` : ''})</span></span>
                    <span><b>cash</b> <span className="font-mono">{cPct.toFixed(0)}%</span> <span className="text-neutral-400">(floor 10%)</span></span>
                    <span className="text-neutral-400">holdings {positions.length}/10</span>
                  </div>
                  {flags.length > 0 && <div className="mt-0.5 text-[11px] font-medium text-amber-800 dark:text-amber-200">⚠ {flags.join(' · ')}</div>}
                </div>
              )
            })()}
          </>
        )}
      </Panel>

      {/* ── 2. UP NEXT — the queue, with timing grades and the buy button; one chart with everything on it ── */}
      <Panel accent="amber" title="★ Up next — in line to add"
        right={<span className="text-[11px] text-neutral-500">POLE → WATCH → VERIFYING · numbers live, never from thesis text · holdings excluded</span>}>
        {state.theses === null ? (
          <span className="text-[13px] text-red-600">Theses unreachable — fetch failed, not empty.</span>
        ) : queue.length === 0 ? (
          <span className="text-[13px] text-amber-800 dark:text-amber-200">Nothing in line{heldPole ? ` — desk_theses names ${heldPole.symbol} as POLE but it is held; desk must promote a candidate` : ''}.</span>
        ) : (
          <div className="divide-y divide-neutral-100 dark:divide-white/5">
            {heldPole && <div className="pb-1 text-[11px] text-amber-800 dark:text-amber-200">desk_theses POLE row is {heldPole.symbol}, which is held — suppressed; the first name below is not a pole until the desk promotes it.</div>}
            {/* Jacob 2026-09-11: "i only want things on that list that are a c+ or higher". D and F are
                collapsed, not deleted. A name that has not been checked yet, or that could not be graded
                for want of a live price ('?'), still shows — hiding those would hide the good ones, which
                is exactly what happened when a rate limit turned five B-scoring names into Fs. */}
            {queueRanked.map((t, rank) => {
              const lv = live[t.symbol]; const r = radarFor(t.symbol); const fl = flowFor(t.symbol)
              const lines = trig(t.symbol, ['bid', 'deep_rung', 'entry', 'dump', 'reclaim'])
              const tm = timing[t.symbol]; const br = buying[t.symbol]
              const T = tm && tm !== 'loading' && !('error' in tm) ? tm : null
              const belowC = T != null && (T.grade === 'D' || T.grade === 'F')   // '?' and errors stay visible on purpose
              if (belowC && !showBelowC) return null
              return (
                <div key={t.symbol} className="py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px]">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-800 font-mono text-[11px] font-bold text-white dark:bg-white dark:text-black">{rank + 1}</span>
                    <span className="text-[16px] font-black text-neutral-800 dark:text-neutral-100">{t.symbol}</span>
                    <span className={`rounded px-1.5 py-px text-[9px] font-bold uppercase tracking-wide ${STATUS[t.status] ?? 'bg-neutral-100 text-neutral-600'}`}>{t.status}</span>
                    <span className="font-mono text-[14px] font-bold tabular-nums text-neutral-800 dark:text-neutral-100">{lv ? fmt(lv.price) : '…'}</span>
                    <span className="text-neutral-500">24h <Pct v={lv?.d1} /> · 7d <Pct v={lv?.d7} /> · 30d <Pct v={lv?.d30} /></span>
                    {lv?.vol != null && <span className="text-neutral-500">vol {big(lv.vol)}</span>}
                    {lines.map((l, i) => (
                      <span key={i} className="text-teal-700 dark:text-teal-300">{l.kind} <b className="font-mono">{fmt(Number(l.level))}</b>{lv && <span className="text-neutral-500"> ({(((Number(l.level) - lv.price) / lv.price) * 100).toFixed(1)}% away)</span>}</span>
                    ))}
                    {fl && fl.flow_score != null && <span className={`rounded px-1.5 py-px text-[10px] font-bold ${fl.stage === 'PRE-EARLY' || fl.stage === 'RISING' ? 'bg-sky-100 text-sky-800 dark:bg-sky-400/20 dark:text-sky-200' : 'bg-neutral-100 text-neutral-600 dark:bg-white/10 dark:text-neutral-300'}`} title={`flow radar ${fl.scan_date}`}>flow {fl.flow_score >= 0 ? '+' : ''}{Number(fl.flow_score).toFixed(0)} · {fl.stage}</span>}
                    {r && <span className="text-[11px] text-neutral-500">radar {r.stage} · {Number(r.score).toFixed(0)} · turn {Number(r.turnover).toFixed(0)}%</span>}
                    <span className="ml-auto flex items-center gap-1.5">
                      <button type="button" onClick={() => checkTiming(t.symbol)} disabled={tm === 'loading'}
                        className="rounded-lg bg-neutral-800 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-neutral-700 disabled:opacity-50 dark:bg-white dark:text-black dark:hover:bg-neutral-200">
                        {tm === 'loading' ? 'checking…' : T ? `Timing ${T.grade} · hide` : 'Timing A–F'}
                      </button>
                      {T && T.rh_configured && T.buyable && (
                        <button type="button" onClick={() => buy(t.symbol, T, false)} disabled={br === 'working'}
                          className="rounded-lg bg-emerald-600 px-2.5 py-1 text-[11px] font-bold text-white hover:bg-emerald-500 disabled:opacity-50">
                          {br === 'working' ? 'placing…' : `Buy $${T.size.usd.toFixed(0)}`}
                        </button>
                      )}
                      {T && T.rh_configured && !T.buyable && T.overridable && (
                        <button type="button" onClick={() => buy(t.symbol, T, true)} disabled={br === 'working'}
                          className="rounded-lg border border-amber-500 px-2.5 py-1 text-[11px] font-bold text-amber-700 hover:bg-amber-50 disabled:opacity-50 dark:text-amber-300 dark:hover:bg-amber-400/10">
                          {br === 'working' ? 'placing…' : `Override · buy $${T.size.usd.toFixed(0)}`}
                        </button>
                      )}
                      {T && !T.rh_configured && (
                        <a href={`https://robinhood.com/crypto/${t.symbol}`} target="_blank" rel="noreferrer"
                          className="rounded-lg border border-emerald-600 px-2.5 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-400/10" title="Robinhood API keys are not set in Vercel — opens the app instead">
                          Open in Robinhood ↗
                        </a>
                      )}
                    </span>
                  </div>
                  <div className="mt-0.5 text-[12px] leading-snug text-neutral-600 dark:text-neutral-400">{t.thesis}{t.gate && <span className="text-teal-700 dark:text-teal-300"> · gate → {t.gate}</span>}</div>

                  {tm && tm !== 'loading' && 'error' in tm && <div className="mt-1 text-[12px] text-red-600 dark:text-rose-300">Timing check failed: {tm.error}</div>}
                  {T?.tapeError && T.hi20 === null && (
                    <div className="mt-1 rounded-lg border border-rose-400/50 bg-rose-500/10 px-2 py-1 text-[12px] leading-snug text-rose-700 dark:text-rose-300">
                      <b>Tape unread — grade is not trustworthy.</b> {T.tapeError}. Without the
                      20-day high the RUNNING extension law cannot be checked, so the desk refuses
                      the entry rather than clearing it on data it does not have. Re-run the check.
                    </div>
                  )}
                  {T?.tapeError && T.hi20 !== null && (
                    <div className="mt-1 rounded-lg border border-amber-400/50 bg-amber-400/10 px-2 py-1 text-[12px] leading-snug text-amber-700 dark:text-amber-300">
                      <b>Volume unconfirmed.</b> {T.tapeError}. The 20-day high came from the
                      stored daily series, so the RUNNING law was still checked — only the
                      volume-vs-average test is missing from this grade.
                    </div>
                  )}
                  {T && (
                    <div className="mt-1.5 rounded-xl border border-neutral-200 bg-neutral-50 p-2.5 dark:border-white/10 dark:bg-white/5">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className={`flex h-12 w-12 items-center justify-center rounded-xl text-[26px] font-black ${GRADE[T.grade]}`}>{T.grade}</span>
                        <div className="text-[12px] leading-snug">
                          <div className="font-bold text-neutral-800 dark:text-neutral-100">Timing {T.score}/100 · {T.hard.length ? 'BARRED by law' : T.buyable ? 'clear to buy' : 'soft bars — override only'}</div>
                          <div className="text-neutral-500">as of {denver(T.at)} · price <b className="font-mono text-neutral-700 dark:text-neutral-200">{fmt(T.price)}</b> · 24h volume <b className="font-mono text-neutral-700 dark:text-neutral-200">{T.vol24h != null ? big(T.vol24h) : '—'}</b>{T.volX != null && <span> ({T.volX.toFixed(1)}× its 20d avg)</span>}</div>
                          <div className="text-neutral-500">24h <Pct v={T.d1} /> · 7d <Pct v={T.d7} /> · 30d <Pct v={T.d30} /> · vs 20d high <Pct v={T.extPct} /> · vs BTC 7d <Pct v={T.rs7VsBtc} /></div>
                        </div>
                        <div className="ml-auto text-right text-[12px]">
                          <div className="text-neutral-500">ruled size</div>
                          <div className="font-mono text-[15px] font-bold text-neutral-800 dark:text-neutral-100">${T.size.usd.toFixed(2)} <span className="text-[11px] font-normal text-neutral-500">({T.size.pctBook.toFixed(1)}% of ${T.book.toFixed(0)}{T.size.halfSize ? ', half-size' : ''})</span></div>
                          <div className="text-neutral-500">stop at fill <b className="font-mono text-amber-700 dark:text-amber-300">{fmt(T.stop.price)}</b> ({T.stop.pct.toFixed(0)}%)</div>
                        </div>
                      </div>
                      <div className="mt-1.5 grid gap-x-4 gap-y-0.5 text-[11px] sm:grid-cols-2">
                        {T.hard.map((x, i) => <div key={`h${i}`} className="text-rose-700 dark:text-rose-300">⛔ {x}</div>)}
                        {T.plus.map((x, i) => <div key={`p${i}`} className="text-emerald-700 dark:text-emerald-300">{x}</div>)}
                        {T.soft.map((x, i) => <div key={`s${i}`} className="text-amber-800 dark:text-amber-200">{x}</div>)}
                        <div className="text-neutral-500">slots {T.sleeveCount}/{T.slots} · entries this week {T.weeklyEntries}/2 · cash ${T.cash.toFixed(0)}{T.blackout ? ` · ${T.blackout}` : ''}</div>
                      </div>
                      {!T.rh_configured && <div className="mt-1 text-[11px] text-neutral-500">Tap-to-buy needs Robinhood API credentials (RH_API_KEY + RH_PRIVATE_KEY) in Vercel env. Until then the button opens the Robinhood app; size and stop above are the order to place by hand.</div>}
                    </div>
                  )}
                  {br && br !== 'working' && (
                    <div className={`mt-1.5 rounded-xl border p-2 text-[12px] ${br.ok ? 'border-emerald-500 bg-emerald-50 text-emerald-900 dark:bg-emerald-400/10 dark:text-emerald-200' : 'border-rose-500 bg-rose-50 text-rose-900 dark:bg-rose-400/10 dark:text-rose-200'}`}>
                      {br.ok ? <>✅ Bought <b className="font-mono">{br.qty} {t.symbol}</b> @ <b className="font-mono">{fmt(br.avg_price ?? 0)}</b> (${(br.notional ?? 0).toFixed(2)}, order {br.order_id?.slice(0, 8)}). {br.stop ? <>Stop-limit <b className="font-mono">{br.stop.stop}/{br.stop.limit}</b> placed (order {br.stop.order_id.slice(0, 8)}).</> : <b>⚠ STOP NOT PLACED{br.stop_error ? `: ${br.stop_error}` : ''} — place it now in the app.</b>}{br.ledger_errors?.length ? <span> Ledger: {br.ledger_errors.join('; ')}</span> : ''}</>
                        : <>❌ {br.message ?? br.error ?? `order state ${br.state ?? 'unknown'}`}</>}
                    </div>
                  )}
                </div>
              )
            })}
            {/* The C+ filter hides names, so it must always say how many and let you look. A quiet
                filter that silently drops a name is the same failure as a zero standing in for a
                fetch that failed. */}
            {(() => {
              const below = queue.filter((t) => {
                const tm = timing[t.symbol]
                const T = tm && tm !== 'loading' && !('error' in tm) ? tm : null
                return T != null && (T.grade === 'D' || T.grade === 'F')
              })
              if (!below.length) return null
              return (
                <button type="button" onClick={() => setShowBelowC((v) => !v)}
                  className="w-full py-1.5 text-left text-[11px] font-bold uppercase tracking-wider text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300">
                  {showBelowC ? '▾ hide' : '▸ show'} {below.length} below C · {below.map((t) => t.symbol).join(' ')}
                </button>
              )
            })()}
          </div>
        )}
        {poleSym && (
          <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
            ★ POLE is <b>{poleSym}</b> — best live grade among names with a VERIFIED mechanism.
            {topGraded && topGraded !== poleSym && <> {topGraded} grades higher but its thesis is still unverified, so it is a candidate, not the pole.</>}
          </div>
        )}
        {!poleSym && topGraded && (
          <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
            ★ POLE is VACANT — {topGraded} is the best grade but no queued name has a verified mechanism yet. Verify one before it can be pole.
          </div>
        )}
        {boardPoleSym && held.has(boardPoleSym) && (
          <div className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">Session board still names {boardPoleSym} as pole but it is held — desk to refresh the board.</div>
        )}
        {perfItems.length > 0 && (
          <div className="mt-2 border-t border-neutral-100 pt-2 dark:border-white/5">
            <div className="mb-1 text-[11px] font-bold uppercase tracking-wider text-neutral-500">Where they are — every holding and every name in line, one chart</div>
            <PerfChart items={perfItems} secret={secret} />
          </div>
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
