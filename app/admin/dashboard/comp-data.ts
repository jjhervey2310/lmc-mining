import { createServiceClient } from '@/lib/supabase'
import { getMarketQuotes, isStale } from '@/lib/markets'
import type { CompBook } from './comp-panel'
import { replayCompTrades } from '@/lib/comp-replay'

// Trading-competition books, shared by the TRADING page (and anything else that
// wants the leaderboard): every contestant priced by the same live feed.

export const COMP_START_CASH = 1000

export interface CompBooksResult { books: CompBook[]; quotedAt: number | null; anyStale: boolean }

export async function getCompBooks(): Promise<CompBook[]> {
  const supabase = createServiceClient()
  const [trades, weekly, quotes] = await Promise.all([
    supabase?.from('comp_trades').select('traded_at, action, symbol, qty, price, note, contestant').order('traded_at') ?? null,
    supabase?.from('comp_weekly').select('week_of, contestant, cash_total').order('week_of', { ascending: false }).limit(30) ?? null,
    getMarketQuotes().catch(() => [] as Awaited<ReturnType<typeof getMarketQuotes>>),
  ])

  const allTradeRows = (trades?.data ?? []) as { traded_at: string; action: string; symbol: string; qty: number; price: number; note: string | null; contestant?: string }[]
  const priceOf = (sym: string) => quotes?.find((q) => q.symbol === sym)?.price

  const buildBook = (rows: typeof allTradeRows) => {
    // Ledger arithmetic lives in lib/comp-replay.ts (unit-tested); this only prices the result.
    const { book, cash, realized } = replayCompTrades(rows, COMP_START_CASH)
    const positions = Object.entries(book).filter(([, p]) => p.qty > 1e-12).map(([symbol, p]) => {
      const q = quotes?.find((x) => x.symbol === symbol)
      const live = q?.price ?? null
      const value = live != null ? p.qty * live : null
      return {
        symbol, qty: p.qty, avg: p.cost / p.qty, spent: p.cost, live, value,
        pnl: value != null ? value - p.cost : null,
        // Surfaced so the panel can refuse to present old data as current.
        stale: q ? isStale(q) : false,
        sessionClose: q?.sessionClose ?? false,
        quotedAt: q?.fetchedAt ?? null,
      }
    })
    const holdings = positions.reduce((s, p) => s + (p.value ?? p.spent), 0)
    return { positions, cash, holdings, total: cash + holdings, realized }
  }

  const weeklyRows = weekly?.data ?? []
  const latestRival = (name: string) => weeklyRows.find((w) => w.contestant === name)

  return [
    { key: 'claude', name: 'CLAUDE' },
    { key: 'gpt', name: 'GPT' },
    { key: 'gemini', name: 'GEMINI' },
  ].map(({ key, name }) => {
    const rows = allTradeRows.filter((t) => (t.contestant || 'claude') === key)
    if (rows.length) {
      const b = buildBook(rows)
      return { key, name, week: 'live', total: b.total, cash: b.cash, holdings: b.holdings, realized: b.realized, positions: b.positions, trades: rows.map((t) => ({ traded_at: t.traded_at, action: t.action, symbol: t.symbol, qty: Number(t.qty), price: Number(t.price), note: t.note })) }
    }
    const r = latestRival(key)
    return { key, name, week: r ? String(r.week_of) : '—', total: r ? Number(r.cash_total) : null, cash: null, holdings: null, realized: null, positions: [], trades: [] }
  }).sort((a, b) => (b.total ?? -1) - (a.total ?? -1))
}
