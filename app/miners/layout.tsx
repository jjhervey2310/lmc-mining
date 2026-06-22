import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Hardware Database 2026',
  description: 'Compare Bitcoin miners. Find the best ASIC miners by efficiency, hashrate, and price.',
}

export default function MinersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
