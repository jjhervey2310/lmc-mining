import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Compare Bitcoin Mining Hosting Providers Side-by-Side',
  description: 'Compare Bitcoin mining hosting providers side-by-side: pricing, cooling type, uptime, contract terms, and verification status. Pick the right host for your hardware.',
  alternates: { canonical: '/hosts/compare' },
}

export default function HostsCompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
