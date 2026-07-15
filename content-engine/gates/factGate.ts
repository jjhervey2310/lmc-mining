import { ContentBrief, GateResult, Script } from '../types'
import { FACT_TOLERANCE } from '../config'

/**
 * Deterministic fact gate. Extracts every dollar figure the script states and
 * checks each against the live/computed truth for today. A dollar amount that
 * matches nothing real is flagged — this is what catches a hallucinated number.
 * (This is a real check, not one AI trusting another.)
 */
export function factGate(script: Script, brief: ContentBrief): GateResult {
  const truth: number[] = [brief.live.btcPrice, brief.live.hashpricePerThDay]
  const m = brief.featuredMiner
  if (m) {
    truth.push(
      Math.abs(m.dailyProfitUsd),
      m.dailyRevenueUsd,
      Math.abs(m.monthlyProfitUsd),
      m.breakevenBtcPrice,
      m.hostingMonthly,
      m.dailyHostingUsd,
      m.hashrateTh,
      Math.abs(m.breakevenBtcPrice - brief.live.btcPrice) // the "how far from breakeven" gap
    )
  }

  const text = [script.hook, script.body, script.caption, ...(script.onScreenText || [])].join('  ')
  const dollarFigures = [...text.matchAll(/\$\s?([\d,]+(?:\.\d+)?)/g)].map((x) =>
    parseFloat(x[1].replace(/,/g, ''))
  )

  const issues: string[] = []
  for (const n of dollarFigures) {
    if (n < 1) continue // ignore sub-dollar rounding noise
    const ok = truth.some((t) => t > 0 && Math.abs(n - t) / t <= FACT_TOLERANCE)
    if (!ok) {
      issues.push(`Unverified $ figure "$${n.toLocaleString()}" — not within ${(FACT_TOLERANCE * 100).toFixed(0)}% of any live/computed value`)
    }
  }

  return {
    gate: 'fact (deterministic)',
    pass: issues.length === 0,
    issues,
    notes: [`Checked ${dollarFigures.length} dollar figure(s) against today's live truth`],
  }
}
