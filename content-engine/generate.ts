import { ContentBrief, LiveNumbers, Pillar, Platform, Script, ClaimedNumber } from './types'
import { minerEconomics } from './liveData'
import { BRAND_SYSTEM_PROMPT } from './rubric'
import { REQUIRED_CTA, AI_DISCLOSURE, AFFILIATE_DISCLOSURE, HASHTAGS_BY_PLATFORM } from './config'
import { anthropicReady, generateJSON } from './llm/anthropic'

// Which pillars feature a specific machine's real math.
const FEATURE_MINER: Record<Pillar, string | null> = {
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

function userPrompt(brief: ContentBrief, platform: Platform): string {
  return `Write one ${platform.replace('_', ' ')} script for pillar "${brief.pillar}".

LENGTH BUDGET (hard requirement): the spoken "body" must be 110-150 words — roughly 45-60 seconds
aloud. Shorter retains viewers better and costs less to render. Cut setup, keep the mechanics.

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

export async function generateScripts(
  brief: ContentBrief,
  platforms: Platform[],
  mode: 'dry' | 'live'
): Promise<Script[]> {
  if (mode === 'live' && anthropicReady()) {
    const out: Script[] = []
    for (const p of platforms) {
      const raw = await generateJSON(BRAND_SYSTEM_PROMPT, userPrompt(brief, p))
      out.push(parseScript(raw, brief, p))
    }
    return out
  }
  return platforms.map((p) => mockScript(brief, p))
}

export { AFFILIATE_DISCLOSURE }
