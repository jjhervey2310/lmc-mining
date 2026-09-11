'use client'

import { useState } from 'react'

/** One preregistered paper decision, with every level it was judged against. */
export type Trade = {
  id: string
  rule: string | null
  market: string
  side: string
  opened_at: string
  closed_at: string | null
  entry_price: number | null
  exit_price: number | null
  stop_price: number | null
  target_price: number | null
  liquidation_price: number | null
  realized_pnl_usd: number | null
  notional_usd: number | null
  status: string
  exit_reason: string | null
  thesis: string | null
}

export type Candle = {
  symbol: string
  bar_time: string
  open: number
  high: number
  low: number
  close: number
}

const W = 760
const H = 260
const PAD = { l: 8, r: 64, t: 12, b: 20 }

/** Price line with the decision's own levels drawn across it.
 *
 *  Candles rather than a close-only line, because a stop and a liquidation are hit by the
 *  LOW of a bar, not by its close — a close-only chart would show a trade surviving a bar
 *  that in fact ended it, which is the one thing this picture must never do. */
function Chart({ trade, candles }: { trade: Trade; candles: Candle[] }) {
  const opened = new Date(trade.opened_at).getTime()
  const closed = trade.closed_at ? new Date(trade.closed_at).getTime() : Date.now()
  const span = Math.max(closed - opened, 60_000)

  // Show the trade with breathing room either side, so the entry is in context rather
  // than jammed against the left edge.
  const from = opened - span * 0.6
  const to = closed + span * 0.6
  const rows = candles
    .filter((c) => c.symbol === trade.market)
    .map((c) => ({ ...c, t: new Date(c.bar_time).getTime() }))
    .filter((c) => c.t >= from && c.t <= to)
    .sort((a, b) => a.t - b.t)

  if (rows.length < 2) {
    return (
      <div className="flex h-[260px] items-center justify-center rounded-lg border border-dashed border-neutral-300 text-[12px] text-neutral-500 dark:border-white/15 dark:text-neutral-400">
        No stored bars covering this decision — 5-minute history is only kept for a few days.
      </div>
    )
  }

  const levels = [
    { v: trade.entry_price, label: 'entry', cls: 'stroke-sky-500', text: 'fill-sky-600 dark:fill-sky-300', dash: '' },
    { v: trade.exit_price, label: 'exit', cls: 'stroke-neutral-500', text: 'fill-neutral-600 dark:fill-neutral-300', dash: '4 3' },
    { v: trade.stop_price, label: 'stop', cls: 'stroke-rose-500', text: 'fill-rose-600 dark:fill-rose-400', dash: '5 4' },
    { v: trade.target_price, label: 'target', cls: 'stroke-emerald-500', text: 'fill-emerald-600 dark:fill-emerald-400', dash: '5 4' },
    { v: trade.liquidation_price, label: 'liquidation', cls: 'stroke-rose-700', text: 'fill-rose-700 dark:fill-rose-500', dash: '2 3' },
  ].filter((l): l is typeof l & { v: number } => typeof l.v === 'number' && l.v > 0)

  const prices = [...rows.flatMap((r) => [r.high, r.low]), ...levels.map((l) => l.v)]
  const lo = Math.min(...prices)
  const hi = Math.max(...prices)
  const pad = (hi - lo) * 0.08 || hi * 0.01
  const yMin = lo - pad
  const yMax = hi + pad

  const x = (t: number) => PAD.l + ((t - from) / (to - from)) * (W - PAD.l - PAD.r)
  const y = (p: number) => PAD.t + (1 - (p - yMin) / (yMax - yMin)) * (H - PAD.t - PAD.b)
  const bw = Math.max(1.4, (W - PAD.l - PAD.r) / rows.length * 0.62)
  const fmt = (p: number) => p >= 1000 ? p.toFixed(0) : p >= 1 ? p.toFixed(3) : p.toFixed(6)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
         aria-label={`${trade.market} price around a ${trade.side} decision`}>
      {/* The window the position was actually open. */}
      <rect x={x(opened)} y={PAD.t} width={Math.max(1, x(closed) - x(opened))}
            height={H - PAD.t - PAD.b}
            className="fill-sky-500/10 dark:fill-sky-300/10" />

      {rows.map((r) => {
        const up = r.close >= r.open
        return (
          <g key={r.t} className={up ? 'stroke-emerald-500 fill-emerald-500'
                                     : 'stroke-rose-500 fill-rose-500'}>
            <line x1={x(r.t)} x2={x(r.t)} y1={y(r.high)} y2={y(r.low)} strokeWidth={1} />
            <rect x={x(r.t) - bw / 2} y={y(Math.max(r.open, r.close))} width={bw}
                  height={Math.max(1, Math.abs(y(r.open) - y(r.close)))} />
          </g>
        )
      })}

      {levels.map((l) => (
        <g key={l.label}>
          <line x1={PAD.l} x2={W - PAD.r} y1={y(l.v)} y2={y(l.v)}
                className={l.cls} strokeWidth={1.2} strokeDasharray={l.dash} />
          <text x={W - PAD.r + 4} y={y(l.v) + 3} className={`${l.text} font-mono`} fontSize={9}>
            {l.label} {fmt(l.v)}
          </text>
        </g>
      ))}
    </svg>
  )
}

