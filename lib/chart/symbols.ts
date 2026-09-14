// The terminal's symbol registry.
//
// Every chartable instrument is declared here once: where its data comes from,
// which timeframes that source can actually serve, and how to format its price.
// The API route and the UI both read from this list, so adding an instrument is
// a one-line change rather than a hunt through fetchers and switch statements.

import type { SeriesShape, SymbolKind, Timeframe } from './types'

export interface ChartSymbol {
  /** URL-safe id used in the query string and in localStorage keys. */
  id: string
  label: string
  description: string
  kind: SymbolKind
  /** Heading the symbol is filed under in the picker. */
  group: string
  source: 'kraken' | 'yahoo' | 'mining'
  /** The identifier the upstream source expects. */
  sourceId: string
  shape: SeriesShape
  /** Timeframes this source can genuinely serve — not a wish list. */
  timeframes: Timeframe[]
  /** Decimal places on the price axis. */
  precision: number
  /** Appended to axis values for non-currency series. */
  unit?: string
}

const CRYPTO_TFS: Timeframe[] = ['1h', '4h', '1D', '1W']
// Yahoo serves 60m and 1d/1wk cleanly. It has no 4h bar, and synthesising one
// across ragged US session hours produces misleading candles, so it's omitted.
const EQUITY_TFS: Timeframe[] = ['1h', '1D', '1W']
// Mining metrics are derived from difficulty epochs — daily is the honest floor.
const MINING_TFS: Timeframe[] = ['1D']

export const SYMBOLS: ChartSymbol[] = [
  // ── Mining economics — the series no other terminal carries ────────────
  {
    id: 'HASHPRICE',
    label: 'HASHPRICE',
    description: 'Hashprice — USD per PH/s per day',
    kind: 'mining',
    group: 'Mining Economics',
    source: 'mining',
    sourceId: 'hashprice',
    shape: 'line',
    timeframes: MINING_TFS,
    precision: 2,
  },
  {
    id: 'DIFFICULTY',
    label: 'DIFFICULTY',
    description: 'Bitcoin network difficulty',
    kind: 'mining',
    group: 'Mining Economics',
    source: 'mining',
    sourceId: 'difficulty',
    shape: 'line',
    timeframes: MINING_TFS,
    precision: 2,
    unit: 'T',
  },
  {
    id: 'HASHRATE',
    label: 'HASHRATE',
    description: 'Network hashrate (EH/s)',
    kind: 'mining',
    group: 'Mining Economics',
    source: 'mining',
    sourceId: 'hashrate',
    shape: 'line',
    timeframes: MINING_TFS,
    precision: 1,
    unit: ' EH/s',
  },

  // ── Crypto (Kraken public OHLC — free, keyless, includes volume) ───────
  { id: 'BTCUSD', label: 'BTC/USD', description: 'Bitcoin', kind: 'crypto', group: 'Crypto', source: 'kraken', sourceId: 'XBTUSD', shape: 'candlestick', timeframes: CRYPTO_TFS, precision: 2 },
  { id: 'ETHUSD', label: 'ETH/USD', description: 'Ethereum', kind: 'crypto', group: 'Crypto', source: 'kraken', sourceId: 'ETHUSD', shape: 'candlestick', timeframes: CRYPTO_TFS, precision: 2 },
  { id: 'SOLUSD', label: 'SOL/USD', description: 'Solana', kind: 'crypto', group: 'Crypto', source: 'kraken', sourceId: 'SOLUSD', shape: 'candlestick', timeframes: CRYPTO_TFS, precision: 2 },
  { id: 'SUIUSD', label: 'SUI/USD', description: 'Sui', kind: 'crypto', group: 'Crypto', source: 'kraken', sourceId: 'SUIUSD', shape: 'candlestick', timeframes: CRYPTO_TFS, precision: 4 },

  // ── Mining equities ───────────────────────────────────────────────────
  { id: 'MARA', label: 'MARA', description: 'MARA Holdings', kind: 'equity', group: 'Mining Stocks', source: 'yahoo', sourceId: 'MARA', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'RIOT', label: 'RIOT', description: 'Riot Platforms', kind: 'equity', group: 'Mining Stocks', source: 'yahoo', sourceId: 'RIOT', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'CLSK', label: 'CLSK', description: 'CleanSpark', kind: 'equity', group: 'Mining Stocks', source: 'yahoo', sourceId: 'CLSK', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'WULF', label: 'WULF', description: 'TeraWulf', kind: 'equity', group: 'Mining Stocks', source: 'yahoo', sourceId: 'WULF', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'IREN', label: 'IREN', description: 'IREN Limited', kind: 'equity', group: 'Mining Stocks', source: 'yahoo', sourceId: 'IREN', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'HUT', label: 'HUT', description: 'Hut 8 Corp', kind: 'equity', group: 'Mining Stocks', source: 'yahoo', sourceId: 'HUT', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },

  // ── Mag 7 + the tickers already tracked in the trading competition ─────
  { id: 'NVDA', label: 'NVDA', description: 'NVIDIA', kind: 'equity', group: 'Equities', source: 'yahoo', sourceId: 'NVDA', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'AAPL', label: 'AAPL', description: 'Apple', kind: 'equity', group: 'Equities', source: 'yahoo', sourceId: 'AAPL', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'MSFT', label: 'MSFT', description: 'Microsoft', kind: 'equity', group: 'Equities', source: 'yahoo', sourceId: 'MSFT', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'GOOGL', label: 'GOOGL', description: 'Alphabet', kind: 'equity', group: 'Equities', source: 'yahoo', sourceId: 'GOOGL', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'AMZN', label: 'AMZN', description: 'Amazon', kind: 'equity', group: 'Equities', source: 'yahoo', sourceId: 'AMZN', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'META', label: 'META', description: 'Meta Platforms', kind: 'equity', group: 'Equities', source: 'yahoo', sourceId: 'META', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'TSLA', label: 'TSLA', description: 'Tesla', kind: 'equity', group: 'Equities', source: 'yahoo', sourceId: 'TSLA', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
  { id: 'TQQQ', label: 'TQQQ', description: 'ProShares UltraPro QQQ', kind: 'equity', group: 'Equities', source: 'yahoo', sourceId: 'TQQQ', shape: 'candlestick', timeframes: EQUITY_TFS, precision: 2 },
]

const BY_ID = new Map(SYMBOLS.map((s) => [s.id, s]))

export function getSymbol(id: string | null | undefined): ChartSymbol | undefined {
  return id ? BY_ID.get(id.toUpperCase()) : undefined
}

export const DEFAULT_SYMBOL = 'HASHPRICE'
export const DEFAULT_TIMEFRAME: Timeframe = '1D'

/** Symbols bucketed by `group`, preserving registry order. */
export function groupedSymbols(): { group: string; symbols: ChartSymbol[] }[] {
  const groups: { group: string; symbols: ChartSymbol[] }[] = []
  for (const s of SYMBOLS) {
    const existing = groups.find((g) => g.group === s.group)
    if (existing) existing.symbols.push(s)
    else groups.push({ group: s.group, symbols: [s] })
  }
  return groups
}
