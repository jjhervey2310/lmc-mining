import { createServiceClient } from '@/lib/supabase'
import { getMarketQuotes, isStale } from '@/lib/markets'
import type { CompBook } from './comp-panel'

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
    const book: Record<string, { qty: number; cost: number }> = {}
    let cash = COMP_START_CASH
    // Profit banked on closed size. Without this, a sold winner's gain vanished
    // from the panel entirely (only open positions showed P&L).
    let realized = 0
    for (const t of rows) {
      const qty = Number(t.qty), price = Number(t.price)
      const p = (book[t.symbol] ??= { qty: 0, cost: 0 })
      if (t.action === 'buy') {
        p.qty += qty; p.cost += qty * price; cash -= qty * price
      } else {
        const avg = p.qty ? p.cost / p.qty : 0
        // Never let a sell drive the position negative in the replay — an
        // oversold row is a ledger error, not a short (guarded at insert now).
        const sold = Math.min(qty, p.qty)
        realized += sold * (price - avg)
        p.qty -= sold; p.cost -= sold * avg; cash += qty * price
      }
    }
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
