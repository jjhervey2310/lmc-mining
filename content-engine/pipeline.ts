import { PipelineResult, ReviewedScript, Pillar, Script, ContentBrief, GateResult } from './types'
import { getLiveNumbers } from './liveData'
import { buildBrief, generateScripts } from './generate'
import { reviseScript } from './revise'
import { factGate } from './gates/factGate'
import { brandGate } from './gates/brandGate'
import { reviewGate } from './gates/reviewGate'
import { DEFAULT_PILLAR, ALL_PLATFORMS, MAX_REVISIONS } from './config'

/** Run all gates on a single script. */
async function runGates(script: Script, brief: ContentBrief, mode: 'dry' | 'live'): Promise<GateResult[]> {
  return [factGate(script, brief), brandGate(script), await reviewGate(script, brief, mode)]
}

/**
 * The brain. Ideate from live data -> generate -> gates -> (Claude↔GPT revise loop
 * until it passes or MAX_REVISIONS) -> approval digest. Nothing here posts anything.
 * Rendering (HeyGen) and posting (Blotato) hang off the approved output.
 */
export async function runPipeline(mode: 'dry' | 'live', opts: { pillar?: string; angle?: string } = {}): Promise<PipelineResult> {
  const live = await getLiveNumbers()
  // Default to the standard bullish+caveat format; an explicit --pillar= (e.g. scheduled
  // Lightning Lessons episodes) still overrides it.
  const pillar = (opts.pillar as Pillar) || DEFAULT_PILLAR
  const brief = buildBrief(live, pillar, opts.angle)

  const platforms = ALL_PLATFORMS
  const initialScripts = await generateScripts(brief, platforms, mode)

  const reviewed: ReviewedScript[] = []
  for (const initial of initialScripts) {
    let script = initial
    let gates = await runGates(script, brief, mode)
    let revisions = 0

    // Cross-check loop: Claude rewrites against the reviewer's notes, then re-gate.
    while (!gates.every((g) => g.pass) && revisions < MAX_REVISIONS && mode === 'live') {
      const issues = gates.filter((g) => !g.pass).flatMap((g) => g.issues)
      script = await reviseScript(script, brief, issues)
      gates = await runGates(script, brief, mode)
      revisions++
    }

    reviewed.push({ script, gates, passedAll: gates.every((g) => g.pass), revisions })
  }

  return { brief, reviewed, generatedAt: new Date().toISOString(), mode }
}
