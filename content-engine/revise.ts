import { ContentBrief, Script } from './types'
import { BRAND_SYSTEM_PROMPT } from './rubric'
import { anthropicReady, generateJSON } from './llm/anthropic'

/**
 * Dual-brain step: hand the generator (Claude) the reviewer's (GPT + deterministic)
 * complaints and have it rewrite to fix EVERY one, keeping the correct numbers and
 * voice. This is what turns "one grades the other" into "they converge on perfect."
 */
export async function reviseScript(script: Script, brief: ContentBrief, issues: string[]): Promise<Script> {
  if (!anthropicReady() || issues.length === 0) return script

  const user = `A reviewer flagged the issues below. Rewrite the script to fix EVERY issue.
Keep the calm, numbers-first Lightning Mines voice. Use ONLY numbers present in the brief.

BRIEF (the only valid numbers):
${JSON.stringify({ date: brief.date, live: brief.live, featuredMiner: brief.featuredMiner }, null, 2)}

CURRENT SCRIPT:
${JSON.stringify(script, null, 2)}

ISSUES TO FIX:
${issues.map((i, n) => `${n + 1}. ${i}`).join('\n')}

Return the revised script as strict JSON in the same shape:
{ "hook": string, "body": string, "onScreenText": string[], "caption": string,
  "cta": string, "disclosures": string[],
  "claimedNumbers": [ { "label": string, "value": number, "unit": "usd"|"usd_per_th_day"|"btc_price"|"percent" } ] }`

  let raw: string
  try {
    raw = await generateJSON(BRAND_SYSTEM_PROMPT, user)
  } catch {
    return script // if the revise call fails, keep the original (it will stay flagged)
  }

  try {
    const start = raw.indexOf('{')
    const end = raw.lastIndexOf('}')
    const p = JSON.parse(raw.slice(start, end + 1))
    return {
      ...script,
      hook: String(p.hook ?? script.hook),
      body: String(p.body ?? script.body),
      onScreenText: Array.isArray(p.onScreenText) ? p.onScreenText.map(String) : script.onScreenText,
      caption: String(p.caption ?? script.caption),
      cta: String(p.cta ?? script.cta),
      disclosures: Array.isArray(p.disclosures) && p.disclosures.length ? p.disclosures.map(String) : script.disclosures,
      claimedNumbers: Array.isArray(p.claimedNumbers) ? p.claimedNumbers : script.claimedNumbers,
    }
  } catch {
    return script
  }
}
