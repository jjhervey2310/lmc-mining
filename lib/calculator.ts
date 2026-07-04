import { CalculatorInputs, CalculatorResults } from './types'
import { BLOCK_REWARD_BTC } from './constants'

export function calculateMiningProfitability(inputs: CalculatorInputs): CalculatorResults {
  const { hashrate_th, power_watts, electricity_rate_kwh, hardware_cost, btc_price, network_difficulty } =
    inputs

  // Daily BTC mined = (hashrate_th * 1e12 * 86400 * block_reward) / (difficulty * 2^32)
  const hashrateHs = hashrate_th * 1e12
  const daily_btc_mined = (hashrateHs * 86400 * BLOCK_REWARD_BTC) / (network_difficulty * Math.pow(2, 32))

  const daily_revenue_usd = daily_btc_mined * btc_price
  const daily_power_cost_usd = (power_watts / 1000) * 24 * electricity_rate_kwh
  const daily_profit_usd = daily_revenue_usd - daily_power_cost_usd

  const monthly_revenue_usd = daily_revenue_usd * 30
  const monthly_profit_usd = daily_profit_usd * 30

  const annual_revenue_usd = daily_revenue_usd * 365
  const annual_profit_usd = daily_profit_usd * 365

  const breakeven_btc_price = daily_btc_mined > 0 ? daily_power_cost_usd / daily_btc_mined : 0

  const profit_margin_percent = daily_revenue_usd > 0 ? (daily_profit_usd / daily_revenue_usd) * 100 : 0

  const hashprice_usd_per_th_day = hashrate_th > 0 ? daily_revenue_usd / hashrate_th : 0

  const payback_days =
    hardware_cost && daily_profit_usd > 0 ? hardware_cost / daily_profit_usd : null

  return {
    daily_btc_mined,
    daily_revenue_usd,
    daily_power_cost_usd,
    daily_profit_usd,
    monthly_revenue_usd,
    monthly_profit_usd,
    annual_revenue_usd,
    annual_profit_usd,
    breakeven_btc_price,
    profit_margin_percent,
    hashprice_usd_per_th_day,
    payback_days,
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
