import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/audit' },
  title: 'Bitcoin Mining Build Plan — $297 Deep Dive & $97 Deal Audit',
  description: 'Independent, numbers-first review of your Bitcoin mining deal. The $297 Mining Build Plan covers profitability, deployment, hardware, financing, tax, and a live call. Personally reviewed by a founder with 8 years in Bitcoin mining. Delivered within 72 hours.',
}

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
