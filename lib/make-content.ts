// Gated daily content for the Make.com posting pipeline.
//
// This is the server-side home of the content-engine quality bar: Claude writes a
// fresh script from live numbers, the deterministic fact + brand/FTC gates check it,
// GPT gives the second opinion, and Claude revises against the notes until it passes.
// If any step fails (missing key, API outage, gates never converge), the pre-approved
// template drop from lib/daily-content.ts ships instead — fresh when possible, never
// wrong. The day's result is cached in Supabase so every consumer (Make's generate
// run, the publish webhook, a debugging human) sees the same content all day.

import { getLivePriceData } from './btc-price'
import { calculateMiningProfitability } from './calculator'
import { computeDailyNumbers, buildDailyDrop } from './daily-content'
import { createServiceClient } from './supabase'
import { buildBrief, generateScripts } from '../content-engine/generate'
import { reviseScript } from '../content-engine/revise'
import { factGate } from '../content-engine/gates/factGate'
import { brandGate } from '../content-engine/gates/brandGate'
import { reviewGate } from '../content-engine/gates/reviewGate'
import { MAX_REVISIONS, HASHTAGS_BY_PLATFORM } from '../content-engine/config'
import type { ContentBrief, GateResult, LiveNumbers, Pillar, Script, Platform } from '../content-engine/types'

// Price numbers are Sunday-only (Jacob, 2026-07-25): Sunday runs the live "is Bitcoin
// mining still worth it at $X" numbers check; every other day is evergreen educational
// content with ZERO dollar figures, so a whole week of posts can be banked without
// anything going stale. getUTCDay(): 0=Sun ... 6=Sat.
const EVERGREEN_PILLAR_BY_DOW: Record<number, Pillar> = {
  1: 'explainer',
  2: 'red_flag',
  3: 'hardware_reality',
  4: 'explainer',
  5: 'red_flag',
  6: 'myth_bust',
}

const EVERGREEN_ANGLE =
  'EVERGREEN PIECE (price numbers are Sunday-only — Jacob, 2026-07-25): this post may publish ' +
  'any day, up to a week after writing. Do NOT state the Bitcoin price, hashprice, difficulty ' +
  'values, profit/loss dollar amounts, or ANY dollar figure — zero $ numbers anywhere, including ' +
  'the title and on-screen text. Teach one timeless idea from this pillar that a miner could ' +
  'watch any week and still find true. ' +
  'TONE (Jacob, 2026-07-25): bullish on Bitcoin mining as a thing worth learning — energetic, ' +
  'fun, entertaining. Write like a sharp friend who actually mines, not a news desk: contractions, ' +
  'short punchy sentences, and ONE genuinely funny line or vivid image per script (dry wit, never ' +
  'cringe, never hype vocabulary, no emoji). The honesty is the entertainment — the joke lands ' +
  'because the math is real. ' +
  'The hook must still name Bitcoin mining, and the worth-it question works without a price — ' +
  'but write FRESH wording every time: this runs in a weekly batch and the exact phrase ' +
  '"Here\'s what most people miss" is BANNED (it was copy-pasted across a whole week once). ' +
  'End the body with the required CTA once.'

// Per-pillar hook direction so a week of evergreen posts never opens the same way twice.
const HOOK_SEED: Record<string, string> = {
  explainer: 'tease the one mining concept almost everyone gets wrong',
  red_flag: 'tease the specific scam or contract trap you are about to expose',
  hardware_reality: 'tease the hardware-buying mistake that costs people the most',
  myth_bust: 'name the myth you are about to take apart',
}

const HARDWARE_NO_PRICE =
  ' HARDWARE RULE: stay completely dollar-free — compare machines by efficiency (joules per ' +
  'terahash), hardware generation, cooling, and used-market risk. If you feel the urge to quote ' +
  'a price, describe it qualitatively ("flagship money", "used-market cheap") instead.'

/** Deterministic evergreen gate: Mon–Sat posts must carry no dollar figures at all. */
function evergreenGate(script: Script): GateResult {
  const text = [script.hook, script.title || '', script.body, script.caption, ...(script.onScreenText || [])].join('  ')
  const issues: string[] = []
  if (/\$\s?\d/.test(text)) {
    issues.push('Evergreen post contains a dollar figure — price numbers are Sunday-only')
  }
  // Live network readings ("difficulty just hit 126.2 trillion") go stale mid-week just
  // like prices. Hardware specs ("270 terahash") are stable and stay allowed.
  if (/\b\d[\d.,]*\s*(trillion|billion)\b/i.test(text)) {
    issues.push('Evergreen post quotes a live network figure (difficulty/hashrate) — live numbers are Sunday-only')
  }
  if (!/bitcoin mining|mining bitcoin|btc mining/i.test(script.hook)) {
    issues.push('Hook does not name Bitcoin mining')
  }
  return { gate: 'evergreen (no price numbers Mon–Sat)', pass: issues.length === 0, issues }
}

