import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compare Bitcoin ASIC Miners Side-by-Side',
  description: 'Compare Bitcoin ASIC miners side-by-side: hashrate, power draw, efficiency (J/TH), and price. Find the right miner for your budget and cooling setup.',
  alternates: { canonical: '/miners/compare' },
}

export default function MinersCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
