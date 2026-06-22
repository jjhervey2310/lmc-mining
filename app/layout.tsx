import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LMC Mining | Bitcoin Mining Intelligence Platform',
  description: 'Independent Bitcoin mining data. Compare hardware, analyze hosting deals, calculate profitability.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://lmc-mining.vercel.app'),
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        {children}
      </body>
    </html>
  )
}
