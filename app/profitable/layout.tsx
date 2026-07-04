import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/profitable' },
  title: 'Is Bitcoin Mining Profitable Right Now?',
  description: 'Live Bitcoin mining profitability analysis using current BTC price and network difficulty, benchmarked against a reference Antminer S21 Pro (234 TH/s, 3,510W).',
}

export default function ProfitableLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
