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
import type { ContentBrief, GateResult, LiveNumbers, Script, Platform } from '../content-engine/types'

export interface MakeDrop {
  date: string
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

async function runGates(script: Script, brief: ContentBrief): Promise<GateResult[]> {
  return [factGate(script, brief), brandGate(script), await reviewGate(script, brief, 'live')]
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
async function engineDrop(deadline: number): Promise<MakeDrop> {
  const live = await liveNumbers()
  const brief = buildBrief(live, 'bullish_caveat')

  let script = (await generateScripts(brief, ['youtube_shorts'], 'live'))[0]
  let gates = await runGates(script, brief)
  let revisions = 0
  while (!gates.every((g) => g.pass) && revisions < MAX_REVISIONS && Date.now() < deadline) {
    const issues = gates.filter((g) => !g.pass).flatMap((g) => g.issues)
    script = await reviseScript(script, brief, issues)
    gates = await runGates(script, brief)
    revisions++
  }
  if (!gates.every((g) => g.pass)) {
    const issues = gates.filter((g) => !g.pass).flatMap((g) => g.issues)
    throw new Error(`gates failed after ${revisions} revision(s): ${issues.join('; ')}`)
  }

  const n = computeDailyNumbers(live.btcPrice, live.difficulty)
  return {
    date: new Date().toISOString().slice(0, 10),
    source: 'engine',
    theme: brief.pillar,
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
  return {
    date: new Date().toISOString().slice(0, 10),
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
export async function getMakeDrop(opts: { refresh?: boolean } = {}): Promise<MakeDrop> {
  const today = new Date().toISOString().slice(0, 10)
  const supabase = createServiceClient()

  if (supabase && !opts.refresh) {
    const { data } = await supabase
      .from('make_content_cache')
      .select('payload')
      .eq('cache_date', today)
      .maybeSingle()
    if (data?.payload) return data.payload as MakeDrop
  }

  let drop: MakeDrop
  try {
    drop = await engineDrop(Date.now() + 40_000)
  } catch (e) {
    console.error('make-content: engine path failed, serving template —', e instanceof Error ? e.message : e)
    drop = await templateDrop()
  }

  if (supabase) {
    await supabase
      .from('make_content_cache')
      .upsert({ cache_date: today, payload: drop, source: drop.source })
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
