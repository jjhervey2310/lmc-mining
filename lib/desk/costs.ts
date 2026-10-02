// EXPLICIT COST MODEL. No venue carries a built-in default: whoever runs a backtest, sizes a grid or
// routes a strategy states the fees in force, and the record travels with the result. Fractions, not
// percent (0.0022 == 0.22%). The live Kraken tier is read from the account and cached in
// desk_config.kraken_fee_tier (Phase 1); until then callers pass what they verified.

export interface CostModel {
  makerFee: number   // fraction per side
  takerFee: number   // fraction per side
  spread: number     // half-spread paid per side on a market fill
  slippage: number   // extra per-side impact; constant here, size-dependent in reality
  venue: string
  tier: string       // the fee tier these numbers came from, e.g. "kraken $10k-50k 30d" or "verified 2026-10-02"
  note?: string
}

export function makeCostModel(c: CostModel): CostModel {
  for (const k of ['makerFee', 'takerFee', 'spread', 'slippage'] as const) {
    const v = c[k]
    if (!(v >= 0 && v < 0.1)) throw new Error(`${k}=${v}: give a fraction in [0, 0.1) (0.0022 == 0.22%)`)
  }
  if (!c.venue || !c.tier) throw new Error('venue and tier are required so results can never be quoted without them')
  return { ...c }
}

export const perSide = (c: CostModel, taker = true) => (taker ? c.takerFee : c.makerFee) + c.spread + c.slippage
export const roundTrip = (c: CostModel, taker = true) => 2 * perSide(c, taker)
