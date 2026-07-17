import fs from 'fs'
import path from 'path'
import { getLiveNumbers, minerEconomics } from './liveData'
import { BRAND_SYSTEM_PROMPT } from './rubric'
import { generateJSON, anthropicReady } from './llm/anthropic'
import { reviewJSON, openaiReady } from './llm/openai'
import { firstJsonObject, escapeControlCharsInStrings } from './generate'

interface Idea {
  title: string
  category: 'school' | 'bullish_when_true' | 'evergreen'
  angle: string
  hookDraft: string
  trigger?: string // for bullish_when_true: the live-data condition that makes it postable
  gptScore?: number
  gptNotes?: string
}

const IDEAS_FILE = path.resolve(process.cwd(), 'content-engine/ideas.md')

/**
 * Dual-brain topic research: Claude proposes episode ideas grounded in today's
 * live economics, GPT scores each for scroll-stopping potential + brand fit,
 * and the ranked backlog lands in content-engine/ideas.md. Ideas are drafts —
 * every one still goes through the full gate pipeline when it becomes a script.
 */
async function research(): Promise<Idea[]> {
  const live = await getLiveNumbers()
  const flagship = minerEconomics('antminer-s21-xp', live)

  const proposal = await generateJSON(
    BRAND_SYSTEM_PROMPT,
    `Propose 12 short-video episode ideas for Lightning Mines, split across three categories:

1. "school" (6 ideas): Lightning Lessons — a numbered curriculum teaching bitcoin mining from zero.
   Sequential: each episode assumes the previous ones. Ep 1 (what mining is) and Ep 2 (the pitch) exist.
   Propose eps 3-8. Evergreen — no time-sensitive numbers in the core lesson.
2. "bullish_when_true" (4 ideas): genuinely positive stories we can post ONLY when live data supports
   them. Each needs a "trigger" — a measurable condition (e.g. "flagship miner daily profit > $1").
   Honest optimism grounded in math. Never predictions, never hype.
3. "evergreen" (2 ideas): myth-busts or red-flag warnings that work any day.

CONTEXT (today's live data, for grounding only): BTC $${Math.round(live.btcPrice).toLocaleString()},
hashprice $${live.hashpricePerThDay.toFixed(4)}/TH/day, flagship Antminer S21 XP daily profit ${
      flagship ? `$${flagship.dailyProfitUsd.toFixed(2)}` : 'n/a'
    }.

Return strict JSON: { "ideas": [ { "title": string, "category": "school"|"bullish_when_true"|"evergreen",
"angle": string (2-3 sentences), "hookDraft": string (the opening line), "trigger": string (bullish_when_true only) } ] }`,
    6000
  )
  const parsed = JSON.parse(escapeControlCharsInStrings(firstJsonObject(proposal)))
  const ideas: Idea[] = Array.isArray(parsed.ideas) ? parsed.ideas : []

  const review = await reviewJSON(
    'You are a short-form video strategist reviewing episode ideas for an educational bitcoin-mining trust brand. No hype allowed; honesty is the moat. Score each idea 0-100 for scroll-stopping potential AND brand fit combined, with one sentence of notes.',
    `Score these ideas. Return strict JSON: { "scores": [ { "title": string, "score": number, "notes": string } ] }\n\n${JSON.stringify(ideas, null, 2)}`
  )
  const scores = JSON.parse(escapeControlCharsInStrings(firstJsonObject(review)))
  for (const idea of ideas) {
    const s = (scores.scores || []).find((x: any) => x.title === idea.title)
    if (s) {
      idea.gptScore = Number(s.score)
      idea.gptNotes = String(s.notes || '')
    }
  }
  return ideas.sort((a, b) => (b.gptScore || 0) - (a.gptScore || 0))
}

function renderBacklog(ideas: Idea[]): string {
  const date = new Date().toISOString().slice(0, 10)
  const lines = [
    `# Content Ideas Backlog`,
    ``,
    `Dual-brain research (Claude proposes, GPT scores). Refreshed ${date}. Re-run: \`npm run content:ideas\`.`,
    `To produce one: \`npm run content:run -- --pillar=explainer --angle="<angle from below>"\` then render + post.`,
    `Bullish ideas post ONLY when their trigger is true that day — check with live numbers first.`,
    ``,
  ]
  for (const cat of ['school', 'bullish_when_true', 'evergreen'] as const) {
    lines.push(`## ${cat === 'school' ? 'Lightning Lessons (school curriculum)' : cat === 'bullish_when_true' ? 'Bullish — post when trigger is TRUE' : 'Evergreen'}`)
    lines.push(``)
    for (const i of ideas.filter((x) => x.category === cat)) {
      lines.push(`### ${i.title}  ·  GPT ${i.gptScore ?? '—'}/100`)
      if (i.trigger) lines.push(`**Trigger:** ${i.trigger}`)
      lines.push(`**Angle:** ${i.angle}`)
      lines.push(`**Hook draft:** ${i.hookDraft}`)
      if (i.gptNotes) lines.push(`**GPT notes:** ${i.gptNotes}`)
      lines.push(``)
    }
  }
  return lines.join('\n')
}

async function main() {
  if (!anthropicReady() || !openaiReady()) throw new Error('content:ideas needs both ANTHROPIC_API_KEY and OPENAI_API_KEY')
  const ideas = await research()
  fs.writeFileSync(IDEAS_FILE, renderBacklog(ideas))
  console.log(`💡 ${ideas.length} ideas researched and ranked → ${path.relative(process.cwd(), IDEAS_FILE)}`)
  for (const i of ideas) console.log(`  ${String(i.gptScore ?? '—').padStart(3)}  [${i.category}] ${i.title}`)
}

if (require.main === module) {
  main().catch((e) => {
    console.error('ideas failed:', e)
    process.exit(1)
  })
}
