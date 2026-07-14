import Link from 'next/link'
import type { Metadata } from 'next'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'

export const metadata: Metadata = {
  title: 'Abundant Mines Review 2026 — $225/Month Flat Fee Hosting',
  description: 'Honest review of Abundant Mines Bitcoin hosting. $225/month flat fee, hydro power, Cascade Locks Oregon. Real numbers, no fluff.',
  alternates: { canonical: '/hosts/abundant-miners' },
  openGraph: {
    images: [{ url: `/api/og?title=${encodeURIComponent('Abundant Mines Review 2026 — $225/Month Flat Fee Hosting')}`, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image' as const,
    images: [`/api/og?title=${encodeURIComponent('Abundant Mines Review 2026 — $225/Month Flat Fee Hosting')}`],
  },
}

const FAQ_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How much does Abundant Mines charge per month?',
      acceptedAnswer: { '@type': 'Answer', text: 'Abundant Mines charges a flat fee of $225 per miner per month regardless of power consumption. There are no separate electricity bills.' },
    },
    {
      '@type': 'Question',
      name: 'Does Abundant Mines offer financing?',
      acceptedAnswer: { '@type': 'Answer', text: 'Yes. Abundant Mines offers financing up to $140,000 at 10% interest over 36 months, allowing you to get started without full capital upfront.' },
    },
    {
      '@type': 'Question',
      name: 'What cooling does Abundant Mines use?',
      acceptedAnswer: { '@type': 'Answer', text: 'Abundant Mines currently uses air cooling. Immersion cooling is planned for approximately 2028.' },
    },
  ],
}

const AFFILIATE_URL = 'https://abundantmines.com/ref/72/'

