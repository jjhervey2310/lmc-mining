// Pure replay of a contestant's comp_trades rows into cash, positions and realized P&L. Kept free of
// quotes and Supabase so the ledger arithmetic can be unit-tested on its own.

export interface CompTradeRow { action: string; symbol: string; qty: number | string; price: number | string }
export interface ReplayedPosition { qty: number; cost: number }
export interface Replay { book: Record<string, ReplayedPosition>; cash: number; realized: number }

export function replayCompTrades(rows: CompTradeRow[], startCash: number): Replay {
  const book: Record<string, ReplayedPosition> = {}
  let cash = startCash
  let realized = 0
  for (const t of rows) {
    const qty = Number(t.qty), price = Number(t.price)
    const p = (book[t.symbol] ??= { qty: 0, cost: 0 })
    if (t.action === 'buy') {
      p.qty += qty; p.cost += qty * price; cash -= qty * price
    } else {
      const avg = p.qty ? p.cost / p.qty : 0
      // Never let a sell drive the position negative: an oversold row is a ledger error, not a short,
      // and cash is credited only for what was actually held (the old code credited the full qty and
      // minted cash out of nothing).
      const sold = Math.min(qty, p.qty)
      realized += sold * (price - avg)
      p.qty -= sold; p.cost -= sold * avg; cash += sold * price
    }
  }
  return { book, cash, realized }
}
