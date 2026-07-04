import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/audit' },
  title: 'Bitcoin Mining Audit — $97 Deal Audit & $297 Build Plan',
  description: 'Get a professional review of your Bitcoin mining deal. $97 Mining Deal Audit or $297 Mining Build Plan. Profitability analysis, risk assessment, and go/no-go recommendation. Human analysis, 48-hour delivery.',
}

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
