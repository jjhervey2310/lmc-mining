// SERVER-SIDE ORDER SIZING. The client may ask for less than the ruled size, never more; the
// buying-power and per-order caps are applied here and nowhere else.

export interface SizingInput {
  requestedUsd?: number | null  // what the client asked for, if anything
  ruledUsd: number              // the size the desk rules produced (gradeTiming)
  cashUsd: number               // buying power on the book
  bookUsd: number               // whole book, for the per-order cap
  perOrderCapPct?: number       // default 10% of book
  perOrderFloorUsd?: number     // default $10 — a book under $100 may still place a minimum order
}

export function clampOrderUsd(i: SizingInput): number {
  const req = Number(i.requestedUsd)
  const wanted = req > 0 ? Math.min(req, i.ruledUsd) : i.ruledUsd
  const cap = Math.max(i.bookUsd * (i.perOrderCapPct ?? 0.10), i.perOrderFloorUsd ?? 10)
  return Math.max(0, Math.min(wanted, i.cashUsd, cap))
}
