import { ContentBrief, LiveNumbers, Pillar, Platform, Script, ClaimedNumber } from './types'
import { minerEconomics } from './liveData'
import { BRAND_SYSTEM_PROMPT } from './rubric'
import {
  REQUIRED_CTA,
  AI_DISCLOSURE,
  AFFILIATE_DISCLOSURE,
  HASHTAGS_BY_PLATFORM,
  BRAND_OPEN,
  BULLISH_WORD_MIN,
  BULLISH_WORD_MAX,
} from './config'
import { anthropicReady, generateJSON } from './llm/anthropic'

// Which pillars feature a specific machine's real math.
const FEATURE_MINER: Record<Pillar, string | null> = {
  bullish_caveat: 'antminer-s21-xp', // standard daily format always runs the S21 XP
  hashprice_check: 'antminer-s21-xp',
  hardware_reality: 'antminer-s21-xp',
  week_recap: 'antminer-s21-xp',
  longform: 'antminer-s21-xp',
  red_flag: null,
  explainer: null,
  myth_bust: null,
}

export function buildBrief(live: LiveNumbers, pillar: Pillar, angleOverride?: string): ContentBrief {
  const slug = FEATURE_MINER[pillar]
  const miner = slug ? minerEconomics(slug, live) || undefined : undefined
  const date = new Date().toISOString().slice(0, 10)

  let hookNumber = `$${live.hashpricePerThDay.toFixed(4)}/TH/day hashprice`
  let angle = 'Today’s live hashprice and what it means for a miner’s daily revenue.'

  if (miner) {
    const sign = miner.dailyProfitUsd >= 0 ? '+' : '-'
    hookNumber = `${miner.name}: ${sign}$${Math.abs(miner.dailyProfitUsd).toFixed(2)}/day`
    angle = miner.profitable
      ? `${miner.name} nets $${miner.dailyProfitUsd.toFixed(2)}/day at $${Math.round(live.btcPrice).toLocaleString()} BTC and $${miner.hostingMonthly}/mo hosting.`
      : `${miner.name} loses $${Math.abs(miner.dailyProfitUsd).toFixed(2)}/day at $${Math.round(live.btcPrice).toLocaleString()} BTC — do not buy this today.`
  }

  // Standard format: lead with the bullish case for the S21 XP, then the honest "but".
  if (pillar === 'bullish_caveat' && miner) {
    const btc = Math.round(live.btcPrice).toLocaleString()
    angle = miner.profitable
      ? `Bullish case: the ${miner.name} nets $${miner.dailyProfitUsd.toFixed(2)}/day at $${btc} BTC on $${miner.hostingMonthly}/mo flat hosting. ` +
        `But: that only holds above breakeven ($${Math.round(miner.breakevenBtcPrice).toLocaleString()} BTC) and rising difficulty erodes it.`
      : `Bullish case: the ${miner.name} is the most efficient machine you can host and it turns profitable the moment BTC clears its breakeven ($${Math.round(miner.breakevenBtcPrice).toLocaleString()}). ` +
        `But: at $${btc} BTC it still loses $${Math.abs(miner.dailyProfitUsd).toFixed(2)}/day after hosting — don't buy in expecting instant profit.`
  }

  return { date, pillar, hookNumber, featuredMiner: miner, live, angle: angleOverride || angle }
}

function claimedNumbers(brief: ContentBrief): ClaimedNumber[] {
  const c: ClaimedNumber[] = [
    { label: 'BTC price', value: brief.live.btcPrice, unit: 'btc_price' },
    { label: 'network hashprice', value: brief.live.hashpricePerThDay, unit: 'usd_per_th_day' },
  ]
  const m = brief.featuredMiner
  if (m) {
    c.push({ label: `${m.name} daily profit`, value: m.dailyProfitUsd, unit: 'usd' })
    c.push({ label: `${m.name} breakeven BTC`, value: m.breakevenBtcPrice, unit: 'btc_price' })
  }
  return c
}

