import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: {
    default: 'Bitcoin Mining Hosting Providers 2026',
    template: '%s | Lightning Mines',
  },
  description: 'Compare Bitcoin mining hosting providers. Air, hydro, and immersion cooling options reviewed. Find the best hosting rate for your Antminer or MicroBT miner.',
}

export default function HostsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
