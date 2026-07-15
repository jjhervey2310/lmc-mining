import { calculateMiningProfitability } from '../lib/calculator'
import { MINERS_DATA } from '../lib/data'
import { LiveNumbers, MinerEconomics } from './types'
import { PRICE_API, HOSTING_MONTHLY_USD } from './config'

/** Pull today's live BTC price + network difficulty from the site's own API,
 *  so the engine's numbers always match what visitors see on the site. */
export async function getLiveNumbers(): Promise<LiveNumbers> {
  const res = await fetch(PRICE_API)
  if (!res.ok) throw new Error(`price API returned ${res.status}`)
  const d = (await res.json()) as { price?: number; difficulty?: number }
  const btcPrice = Number(d.price)
  const difficulty = Number(d.difficulty)
  if (!btcPrice || !difficulty) throw new Error('price API missing price/difficulty')

  // Network hashprice = revenue a single TH/s earns in a day (uses the site calculator).
  const one = calculateMiningProfitability({
    hashrate_th: 1,
    power_watts: 0,
    electricity_rate_kwh: 0,
    hardware_cost: null,
    btc_price: btcPrice,
    network_difficulty: difficulty,
  })

  return {
    btcPrice,
    difficulty,
    hashpricePerThDay: one.hashprice_usd_per_th_day,
    fetchedAt: new Date().toISOString(),
    source: PRICE_API,
  }
}

/** Real economics for one miner at a flat hosting fee — same math as the site. */
export function minerEconomics(slug: string, live: LiveNumbers): MinerEconomics | null {
  const m = MINERS_DATA.find((x) => x.slug === slug)
  if (!m) return null

  const r = calculateMiningProfitability({
    hashrate_th: m.default_hashrate_th,
    power_watts: m.power_watts,
    electricity_rate_kwh: 0, // hosting is a flat monthly fee, not per-kWh
    hardware_cost: null,
    btc_price: live.btcPrice,
    network_difficulty: live.difficulty,
  })

  const dailyHosting = HOSTING_MONTHLY_USD / 30
  const dailyProfit = r.daily_revenue_usd - dailyHosting

  return {
    slug: m.slug || slug,
    name: m.name,
    hashrateTh: m.default_hashrate_th,
    powerWatts: m.power_watts,
    hostingMonthly: HOSTING_MONTHLY_USD,
    dailyRevenueUsd: r.daily_revenue_usd,
    dailyHostingUsd: dailyHosting,
    dailyProfitUsd: dailyProfit,
    monthlyProfitUsd: dailyProfit * 30,
    breakevenBtcPrice: r.daily_btc_mined > 0 ? dailyHosting / r.daily_btc_mined : 0,
    profitable: dailyProfit > 0,
  }
}
