import { Broker, BrokerNotImplemented, type Balance, type Order, type Quote } from './types'

// COINBASE ADVANCED — secondary broker, used only for pairs Kraken lacks or where depth is materially
// better. Contract only in Phase 0; no keys, no network.

export class CoinbaseBroker implements Broker {
  readonly id = 'coinbase' as const
  configured(): boolean { return false }
  async getQuote(): Promise<Quote> { throw new BrokerNotImplemented(this.id, 'getQuote') }
  async getBalances(): Promise<Balance[]> { throw new BrokerNotImplemented(this.id, 'getBalances') }
  async getOpenOrders(): Promise<Order[]> { throw new BrokerNotImplemented(this.id, 'getOpenOrders') }
  async placeOrder(): Promise<Order> { throw new BrokerNotImplemented(this.id, 'placeOrder') }
  async cancelOrder(): Promise<void> { throw new BrokerNotImplemented(this.id, 'cancelOrder') }
  async getOrder(): Promise<Order> { throw new BrokerNotImplemented(this.id, 'getOrder') }
}
