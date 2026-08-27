'use client'

import React, { useState } from 'react'
import RivalEntry from './competition'
import TrendChart from './trend-chart'

// Interactive competition panel: click a contestant on the leaderboard and the
// whole panel switches to their book — positions, spend, live value, P&L, and
// their full trade history. Every book is priced by the same feed server-side.

interface Pos {
  symbol: string; qty: number; avg: number; spent: number
  live: number | null; value: number | null; pnl: number | null
  /** quote older than 10 min — must not be shown as a live tick */
  stale?: boolean
  /** equity quote carried from the last session (weekend/after-hours) */
  sessionClose?: boolean
  quotedAt?: number | null
}
interface Trade { traded_at: string; action: string; symbol: string; qty: number; price: number; note: string | null }
export interface CompBook {
  key: string
  name: string
  week: string
  total: number | null
  cash: number | null
  holdings: number | null
  /** profit banked on closed size — survives after a position is sold */
  realized?: number | null
  positions: Pos[]
  trades: Trade[]
}

const usd = (n: number, d = 2) => n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })
const px = (n: number) => `$${usd(n, n < 10 ? 4 : 2)}`

// Brand identities (Jacob 2026-08-01): Claude = orange, ChatGPT = its logo
// emerald, Gemini = the Google rainbow.
const GOOGLE_RAINBOW = 'linear-gradient(90deg,#4285F4,#EA4335,#FBBC05,#34A853)'
const BRAND: Record<string, { chip: string; chipSel: string; name: string; nameStyle?: React.CSSProperties; tile: string; value: string }> = {
  claude: {
    chip: 'border-amber-400 bg-amber-50 hover:bg-amber-100 dark:bg-amber-400/10 dark:hover:bg-amber-400/20',
    chipSel: 'border-amber-500 bg-amber-100 ring-2 ring-amber-400 dark:bg-amber-400/20',
    name: 'font-bold text-amber-700 dark:text-amber-300',
    tile: 'border-t-amber-500 from-amber-50 dark:from-amber-400/20',
    value: 'text-amber-700 dark:text-amber-300',
  },
  gpt: {
    chip: 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/20',
    chipSel: 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-400 dark:bg-emerald-400/20',
    name: 'font-bold text-emerald-700 dark:text-emerald-300',
    tile: 'border-t-emerald-500 from-emerald-50 dark:from-emerald-400/20',
    value: 'text-emerald-700 dark:text-emerald-300',
  },
  gemini: {
    chip: 'border-blue-400 bg-gradient-to-r from-blue-50 via-yellow-50 to-green-50 hover:brightness-95 dark:from-blue-400/15 dark:via-yellow-400/15 dark:to-green-400/15',
    chipSel: 'border-blue-500 bg-gradient-to-r from-blue-100 via-yellow-100 to-green-100 ring-2 ring-blue-400 dark:from-blue-400/25 dark:via-yellow-400/25 dark:to-green-400/25',
    name: 'font-bold bg-clip-text text-transparent',
    nameStyle: { backgroundImage: GOOGLE_RAINBOW },
    tile: 'border-t-blue-500 from-blue-50 via-yellow-50 dark:from-blue-400/20 dark:via-yellow-400/10',
    value: 'text-blue-700 dark:text-sky-300',
  },
}

export interface DailyCurve { days: string[]; totals: Record<string, number[]> }

const CURVE_COLOR: Record<string, string> = { claude: '#fbbf24', gpt: '#34d399', gemini: '#60a5fa' }

interface Hist { points: { date: string; close: number }[]; entry: string; avg: number }