// Grounded fallback used in DRY mode (no Anthropic key). Brand-compliant on purpose
// so a dry run demonstrates the happy path; the gates still verify it.
function mockScript(brief: ContentBrief, platform: Platform): Script {
  const m = brief.featuredMiner
  const btc = Math.round(brief.live.btcPrice).toLocaleString()

  // Standard format: brand-open hook, bullish case, honest "but", single CTA at the close.
  if (brief.pillar === 'bullish_caveat' && m) {
    const profit = Math.abs(m.dailyProfitUsd).toFixed(2)
    const breakeven = Math.round(m.breakevenBtcPrice).toLocaleString()
    const bcHook = `${BRAND_OPEN} here — at $${btc} Bitcoin, the ${m.name} ${m.profitable ? 'makes' : 'loses'} $${profit} a day.`
    const bcBody = m.profitable
      ? `Bullish case: at $${btc} BTC on $${m.hostingMonthly}/month flat hosting, the ${m.name}'s ${m.hashrateTh} terahash nets $${profit} a day — real profit from the most efficient machine you can host. But here's the honest part: that only holds above breakeven, $${breakeven} BTC, and rising difficulty chips at it every day. ${REQUIRED_CTA}.`
      : `Bullish case: the ${m.name} is the most efficient machine you can host, and it flips profitable the moment BTC clears breakeven, $${breakeven}. But here's the honest part: at $${btc} BTC it still loses $${profit} a day after $${m.hostingMonthly}/month hosting — don't buy in expecting instant profit. ${REQUIRED_CTA}.`
    return {
      platform,
      pillar: brief.pillar,
      hook: bcHook,
      title: `S21 XP: ${m.profitable ? `+$${profit}/day` : `-$${profit}/day`} — the bullish case (and the catch)`,
      body: bcBody,
      onScreenText: [m.name, `${m.profitable ? '+' : '-'}$${profit}/day`, `Breakeven $${breakeven}`],
      caption:
        platform === 'x'
          ? `${bcHook} ${REQUIRED_CTA}`
          : `${bcHook} Full math + your own numbers at lightningmines.com.`,
      hashtags: HASHTAGS_BY_PLATFORM[platform],
      cta: REQUIRED_CTA,
      disclosures: [AI_DISCLOSURE],
      claimedNumbers: claimedNumbers(brief),
    }
  }

  const hook = m
    ? `The ${m.name} ${m.profitable ? 'makes' : 'loses'} $${Math.abs(m.dailyProfitUsd).toFixed(2)} a day right now.`
    : `Bitcoin hashprice is $${brief.live.hashpricePerThDay.toFixed(4)} per terahash today.`

  const body = m
    ? `At $${btc} BTC and $${m.hostingMonthly}/month flat hosting, a ${m.name} running ${m.hashrateTh} TH/s ${
        m.profitable ? `nets $${m.dailyProfitUsd.toFixed(2)}/day` : `loses $${Math.abs(m.dailyProfitUsd).toFixed(2)}/day`
      }. Breakeven is $${Math.round(m.breakevenBtcPrice).toLocaleString()} BTC — ${
        m.profitable ? 'you have headroom above breakeven today' : 'above today’s price, so it is unprofitable right now'
      }. ${REQUIRED_CTA}.`
    : `Network hashprice is $${brief.live.hashpricePerThDay.toFixed(
        4
      )} per TH per day at $${btc} BTC — the revenue every terahash earns before power and hosting. ${REQUIRED_CTA}.`

  const onScreenText = m
    ? [m.name, `${m.profitable ? '+' : '-'}$${Math.abs(m.dailyProfitUsd).toFixed(2)}/day`, `Breakeven $${Math.round(m.breakevenBtcPrice).toLocaleString()}`]
    : [`$${brief.live.hashpricePerThDay.toFixed(4)}/TH/day`, `$${btc} BTC`]

  const caption =
    platform === 'x'
      ? `${hook} ${REQUIRED_CTA}`
      : `${hook} Full math + your own numbers at lightningmines.com.`

  return {
    platform,
    pillar: brief.pillar,
    hook,
    body,
    onScreenText,
    caption,
    hashtags: HASHTAGS_BY_PLATFORM[platform],
    cta: REQUIRED_CTA,
    disclosures: [AI_DISCLOSURE], // affiliate disclosure added only if a partner is named
    claimedNumbers: claimedNumbers(brief),
  }
}

