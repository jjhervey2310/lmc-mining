import type { Metadata } from 'next'
import './globals.css'
import Navbar from '@/components/Navbar'
import EmailCapture from '@/components/EmailCapture'
import TickerBar from '@/components/TickerBar'
import ExitIntent from '@/components/ExitIntent'

export const metadata: Metadata = {
  title: {
    default: 'Bitcoin Mining ROI Calculator & Hosting Reviews | Lightning Mines',
    template: '%s | Lightning Mines',
  },
  description:
    'Lightning Mines helps you avoid bad Bitcoin mining deals. Free ROI calculator, hosting comparison, hardware reviews, and expert deal review.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lightningmines.com'),
  openGraph: {
    siteName: 'Lightning Mines',
    type: 'website',
    title: 'Lightning Mines — Bitcoin Mining Made Simple',
    description:
      'Avoid bad mining deals. Free ROI calculator, verified hosting providers, hardware comparison, and expert deal review.',
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'Lightning Mines' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Lightning Mines — Bitcoin Mining Made Simple',
    description:
      'Avoid bad mining deals. Free ROI calculator, verified hosting providers, hardware comparison, and expert deal review.',
    images: ['/api/og'],
  },
  keywords: [
    'bitcoin mining calculator',
    'bitcoin mining profitability',
    'bitcoin mining hosting',
    'bitcoin mining roi',
    'is bitcoin mining profitable',
    'hosted bitcoin mining',
    'antminer s21 pro',
    'bitcoin mining hosting comparison',
    'mining deal review',
    'bitcoin mining for beginners',
    'bitcoin mining electricity costs',
    'asic miner efficiency',
    'mining pool fees',
    'home vs hosted mining',
  ],
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lightningmines.com',
  },
}

const FOOTER_NAV = [
  { href: '/', label: 'Home' },
  { href: '/calculator', label: 'Calculator' },
  { href: '/hosting', label: 'Hosting' },
  { href: '/miners', label: 'Miners' },
  { href: '/university', label: 'University' },
  { href: '/review', label: 'Free Review' },
  { href: '/audit', label: 'Audit' },
  { href: '/tools', label: 'Tools' },
  { href: '/about', label: 'About' },
  { href: '/how-we-verify', label: 'How We Verify' },
]

const UNIVERSITY_LINKS = [
  { href: '/university/what-is-bitcoin-mining', label: 'What Is Bitcoin Mining?' },
  { href: '/university/is-bitcoin-mining-profitable', label: 'Is Mining Profitable?' },
  { href: '/university/hosted-bitcoin-mining-explained', label: 'Hosted Mining Explained' },
  { href: '/university/bitcoin-mining-electricity-costs', label: 'Electricity Costs' },
  { href: '/university/best-bitcoin-miners-for-beginners', label: 'Best Miners for Beginners' },
  { href: '/university/bitcoin-mining-hosting-red-flags', label: 'Hosting Red Flags' },
  { href: '/university/how-to-avoid-bad-mining-deals', label: 'Avoid Bad Deals' },
  { href: '/university/bitcoin-mining-tax-basics', label: 'Tax Basics' },
]

const LEGAL_DISCLAIMER =
  'This site provides educational Bitcoin mining profitability analysis only. Nothing on this site constitutes financial, legal, or tax advice. Mining profitability is subject to change based on Bitcoin price, network difficulty, hardware performance, and hosting costs. Always conduct your own due diligence before making investment decisions.'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: '#0a0a0a', color: '#e2e8f0' }}>
        <TickerBar />
        <Navbar />
        <ExitIntent />
        <main className="flex-1 pb-16 md:pb-0">{children}</main>

        <footer className="border-t mt-16" style={{ borderColor: '#222222' }}>
          <div className="max-w-6xl mx-auto px-4 py-10">
            <div className="mb-10 pb-10 border-b" style={{ borderColor: '#222222' }}>
              <EmailCapture />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <span style={{ color: '#f7931a' }}>⚡</span>
                  <span className="font-bold text-white">Lightning Mines</span>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Bitcoin mining profitability, hosting and hardware made simple. We help you avoid bad deals.
                </p>
                <p className="text-xs text-gray-600">contact@lightningmines.com</p>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-3 text-sm">Pages</h3>
                <ul className="space-y-2">
                  {FOOTER_NAV.map(l => (
                    <li key={l.href}>
                      <a href={l.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold text-white mb-3 text-sm">Mining University</h3>
                <ul className="space-y-2">
                  {UNIVERSITY_LINKS.map(l => (
                    <li key={l.href}>
                      <a href={l.href} className="text-sm text-gray-500 hover:text-white transition-colors">
                        {l.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="border-t pt-6 mb-4" style={{ borderColor: '#222222' }}>
              <p className="text-xs text-gray-600">
                <span className="font-semibold text-gray-500">Affiliate Disclosure:</span>{' '}
                Lightning Mines earns commissions from affiliate links including Abundant Mines hosting,
                Kraken exchange, and Koinly tax software. Affiliate relationships do not influence our
                recommendations — we only feature providers we believe offer genuine value to miners.
              </p>
            </div>

            <div className="border rounded-lg p-4 mb-6" style={{ borderColor: '#3a2800', background: '#1a1000' }}>
              <p className="text-xs" style={{ color: 'rgba(251,191,36,0.6)' }}>
                <span className="font-semibold" style={{ color: 'rgba(251,191,36,0.8)' }}>Legal Disclaimer:</span>{' '}
                {LEGAL_DISCLAIMER}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600 text-center">
              <span>© {new Date().getFullYear()} Lightning Mines. All rights reserved.</span>
              <span>·</span>
              <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacy Policy</a>
              <span>·</span>
              <a href="/terms" className="hover:text-gray-400 transition-colors">Terms of Service</a>
            </div>
          </div>
        </footer>
      </body>
    </html>
  )
}
