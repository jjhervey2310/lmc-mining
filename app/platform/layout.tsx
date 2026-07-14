import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Intelligence Platform',
  description: 'ROI calculator, verified hosting comparisons, hardware reviews, and expert deal analysis.',
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lightningmines.com'}/platform`,
  },
}

export default function PlatformLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