// Format-specific structure. The default bullish_caveat format is the one Jacob asked for:
// ~30s, bullish case + honest "but", S21 XP always, brand named at the open, CTA at the close.
function formatGuidance(brief: ContentBrief): string {
  if (brief.pillar === 'bullish_caveat') {
    return `LENGTH BUDGET (hard requirement): the spoken "body" must be ${BULLISH_WORD_MIN}-${BULLISH_WORD_MAX} words —
roughly 30 seconds aloud. This is a tight, punchy format. Cut all setup.

TONE: energetic and impactful — make the viewer feel that mining is a real, live opportunity worth
getting excited about. The excitement must come from the specificity of the numbers (real
dollars, real breakeven, real headroom), never from hype vocabulary. Short sentences. Momentum.

TIMELESS PHRASING (hard requirement): this post may publish up to 24 hours after you write it.
NEVER say "today", "right now", "tonight", "this morning", or reference the date. Anchor every
claim to the price instead: "At $66,088 Bitcoin, the S21 XP nets $1.32 a day." Price-conditional
statements stay true as long as the price holds; date-stamped ones go stale overnight.

STRUCTURE (follow exactly — this is a bullish-case-with-a-caveat video):
1. OPEN by naming the brand in the "hook": start with "${BRAND_OPEN}" and then the most
   surprising S21 XP number, price-anchored (e.g. "${BRAND_OPEN} here — at $X Bitcoin, the S21 XP
   makes $Y a day.").
2. BULLISH CASE (first half of body): the strongest HONEST bullish point about the Antminer S21 XP
   using the brief's numbers — daily profit if it's profitable, or efficiency + "profitable the
   moment BTC clears breakeven" if it's not.
3. THE "BUT" (second half of body): one clear, honest caveat that a real miner needs — breakeven
   price, rising-difficulty risk, or that at today's price it still loses money. Never hide this.
4. CLOSE: end the body with EXACTLY the required CTA, once. The CTA already contains
   lightningmines.com, so the brand is named at the open and the URL at the close.

DO NOT REPEAT (this fixes a real bug): say each number and each idea ONCE. Do NOT restate the hook
number or recap at the end, and do NOT write the CTA or "lightningmines.com" more than once. End
cleanly on the single CTA — no trailing repetition.`
  }
  return `LENGTH BUDGET (hard requirement): the spoken "body" must be 110-150 words — roughly 45-60 seconds
aloud. Shorter retains viewers better and costs less to render. Cut setup, keep the mechanics.`
}

function userPrompt(brief: ContentBrief, platform: Platform): string {
  return `Write one ${platform.replace('_', ' ')} script for pillar "${brief.pillar}".

${formatGuidance(brief)}

LIVE DATA BRIEF (use ONLY these numbers):
${JSON.stringify({ date: brief.date, angle: brief.angle, live: brief.live, featuredMiner: brief.featuredMiner }, null, 2)}

Return strict JSON with this exact shape:
{
  "hook": string,            // first line, ~1.5s, leads with the surprising number
  "title": string,           // display/YouTube title, <=90 chars: curiosity-driven, a reason to tap, never a lie, evergreen pieces must not say "today"
  "body": string,            // spoken script for the AI presenter, ends with the required CTA
  "onScreenText": string[],  // 2-4 big on-screen numbers/labels
  "caption": string,         // platform caption
  "cta": "Run your own numbers free at lightningmines.com",
  "disclosures": string[],   // must include the AI-presenter disclosure; add affiliate if a partner is named
  "claimedNumbers": [ { "label": string, "value": number, "unit": "usd"|"usd_per_th_day"|"btc_price"|"percent" } ]
}`
}

