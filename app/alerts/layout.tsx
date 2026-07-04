import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/alerts' },
  title: 'BTC Price & Hashprice Alerts',
  description: 'Get notified when Bitcoin price or hashprice crosses your target threshold. Free email alerts to help you time expansion, selling, or risk decisions.',
}

export default function AlertsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
