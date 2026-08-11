import type { Metadata } from 'next'
import LandingShell, { type HomeStats } from './LandingShell'
import { getLivePriceData } from '@/lib/btc-price'
import { PROVIDERS_DATA } from '@/lib/data'

// Re-render at most hourly so the stat strip stays current without per-request fetches.
export const revalidate = 3600

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  title: { absolute: 'Lightning Mines — The Independent Standard for Bitcoin Mining' },
  description:
    'Independent Bitcoin mining intelligence. Verified hosting comparisons, live ROI calculator, hashprice data, and expert deal reviews — no sponsored content.',
  openGraph: {
    title: 'Lightning Mines — The Independent Standard for Bitcoin Mining',
    description: 'Independent data. No sponsored rankings. No marketing math.',
    type: 'website',
  },
}

// Hashprice = USD earned per 1 TH/s per day at the current block reward
// (1e12 * 86400 * 3.125 = 2.7e17). Matches lib/calculator.ts and the /data page.
function calcHashprice(btcPrice: number, difficulty: number): number {
  return (2.7e17 * btcPrice) / (difficulty * 4294967296)
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
}

export default async function HomePage() {
  // Organization + WebSite JSON-LD are emitted site-wide in app/layout.tsx; not duplicated here.
  const live = await getLivePriceData()

  const activeProviders = PROVIDERS_DATA.filter(p => p.listingStatus === 'active')
  const usKwhRates = activeProviders
    .filter(p => p.country === 'US' && p.billingType === 'kwh' && p.rateMin !== null)
    .map(p => ({ min: p.rateMin as number, max: p.rateMax ?? (p.rateMin as number) }))
  const rateLow = usKwhRates.length ? Math.min(...usKwhRates.map(r => r.min)) : null
  const rateHigh = usKwhRates.length ? Math.max(...usKwhRates.map(r => r.max)) : null
  const lastVerified = activeProviders.reduce((acc, p) => (p.lastVerified > acc ? p.lastVerified : acc), '')

  const stats: HomeStats = {
    btcPrice: 'error' in live ? null : `$${Math.round(live.price).toLocaleString('en-US')}`,
    hashprice: 'error' in live ? null : `$${calcHashprice(live.price, live.difficulty).toFixed(4)}/TH/day`,
    liveAsOf: 'error' in live ? null : fmtDate(live.last_updated),
    providerCount: activeProviders.length,
    rateRange: rateLow !== null && rateHigh !== null ? `$${rateLow.toFixed(3)}–$${rateHigh.toFixed(3)}/kWh` : null,
    providersAsOf: lastVerified ? fmtDate(lastVerified) : null,
  }

  return <LandingShell stats={stats} />
}
