import { PipelineResult, ReviewedScript, Pillar } from './types'
import { getLiveNumbers } from './liveData'
import { buildBrief, generateScripts } from './generate'
import { factGate } from './gates/factGate'
import { brandGate } from './gates/brandGate'
import { reviewGate } from './gates/reviewGate'
import { PILLAR_BY_WEEKDAY, ALL_PLATFORMS } from './config'

/**
 * The brain. Ideate from live data -> generate per-platform scripts -> run every
 * gate. Nothing here posts anything: it produces reviewed scripts for the human
 * approval digest. Rendering (HeyGen) and posting (Blotato) hang off the approved
 * output once those keys/accounts exist.
 */
export async function runPipeline(mode: 'dry' | 'live', opts: { pillar?: string } = {}): Promise<PipelineResult> {
  const live = await getLiveNumbers()
  const pillar = (opts.pillar as Pillar) || PILLAR_BY_WEEKDAY[new Date().getUTCDay()]
  const brief = buildBrief(live, pillar)

  // One vertical asset repurposes to the short platforms; X gets a text-native cut.
  const platforms = ALL_PLATFORMS
  const scripts = await generateScripts(brief, platforms, mode)

  const reviewed: ReviewedScript[] = []
  for (const script of scripts) {
    const gates = [factGate(script, brief), brandGate(script), await reviewGate(script, brief, mode)]
    reviewed.push({ script, gates, passedAll: gates.every((g) => g.pass) })
  }

  return { brief, reviewed, generatedAt: new Date().toISOString(), mode }
}