// Extract the first balanced JSON object — models sometimes append prose after the JSON.
export function firstJsonObject(raw: string): string {
  const start = raw.indexOf('{')
  if (start < 0) return '{}'
  let depth = 0
  let inString = false
  for (let i = start; i < raw.length; i++) {
    const ch = raw[i]
    if (inString) {
      if (ch === '\\') i++
      else if (ch === '"') inString = false
    } else if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}' && --depth === 0) return raw.slice(start, i + 1)
  }
  return raw.slice(start)
}

// Escape raw control characters that appear INSIDE string values (models write
// real newlines into multi-sentence fields, which is invalid JSON).
export function escapeControlCharsInStrings(json: string): string {
  let out = ''
  let inString = false
  for (let i = 0; i < json.length; i++) {
    const ch = json[i]
    if (inString) {
      if (ch === '\\') {
        out += ch + (json[i + 1] || '')
        i++
        continue
      }
      if (ch === '"') inString = false
      if (ch === '\n') { out += '\\n'; continue }
      if (ch === '\r') { out += '\\r'; continue }
      if (ch === '\t') { out += '\\t'; continue }
    } else if (ch === '"') inString = true
    out += ch
  }
  return out
}

function parseScript(raw: string, brief: ContentBrief, platform: Platform): Script {
  const p = JSON.parse(escapeControlCharsInStrings(firstJsonObject(raw)))
  return {
    platform,
    pillar: brief.pillar,
    hook: String(p.hook || ''),
    title: String(p.title || ''),
    body: String(p.body || ''),
    onScreenText: Array.isArray(p.onScreenText) ? p.onScreenText.map(String) : [],
    caption: String(p.caption || ''),
    hashtags: HASHTAGS_BY_PLATFORM[platform],
    cta: String(p.cta || REQUIRED_CTA),
    disclosures: Array.isArray(p.disclosures) && p.disclosures.length ? p.disclosures.map(String) : [AI_DISCLOSURE],
    claimedNumbers: Array.isArray(p.claimedNumbers) ? p.claimedNumbers : claimedNumbers(brief),
  }
}

// Models occasionally emit malformed JSON (unescaped quote, truncation). Retry with
// the parse error fed back instead of crashing the whole run — a dead pipeline is a
// missed posting day, and the gates still validate whatever ultimately parses.
const JSON_ATTEMPTS = 3

async function generateOneScript(brief: ContentBrief, platform: Platform): Promise<Script> {
  let lastError = ''
  for (let attempt = 1; attempt <= JSON_ATTEMPTS; attempt++) {
    const prompt =
      userPrompt(brief, platform) +
      (lastError
        ? `\n\nIMPORTANT: your previous response was not parseable JSON (${lastError}). Return ONLY one complete, valid JSON object — escape any double quotes inside string values, no trailing text.`
        : '')
    const raw = await generateJSON(BRAND_SYSTEM_PROMPT, prompt, 3000)
    try {
      return parseScript(raw, brief, platform)
    } catch (e) {
      lastError = (e instanceof Error ? e.message : String(e)).slice(0, 150)
      console.log(`⚠ ${platform}: invalid JSON from generator (attempt ${attempt}/${JSON_ATTEMPTS}) — ${lastError}`)
    }
  }
  throw new Error(`${platform}: generator returned invalid JSON ${JSON_ATTEMPTS} times — ${lastError}`)
}

export async function generateScripts(
  brief: ContentBrief,
  platforms: Platform[],
  mode: 'dry' | 'live'
): Promise<Script[]> {
  if (mode === 'live' && anthropicReady()) {
    const out: Script[] = []
    for (const p of platforms) {
      out.push(await generateOneScript(brief, p))
    }
    return out
  }
  return platforms.map((p) => mockScript(brief, p))
}

export { AFFILIATE_DISCLOSURE }
