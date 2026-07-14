import type { Metadata } from 'next'
import LandingShell from './LandingShell'

export const metadata: Metadata = {
  alternates: { canonical: '/' },
  title: 'Lightning Mines — The Independent Standard for Bitcoin Mining',
  description:
    'Independent Bitcoin mining intelligence. Verified hosting comparisons, live ROI calculator, hashprice data, and expert deal reviews — no sponsored content.',
  openGraph: {
    title: 'Lightning Mines — The Independent Standard for Bitcoin Mining',
    description: 'Independent data. No sponsored rankings. No marketing math.',
    type: 'website',
  },
}

const orgSchema = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: 'Lightning Mines',
  url: 'https://www.lightningmines.com',
  description: 'Independent Bitcoin mining intelligence — ROI calculator, hosting comparison, and deal reviews.',
}

const websiteSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Lightning Mines',
  url: 'https://www.lightningmines.com',
  potentialAction: {
    '@type': 'SearchAction',
    target: {
      '@type': 'EntryPoint',
      urlTemplate: 'https://www.lightningmines.com/miners?q={search_term_string}',
    },
    'query-input': 'required name=search_term_string',
  },
}

export default function HomePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <LandingShell />
    </>
  )
}
