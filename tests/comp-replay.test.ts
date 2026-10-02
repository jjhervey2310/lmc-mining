import { describe, expect, it } from 'vitest'
import { replayCompTrades } from '@/lib/comp-replay'

describe('replayCompTrades', () => {
  it('buy then full sell books the realized gain', () => {
    const r = replayCompTrades([
      { action: 'buy', symbol: 'SOL', qty: 2, price: 100 },
      { action: 'sell', symbol: 'SOL', qty: 2, price: 150 },
    ], 1000)
    expect(r.cash).toBe(1100)
    expect(r.realized).toBe(100)
    expect(r.book.SOL.qty).toBe(0)
  })
  it('an oversold row cannot mint cash', () => {
    const r = replayCompTrades([
      { action: 'buy', symbol: 'SOL', qty: 1, price: 100 },
      { action: 'sell', symbol: 'SOL', qty: 5, price: 100 },   // ledger error: only 1 held
    ], 1000)
    expect(r.cash).toBe(1000)        // was 1400 under the old code
    expect(r.book.SOL.qty).toBe(0)
    expect(r.realized).toBe(0)
  })
  it('string numerics from the DB are coerced', () => {
    const r = replayCompTrades([{ action: 'buy', symbol: 'BTC', qty: '0.5', price: '80000' }], 50000)
    expect(r.cash).toBe(10000)
  })
})
