import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Audit — Expert ROI Review',
  description: 'Get a professional review of your mining deal from $97. Profitability analysis, hosting recommendation, 12-month ROI projection. Human analysis, not AI reports.',
  openGraph: {
    images: [{ url: '/api/og?title=Bitcoin+Mining+Audit&sub=Expert+ROI+Review+from+%2497', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og?title=Bitcoin+Mining+Audit&sub=Expert+ROI+Review+from+%2497'],
  },
}

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
