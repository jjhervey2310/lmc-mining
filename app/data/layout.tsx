import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Live Bitcoin Mining Data Dashboard',
  description: 'Live Bitcoin network data for miners. Network difficulty, hashprice, block reward, mempool fees, and profitability metrics updated in real time.',
}

export default function DataLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
