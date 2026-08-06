'use client'

import { useState } from 'react'
import RivalEntry from './competition'

// Interactive competition panel: click a contestant on the leaderboard and the
// whole panel switches to their book — positions, spend, live value, P&L, and
// their full trade history. Every book is priced by the same feed server-side.

interface Pos { symbol: string; qty: number; avg: number; spent: number; live: number | null; value: number | null; pnl: number | null }
interface Trade { traded_at: string; action: string; symbol: string; qty: number; price: number; note: string | null }
export interface CompBook {
  key: string
  name: string
  week: string
  total: number | null
  cash: number | null
  holdings: number | null
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
    name: 'font-bold text-amber-700',
    tile: 'border-t-amber-500 from-amber-50',
    value: 'text-amber-700',
  },
  gpt: {
    chip: 'border-emerald-400 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-400/10 dark:hover:bg-emerald-400/20',
    chipSel: 'border-emerald-500 bg-emerald-100 ring-2 ring-emerald-400 dark:bg-emerald-400/20',
    name: 'font-bold text-emerald-700',
    tile: 'border-t-emerald-500 from-emerald-50',
    value: 'text-emerald-700',
  },
  gemini: {
    chip: 'border-blue-400 bg-gradient-to-r from-blue-50 via-yellow-50 to-green-50 hover:brightness-95 dark:from-blue-400/15 dark:via-yellow-400/15 dark:to-green-400/15',
    chipSel: 'border-blue-500 bg-gradient-to-r from-blue-100 via-yellow-100 to-green-100 ring-2 ring-blue-400 dark:from-blue-400/25 dark:via-yellow-400/25 dark:to-green-400/25',
    name: 'font-bold bg-clip-text text-transparent',
    nameStyle: { backgroundImage: GOOGLE_RAINBOW },
    tile: 'border-t-blue-500 from-blue-50 via-yellow-50',
    value: 'text-blue-700',
  },
}

export default function CompPanel({ books, start, secret }: { books: CompBook[]; start: number; secret: string }) {
  const [sel, setSel] = useState('claude')
  const b = books.find((x) => x.key === sel) ?? books[0]
  const totalPnl = b.positions.reduce((s, p) => s + (p.pnl ?? 0), 0)

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
              <span className={x.total == null ? 'text-neutral-400' : x.total >= start ? 'text-green-600' : 'text-red-600'}>
                {x.total != null ? `$${usd(x.total)}` : 'no report'}
              </span>{' '}
              <span className="text-[10px] text-neutral-400">{x.week}</span>
            </button>
          )
        })}
        <span className="self-center text-[11px] text-neutral-400">click a name for the full book ↓</span>
      </div>

      {/* Selected contestant's book */}
      <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: `${b.name} total`, value: b.total != null ? `$${usd(b.total)}` : '—', tone: b.total == null ? '' : b.total >= start ? 'text-green-600' : 'text-red-600' },
          { label: 'Cash in bank', value: b.cash != null ? `$${usd(b.cash)}` : '—', tone: '' },
          { label: 'Holdings value', value: b.holdings != null ? `$${usd(b.holdings)}` : '—', tone: '' },
          { label: 'Unrealized P&L', value: b.positions.length ? `${totalPnl >= 0 ? '+' : '-'}$${usd(Math.abs(totalPnl))}` : '—', tone: totalPnl >= 0 ? 'text-green-600' : 'text-red-600' },
        ].map((t) => {
          const br = BRAND[b.key] ?? BRAND.claude
          return (
            <div key={t.label} className={`lmc-card lmc-lift rounded-xl border border-neutral-200 border-t-4 bg-gradient-to-b to-white px-3 py-2 shadow-md dark:border-white/10 dark:to-neutral-900/60 ${br.tile}`}>
              <div className="text-[11px] uppercase tracking-widest text-neutral-600 dark:text-neutral-400">{t.label}</div>
              <div className={`font-mono text-2xl font-bold leading-tight ${t.tone || br.value}`}>{t.value}</div>
            </div>
          )
        })}
      </div>

      {b.positions.length ? (
        <div className="overflow-x-auto"><table className="w-full min-w-[560px] max-w-2xl border border-neutral-200 font-mono text-[12px]">
          <thead>
            <tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-wide text-neutral-500">
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
            {b.positions.map((p) => (
              <tr key={p.symbol} className="border-t border-neutral-100">
                <td className="px-2 py-1 font-semibold text-amber-700">{p.symbol}</td>
                <td className="px-2 py-1">{p.qty.toLocaleString('en-US', { maximumFractionDigits: 8 })}</td>
                <td className="px-2 py-1">{px(p.avg)}</td>
                <td className="px-2 py-1">${usd(p.spent)}</td>
                <td className="px-2 py-1">{p.live != null ? px(p.live) : '—'}</td>
                <td className="px-2 py-1">{p.value != null ? `$${usd(p.value)}` : '—'}</td>
                <td className={`px-2 py-1 ${(p.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {p.pnl != null ? `${p.pnl >= 0 ? '+' : '-'}$${usd(Math.abs(p.pnl))} (${((p.pnl / p.spent) * 100).toFixed(1)}%)` : '—'}
                </td>
              </tr>
            ))}
            {b.cash != null && (
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td className="px-2 py-1 font-semibold text-neutral-700">CASH</td>
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
