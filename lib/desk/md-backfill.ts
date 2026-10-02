import type { SupabaseClient } from '@supabase/supabase-js'
import { MAX_BARS, candleWindow, fetchCandles, parseCoinbaseCandles, type MdRow } from './coinbase-candles'

// RESUMABLE BACKFILL + FORWARD FILL for md_candles, driven by md_backfill_cursor rows. Each run does a
// bounded amount of work (fits a 60s route): a batch of backward chunks for unfinished cursors, then a
// head refresh for finished ones whose newest bar is stale. pg_cron calls it every few minutes until
// the backlog is gone, after which the same route is the daily forward fill. Idempotent: every write
// is an upsert on the candle primary key.

export interface Cursor {
  venue: string; symbol: string; product_id: string; interval_minutes: number
  next_end: string; target_start: string; done: boolean; bars: number; requests: number; priority: number; error: string | null; head_synced_at: string | null
}

export interface CursorStep { done: boolean; next_end: string; bars: number; requests: number; error: string | null }

/** Pure: where the cursor goes after one chunk. `rows` are the completed bars the chunk produced. */
export function advanceCursor(c: Cursor, windowStartMs: number, rows: MdRow[], notFound: boolean): CursorStep {
  const requests = c.requests + 1
  if (notFound) return { done: true, next_end: c.next_end, bars: c.bars, requests, error: 'product 404' }
  const target = new Date(c.target_start).getTime()
  const bars = c.bars + rows.length
  // Empty chunk = history exhausted (listing date reached); window past the target = far enough back.
  if (rows.length === 0 || windowStartMs <= target) return { done: true, next_end: new Date(windowStartMs).toISOString(), bars, requests, error: null }
  const oldest = Math.min(...rows.map((r) => new Date(r.bar_time).getTime()))
  return { done: false, next_end: new Date(oldest - c.interval_minutes * 60_000).toISOString(), bars, requests, error: null }
}

async function upsertCandles(sb: SupabaseClient, rows: MdRow[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await sb.from('md_candles').upsert(rows.slice(i, i + 500), { onConflict: 'venue,symbol,interval_minutes,bar_time', ignoreDuplicates: false })
    if (error) throw new Error(`md_candles upsert: ${error.message}`)
  }
}

async function stepCursor(sb: SupabaseClient, c: Cursor, now: number): Promise<CursorStep> {
  const { startMs, endMs } = candleWindow(new Date(c.next_end).getTime(), c.interval_minutes)
  let step: CursorStep
  try {
    const raw = await fetchCandles(c.product_id, c.interval_minutes, startMs, endMs)
    const rows = raw === null ? [] : parseCoinbaseCandles(raw, c.symbol, c.interval_minutes, now)
    if (rows.length) await upsertCandles(sb, rows)
    step = advanceCursor(c, startMs, rows, raw === null)
  } catch (e) {
    step = { done: false, next_end: c.next_end, bars: c.bars, requests: c.requests + 1, error: (e instanceof Error ? e.message : String(e)).slice(0, 200) }
  }
  const { error } = await sb.from('md_backfill_cursor').update({ ...step, updated_at: new Date().toISOString() })
    .eq('venue', c.venue).eq('symbol', c.symbol).eq('interval_minutes', c.interval_minutes)
  if (error) throw new Error(`cursor update: ${error.message}`)
  return step
}

/** Forward fill: newest bars from the last stored bar to now (one request, ≤ MAX_BARS). */
async function refreshHead(sb: SupabaseClient, c: Cursor, now: number): Promise<number> {
  const { data } = await sb.from('md_candles').select('bar_time').eq('venue', c.venue).eq('symbol', c.symbol).eq('interval_minutes', c.interval_minutes).order('bar_time', { ascending: false }).limit(1).maybeSingle()
  const step = c.interval_minutes * 60_000
  const last = data?.bar_time ? new Date(data.bar_time).getTime() : now - (MAX_BARS - 1) * step
  const startMs = Math.max(last, now - (MAX_BARS - 1) * step)
  let n = 0, error: string | null = null
  try {
    const raw = await fetchCandles(c.product_id, c.interval_minutes, startMs, now)
    const rows = raw === null ? [] : parseCoinbaseCandles(raw, c.symbol, c.interval_minutes, now)
    if (rows.length) await upsertCandles(sb, rows)
    n = rows.length
  } catch (e) { error = (e instanceof Error ? e.message : String(e)).slice(0, 200) }
  await sb.from('md_backfill_cursor').update({ head_synced_at: new Date().toISOString(), error, requests: c.requests + 1, updated_at: new Date().toISOString() })
    .eq('venue', c.venue).eq('symbol', c.symbol).eq('interval_minutes', c.interval_minutes)
  return n
}

// Coinbase's public limit is ~10 req/s per IP and it 429s on bursts (23% of the first runs' chunks were
// rate-limited). Small groups with a pause between them keep a 40-chunk run inside the limit.
const PACE_MS = 400
const inGroups = async <T, R>(items: T[], size: number, fn: (t: T) => Promise<R>): Promise<R[]> => {
  const out: R[] = []
  for (let i = 0; i < items.length; i += size) {
    if (i > 0) await new Promise((r) => setTimeout(r, PACE_MS))
    out.push(...(await Promise.all(items.slice(i, i + size).map(fn))))
  }
  return out
}

export interface BatchResult { backfilled: number; chunks: number; errors: number; completed: number; headRefreshed: number; headBars: number; remaining: number }

export async function runBackfillBatch(sb: SupabaseClient, opts: { chunks?: number; heads?: number; now?: number } = {}): Promise<BatchResult> {
  const now = opts.now ?? Date.now()
  const chunks = opts.chunks ?? 40, heads = opts.heads ?? 20
  // Daily first (features need it), then by priority, oldest-touched first so no cursor starves.
  const { data: todo, error } = await sb.from('md_backfill_cursor').select('*').eq('done', false)
    .order('interval_minutes', { ascending: false }).order('priority').order('updated_at').limit(chunks)
  if (error) throw new Error(`cursor select: ${error.message}`)
  const steps = await inGroups((todo ?? []) as Cursor[], 3, (c) => stepCursor(sb, c, now))

  // Heads: finished cursors whose newest bar is older than one interval.
  const { data: stale } = await sb.from('md_backfill_cursor').select('*').eq('done', true).is('error', null)
    .or(`head_synced_at.is.null,head_synced_at.lt.${new Date(now - 60 * 60_000).toISOString()}`)
    .order('interval_minutes', { ascending: false }).order('head_synced_at', { ascending: true, nullsFirst: true }).limit(heads)
  const headCounts = await inGroups((stale ?? []) as Cursor[], 3, (c) => refreshHead(sb, c, now))

  const { count } = await sb.from('md_backfill_cursor').select('*', { count: 'exact', head: true }).eq('done', false)
  return {
    backfilled: steps.reduce((s, x) => s + (x.error ? 0 : 1), 0), chunks: steps.length, errors: steps.filter((x) => x.error).length,
    completed: steps.filter((x) => x.done).length, headRefreshed: headCounts.length, headBars: headCounts.reduce((a, b) => a + b, 0), remaining: count ?? -1,
  }
}
