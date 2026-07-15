import { GateResult, Script } from '../types'
import { BANNED_TERMS, REQUIRED_CTA, AFFILIATE_TRIGGERS } from '../config'

/**
 * Deterministic brand + FTC gate. Enforces the machine-checkable BRAND.md rules:
 * no hype/FOMO vocabulary, exactly one correct CTA, AI disclosure always,
 * affiliate disclosure whenever a partner is named, no guaranteed-return language.
 */
export function brandGate(script: Script): GateResult {
  const issues: string[] = []
  const hay = `${script.hook} ${script.body} ${script.caption} ${(script.onScreenText || []).join(' ')}`.toLowerCase()

  for (const term of BANNED_TERMS) {
    if (hay.includes(term.toLowerCase())) issues.push(`Banned hype/FOMO term: "${term}"`)
  }

  // Flag PROMISES of guaranteed upside, not honest "not guaranteed" disclaimers.
  const promisesGuarantee = /\bguarantee(d|s)?\s+(return|profit|income|roi|money|gains?|upside|\$|\d)/.test(hay)
  const riskFree = /\brisk[-\s]?free\b|\briskless\b/.test(hay)
  if (promisesGuarantee || riskFree) {
    issues.push('Guaranteed-return / risk-free claim')
  }

  // Required CTA must be present. Repeating the SAME CTA (spoken script + caption)
  // is reinforcement, not stacking — so only flag genuinely competing CTAs.
  const ctaLc = REQUIRED_CTA.toLowerCase()
  if (!hay.includes(ctaLc)) issues.push('Missing the required CTA')
  const COMPETING_CTAS = ['link in bio', 'sign up now', 'buy now', 'dm me', 'book now', 'swipe up', 'use code']
  for (const c of COMPETING_CTAS) {
    if (hay.includes(c)) issues.push(`Competing CTA ("${c}") — BRAND.md allows only the calculator CTA`)
  }

  // AI presenter disclosure always required.
  if (!script.disclosures.some((d) => d.toLowerCase().includes('ai'))) {
    issues.push('Missing AI-presenter disclosure')
  }

  // Affiliate disclosure required if a partner is named.
  const namesPartner = AFFILIATE_TRIGGERS.some((t) => hay.includes(t))
  const hasAffiliateDisclosure = script.disclosures.some((d) => d.toLowerCase().includes('affiliate'))
  if (namesPartner && !hasAffiliateDisclosure) {
    issues.push('Names an affiliate partner without an affiliate disclosure')
  }

  return { gate: 'brand + FTC (deterministic)', pass: issues.length === 0, issues }
}
