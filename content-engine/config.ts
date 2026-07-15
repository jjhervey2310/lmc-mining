import { config as loadEnv } from 'dotenv'
import path from 'path'
import { Pillar, Platform } from './types'

// Share the app's env (.env.local) so keys live in one place.
loadEnv({ path: path.resolve(process.cwd(), '.env.local') })

// --- API keys (set these in .env.local when you're ready to go live) ---
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || ''
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ''

// Generator = Claude (writes). Reviewer = GPT (critiques). Two models on purpose.
export const GENERATOR_MODEL = process.env.CE_GENERATOR_MODEL || 'claude-sonnet-5'
export const REVIEWER_MODEL = process.env.CE_REVIEWER_MODEL || 'gpt-4o'

export const SITE_URL = 'https://lightningmines.com'
export const PRICE_API = process.env.CE_PRICE_API || 'https://www.lightningmines.com/api/btc-price'

// Flat hosting assumption for hardware math (Abundant Mines flat rate).
export const HOSTING_MONTHLY_USD = 225

// BRAND.md "The One CTA" — every piece ends with exactly this.
export const REQUIRED_CTA = 'Run your own numbers free at lightningmines.com'

// Hype / FOMO vocabulary that hard-fails the brand gate.
export const BANNED_TERMS = [
  '🚀', 'to the moon', 'moon', 'guaranteed', 'risk-free', 'riskless',
  'get rich', 'passive income', "can't lose", 'easy money', 'fomo',
  "don't miss out", 'act now', 'limited spots', 'once in a lifetime',
  '100x', 'lambo', 'diamond hands', 'hodl',
]

export const AI_DISCLOSURE = 'AI-generated presenter. Educational only — not financial advice.'
export const AFFILIATE_DISCLOSURE = 'Contains affiliate links; we may earn a commission at no cost to you.'
export const AFFILIATE_TRIGGERS = ['abundant mines', 'abundantmines', 'kraken', 'koinly']

// A claimed $ figure may differ from computed truth by this fraction before it's flagged.
export const FACT_TOLERANCE = 0.05

// GPT reviewer must score >= this to pass the subjective gate.
export const REVIEW_PASS_SCORE = 80

// Weekly pillar rotation (BRAND.md). getUTCDay(): 0=Sun ... 6=Sat.
export const PILLAR_BY_WEEKDAY: Record<number, Pillar> = {
  1: 'hashprice_check',
  2: 'red_flag',
  3: 'hardware_reality',
  4: 'explainer',
  5: 'week_recap',
  6: 'myth_bust',
  0: 'longform',
}

export const SHORT_PLATFORMS: Platform[] = ['youtube_shorts', 'instagram_reels', 'tiktok']
export const ALL_PLATFORMS: Platform[] = [...SHORT_PLATFORMS, 'x']

export const HASHTAGS_BY_PLATFORM: Record<Platform, string[]> = {
  youtube_shorts: ['#bitcoinmining', '#bitcoin', '#mining'],
  instagram_reels: ['#bitcoinmining', '#bitcoin', '#crypto', '#mining', '#asicminer'],
  tiktok: ['#bitcoinmining', '#bitcoin', '#crypto', '#mining'],
  x: ['#Bitcoin', '#BitcoinMining'],
}
