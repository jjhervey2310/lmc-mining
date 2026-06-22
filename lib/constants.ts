export const SITE_NAME = 'LMC Mining Intelligence'
export const SITE_TAGLINE = 'The Independent Bitcoin Mining Intelligence Platform'
export const SITE_DESCRIPTION =
  'The independent Bitcoin mining intelligence platform. Compare miners, hosting providers, and financing options. Free profitability calculator and deal analyzer.'

export const COLORS = {
  bg: '#0a0e17',
  profitPositive: '#00d4aa',
  negative: '#ff4757',
  accent: '#3d7aed',
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
