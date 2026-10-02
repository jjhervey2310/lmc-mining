// BROKER ABSTRACTION. Every venue the desk can execute on implements this; the strategy, risk gate
// and recommendation layers never import a venue client directly. Phase 0 defines the contract and
// wires the legacy Robinhood client behind it; Kraken (primary) and Coinbase (secondary) are stubs
// until Phase 9 — no venue secrets exist in this codebase for them.

export type BrokerId = 'kraken' | 'coinbase' | 'robinhood' | 'manual'
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'market' | 'limit' | 'stop_limit'
export type OrderState = 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected' | 'unknown'

export interface Quote { symbol: string; bid: number; ask: number; mid: number; at: string; source: BrokerId }
export interface Balance { asset: string; total: number; available: number }
export interface OrderRequest {
  symbol: string            // base asset, e.g. 'BTC'; the adapter maps to the venue pair
  side: OrderSide
  type: OrderType
  qty: string               // base units, already quantized by the adapter's increment
  limitPrice?: string
  stopPrice?: string
  clientId?: string         // idempotency key; adapters that support it must pass it through
}
export interface Order {
  id: string
  symbol: string
  side: OrderSide
  type: OrderType
  state: OrderState
  qty: string
  filledQty: string
  avgPrice: number | null
  limitPrice?: string
  stopPrice?: string
  createdAt: string
  raw?: unknown
}

export interface Broker {
  readonly id: BrokerId
  /** True when the adapter has what it needs to talk to the venue (keys present, pair resolvable). */
  configured(): boolean
  getQuote(symbol: string): Promise<Quote>
  getBalances(): Promise<Balance[]>
  getOpenOrders(symbol?: string): Promise<Order[]>
  placeOrder(req: OrderRequest): Promise<Order>
  cancelOrder(orderId: string): Promise<void>
  getOrder(orderId: string): Promise<Order>
}

export class BrokerNotImplemented extends Error {
  constructor(id: BrokerId, method: string) {
    super(`${id}.${method} is not implemented in this phase — see docs/CRYPTO-DESK-ARCHITECTURE.md §15`)
    this.name = 'BrokerNotImplemented'
  }
}