export interface MakeDrop {
  date: string
  dateNext: string // day after `date` — TikTok's 00:30Z slot lands there
  source: 'engine' | 'template'
  theme: string
  title: string
  hook: string
  script: string // spoken by the HeyGen presenter
  captions: { youtube: string; instagram: string; tiktok: string; x: string }
  numbers: {
    btcPrice: number
    difficulty: number
    hashpricePerThDay: number
    s21NetDay: number
    breakevenBtcPrice: number
    profitable: boolean
  }
  gates: { gate: string; pass: boolean; score?: number; issues: string[] }[]
  revisions: number
}

const usd = (n: number) => Math.abs(n).toFixed(2)
const usd0 = (n: number) => Math.round(n).toLocaleString('en-US')
const dayAfter = (iso: string) => new Date(new Date(`${iso}T12:00:00Z`).getTime() + 864e5).toISOString().slice(0, 10)

async function liveNumbers(): Promise<LiveNumbers> {
  const live = await getLivePriceData()
  if (!live || 'error' in live) throw new Error('live price data unavailable')
  const one = calculateMiningProfitability({
    hashrate_th: 1,
    power_watts: 0,
    electricity_rate_kwh: 0,
    hardware_cost: null,
    btc_price: live.price,
    network_difficulty: live.difficulty,
  })
  return {
    btcPrice: live.price,
    difficulty: live.difficulty,
    hashpricePerThDay: one.hashprice_usd_per_th_day,
    fetchedAt: new Date().toISOString(),
    source: 'lib/btc-price',
  }
}

/** Hooks must differ across the week — a feed of identical openers reads as copy-paste. */
function varietyGate(script: Script, otherHooks: string[]): GateResult {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
  const h = norm(script.hook)
  const toks = new Set(h.split(' '))
  const issues: string[] = []
  for (const o of otherHooks) {
    const on = norm(o)
    if (!on) continue
    const otoks = new Set(on.split(' '))
    const inter = [...toks].filter((t) => otoks.has(t)).length
    const jaccard = inter / Math.max(1, new Set([...toks, ...otoks]).size)
    if (h === on || jaccard > 0.7) {
      issues.push(`Hook nearly duplicates another queued day's hook ("${o}") — write a different opener`)
      break
    }
  }
  return { gate: 'variety (no repeated hooks across the week)', pass: issues.length === 0, issues }
}

/** Hooks already cached for the surrounding week, so the variety gate has something to compare against. */
async function nearbyHooks(targetDate: string): Promise<string[]> {
  const supabase = createServiceClient()
  if (!supabase) return []
  const t = new Date(`${targetDate}T12:00:00Z`).getTime()
  const lo = new Date(t - 6 * 864e5).toISOString().slice(0, 10)
  const hi = new Date(t + 6 * 864e5).toISOString().slice(0, 10)
  const { data } = await supabase
    .from('make_content_cache')
    .select('cache_date, payload')
    .gte('cache_date', lo)
    .lte('cache_date', hi)
    .neq('cache_date', targetDate)
  return (data || []).map((r) => (r.payload as MakeDrop)?.hook).filter(Boolean)
}

function captionFor(script: Script, platform: Platform): string {
  const disclosure = script.disclosures.join(' ')
  if (platform === 'x') {
    // X gets the written breakdown (hook + body) with the video attached natively.
    return [script.hook, script.body, HASHTAGS_BY_PLATFORM.x.join(' '), disclosure]
      .filter(Boolean)
      .join('\n\n')
  }
  return [script.caption, HASHTAGS_BY_PLATFORM[platform].join(' '), disclosure]
    .filter(Boolean)
    .join('\n\n')
}

