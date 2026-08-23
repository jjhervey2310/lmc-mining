import { SupabaseClient } from '@supabase/supabase-js'
import { getMarketQuotes } from '@/lib/markets'
import { getCompBooks } from '@/app/admin/dashboard/comp-data'

// Daily bot for the trading competition: manages the CASH SLEEVE of Claude's
// book (never the strategic core positions) with a momentum/trend ruleset,
// logs every trade to comp_trades like any other call, and keeps a journal
// (comp_trader_journal) it re-reads each run — that history is how it "learns":
// sleeve size adapts to whether the bot has actually been beating buy-and-hold.
//
// Hard guards, in priority order:
//   1. Bot may only ever spend cash the ledger says exists; sells capped at
//      bot-held qty. The ledger is truth — the journal is the bot's memory.
//   2. Circuit breaker: book total under 85% of its 30-day high-water mark
//      puts the bot 100% in cash and it stays there until a human reviews.
//   3. Trades under $10 are skipped — no dust churn.

const UNIVERSE: [string, string][] = [
  ['bitcoin', 'BTC'],
  ['ethereum', 'ETH'],
  ['solana', 'SOL'],
  ['sui', 'SUI'],
  ['hyperliquid', 'HYPE'],
]

const SLEEVE_PCT_START = 20 // % of book value the bot may manage
const SLEEVE_PCT_MIN = 10
const SLEEVE_PCT_MAX = 25
const TOP_N = 2 // hold the N strongest eligible assets
const MIN_TRADE_USD = 10
const REBAL_BAND = 0.2 // trade only when target differs >20% from held
const CIRCUIT_BREAKER = 0.85 // of 30-day high-water book total

interface Signal {
  symbol: string
  price: number
  mom7: number // 7-day return
  aboveSma20: boolean
  eligible: boolean
}

interface JournalRow {
  run_date: string
  sleeve_pct: number
  bot_cash: number
  bot_positions: Record<string, number>
  signals: Signal[]
  actions: { action: string; symbol: string; qty: number; price: number; reason: string }[]
  book_total: number
  notes: string
}

async function fetchDailyCloses(id: string): Promise<number[]> {
  const key = process.env.COINGECKO_API_KEY
  const base = `https://api.coingecko.com/api/v3/coins/${id}/market_chart?vs_currency=usd&days=30&interval=daily`
  let res = await fetch(key ? `${base}&x_cg_demo_api_key=${key}` : base, { cache: 'no-store' })
  if (!res.ok && key && (res.status === 401 || res.status === 403)) {
    res = await fetch(base, { cache: 'no-store' })
  }
  if (!res.ok) throw new Error(`coingecko history ${id} ${res.status}`)
  const prices = (await res.json())?.prices as [number, number][] | undefined
  if (!prices?.length) throw new Error(`coingecko history ${id} empty`)
  return prices.map((p) => p[1])
}

const sma = (xs: number[], n: number) => {
  const tail = xs.slice(-n)
  return tail.reduce((s, x) => s + x, 0) / tail.length
}

export async function computeSignals(): Promise<Signal[]> {
  const quotes = await getMarketQuotes()
  const out: Signal[] = []
  for (const [id, symbol] of UNIVERSE) {
    const live = quotes.find((q) => q.symbol === symbol)?.price
    if (live == null) continue
    try {
      const closes = await fetchDailyCloses(id)
      const week = closes[closes.length - 8] ?? closes[0]
      out.push({
        symbol,
        price: live,
        mom7: week ? (live - week) / week : 0,
        aboveSma20: live > sma(closes, 20),
        eligible: live > sma(closes, 20),
      })
    } catch {
      // One asset's missing history must not kill the run — skip it.
    }
  }
  return out
}

