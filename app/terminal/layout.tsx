import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/terminal' },
  title: 'Mining Terminal — Charts for Hashprice, Difficulty & Miners',
  description:
    'A free charting terminal built for Bitcoin miners. Chart hashprice, network difficulty and hashrate alongside crypto and mining stocks, with candlesticks, indicators, and Fibonacci drawing tools.',
}

export default function TerminalLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
