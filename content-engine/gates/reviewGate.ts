import { ContentBrief, GateResult, Script } from '../types'
import { REVIEW_RUBRIC } from '../rubric'
import { REVIEW_PASS_SCORE } from '../config'
import { openaiReady, reviewJSON } from '../llm/openai'

/**
 * Second-opinion gate. A different model (GPT) critiques the script against the
 * rubric — the "checks and balances" step. In DRY mode (no OpenAI key) it returns
 * a neutral note so the pipeline still runs end-to-end.
 */
export async function reviewGate(script: Script, brief: ContentBrief, _mode: 'dry' | 'live'): Promise<GateResult> {
  // Run the real GPT critique whenever the OpenAI key exists — independent of
  // whether the generator (Claude) is live. Each stage uses its own key.
  if (openaiReady()) {
    const user = `LIVE DATA BRIEF:
${JSON.stringify({ date: brief.date, pillar: brief.pillar, live: brief.live, miner: brief.featuredMiner }, null, 2)}

SCRIPT TO REVIEW:
${JSON.stringify(script, null, 2)}`

    let raw: string
    try {
      raw = await reviewJSON(REVIEW_RUBRIC, user)
    } catch (e) {
      // Surface API/auth/billing errors as a gate issue instead of crashing.
      const msg = e instanceof Error ? e.message : String(e)
      return { gate: 'review — GPT second opinion', pass: false, issues: [`OpenAI API error: ${msg}`] }
    }

    try {
      const r = JSON.parse(raw) as { score?: number; pass?: boolean; issues?: string[]; strengths?: string[] }
      const score = typeof r.score === 'number' ? r.score : 0
      const pass = !!r.pass && score >= REVIEW_PASS_SCORE
      return {
        gate: 'review — GPT second opinion',
        pass,
        score,
        issues: Array.isArray(r.issues) ? r.issues : [],
        notes: Array.isArray(r.strengths) ? r.strengths : [],
      }
    } catch {
      return { gate: 'review — GPT second opinion', pass: false, issues: ['Reviewer returned invalid JSON'] }
    }
  }

  return {
    gate: 'review — GPT second opinion',
    pass: true,
    score: undefined,
    issues: [],
    notes: ['DRY MODE — GPT reviewer not called (no OPENAI_API_KEY). Add the key to enable the second-model critique.'],
  }
}