/** Full content-engine path: generate → gates → revise loop. Throws on any failure. */
async function engineDrop(deadline: number, targetDate: string): Promise<MakeDrop> {
  const live = await liveNumbers()
  const dow = new Date(`${targetDate}T12:00:00Z`).getUTCDay()
  const today = new Date().toISOString().slice(0, 10)
  // The Sunday numbers post is only valid generated same-day — a week-old price is
  // exactly the staleness the evergreen rule exists to prevent.
  const pillar: Pillar = dow === 0 && targetDate === today ? 'bullish_caveat' : EVERGREEN_PILLAR_BY_DOW[dow] || 'myth_bust'
  const evergreenAngle =
    EVERGREEN_ANGLE +
    ` HOOK ANGLE for this piece (${targetDate}): ${HOOK_SEED[pillar] || HOOK_SEED.explainer}.` +
    (pillar === 'hardware_reality' ? HARDWARE_NO_PRICE : '')
  const brief = buildBrief(live, pillar, pillar === 'bullish_caveat' ? undefined : evergreenAngle)

  const otherHooks = await nearbyHooks(targetDate)

  // Free deterministic gates run first; the paid GPT review only grades drafts
  // that already passed them — a known-bad draft never costs a review call.
  const gatesFor = async (s: Script) => {
    const det = [factGate(s, brief), brandGate(s), varietyGate(s, otherHooks)]
    if (pillar !== 'bullish_caveat') det.push(evergreenGate(s))
    if (!det.every((g) => g.pass)) return det
    return [...det, await reviewGate(s, brief, 'live')]
  }

  let script = (await generateScripts(brief, ['youtube_shorts'], 'live'))[0]
  let gates = await gatesFor(script)
  let revisions = 0
  while (!gates.every((g) => g.pass) && revisions < MAX_REVISIONS && Date.now() < deadline) {
    const issues = gates.filter((g) => !g.pass).flatMap((g) => g.issues)
    script = await reviseScript(script, brief, issues)
    gates = await gatesFor(script)
    revisions++
  }
  if (!gates.every((g) => g.pass)) {
    const issues = gates.filter((g) => !g.pass).flatMap((g) => g.issues)
    throw new Error(`gates failed after ${revisions} revision(s): ${issues.join('; ')}`)
  }

  const n = computeDailyNumbers(live.btcPrice, live.difficulty)
  return {
    date: targetDate,
    dateNext: dayAfter(targetDate),
    source: 'engine',
    theme: pillar,
    title: (script.title || script.hook).slice(0, 90),
    hook: script.hook,
    script: script.body,
    captions: {
      youtube: captionFor(script, 'youtube_shorts'),
      instagram: captionFor(script, 'instagram_reels'),
      tiktok: captionFor(script, 'tiktok'),
      x: captionFor(script, 'x'),
    },
    numbers: {
      btcPrice: n.btcPrice,
      difficulty: n.difficulty,
      hashpricePerThDay: n.hashpricePerThDay,
      s21NetDay: n.s21NetDay,
      breakevenBtcPrice: n.breakevenBtcPrice,
      profitable: n.profitable,
    },
    gates: gates.map((g) => ({ gate: g.gate, pass: g.pass, score: g.score, issues: g.issues })),
    revisions,
  }
}

/** Pre-approved template fallback — the numbers are computed, the copy is fixed. */
async function templateDrop(): Promise<MakeDrop> {
  const live = await getLivePriceData()
  if (!live || 'error' in live) throw new Error('live price data unavailable')
  const n = computeDailyNumbers(live.price, live.difficulty)
  const drop = buildDailyDrop(n, new Date())
  const sign = n.profitable ? '+' : '-'
  const today = new Date().toISOString().slice(0, 10)
  return {
    date: today,
    dateNext: dayAfter(today),
    source: 'template',
    theme: drop.theme,
    title: `Is Bitcoin mining still worth it? S21 XP: ${sign}$${usd(n.s21NetDay)}/day at $${usd0(n.btcPrice)} BTC`.slice(0, 90),
    hook: drop.script.split('\n')[0],
    script: drop.video.narration,
    captions: drop.captions,
    numbers: {
      btcPrice: n.btcPrice,
      difficulty: n.difficulty,
      hashpricePerThDay: n.hashpricePerThDay,
      s21NetDay: n.s21NetDay,
      breakevenBtcPrice: n.breakevenBtcPrice,
      profitable: n.profitable,
    },
    gates: [{ gate: 'template (pre-approved copy, computed numbers)', pass: true, issues: [] }],
    revisions: 0,
  }
}

/**
 * The day's drop, generated once and cached in Supabase so the video script and
 * every platform caption always carry the same numbers no matter when they're read.
 */
export async function getMakeDrop(opts: { refresh?: boolean; date?: string } = {}): Promise<MakeDrop> {
  const today = new Date().toISOString().slice(0, 10)
  const target = opts.date && /^\d{4}-\d{2}-\d{2}$/.test(opts.date) ? opts.date : today
  const supabase = createServiceClient()

  if (supabase && !opts.refresh) {
    const { data } = await supabase
      .from('make_content_cache')
      .select('payload')
      .eq('cache_date', target)
      .maybeSingle()
    if (data?.payload) return data.payload as MakeDrop
  }

  let drop: MakeDrop
  try {
    drop = await engineDrop(Date.now() + 180_000, target)
  } catch (e) {
    console.error('make-content: engine path failed —', e instanceof Error ? e.message : e)
    // The template fallback carries today's numbers, so it's only valid same-day.
    // A future-dated request (weekly batching) must fail loudly instead of banking
    // a post whose numbers will be stale by the time it publishes.
    if (target !== today) throw e
    drop = await templateDrop()
  }

  if (supabase) {
    await supabase
      .from('make_content_cache')
      .upsert({ cache_date: target, payload: drop, source: drop.source })
  }
  return drop
}

/** Escape a string for direct interpolation inside a JSON string body (Make's jsonString modules). */
export function jsonSafe(s: string): string {
  return s
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\r/g, '')
    .replace(/\n/g, '\\n')
    .replace(/[\x00-\x1f]/g, ' ')
}
