import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Bitcoin Mining Hardware Database 2026',
    template: '%s | Lightning Mines',
  },
  description: 'Compare Bitcoin mining hardware. Antminer S21 XP, S21 Pro, MicroBT M60S and more — specs, efficiency, profitability, and hosting recommendations. Updated 2026.',
}

export default function MinersLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
