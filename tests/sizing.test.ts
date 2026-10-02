import { describe, expect, it } from 'vitest'
import { clampOrderUsd } from '@/lib/desk/sizing'

const base = { ruledUsd: 50, cashUsd: 400, bookUsd: 1000 }

describe('clampOrderUsd', () => {
  it('defaults to the ruled size', () => expect(clampOrderUsd(base)).toBe(50))
  it('a client request may shrink the order', () => expect(clampOrderUsd({ ...base, requestedUsd: 20 })).toBe(20))
  it('a client request can never exceed the ruled size (the old bypass)', () => {
    expect(clampOrderUsd({ ...base, requestedUsd: 5000 })).toBe(50)
  })
  it('is capped by cash and by 10% of book', () => {
    expect(clampOrderUsd({ ...base, cashUsd: 30 })).toBe(30)
    expect(clampOrderUsd({ ...base, ruledUsd: 500, bookUsd: 1000 })).toBe(100)
  })
  it('garbage requests fall back to the ruled size', () => {
    expect(clampOrderUsd({ ...base, requestedUsd: -1 })).toBe(50)
    expect(clampOrderUsd({ ...base, requestedUsd: NaN })).toBe(50)
  })
})
