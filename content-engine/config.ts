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
// Pure hype/FOMO vocabulary. "guaranteed"/"risk-free" are handled separately in
// brandGate with negation awareness, since "not guaranteed" is honest, not hype.
export const BANNED_TERMS = [
  '🚀', 'to the moon',
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
export const REVIEW_PASS_SCORE = Number(process.env.CE_REVIEW_PASS_SCORE || 80)

// Dual-brain cross-check: when a gate fails, Claude revises against the reviewer's
// notes and we re-check — up to this many rounds before it goes to you flagged.
export const MAX_REVISIONS = 2

// --- HeyGen rendering (Jacob's avatar) ---
export const HEYGEN_API_KEY = process.env.HEYGEN_API_KEY || ''
// "Broadcaster in a grey hoodie" — the one motion-capable look, and Jacob's pick.
// Generated looks render as talking_photo, not avatar.
export const HEYGEN_TALKING_PHOTO_ID = process.env.HEYGEN_TALKING_PHOTO_ID || '41920dc9d7e44063b3725b4a36818085'
export const HEYGEN_VOICE_ID = process.env.HEYGEN_VOICE_ID || 'f6a3f8a4c96542ebb2f295c140614aea'
// The look is a landscape studio shot; this zoom fills the 9:16 frame without letterboxing.
export const HEYGEN_SCALE = Number(process.env.HEYGEN_SCALE || 3.2)

// Wardrobe rotation: same face/voice, different outfit per pillar so each series has a
// consistent look. All are motion-enabled looks in Jacob's avatar group (added 2026-07-17).
// School episodes keep the original grey hoodie — that's the classroom identity.
export const HEYGEN_LOOK_BY_PILLAR: Record<string, string> = {
  hashprice_check: '5412fd52d175431182c8c6bc526abf6b', // grey sweater
  week_recap: '5412fd52d175431182c8c6bc526abf6b', // grey sweater
  red_flag: '8b4eeda46b3a46618747bd402750b781', // olive shirt
  myth_bust: 'ae7617f1a11f487c9cbfc68797606198', // studio setting
  hardware_reality: '79fe785cd16c4b5f950a733b19f02505', // navy hoodie
  // explainer + longform fall through to HEYGEN_TALKING_PHOTO_ID (grey hoodie)
}
export const RENDER_WIDTH = 720
export const RENDER_HEIGHT = 1280

// --- Postiz posting (multi-platform publish of approved content) ---
export const POSTIZ_API_KEY = process.env.POSTIZ_API_KEY || ''
export const POSTIZ_API_URL = process.env.POSTIZ_API_URL || 'https://api.postiz.com/public/v1'

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
