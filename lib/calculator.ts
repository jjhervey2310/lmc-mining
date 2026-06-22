import { CalculatorInputs, CalculatorResults } from './types'
import { BLOCK_REWARD_BTC } from './constants'

export function calculateMiningProfitability(inputs: CalculatorInputs): CalculatorResults {
  const {
    hashrate_th,
    power_watts,
    monthly_hosting_fee,
    electricity_rate_kwh,
    miner_purchase_price,
    btc_price,
    network_difficulty,
  } = inputs

  // Daily BTC mined = (hashrate_th * 1e12 * 86400 * block_reward) / (difficulty * 2^32)
  const hashrateHs = hashrate_th * 1e12
  const daily_btc_mined = (hashrateHs * 86400 * BLOCK_REWARD_BTC) / (network_difficulty * Math.pow(2, 32))

  const daily_gross_revenue_usd = daily_btc_mined * btc_price

  // Home electricity cost
  const daily_home_electricity_cost = (power_watts / 1000) * 24 * electricity_rate_kwh

  // Hosted cost
  const daily_hosted_cost = monthly_hosting_fee !== null ? monthly_hosting_fee / 30 : null

  const daily_net_profit_home = daily_gross_revenue_usd - daily_home_electricity_cost
  const daily_net_profit_hosted =
    daily_hosted_cost !== null ? daily_gross_revenue_usd - daily_hosted_cost : null

  const monthly_net_profit_home = daily_net_profit_home * 30
  const monthly_net_profit_hosted =
    daily_net_profit_hosted !== null ? daily_net_profit_hosted * 30 : null

  const annual_net_profit_home = daily_net_profit_home * 365
  const annual_net_profit_hosted =
    daily_net_profit_hosted !== null ? daily_net_profit_hosted * 365 : null

  // Breakeven days (only if profitable and purchase price provided)
  const breakeven_days_hosted =
    miner_purchase_price && daily_net_profit_hosted && daily_net_profit_hosted > 0
      ? miner_purchase_price / daily_net_profit_hosted
      : null

  const breakeven_days_home =
    miner_purchase_price && daily_net_profit_home > 0
      ? miner_purchase_price / daily_net_profit_home
      : null

  return {
    daily_btc_mined,
    daily_gross_revenue_usd,
    daily_home_electricity_cost,
    daily_hosted_cost,
    daily_net_profit_home,
    daily_net_profit_hosted,
    monthly_net_profit_home,
    monthly_net_profit_hosted,
    annual_net_profit_home,
    annual_net_profit_hosted,
    breakeven_days_hosted,
    breakeven_days_home,
  }
}

export function formatBTC(value: number): string {
  return value.toFixed(8)
}

export function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

export function formatDays(days: number): string {
  if (days < 30) return `${Math.round(days)} days`
  if (days < 365) return `${(days / 30).toFixed(1)} months`
  return `${(days / 365).toFixed(1)} years`
}