export default function PaperTrades({ trades, candles }: { trades: Trade[]; candles: Candle[] }) {
  const [picked, setPicked] = useState(trades[0]?.id ?? null)
  const trade = trades.find((t) => t.id === picked) ?? trades[0]
  if (!trade) return null

  const pnl = trade.realized_pnl_usd ?? 0
  const pct = trade.notional_usd ? (pnl / trade.notional_usd) * 100 : null

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <div className="max-h-[340px] overflow-y-auto rounded-lg border border-neutral-200 dark:border-white/10">
        {trades.map((t) => {
          const p = t.realized_pnl_usd ?? 0
          const on = t.id === trade.id
          return (
            <button key={t.id} onClick={() => setPicked(t.id)}
              className={`flex w-full items-center justify-between gap-2 border-b border-neutral-100 px-2.5 py-1.5 text-left last:border-0 dark:border-white/5 ${
                on ? 'bg-sky-50 dark:bg-sky-400/10' : 'hover:bg-neutral-50 dark:hover:bg-white/5'}`}>
              <span className="min-w-0">
                <span className="block truncate text-[12px] font-semibold">{t.market}</span>
                <span className="block truncate font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
                  {t.rule ?? 'manual'}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`block font-mono text-[11px] font-semibold ${
                  p > 0 ? 'text-emerald-600 dark:text-emerald-400'
                        : p < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-500'}`}>
                  {p >= 0 ? '+' : ''}{p.toFixed(2)}
                </span>
                <span className={`block text-[9px] uppercase tracking-wider ${
                  t.side === 'short' ? 'text-rose-500' : 'text-emerald-500'}`}>{t.side}</span>
              </span>
            </button>
          )
        })}
      </div>

      <div className="min-w-0">
        <div className="mb-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[14px] font-bold">{trade.market}</span>
          <span className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
            {trade.rule ?? 'manual'}
          </span>
          <span className={`font-mono text-[12px] font-semibold ${
            pnl > 0 ? 'text-emerald-600 dark:text-emerald-400'
                    : pnl < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-neutral-500'}`}>
            {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
            {pct !== null && ` (${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%)`}
          </span>
          {trade.exit_reason && (
            <span className="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-neutral-600 dark:bg-white/10 dark:text-neutral-300">
              {trade.exit_reason}
            </span>
          )}
        </div>

        <Chart trade={trade} candles={candles} />

        {trade.thesis && (
          <div className="mt-1.5 text-[11px] leading-relaxed text-neutral-600 dark:text-neutral-400">
            <b className="text-neutral-800 dark:text-neutral-200">Why it was taken:</b>{' '}
            {trade.thesis}
          </div>
        )}
      </div>
    </div>
  )
}
