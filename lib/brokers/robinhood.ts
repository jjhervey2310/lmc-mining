import { rhConfigured, tradingPair, bestBidAsk, quantize, marketBuy, stopLimitSell, getOrder as rhGetOrder, listOpenOrders, orderLevel, orderQty, type Order as RhOrder, type OpenOrder } from '@/lib/robinhood'
import { Broker, BrokerNotImplemented, type Balance, type Order, type OrderRequest, type OrderState, type Quote } from './types'

// ROBINHOOD — legacy adapter over lib/robinhood.ts for existing holdings only. No new strategy work
// targets it (plan §1). Supports exactly what the tap-buy flow already used: market buy, stop-limit
// sell, order lookup, open orders. Balances and cancels were never implemented in the client and
// stay unimplemented here rather than guessed.

const mapState = (s: string | undefined): OrderState => {
  switch ((s ?? '').toLowerCase()) {
    case 'filled': return 'filled'
    case 'open': return 'open'
    case 'partially_filled': return 'partially_filled'
    case 'canceled': case 'cancelled': return 'cancelled'
    case 'rejected': case 'failed': return 'rejected'
    case 'queued': case 'confirmed': case 'pending': return 'pending'
    default: return 'unknown'
  }
}

const fromRh = (o: RhOrder, req?: Partial<OrderRequest>): Order => ({
  id: o.id,
  symbol: (o.symbol ?? req?.symbol ?? '').replace(/-USD$/, ''),
  side: (o.side?.toLowerCase() === 'sell' ? 'sell' : 'buy'),
  type: o.type?.toLowerCase() === 'stop_limit' ? 'stop_limit' : o.type?.toLowerCase() === 'limit' ? 'limit' : 'market',
  state: mapState(o.state),
  qty: req?.qty ?? o.filled_asset_quantity ?? '0',
  filledQty: o.filled_asset_quantity ?? (o.state === 'filled' ? (req?.qty ?? '0') : '0'),
  avgPrice: o.average_price != null ? Number(o.average_price) : o.executions?.[0]?.effective_price != null ? Number(o.executions[0].effective_price) : null,
  limitPrice: req?.limitPrice, stopPrice: req?.stopPrice,
  createdAt: o.created_at ?? new Date().toISOString(),
  raw: o,
})

const fromOpen = (o: OpenOrder): Order => ({
  id: o.id,
  symbol: (o.symbol ?? '').replace(/-USD$/, ''),
  side: o.side?.toLowerCase() === 'sell' ? 'sell' : 'buy',
  type: o.type?.toLowerCase() === 'stop_limit' ? 'stop_limit' : o.type?.toLowerCase() === 'limit' ? 'limit' : 'market',
  state: mapState(o.state),
  qty: String(orderQty(o) ?? '0'),
  filledQty: '0',
  avgPrice: null,
  limitPrice: orderLevel(o) != null ? String(orderLevel(o)) : undefined,
  createdAt: o.created_at ?? new Date().toISOString(),
  raw: o,
})

export class RobinhoodBroker implements Broker {
  readonly id = 'robinhood' as const
  configured(): boolean { return rhConfigured() }

  async getQuote(symbol: string): Promise<Quote> {
    const q = await bestBidAsk(symbol)
    const bid = Number(q.bid_inclusive_of_sell_spread), ask = Number(q.ask_inclusive_of_buy_spread)
    const mid = Number(q.price) || (bid > 0 && ask > 0 ? (bid + ask) / 2 : 0)
    if (!(mid > 0)) throw new Error(`robinhood: no quote for ${symbol}`)
    return { symbol, bid, ask, mid, at: q.timestamp ?? new Date().toISOString(), source: this.id }
  }

  async getBalances(): Promise<Balance[]> { throw new BrokerNotImplemented(this.id, 'getBalances') }

  async getOpenOrders(symbol?: string): Promise<Order[]> {
    const { orders } = await listOpenOrders()
    return orders.map(fromOpen).filter((o) => !symbol || o.symbol === symbol.toUpperCase())
  }

  /** Quantizes to the pair's increments. Market BUY and stop-limit SELL only — the two orders the
   *  legacy tap-buy flow places. Anything else is refused explicitly. */
  async placeOrder(req: OrderRequest): Promise<Order> {
    const pair = await tradingPair(req.symbol)
    if (pair.status && pair.status !== 'tradable') throw new Error(`${req.symbol}-USD status ${pair.status}`)
    const inc = pair.asset_increment ?? pair.min_order_size ?? '0.000001'
    const qty = quantize(Number(req.qty), inc)
    if (Number(qty) <= 0 || Number(qty) < Number(pair.min_order_size || 0)) throw new Error(`${qty} ${req.symbol} is under the pair minimum ${pair.min_order_size}`)
    if (req.side === 'buy' && req.type === 'market') return fromRh(await marketBuy(req.symbol, qty), { ...req, qty })
    if (req.side === 'sell' && req.type === 'stop_limit' && req.stopPrice && req.limitPrice) {
      const qInc = pair.quote_increment ?? '0.000001'
      const stop = quantize(Number(req.stopPrice), qInc), limit = quantize(Number(req.limitPrice), qInc)
      return fromRh(await stopLimitSell(req.symbol, qty, stop, limit), { ...req, qty, stopPrice: stop, limitPrice: limit })
    }
    throw new BrokerNotImplemented(this.id, `placeOrder(${req.side} ${req.type})`)
  }

  async cancelOrder(orderId: string): Promise<void> { throw new BrokerNotImplemented(this.id, `cancelOrder(${orderId})`) }

  async getOrder(orderId: string): Promise<Order> { return fromRh(await rhGetOrder(orderId)) }
}