// Sleeve adaptation: if the bot's last-7-runs return beat BTC over the same
// span, it earns one point of sleeve; if it lagged, it loses one. Bounded so
// a hot streak can't swallow the book and a cold one can't kill the bot.
function adaptSleevePct(history: JournalRow[], signals: Signal[]): { pct: number; why: string } {
  const last = history[history.length - 1]
  const prev = history.length >= 7 ? history[history.length - 7] : history[0]
  if (!last || !prev || last === prev) return { pct: last?.sleeve_pct ?? SLEEVE_PCT_START, why: 'insufficient history — sleeve unchanged' }
  const value = (r: JournalRow, priceOf: (s: string) => number) =>
    r.bot_cash + Object.entries(r.bot_positions).reduce((s, [sym, q]) => s + q * priceOf(sym), 0)
  const priceNow = (s: string) => signals.find((x) => x.symbol === s)?.price ?? 0
  // Approximation: value prior positions at today's prices for both endpoints —
  // measures allocation skill, not entry timing, which is what sleeve sizing cares about.
  const botRet = value(prev, priceNow) > 0 ? (value(last, priceNow) - value(prev, priceNow)) / value(prev, priceNow) : 0
  const btc = signals.find((s) => s.symbol === 'BTC')
  const btcRet = btc ? btc.mom7 : 0
  if (botRet > btcRet) return { pct: Math.min(SLEEVE_PCT_MAX, last.sleeve_pct + 1), why: `bot beat BTC over window (${(botRet * 100).toFixed(1)}% vs ${(btcRet * 100).toFixed(1)}%) — sleeve +1` }
  return { pct: Math.max(SLEEVE_PCT_MIN, last.sleeve_pct - 1), why: `bot lagged BTC over window (${(botRet * 100).toFixed(1)}% vs ${(btcRet * 100).toFixed(1)}%) — sleeve -1` }
}

