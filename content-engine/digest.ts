import { PipelineResult, ReviewedScript } from './types'

function gateLine(g: ReviewedScript['gates'][number]): string {
  const mark = g.pass ? '✅' : '⛔'
  const score = typeof g.score === 'number' ? ` (${g.score}/100)` : ''
  const issues = g.issues.length ? ` — ${g.issues.join('; ')}` : ''
  return `- ${mark} **${g.gate}**${score}${issues}`
}

function scriptBlock(r: ReviewedScript): string {
  const s = r.script
  const status = r.passedAll ? '✅ PASSED ALL GATES' : '⛔ HAS ISSUES — do not approve as-is'
  const rev = r.revisions > 0 ? `  ·  ${r.revisions} cross-check revision${r.revisions > 1 ? 's' : ''}` : ''
  return [
    `### ${s.platform}  ·  ${status}${rev}`,
    ``,
    `**Hook:** ${s.hook}`,
    ``,
    `**Script:** ${s.body}`,
    ``,
    s.onScreenText && s.onScreenText.length ? `**On-screen:** ${s.onScreenText.join('  |  ')}` : '',
    `**Caption:** ${s.caption}`,
    `**Hashtags:** ${s.hashtags.join(' ')}`,
    `**Disclosures:** ${s.disclosures.join(' · ')}`,
    ``,
    `**Gate results:**`,
    ...r.gates.map(gateLine),
    ``,
  ]
    .filter(Boolean)
    .join('\n')
}

/** Human-readable approval digest — the one-tap Approve/Reject sheet. */
export function buildDigest(result: PipelineResult): string {
  const { brief } = result
  const anyBlocked = result.reviewed.some((r) => !r.passedAll)

  const header = [
    `# Content for approval — ${brief.date}`,
    ``,
    `**Pillar:** ${brief.pillar}  ·  **Mode:** ${result.mode.toUpperCase()}`,
    `**Live:** BTC $${Math.round(brief.live.btcPrice).toLocaleString()} · hashprice $${brief.live.hashpricePerThDay.toFixed(4)}/TH/day · difficulty ${(brief.live.difficulty / 1e12).toFixed(2)}T`,
    brief.featuredMiner
      ? `**Featured:** ${brief.featuredMiner.name} — ${brief.featuredMiner.profitable ? '+' : '-'}$${Math.abs(brief.featuredMiner.dailyProfitUsd).toFixed(2)}/day, breakeven $${Math.round(brief.featuredMiner.breakevenBtcPrice).toLocaleString()}`
      : '',
    `**Angle:** ${brief.angle}`,
    ``,
    anyBlocked
      ? `> ⛔ One or more scripts have gate issues. Fix or reject — this batch would NOT auto-advance.`
      : `> ✅ All scripts passed every gate. Reply **APPROVE** to render + queue, or **REJECT** to discard.`,
    ``,
    `---`,
    ``,
  ]
    .filter(Boolean)
    .join('\n')

  return header + result.reviewed.map(scriptBlock).join('\n---\n\n')
}