export default function AbundantMinersPage() {
  return (
    <div style={{ background: '#0a0e17' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(FAQ_SCHEMA) }} />

      {/* ═══ SECTION 1: HERO ═══ */}
      <section className="text-center py-20 px-4 border-b" style={{ borderColor: '#1a2332', background: 'radial-gradient(ellipse 80% 60% at 50% 0%, rgba(245,158,11,0.07) 0%, transparent 70%)' }}>
        <div className="max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs px-3 py-1.5 rounded-full mb-6" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
            ◆ Our Only Recommended Hosting Provider
          </div>

          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4 leading-tight">
            The Only Hosting Provider<br />We Personally Recommend
          </h1>

          <p className="text-lg text-gray-400 mb-2">
            $225 flat monthly fee. Air-cooled facility powered by Columbia River hydroelectric power. Cascade Locks, Oregon.
            No electricity rate games. No surprise bills.
          </p>
          <p className="text-sm text-gray-500 mb-8">
            Real hydroelectric power, professional infrastructure, and straightforward pricing —
            built for serious bitcoin miners.
          </p>

          <div className="text-left mb-8">
            <AffiliateDisclosure />
          </div>

          <a
            href={AFFILIATE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-gold-hero inline-block rounded-xl"
            style={{ padding: '16px 40px', fontSize: '1rem', fontWeight: 700 }}
          >
            Get Started with Abundant Mines →
          </a>

          <p className="text-xs text-gray-600 mt-4">
            <span className="font-medium text-gray-500">Affiliate disclosure:</span>{' '}
            Lightning Mines earns a commission if you sign up through this link, at no extra cost to you.
            We only recommend providers we&apos;d use ourselves.
          </p>
        </div>
      </section>

      {/* ═══ SECTION 2: WHY WE RECOMMEND ═══ */}
      <section className="py-16 px-4 border-b" style={{ borderColor: '#1a2332' }}>
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-2xl font-bold text-white mb-2">Why We Recommend Abundant Mines</h2>
            <p className="text-gray-500 text-sm">Three things that actually matter when choosing a host</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: '⚡',
                title: 'Flat Fee Pricing',
                price: '$225/mo',
                desc: 'One flat rate per machine. No electricity rate calculations, no surprise overage bills, no per-kWh games. You know your exact cost from day one.',
                highlight: true,
              },
              {
                icon: '💧',
                title: 'Hydroelectric Power',
                price: 'Cascade Locks, OR',
                desc: 'Columbia River hydroelectric power — one of the cheapest and most stable power sources in North America. Miners are air-cooled; hydro refers to the electricity source, not the cooling method.',
                highlight: false,
              },
              {
                icon: '🏦',
                title: 'Financing Available',
                price: '$140k @ 10% / 36mo',
                desc: 'Don\'t have the capital for a full fleet? Abundant Mines offers in-house financing on qualified orders. Run the numbers in our Deal Analyzer.',
                highlight: false,
              },
            ].map(card => (
              <div
                key={card.title}
                className="rounded-2xl p-6 flex flex-col"
                style={{
                  background: '#111827',
                  border: `1px solid ${card.highlight ? 'rgba(245,158,11,0.35)' : '#1f2937'}`,
                }}
              >
                <div className="text-3xl mb-3">{card.icon}</div>
                <div className="text-base font-bold text-white mb-1">{card.title}</div>
                <div className="text-sm font-semibold mb-3" style={{ color: '#f59e0b' }}>{card.price}</div>
                <p className="text-sm text-gray-400 flex-1">{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ SECTION 3: SPECS TABLE ═══ */}
      <section className="py-16 px-4 border-b" style={{ borderColor: '#1a2332' }}>
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-white mb-8 text-center">Hosting Specs</h2>
          <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1f2937' }}>
            {[
              { label: 'Monthly Fee', value: '$225 flat (per machine)' },
              { label: 'Power Source', value: 'Columbia River Hydro' },
              { label: 'Location', value: 'Cascade Locks, Oregon' },
              { label: 'Cooling', value: 'Air cooling (facility powered by hydroelectric grid)' },
              { label: 'Contract Terms', value: 'Flexible — contact for details' },
              { label: 'Financing', value: '$140k @ 10% interest / 36 months (on approval)' },
              { label: 'Minimum Miners', value: 'Contact for current minimums' },
              { label: 'Supported Hardware', value: 'All major ASICs (Antminer, Whatsminer, Avalon)' },
              { label: 'Verification Status', value: 'Independently verified by Lightning Mines' },
            ].map((row, i) => (
              <div
                key={row.label}
                className="flex items-center justify-between px-6 py-3.5 text-sm"
                style={{ background: i % 2 === 0 ? '#111827' : '#0d1421', borderBottom: i < 8 ? '1px solid #1a2332' : 'none' }}
              >
                <span className="text-gray-400 font-medium">{row.label}</span>
                <span className="text-white text-right ml-4">{row.value}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-600 mt-3 text-center">
            Specs current as of review date. Always confirm current pricing directly with the provider.
          </p>
        </div>
      </section>

      {/* ═══ SECTION 4: DEAL ANALYZER CTA ═══ */}
      <section className="py-16 px-4 border-b" style={{ borderColor: '#1a2332', background: '#0d1117' }}>
        <div className="max-w-2xl mx-auto text-center">
          <div className="text-3xl mb-4">🔍</div>
          <h2 className="text-2xl font-bold text-white mb-3">
            Run the Numbers Before You Commit
          </h2>
          <p className="text-gray-400 mb-6">
            Plug Abundant Mines into our Deal Analyzer. Get a profitability score, 12-month ROI projection,
            and a STRONG / DECENT / AVOID verdict — at any BTC price.
          </p>
          <Link
            href="/deal-analyzer?host=abundant-mines"
            className="inline-flex items-center gap-2 text-sm font-bold px-8 py-3.5 rounded-xl"
            style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            Analyze Abundant Mines Deal →
          </Link>
          <p className="text-xs text-gray-600 mt-3">Free · No signup required</p>
        </div>
      </section>

      {/* ═══ SECTION 5: FINAL AFFILIATE CTA ═══ */}
      <section className="py-20 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <div
            className="rounded-3xl p-12"
            style={{
              background: 'linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(245,158,11,0.05) 100%)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            <h2 className="text-3xl font-bold text-white mb-3">
              Ready to get started?
            </h2>
            <p className="text-gray-400 mb-8">
              Hosting slots at $225/mo don&apos;t last. Reach out to Abundant Mines directly through our affiliate link —
              you&apos;ll pay the same rate and support independent mining research.
            </p>
            <a
              href={AFFILIATE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-gold-hero inline-block rounded-xl"
              style={{ padding: '16px 48px', fontSize: '1rem', fontWeight: 700 }}
            >
              Visit Abundant Mines →
            </a>
            <p className="text-xs text-gray-600 mt-5">
              Affiliate link — we earn a commission at no cost to you.{' '}
              <Link href="/about" className="underline hover:text-gray-400">Learn more about how we work.</Link>
            </p>
          </div>
        </div>
      </section>

    </div>
  )
}
