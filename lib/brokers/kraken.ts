import { Broker, BrokerNotImplemented, type Balance, type Order, type Quote } from './types'

// KRAKEN PRO — canonical execution interface (primary paper + live target). Phase 0 ships the
// contract only. The real adapter (Phase 9) signs with KRAKEN_API_KEY / KRAKEN_API_SECRET from
// Vercel env — query + trade scopes, NO withdrawal permission, IP allow-listed — and reads the live
// fee tier for lib/desk/costs. Nothing here touches the network or any secret.

export class KrakenBroker implements Broker {
  readonly id = 'kraken' as const
  configured(): boolean { return false }
  async getQuote(): Promise<Quote> { throw new BrokerNotImplemented(this.id, 'getQuote') }
  async getBalances(): Promise<Balance[]> { throw new BrokerNotImplemented(this.id, 'getBalances') }
  async getOpenOrders(): Promise<Order[]> { throw new BrokerNotImplemented(this.id, 'getOpenOrders') }
  async placeOrder(): Promise<Order> { throw new BrokerNotImplemented(this.id, 'placeOrder') }
  async cancelOrder(): Promise<void> { throw new BrokerNotImplemented(this.id, 'cancelOrder') }
  async getOrder(): Promise<Order> { throw new BrokerNotImplemented(this.id, 'getOrder') }
}
