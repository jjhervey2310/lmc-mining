import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Market Data',
  description: 'Live Bitcoin mining market data, hashprice, network difficulty, and mining economics.',
}

export default function DataLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
