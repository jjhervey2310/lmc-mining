import { describe, expect, it } from 'vitest'
import { KrakenBroker } from '@/lib/brokers/kraken'
import { CoinbaseBroker } from '@/lib/brokers/coinbase'
import { ManualBroker, type ManualIntent } from '@/lib/brokers/manual'
import { BrokerNotImplemented, type Broker } from '@/lib/brokers/types'

describe('broker contract (Phase 0)', () => {
  it('kraken and coinbase are explicit stubs — never silently succeed', async () => {
    for (const b of [new KrakenBroker(), new CoinbaseBroker()] as Broker[]) {
      expect(b.configured()).toBe(false)
      await expect(b.placeOrder({ symbol: 'BTC', side: 'buy', type: 'market', qty: '0.001' })).rejects.toBeInstanceOf(BrokerNotImplemented)
      await expect(b.getQuote('BTC')).rejects.toBeInstanceOf(BrokerNotImplemented)
    }
  })
  it('manual records an intent and returns a pending order without touching any venue', async () => {
    const seen: ManualIntent[] = []
    const b = new ManualBroker((i) => { seen.push(i) })
    const o = await b.placeOrder({ symbol: 'SOL', side: 'buy', type: 'limit', qty: '2', limitPrice: '150', clientId: 'card-42' })
    expect(o.state).toBe('pending')
    expect(o.id).toBe('card-42')
    expect(seen).toHaveLength(1)
    expect(seen[0].request.limitPrice).toBe('150')
  })
})
