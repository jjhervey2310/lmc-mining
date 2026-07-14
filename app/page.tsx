import type { Metadata } from 'next'
import LandingShell from './LandingShell'

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

export default function HomePage() {
  // Organization + WebSite JSON-LD are emitted site-wide in app/layout.tsx; not duplicated here.
  return <LandingShell />
}
