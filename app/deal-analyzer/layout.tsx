import type { Metadata } from 'next'

export const metadata: Metadata = {
  alternates: { canonical: '/deal-analyzer' },
  title: 'Bitcoin Mining Deal Analyzer',
  description: 'Score any mining hardware and hosting deal in 60 seconds. Get profitability projections, ROI calculations, and risk scores. Free, no signup required.',
  openGraph: {
    images: [{ url: '/api/og?title=Bitcoin+Mining+Deal+Analyzer&sub=Score+Any+Deal+in+60+Seconds', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og?title=Bitcoin+Mining+Deal+Analyzer&sub=Score+Any+Deal+in+60+Seconds'],
  },
}

export default function DealAnalyzerLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