export default function CompPanel({ books, start, secret, daily }: { books: CompBook[]; start: number; secret: string; daily?: DailyCurve }) {
  const [sel, setSel] = useState('claude')
  const b = books.find((x) => x.key === sel) ?? books[0]
  const totalPnl = b.positions.reduce((s, p) => s + (p.pnl ?? 0), 0)

  // Per-holding price chart, opened by clicking a row. Cached per book+symbol
  // so re-opening a position doesn't re-hit the feed.
  const [openSym, setOpenSym] = useState<string | null>(null)
  const [hist, setHist] = useState<Record<string, Hist | { error: string } | 'loading'>>({})

  /** The day this book first bought the symbol — that's where the chart starts. */
  const entryDate = (symbol: string) => {
    const buys = b.trades
      .filter((t) => t.symbol === symbol && /buy/i.test(t.action))
      .map((t) => t.traded_at)
      .sort()
    return buys[0] ?? null
  }

  async function toggle(p: Pos) {
    if (openSym === p.symbol) { setOpenSym(null); return }
    setOpenSym(p.symbol)
    const cacheKey = `${b.key}:${p.symbol}`
    if (hist[cacheKey]) return
    const from = entryDate(p.symbol)
    setHist((h) => ({ ...h, [cacheKey]: 'loading' }))
    try {
      const q = new URLSearchParams({ secret, symbol: p.symbol })
      if (from) q.set('from', from)
      const res = await fetch(`/api/admin/history?${q}`)
      const d = await res.json()
      setHist((h) => ({
        ...h,
        [cacheKey]: res.ok && d.points?.length
          ? { points: d.points, entry: from ? String(from).slice(0, 10) : '', avg: p.avg }
          : { error: d.error || 'no history available' },
      }))
    } catch {
      setHist((h) => ({ ...h, [cacheKey]: { error: 'could not reach the price feed' } }))
    }
  }

  return (
    <div>
      {/* Leaderboard — click a name to open that book below */}
      <div className="mb-3 flex flex-wrap gap-2">
        {books.map((x, i) => {
          const br = BRAND[x.key] ?? BRAND.claude
          return (
            <button key={x.key} onClick={() => setSel(x.key)} aria-label={`${x.name} — show book`}
              className={`border px-3 py-1.5 text-left font-mono text-[13px] transition-all ${x.key === sel ? br.chipSel : br.chip}`}>
              <span className="text-neutral-500">#{i + 1}{i === 0 && x.total != null ? ' 🏆' : ''}</span>{' '}
              <span className={br.name} style={br.nameStyle}>{x.name}</span>{' '}
              <span className={x.total == null ? 'text-neutral-400' : x.total >= start ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}>
                {x.total != null ? `$${usd(x.total)}` : 'no report'}
              </span>{' '}
              <span className="text-[10px] text-neutral-400">{x.week}</span>
            </button>
          )
        })}
        <span className="self-center text-[11px] text-neutral-400">click a name for the full book ↓</span>
      </div>

      {/* Selected contestant's book */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-5">
        {[
          { label: `${b.name} total`, value: b.total != null ? `$${usd(b.total)}` : '—', tone: b.total == null ? '' : b.total >= start ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300' },
          { label: 'Cash in bank', value: b.cash != null ? `$${usd(b.cash)}` : '—', tone: '' },
          { label: 'Holdings value', value: b.holdings != null ? `$${usd(b.holdings)}` : '—', tone: '' },
          { label: 'Unrealized P&L', value: b.positions.length ? `${totalPnl >= 0 ? '+' : '-'}$${usd(Math.abs(totalPnl))}` : '—', tone: totalPnl >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300' },
          { label: 'Realized P&L', value: b.realized == null ? '—' : `${b.realized >= 0 ? '+' : '-'}$${usd(Math.abs(b.realized))}`, tone: (b.realized ?? 0) >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300' },
        ].map((t) => {
          const br = BRAND[b.key] ?? BRAND.claude
          return (
            <div key={t.label} className={`lmc-card lmc-lift rounded-xl border border-neutral-200 border-t-4 bg-gradient-to-b to-white px-3 py-2 shadow-md dark:border-white/10 dark:to-neutral-900/60 ${br.tile}`}>
              <div className="text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">{t.label}</div>
              <div className={`lmc-figure lmc-pop font-mono text-[26px] font-black leading-tight tabular-nums ${t.tone || br.value}`}>{t.value}</div>
            </div>
          )
        })}
      </div>

      {b.positions.length ? (
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] max-w-2xl border border-neutral-200 font-mono text-[12px] dark:border-white/10">
          <thead>
            <tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-wide text-neutral-500 dark:bg-white/[0.06] dark:text-neutral-400">
              <th className="px-2 py-1">held</th>
              <th className="px-2 py-1">qty</th>
              <th className="px-2 py-1">paid avg</th>
              <th className="px-2 py-1">spent</th>
              <th className="px-2 py-1">now</th>
              <th className="px-2 py-1">value</th>
              <th className="px-2 py-1">p&l</th>
            </tr>
          </thead>
          <tbody>
            {b.positions.map((p) => {
              const cacheKey = `${b.key}:${p.symbol}`
              const h = hist[cacheKey]
              const isOpen = openSym === p.symbol
              return (
              <React.Fragment key={p.symbol}>
              <tr onClick={() => toggle(p)} title={`${p.symbol} — price since ${b.name} bought it`}
                className={`cursor-pointer border-t border-neutral-100 transition-colors hover:bg-amber-50 dark:border-white/5 dark:hover:bg-white/[0.06] ${isOpen ? 'bg-amber-50 dark:bg-white/[0.06]' : ''}`}>
                <td className="px-2 py-1 font-semibold text-amber-700 dark:text-amber-300">
                  <span className="mr-1 inline-block text-[9px] text-neutral-400">{isOpen ? '▾' : '▸'}</span>{p.symbol}
                </td>
                <td className="px-2 py-1">{p.qty.toLocaleString('en-US', { maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1">{px(p.avg)}</td>
                <td className="px-2 py-1">${usd(p.spent)}</td>
                <td className="px-2 py-1">
                  {p.live == null ? '—' : (
                    <span className={p.stale ? 'text-neutral-500 dark:text-neutral-400' : ''}>
                      {px(p.live)}
                      {p.stale && <span className="ml-1 rounded bg-neutral-200 px-1 text-[9px] uppercase text-neutral-600 dark:bg-white/10 dark:text-neutral-300">stale</span>}
                      {!p.stale && p.sessionClose && <span className="ml-1 text-[9px] uppercase text-neutral-500">close</span>}
                    </span>
                  )}
                </td>
                <td className="px-2 py-1">{p.value != null ? `$${usd(p.value)}` : '—'}</td>
                <td className={`px-2 py-1 ${(p.pnl ?? 0) >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>
                  {p.pnl != null ? `${p.pnl >= 0 ? '+' : '-'}$${usd(Math.abs(p.pnl))} (${((p.pnl / p.spent) * 100).toFixed(1)}%)` : '—'}
                </td>
              </tr>
              {isOpen && (
                <tr className="border-t border-neutral-100 dark:border-white/5">
                  <td colSpan={7} className="px-2 py-3">
                    {h === 'loading' && <div className="animate-pulse text-[12px] text-neutral-500">loading {p.symbol} price history…</div>}
                    {h && h !== 'loading' && 'error' in h && (
                      <div className="text-[12px] text-red-600 dark:text-rose-300">{p.symbol}: {h.error}</div>
                    )}
                    {h && h !== 'loading' && 'points' in h && (() => {
                      const first = h.points[0].close
                      const last = h.points[h.points.length - 1].close
                      const sinceEntry = ((last - h.avg) / h.avg) * 100
                      return (
                        <div>
                          <div className="mb-2 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px]">
                            <span className="font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">{p.symbol}</span>
                            <span className="text-neutral-500 dark:text-neutral-400">
                              since {b.name} bought it{h.entry ? ` · ${h.entry}` : ''}
                            </span>
                            <span className="text-neutral-500 dark:text-neutral-400">paid <b className="font-mono">{px(h.avg)}</b></span>
                            <span className="text-neutral-500 dark:text-neutral-400">now <b className="font-mono">{px(last)}</b></span>
                            <span className={`font-mono font-bold ${sinceEntry >= 0 ? 'text-green-600 dark:text-emerald-300' : 'text-red-600 dark:text-rose-300'}`}>
                              {sinceEntry >= 0 ? '+' : ''}{sinceEntry.toFixed(1)}% vs entry
                            </span>
                          </div>
                          <TrendChart
                            labels={h.points.map((q) => q.date)}
                            series={[{
                              key: p.symbol,
                              label: p.symbol,
                              color: CURVE_COLOR[b.key] ?? '#fbbf24',
                              points: h.points.map((q) => q.close),
                              format: (first < 10 ? 'usd4' : 'usd2') as 'usd4' | 'usd2',
                            }]}
                            h={180}
                          />
                          <div className="mt-1 text-[10px] text-neutral-500">
                            daily close · slide to read any day · crypto from CoinGecko, equities from Yahoo
                          </div>
                        </div>
                      )
                    })()}
                  </td>
                </tr>
              )}
              </React.Fragment>
            )})}
            {b.cash != null && (
              <tr className="border-t border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-white/[0.04]">
                <td className="px-2 py-1 font-semibold text-neutral-700 dark:text-neutral-200">CASH</td>
                <td className="px-2 py-1" colSpan={4}></td>
                <td className="px-2 py-1">${usd(b.cash)}</td>
                <td className="px-2 py-1"></td>
              </tr>
            )}
          </tbody>
        </table></div>
      ) : (
        <div className="text-[12px] text-neutral-500">
          No holdings relayed for {b.name} yet — only weekly cash reports. Paste their trades to Claude and they show up here priced live.
        </div>
      )}

      {/* This contestant's book, day by day since the competition opened */}
      {daily && (daily.totals[b.key]?.length ?? 0) > 1 && (
        <div className="mt-3">
          <div className="mb-1 text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">
            {b.name} — daily total since day one
          </div>
          <TrendChart
            h={150}
            labels={daily.days}
            series={[{ key: b.key, label: b.name, color: CURVE_COLOR[b.key] ?? '#fbbf24', points: daily.totals[b.key], format: 'usd2' }]}
          />
        </div>
      )}

      {b.trades.length > 0 && (
        <div className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
          {b.trades.slice(-5).reverse().map((t, i) => (
            <div key={i}>
              <span className={t.action === 'buy' ? 'text-green-700' : 'text-red-700'}>{t.action.toUpperCase()}</span>
              {' '}{Number(t.qty).toLocaleString('en-US', { maximumFractionDigits: 8 })} {t.symbol} @ {px(Number(t.price))}
              {' · '}{String(t.traded_at).slice(0, 10)}{t.note ? ` — ${t.note}` : ''}
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 border-t border-neutral-200 pt-2">
        <RivalEntry secret={secret} />
      </div>
    </div>
  )
}
