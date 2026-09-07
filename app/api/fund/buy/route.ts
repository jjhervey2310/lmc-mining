import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { buildTiming } from '../timing/route'
import { rhConfigured, tradingPair, bestBidAsk, quantize, marketBuy, awaitFill, stopLimitSell } from '@/lib/robinhood'

// TAP-TO-BUY. A human (Jacob) taps the button; this route grades the moment with the same code as
// /api/fund/timing, refuses any HARD bar outright (chase laws, RUNNING, halt, already held — the
// constitution refuses chase-bar exemptions in any regime), refuses SOFT bars unless `override` is set
// (Jacob's per-trade override, logged), then places a MARKET BUY for the ruled size and immediately a
// STOP-LIMIT SELL on 100% of the units (v4: stops on all units, always). Everything is logged to
// live_trades, desk_triggers, live_holdings and the agent-log. Nothing here runs on a schedule.
// Requires RH_API_KEY + RH_PRIVATE_KEY in Vercel env; without them it returns 503 and the tab falls
// back to a deep link into the Robinhood app.

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req: Request) {
  const url = new URL(req.url)
  const secret = req.headers.get('x-admin-secret') || url.searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!rhConfigured()) return NextResponse.json({ error: 'no_credentials', message: 'Robinhood API credentials (RH_API_KEY, RH_PRIVATE_KEY) are not set in Vercel env — create them in the Robinhood app under API credentials and add them to the project.' }, { status: 503 })
  let body: { symbol?: string; usd?: number; override?: boolean } = {}
  try { body = await req.json() } catch { /* empty body */ }
  const symbol = (body.symbol ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  let t
  try { t = await buildTiming(symbol) } catch (e) { return NextResponse.json({ error: `timing check failed: ${e instanceof Error ? e.message : e}` }, { status: 502 }) }
  if (t.hard.length) return NextResponse.json({ error: 'hard_bar', message: `Refused by law: ${t.hard.join('; ')}`, timing: t }, { status: 409 })
  if (!t.buyable && !body.override) return NextResponse.json({ error: 'soft_bar', message: `Grade ${t.grade} — ${t.soft.join('; ')}. Override to proceed.`, timing: t }, { status: 409 })
  const usd = Math.min(Number(body.usd) > 0 ? Number(body.usd) : t.size.usd, t.cash, Math.max(t.book * 0.10, 10))
  if (usd < 1) return NextResponse.json({ error: 'no_cash', message: 'No buying power for a ruled-size entry.', timing: t }, { status: 409 })

  try {
    const pair = await tradingPair(symbol)
    if (pair.status && pair.status !== 'tradable') throw new Error(`${symbol}-USD status ${pair.status}`)
    const q = await bestBidAsk(symbol)
    const ask = Number(q.ask_inclusive_of_buy_spread || q.price)
    const inc = pair.asset_increment ?? pair.min_order_size ?? '0.000001'
    const qty = quantize(usd / ask, inc)
    if (Number(qty) <= 0 || Number(qty) < Number(pair.min_order_size || 0)) throw new Error(`$${usd} buys ${qty} ${symbol}, under the pair minimum ${pair.min_order_size}`)

    const placed = await marketBuy(symbol, qty)
    const filled = await awaitFill(placed.id)
    const fillQty = Number(filled.filled_asset_quantity || (filled.state === 'filled' ? qty : 0))
    const fillPx = Number(filled.average_price || filled.executions?.[0]?.effective_price || ask)
    const notional = fillQty * fillPx
    const now = new Date().toISOString()

    // STOP on 100% of the units: the desk's armed stop row, else A9's max(20-day low, −20% from fill). Limit 5% under the stop.
    const stopPx = t.stop.source.startsWith('desk_triggers') ? t.stop.price : Math.max(t.lo20 && t.lo20 < fillPx ? t.lo20 : 0, fillPx * 0.80)
    const qInc = pair.quote_increment ?? '0.000001'
    const stopStr = quantize(stopPx, qInc), limitStr = quantize(stopPx * 0.95, qInc)
    let stopOrder: { id: string; state: string } | null = null, stopError: string | null = null
    if (fillQty > 0) {
      try { stopOrder = await stopLimitSell(symbol, quantize(fillQty, inc), stopStr, limitStr) } catch (e) { stopError = e instanceof Error ? e.message : String(e) }
    }

    // Ledger — best effort, never blocks the response.
    // A9.1 §4: two books. A buy on the tested breakout signal without an override is SLEEVE-RULE; anything else is OWNER-BOOK.
    const bookTag = t.signal && !body.override ? 'SLEEVE-RULE' : 'OWNER-BOOK'
    const note = `[${bookTag}] Tap-buy from the ROBINHOOD tab. Timing grade ${t.grade} (${t.score}), regime ${t.regime}, signal ${t.signal ? 'yes' : 'no'} (${t.signalWhy})${body.override ? ' — Jacob OVERRIDE on soft bars: ' + t.soft.join('; ') : ''}. Stop ${stopOrder ? `placed ${stopStr}/${limitStr} (order ${stopOrder.id})` : `NOT placed${stopError ? ': ' + stopError : ''}`}.`
    const log: string[] = []
    if (fillQty > 0) {
      const r1 = await supabase.from('live_trades').upsert({ order_id: placed.id, traded_at: now, side: 'buy', symbol, qty: fillQty, avg_price: fillPx, notional, initiator: `jacob-tap/${bookTag}`, note: note.slice(0, 480) }, { onConflict: 'order_id' })
      if (r1.error) log.push(`live_trades: ${r1.error.message}`)
      const held = await supabase.from('live_holdings').select('qty, avg_cost').eq('symbol', symbol).maybeSingle()
      const oldQ = Number(held.data?.qty ?? 0), oldC = Number(held.data?.avg_cost ?? 0)
      const newQ = oldQ + fillQty, newC = newQ > 0 ? (oldQ * oldC + fillQty * fillPx) / newQ : fillPx
      const r2 = await supabase.from('live_holdings').upsert({ symbol, qty: newQ, avg_cost: newC, synced_at: now }, { onConflict: 'symbol' })
      if (r2.error) log.push(`live_holdings: ${r2.error.message}`)
      const r3 = await supabase.from('live_holdings').update({ qty: Math.max(0, t.cash - notional), synced_at: now }).eq('symbol', 'USD')
      if (r3.error) log.push(`cash: ${r3.error.message}`)
      if (stopOrder) {
        const r4 = await supabase.from('desk_triggers').insert({ symbol, kind: 'stop', level: Number(stopStr), band_pct: 2.0, active: true, spec: `Stop-limit ${stopOrder.id} (${quantize(fillQty, inc)} ${symbol} @ ${stopStr}/${limitStr}) placed at fill by the tap-buy. ${t.stop.source}.` })
        if (r4.error) log.push(`desk_triggers: ${r4.error.message}`)
      }
      const al = await supabase.from('pa_memory').select('fact').eq('topic', 'agent-log').maybeSingle()
      if (al.data) {
        const head = al.data.fact.split('\n').slice(0, 2).join('\n')
        const rest = al.data.fact.split('\n').slice(2).join('\n')
        const entry = `\n=== ${now} — JACOB TAP-BUY (ROBINHOOD tab) ===\nBOUGHT ${fillQty} ${symbol} @ $${fillPx} avg (order ${placed.id}, market, $${notional.toFixed(2)}). ${note}\n`
        await supabase.from('pa_memory').update({ fact: (head + '\n' + entry + rest).slice(0, 60000), updated_at: now }).eq('topic', 'agent-log')
      }
    }
    return NextResponse.json({
      ok: filled.state === 'filled', state: filled.state, order_id: placed.id, symbol, qty: fillQty, avg_price: fillPx, notional,
      stop: stopOrder ? { order_id: stopOrder.id, state: stopOrder.state, stop: stopStr, limit: limitStr } : null, stop_error: stopError,
      ledger_errors: log, book: bookTag, timing: { grade: t.grade, score: t.score },
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (e) {
    return NextResponse.json({ error: 'broker', message: e instanceof Error ? e.message : String(e) }, { status: 502 })
  }
}
