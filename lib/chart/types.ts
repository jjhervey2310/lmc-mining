// Shared types for the charting terminal.

/** A single OHLC bar. `time` is UTC seconds (lightweight-charts' UTCTimestamp). */
export interface Candle {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

/** A single point on a line series (mining metrics have no intraday OHLC). */
export interface Point {
  time: number
  value: number
}

export type Timeframe = '1h' | '4h' | '1D' | '1W'

export type SymbolKind = 'crypto' | 'equity' | 'mining'

export type SeriesShape = 'candlestick' | 'line'

export interface ChartSeriesResponse {
  symbol: string
  timeframe: Timeframe
  shape: SeriesShape
  candles: Candle[]
  /** Set when the upstream feed failed and this is a degraded/empty response. */
  error?: string
}

export const TIMEFRAME_SECONDS: Record<Timeframe, number> = {
  '1h': 3600,
  '4h': 14400,
  '1D': 86400,
  '1W': 604800,
}
