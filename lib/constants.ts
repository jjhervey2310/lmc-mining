export const SITE_NAME = 'Lightning Mines'
export const SITE_URL = 'https://lightningmines.com'
export const SITE_TAGLINE = 'Bitcoin Mining Profitability, Hosting and Hardware Made Simple'
export const SITE_DESCRIPTION =
  'Lightning Mines helps you avoid bad Bitcoin mining deals. Compare hosting providers, calculate ROI, and get a free deal review before you commit capital.'

export const COLORS = {
  bg: '#0a0a0a',
  card: '#111111',
  border: '#222222',
  orange: '#f7931a',
  profitPositive: '#00d4aa',
  negative: '#ff4757',
  accent: '#f7931a',
} as const

// Bitcoin block reward (post-2024 halving)
export const BLOCK_REWARD_BTC = 3.125

// CoinGecko endpoint
export const COINGECKO_URL =
  'https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd'

// Cache duration (ms)
export const BTC_PRICE_CACHE_MS = 10 * 60 * 1000 // 10 minutes

export const LEGAL_DISCLAIMER =
  'This site provides educational Bitcoin mining profitability analysis only. Nothing on this site constitutes financial, legal, or tax advice. Mining profitability is subject to change based on Bitcoin price, network difficulty, hardware performance, and hosting costs. Always conduct your own due diligence before making investment decisions.'
