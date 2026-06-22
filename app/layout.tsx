import type { Metadata } from 'next'
import CookieConsent from '@/components/CookieConsent'
import './globals.css'
import { SITE_NAME, SITE_TAGLINE, SITE_DESCRIPTION, LEGAL_DISCLAIMER } from '@/lib/constants'
import Navbar from '@/components/Navbar'
import EmailCapture from '@/components/EmailCapture'
import TickerBar from '@/components/TickerBar'
import StickyMobileCTA from '@/components/StickyMobileCTA'
import ExitIntent from '@/components/ExitIntent'
import LoadingScreen from '@/components/LoadingScreen'
import PageTransition from '@/components/PageTransition'
import LightningInit from '@/components/LightningInit'

export const metadata: Metadata = {
  title: {
    default: 'Bitcoin Mining Intelligence Platform | LMC Mining',
    template: '%s | LMC Mining',
  },
  description: 'Independent Bitcoin mining data. Compare hardware, analyze hosting deals, calculate profitability. No sponsored rankings. Used by serious miners.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://lmc-mining.vercel.app'),
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: [{ url: '/api/og', width: 1200, height: 630, alt: 'LMC Mining Intelligence' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: `${SITE_NAME} — ${SITE_TAGLINE}`,
    description: SITE_DESCRIPTION,
    images: ['/api/og'],
  },
  keywords: [
    'bitcoin mining calculator',
    'bitcoin mining profitability',
    'bitcoin mining hosting',
    'antminer s21 pro',
    'immersion cooling mining',
    'hydro cooling mining',
    'antminer hosting',
    'mining deal analyzer',
    'hashprice',
    'bitcoin mining roi',
    'is bitcoin mining profitable',
    'mining deal review',
    'bitcoin network difficulty',
  ],
  alternates: {
    canonical: process.env.NEXT_PUBLIC_SITE_URL || 'https://lmc-mining.vercel.app',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: '#0a0e17', color: '#e2e8f0' }}>
        <LightningInit />
        <LoadingScreen />
        <TickerBar />
        <Navbar />
        <PageTransition>
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
        </PageTransition>
        <StickyMobileCTA />
        <ExitIntent />
        {/* GA4 and Clarity are loaded conditionally by CookieConsent after user consent (GDPR/CCPA compliance) */}
        {/* [OWNER ACTION: Replace GA_MEASUREMENT_ID in components/CookieConsent.tsx with your GA4 ID] */}
        {/* [OWNER ACTION: Replace CLARITY_PROJECT_ID in components/CookieConsent.tsx with your Clarity ID] */}
        <CookieConsent />
        <footer className="border-t border-gray-800 mt-16">
          <div className="max-w-6xl mx-auto px-4 py-8">
            {/* Email capture */}
          <div className="mb-10 pb-10 border-b border-gray-800">
            <EmailCapture />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
              <div>
                <h3 className="font-semibold text-white mb-3">{SITE_NAME}</h3>
                <p className="text-sm text-gray-400">{SITE_TAGLINE}</p>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-3">Tools</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><a href="/" className="hover:text-white transition-colors">Profitability Calculator</a></li>
                  <li><a href="/deal-analyzer" className="hover:text-white transition-colors">Deal Analyzer</a></li>
                  <li><a href="/audit" className="hover:text-white transition-colors">Book an Audit</a></li>
                  <li><a href="/data" className="hover:text-white transition-colors">Live Data Dashboard</a></li>
                  <li><a href="/miners/compare" className="hover:text-white transition-colors">Compare Miners</a></li>
                  <li><a href="/hosts/compare" className="hover:text-white transition-colors">Compare Hosts</a></li>
                  <li><a href="/review" className="hover:text-white transition-colors">Free Deal Review</a></li>
                  <li><a href="/hosting-match" className="hover:text-white transition-colors">Hosting Match</a></li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-3">Learn</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li><a href="/university" className="hover:text-white transition-colors">Mining University</a></li>
                  <li><a href="/glossary" className="hover:text-white transition-colors">Mining Glossary</a></li>
                  <li><a href="/best-bitcoin-mining-hosting" className="hover:text-white transition-colors">Best Bitcoin Mining Hosting</a></li>
                  <li><a href="/miners" className="hover:text-white transition-colors">All Miners</a></li>
                  <li><a href="/hosts" className="hover:text-white transition-colors">All Hosting Providers</a></li>
                  <li><a href="/mining-pools" className="hover:text-white transition-colors">Mining Pools</a></li>
                  <li><a href="/buy-bitcoin" className="hover:text-white transition-colors">Buy Bitcoin →</a></li>
                  <li><a href="/financing" className="hover:text-white transition-colors">Financing Options</a></li>
                  <li><a href="/about" className="hover:text-white transition-colors">About</a></li>
                </ul>
              </div>
            </div>

            {/* Affiliate Disclosure */}
            <div className="border-t border-gray-800 pt-6 mb-4">
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-400">Affiliate Disclosure:</span>{' '}
                This site contains affiliate links. We may earn a commission when you sign up with
                a hosting provider through our links, at no additional cost to you. Our primary
                partner Abundant Miners is compensated through an affiliate arrangement. This does
                not affect our recommendations — we only feature providers we believe offer
                genuine value.
              </p>
            </div>

            {/* Legal Disclaimer */}
            <div className="border border-yellow-900/40 bg-yellow-900/10 rounded-lg p-4 mb-6">
              <p className="text-xs text-yellow-200/70">
                <span className="font-semibold text-yellow-200/90">Legal Disclaimer:</span>{' '}
                {LEGAL_DISCLAIMER}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-gray-600 text-center">
              <span>© {new Date().getFullYear()} {SITE_NAME}. All rights reserved.</span>
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