export async function runTraderCycle(supabase: SupabaseClient): Promise<JournalRow> {
  const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Denver' }).format(new Date())
  const books = await getCompBooks()
  const book = books.find((b) => b.key === 'claude')
  if (!book || book.total == null || book.cash == null) throw new Error('claude book unpriced')

  const { data: journalRows } = await supabase
    .from('comp_trader_journal').select('*').order('run_date').limit(60)
  const history = (journalRows ?? []) as JournalRow[]
  const last = history[history.length - 1]

  const signals = await computeSignals()
  const priceOf = (s: string) => signals.find((x) => x.symbol === s)?.price ?? 0

  // Bot state from journal, reconciled against the ledger: the bot can never
  // hold more of an asset than the whole book holds, nor more cash than exists.
  const botPositions: Record<string, number> = { ...(last?.bot_positions ?? {}) }
  for (const sym of Object.keys(botPositions)) {
    const ledgerQty = book.positions.find((p) => p.symbol === sym)?.qty ?? 0
    botPositions[sym] = Math.min(botPositions[sym], ledgerQty)
    if (botPositions[sym] <= 0) delete botPositions[sym]
  }
  const { pct: sleevePct, why: sleeveWhy } = adaptSleevePct(history, signals)
  const sleeveCap = (sleevePct / 100) * book.total
  let botCash = Math.min(last?.bot_cash ?? Math.min(book.cash, sleeveCap), book.cash)
  // New cash in the book (e.g. Claude trimmed core into cash) tops the sleeve up to its cap.
  const botValue = () => botCash + Object.entries(botPositions).reduce((s, [sym, q]) => s + q * priceOf(sym), 0)
  if (botValue() < sleeveCap) botCash = Math.min(book.cash, botCash + (sleeveCap - botValue()))

  const actions: JournalRow['actions'] = []
  let notes = sleeveWhy

  // Circuit breaker on the WHOLE book, not just the sleeve — the bot's job is
  // to accumulate, never to be the reason the account bleeds out.
  const { data: snaps } = await supabase
    .from('comp_snapshots').select('total').eq('contestant', 'claude')
    .order('snapshot_date', { ascending: false }).limit(30)
  const highWater = Math.max(book.total, ...((snaps ?? []).map((r) => Number(r.total)) ?? []))
  const tripped = book.total < CIRCUIT_BREAKER * highWater

  if (tripped) {
    for (const [sym, qty] of Object.entries(botPositions)) {
      const price = priceOf(sym)
      if (qty * price >= MIN_TRADE_USD && price > 0) {
        actions.push({ action: 'sell', symbol: sym, qty, price, reason: `circuit breaker: book ${((book.total / highWater) * 100).toFixed(1)}% of 30d high-water — bot to cash pending review` })
        botCash += qty * price
        delete botPositions[sym]
      }
    }
    notes = `CIRCUIT BREAKER TRIPPED — book $${book.total.toFixed(2)} vs high-water $${highWater.toFixed(2)}. Bot in cash until a human reviews at check-in.`
  } else {
    // Targets: sleeve value equal-weighted across the TOP_N strongest eligible
    // assets by 7-day momentum; everything else in the sleeve targets zero.
    const ranked = signals.filter((s) => s.eligible).sort((a, b) => b.mom7 - a.mom7).slice(0, TOP_N)
    const perTarget = ranked.length ? botValue() / ranked.length : 0
    const targets: Record<string, number> = Object.fromEntries(ranked.map((s) => [s.symbol, perTarget]))

    // Sells first so the cash exists for the buys.
    for (const [sym, qty] of Object.entries(botPositions)) {
      const price = priceOf(sym)
      const held = qty * price
      const target = targets[sym] ?? 0
      const excess = held - target
      if (price > 0 && excess >= MIN_TRADE_USD && (target === 0 || excess / Math.max(target, 1) > REBAL_BAND)) {
        const sellQty = target === 0 ? qty : excess / price
        actions.push({ action: 'sell', symbol: sym, qty: sellQty, price, reason: target === 0 ? `signal lost (below 20d SMA or out of top ${TOP_N})` : 'rebalance above band' })
        botCash += sellQty * price
        botPositions[sym] = qty - sellQty
        if (botPositions[sym] <= 1e-12) delete botPositions[sym]
      }
    }
    for (const [sym, target] of Object.entries(targets)) {
      const price = priceOf(sym)
      const held = (botPositions[sym] ?? 0) * price
      const gap = target - held
      if (price > 0 && gap >= MIN_TRADE_USD && gap / Math.max(target, 1) > REBAL_BAND) {
        const spend = Math.min(gap, botCash)
        if (spend >= MIN_TRADE_USD) {
          const buyQty = spend / price
          const sig = signals.find((s) => s.symbol === sym)
          actions.push({ action: 'buy', symbol: sym, qty: buyQty, price, reason: `top-${TOP_N} momentum (7d ${(100 * (sig?.mom7 ?? 0)).toFixed(1)}%, above 20d SMA)` })
          botCash -= spend
          botPositions[sym] = (botPositions[sym] ?? 0) + buyQty
        }
      }
    }
    if (!actions.length) notes += ' · no trades: book within rebalance bands'
  }

  // Every bot action is a real competition trade — same ledger, same rules.
  if (actions.length) {
    const { error } = await supabase.from('comp_trades').insert(actions.map((a) => ({
      contestant: 'claude',
      action: a.action,
      symbol: a.symbol,
      qty: a.qty,
      price: a.price,
      note: `BOT ${day}: ${a.reason}`,
    })))
    if (error) throw new Error(`trade insert failed: ${error.message}`)
  }

  const row: JournalRow = {
    run_date: day,
    sleeve_pct: sleevePct,
    bot_cash: Number(botCash.toFixed(2)),
    bot_positions: botPositions,
    signals,
    actions,
    book_total: book.total,
    notes,
  }
  const { error: jerr } = await supabase.from('comp_trader_journal').upsert(row, { onConflict: 'run_date' })
  if (jerr) throw new Error(`journal upsert failed: ${jerr.message}`)
  return row
}
