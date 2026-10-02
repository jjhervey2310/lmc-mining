import { Broker, BrokerNotImplemented, type Balance, type Order, type OrderRequest, type Quote } from './types'

// MANUAL — the fallback "broker": placeOrder records an intent for a human to execute by hand and
// returns it in state 'pending'. Nothing reaches a venue. The intent sink is injected so this stays
// pure and testable; Phase 9 wires it to the recommendations table.

export interface ManualIntent { id: string; request: OrderRequest; createdAt: string }

export class ManualBroker implements Broker {
  readonly id = 'manual' as const
  constructor(private readonly sink: (intent: ManualIntent) => Promise<void> | void, private readonly quote?: (symbol: string) => Promise<Quote>) {}
  configured(): boolean { return true }
  async getQuote(symbol: string): Promise<Quote> {
    if (!this.quote) throw new BrokerNotImplemented(this.id, 'getQuote')
    return this.quote(symbol)
  }
  async getBalances(): Promise<Balance[]> { return [] }
  async getOpenOrders(): Promise<Order[]> { return [] }
  async placeOrder(req: OrderRequest): Promise<Order> {
    const id = req.clientId ?? `manual-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
    const createdAt = new Date().toISOString()
    await this.sink({ id, request: req, createdAt })
    return { id, symbol: req.symbol, side: req.side, type: req.type, state: 'pending', qty: req.qty, filledQty: '0', avgPrice: null, limitPrice: req.limitPrice, stopPrice: req.stopPrice, createdAt }
  }
  async cancelOrder(): Promise<void> { /* a pending intent is cancelled by not acting on it */ }
  async getOrder(orderId: string): Promise<Order> { throw new BrokerNotImplemented(this.id, `getOrder(${orderId})`) }
}
