import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'
import { getMarketQuotes } from '@/lib/markets'

// The ONLY sanctioned way a trade enters comp_trades.
//
// Two ledger bugs got in before this existed (a double-sold BTC and an oversold
// AAPL) and were only caught at audit. Every guard here is checked against the
// book rebuilt from the ledger itself, so a bad trade is refused at insert
// rather than discovered later.

export const dynamic = 'force-dynamic'

const CONTESTANTS = ['claude', 'gpt', 'gemini'] as const
type Contestant = (typeof CONTESTANTS)[number]
const START_CASH = 1000
const EPS = 1e-9
/** A submitted price this far from the live feed gets a referee note. */
const PRICE_DEVIATION = 0.01

interface Row { action: string; symbol: string; qty: number; price: number }

/** Replay the ledger — same rules as comp-data.ts buildBook. */
function replay(rows: Row[]) {
  const book: Record<string, { qty: number; cost: number }> = {}
  let cash = START_CASH
  for (const t of rows) {
    const qty = Number(t.qty), price = Number(t.price)
    const p = (book[t.symbol] ??= { qty: 0, cost: 0 })
    if (t.action === 'buy') {
      p.qty += qty; p.cost += qty * price; cash -= qty * price
    } else {
      const avg = p.qty ? p.cost / p.qty : 0
      const sold = Math.min(qty, p.qty)
      p.qty -= sold; p.cost -= sold * avg; cash += qty * price
    }
  }
  return { book, cash }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!process.env.ADMIN_SECRET || body?.secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const contestant = String(body?.contestant || '') as Contestant
  const action = String(body?.action || '').toLowerCase()
  const symbol = String(body?.symbol || '').toUpperCase().trim()
  const qty = Number(body?.qty)
  const price = Number(body?.price)
  const note = body?.note ? String(body.note) : null

  if (!CONTESTANTS.includes(contestant)) return NextResponse.json({ error: `contestant must be one of ${CONTESTANTS.join('|')}` }, { status: 400 })
  if (action !== 'buy' && action !== 'sell') return NextResponse.json({ error: 'action must be buy or sell' }, { status: 400 })
  if (!symbol) return NextResponse.json({ error: 'symbol required' }, { status: 400 })
  if (!isFinite(qty) || qty <= 0) return NextResponse.json({ error: 'qty must be > 0' }, { status: 400 })
  if (!isFinite(price) || price <= 0) return NextResponse.json({ error: 'price must be > 0' }, { status: 400 })

  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  const { data: existing, error: readErr } = await supabase
    .from('comp_trades')
    .select('action, symbol, qty, price')
    .eq('contestant', contestant)
    .order('traded_at')
  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 })

  const { book, cash } = replay((existing ?? []) as Row[])
  const held = book[symbol]?.qty ?? 0

  // ── guard 1: can't sell what isn't held ──
  if (action === 'sell' && qty > held + EPS) {
    return NextResponse.json({
      error: `oversell refused: ${contestant} holds ${held} ${symbol}, tried to sell ${qty}`,
      held, attempted: qty,
    }, { status: 409 })
  }

  // ── guard 2: can't spend cash that isn't there ──
  const cashAfter = action === 'buy' ? cash - qty * price : cash + qty * price
  if (cashAfter < -EPS) {
    return NextResponse.json({
      error: `insufficient cash: ${contestant} has $${cash.toFixed(2)}, trade needs $${(qty * price).toFixed(2)}`,
      cash, needed: qty * price,
    }, { status: 409 })
  }

  // ── guard 3: flag a price that disagrees with the live feed ──
  let refereeNote = note
  let feedPrice: number | null = null
  try {
    feedPrice = (await getMarketQuotes()).find((q) => q.symbol === symbol)?.price ?? null
  } catch { /* feed down — record the trade, just without the cross-check */ }
  if (feedPrice != null) {
    const dev = Math.abs(price - feedPrice) / feedPrice
    if (dev > PRICE_DEVIATION) {
      const flag = `Referee: submitted $${price} is ${(dev * 100).toFixed(1)}% off the live feed ($${feedPrice}) at insert.`
      refereeNote = refereeNote ? `${refereeNote} ${flag}` : flag
    }
  }

  const { error: insErr } = await supabase.from('comp_trades').insert({
    contestant, action, symbol, qty, price, note: refereeNote,
  })
  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

  const after = replay([...((existing ?? []) as Row[]), { action, symbol, qty, price }])
  return NextResponse.json({
    ok: true, contestant, action, symbol, qty, price,
    feedPrice, flagged: refereeNote !== note,
    position: after.book[symbol]?.qty ?? 0,
    cash: after.cash,
  })
}
