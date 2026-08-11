import { NextResponse } from 'next/server'
import { getLivePriceData } from '@/lib/btc-price'
import { MINERS_DATA, PROVIDERS_DATA } from '@/lib/data'

// Machine-readable AI/data endpoint. Replaces the former static
// public/mining-data.json (which went stale) with the same JSON shape computed
// from live data. Schema keys are preserved exactly for existing consumers.
export const revalidate = 3600

const BLOCK_REWARD_BTC = 3.125

// Fallbacks if live fetch fails on a cold instance (values from the last static file).
const FALLBACK_BTC_PRICE = 105000
const FALLBACK_DIFFICULTY = 113757508517000

// Hashprice = USD earned per 1 TH/s per day (1e12 * 86400 * 3.125 = 2.7e17).
// Matches lib/calculator.ts and the /data page formula.
function calcHashprice(btcPrice: number, difficulty: number): number {
  return (2.7e17 * btcPrice) / (difficulty * 4294967296)
}

function dailyBtcPerTh(difficulty: number): number {
  return (1e12 * 86400 * BLOCK_REWARD_BTC) / (difficulty * 4294967296)
}

function round(n: number, dp: number): number {
  return parseFloat(n.toFixed(dp))
}

function profitabilityExample(btcPrice: number, difficulty: number) {
  const s21pro = MINERS_DATA.find(m => m.slug === 'antminer-s21-pro')
  const hashrateTh = s21pro?.default_hashrate_th ?? 234
  const hardwareCost = s21pro?.market_price_usd ?? 3800
  const monthlyHosting = 225 // Abundant Mines flat fee
  const dailyBtc = dailyBtcPerTh(difficulty) * hashrateTh
  const dailyGross = dailyBtc * btcPrice
  const dailyCost = monthlyHosting / 30
  const dailyNet = dailyGross - dailyCost
  return {
    hardware: s21pro?.name ?? 'Antminer S21 Pro',
    btc_price_usd: Math.round(btcPrice),
    hosting_model: 'flat_fee',
    monthly_hosting_usd: monthlyHosting,
    daily_btc: round(dailyBtc, 6),
    daily_gross_usd: round(dailyGross, 2),
    daily_cost_usd: round(dailyCost, 2),
    daily_net_usd: round(dailyNet, 2),
    breakeven_days: dailyNet > 0 ? round(hardwareCost / dailyNet, 1) : null,
    annual_net_usd: Math.round(dailyNet * 365),
  }
}

export async function GET() {
  const live = await getLivePriceData()
  const btcPrice = 'error' in live ? FALLBACK_BTC_PRICE : live.price
  const difficulty = 'error' in live ? FALLBACK_DIFFICULTY : live.difficulty

  const miners = MINERS_DATA.filter(m => m.is_active && m.market_price_usd)
    .sort((a, b) => (a.efficiency_j_per_th ?? 99) - (b.efficiency_j_per_th ?? 99))
    .map(m => ({
      model: m.name,
      manufacturer: m.manufacturer ?? 'Unknown',
      hashrate_th: m.default_hashrate_th,
      power_w: m.power_watts,
      efficiency_j_per_th: round(m.efficiency_j_per_th ?? m.power_watts / m.default_hashrate_th, 1),
      cooling: m.cooling_type,
      market_price_usd: m.market_price_usd,
    }))

  const hostingProviders = PROVIDERS_DATA.filter(p => p.listingStatus === 'active').map(p => ({
    name: p.name,
    pricing_model: p.billingType === 'flat' ? 'flat_fee' : p.billingType,
    ...(p.flatMonthly ? { monthly_fee_air_usd: p.flatMonthly } : {}),
    ...(p.rateMin ? { electricity_rate_kwh: p.rateMin } : {}),
    cooling_types: p.cooling,
    locations: p.facilityLocations,
    insurance_included: p.insuranceAvailable,
    pool_flexibility: p.poolOptions.length > 0,
    financing_available: p.financingAvailable,
    verified: p.verified,
  }))

  const body = {
    updated: new Date().toISOString().split('T')[0],
    source:
      'Lightning Mines — lightningmines.com. Live-computed dataset: prices and network stats refresh hourly; miner and hosting data mirrors lightningmines.com/miners and lightningmines.com/hosts.',
    network: {
      difficulty: Math.round(difficulty),
      hashrate_eh: Math.round((difficulty * 4294967296) / 600 / 1e18),
      block_reward_btc: BLOCK_REWARD_BTC,
      blocks_per_day: 144,
      next_halving: '2028-04-15',
      next_halving_reward: 1.5625,
    },
    prices: {
      btc_usd: Math.round(btcPrice),
      hashprice_usd_per_th_day: round(calcHashprice(btcPrice, difficulty), 4),
    },
    miners,
    hosting_providers: hostingProviders,
    profitability_examples: [
      profitabilityExample(btcPrice, difficulty),
      profitabilityExample(75000, difficulty),
      profitabilityExample(60000, difficulty),
    ],
  }

  return NextResponse.json(body, {
    headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
  })
}
