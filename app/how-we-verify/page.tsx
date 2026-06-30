import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'How We Verify Hosting Providers — Lightning Mines',
  description:
    'Every provider on Lightning Mines goes through the same verification process. This page explains what Verified, Pending, and Flagged mean — and why some providers are excluded entirely.',
  openGraph: {
    title: 'How We Verify Hosting Providers | Lightning Mines',
    description: 'What Verified, Pending, and Flagged mean — and why some providers are not listed at all.',
    type: 'website',
  },
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'How We Verify', item: 'https://lightningmines.com/how-we-verify' },
  ],
}

const CARD_BG = '#111111'
const BORDER = '#222222'
const ORANGE = '#f7931a'

function StatusBadge({ status }: { status: 'verified' | 'pending' | 'flagged' }) {
  const styles = {
    verified: { background: 'rgba(0,212,170,0.15)', color: '#00d4aa', label: '✓ Verified' },
    pending:  { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', label: '⏳ Pending' },
    flagged:  { background: 'rgba(255,71,87,0.15)',  color: '#ff4757', label: '⚠ Flagged' },
  }
  const s = styles[status]
  return (
    <span className="inline-block text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: s.background, color: s.color }}>
      {s.label}
    </span>
  )
}

export default function HowWeVerifyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>How We Verify</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">How We Verify Hosting Providers</h1>
      <p className="text-gray-400 text-lg mb-10 leading-relaxed">
        Every provider on Lightning Mines goes through the same verification process before being marked Verified.
        This page explains exactly what that means, what it doesn&apos;t mean, and why some providers you might
        expect to see aren&apos;t listed at all.
      </p>

      {/* What Verified Means */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-white font-bold text-xl">What &ldquo;Verified&rdquo; Means</h2>
          <StatusBadge status="verified" />
        </div>
        <p className="text-gray-400 mb-4 leading-relaxed">
          A Verified badge means we have confirmed, directly with the provider or through primary public sources,
          that the following is current and accurate as of the date shown on their listing:
        </p>
        <ul className="space-y-2 text-sm text-gray-400 mb-4">
          {[
            "The provider's official website and contact information",
            'Stated electricity rates and billing structure',
            'Minimum machine requirements and contract terms',
            'Facility locations and power source',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span style={{ color: '#00d4aa' }} className="shrink-0 mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-gray-400 leading-relaxed">
          We re-confirm this information periodically. The &ldquo;Last Verified&rdquo; date on every listing tells
          you exactly how current that confirmation is.
        </p>
      </div>

      {/* What Pending Means */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-white font-bold text-xl">What &ldquo;Pending&rdquo; Means</h2>
          <StatusBadge status="pending" />
        </div>
        <p className="text-gray-400 leading-relaxed">
          A Pending badge means a provider is in our database with publicly available information, but we have not
          yet completed direct confirmation. We list pending providers because partial information is still useful
          to you — but treat anything marked Pending as a starting point for your own due diligence, not a
          guarantee.
        </p>
      </div>

      {/* What Flagged Means */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-white font-bold text-xl">What &ldquo;Flagged&rdquo; Means</h2>
          <StatusBadge status="flagged" />
        </div>
        <p className="text-gray-400 leading-relaxed">
          A Flagged badge means we have specific, documented concerns about a provider — customer complaints,
          delivery delays, contract disputes, or other red flags found in our research. We don&apos;t remove
          flagged providers automatically; we surface what we found so you can weigh it yourself. Every flag
          links to its source.
        </p>
      </div>

      {/* Why Some Aren't Listed */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-xl mb-4">Why Some Providers Aren&apos;t Listed At All</h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          We do not list every hosting company that exists. A provider is excluded — not just flagged — when:
        </p>
        <ul className="space-y-3 text-sm text-gray-400 mb-4">
          {[
            'We cannot confirm their stated website or business identity through any public source',
            'A guessed or pattern-matched domain returns no legitimate business presence',
            'We find evidence of closure, dormancy, or abandonment (e.g. a domain that has lapsed to a for-sale listing)',
            'The entity is subject to active government sanctions that would make using their services illegal for US persons or entities',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5" style={{ color: '#ff4757' }}>×</span>
              {item}
            </li>
          ))}
        </ul>
        <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
          <p className="text-sm text-gray-400 leading-relaxed">
            <span className="text-white font-semibold">Note: </span>
            We are not a directory of &ldquo;every company that has ever offered mining hosting.&rdquo; Absence
            from this site means one of the above — not nothing.
          </p>
        </div>
      </div>

      {/* Research Process */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-xl mb-4">Our Research Process</h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          For every provider, we attempt to confirm:
        </p>
        <ul className="space-y-2 text-sm text-gray-400 mb-4">
          {[
            'Official domain ownership',
            'Business registration where publicly available',
            'Customer-reported experiences (Trustpilot, public forums, mining community discussions)',
            'Direct contact with the provider where possible',
          ].map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span style={{ color: ORANGE }} className="shrink-0 mt-0.5">◆</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-gray-400 leading-relaxed">
          We do not accept self-reported claims at face value — pricing, uptime, and contract terms are checked
          against what the provider states publicly, not what they tell us in outreach.
        </p>
      </div>

      {/* For Providers */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-xl mb-3">For Providers</h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          If you run a hosting facility and want to be listed, verified, or featured, book an audit session and
          we&apos;ll walk you through what we need to confirm before a Verified badge goes live.
        </p>
        <Link
          href="/audit"
          className="inline-block text-sm font-semibold px-5 py-2.5 rounded-lg transition-opacity hover:opacity-90"
          style={{ background: ORANGE, color: '#000' }}
        >
          Book a Listing Review →
        </Link>
      </div>

      {/* Report an Issue */}
      <div className="rounded-2xl p-6 mb-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-xl mb-3">Report an Issue</h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          Found something wrong with a listing, or had an experience with a provider that doesn&apos;t match
          what&apos;s shown here? Let us know — disputes go directly to our review queue.
        </p>
        <Link
          href="/review?reason=dispute"
          className="inline-block text-sm font-semibold px-5 py-2.5 rounded-lg border transition-colors hover:border-[#00d4aa] hover:text-white"
          style={{ border: `1px solid ${BORDER}`, color: '#9ca3af' }}
        >
          Report an Issue →
        </Link>
      </div>

      {/* CTA row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link href="/hosting" className="rounded-xl p-5 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="text-xl mb-2">🏗️</div>
          <div className="font-semibold text-white mb-1">Compare Hosting Providers</div>
          <div className="text-xs text-gray-500">See all verified and pending listings side by side.</div>
        </Link>
        <Link href="/review" className="rounded-xl p-5 text-center block" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <div className="text-xl mb-2">🔍</div>
          <div className="font-semibold text-white mb-1">Free Deal Review</div>
          <div className="text-xs text-gray-500">Submit your deal. Get a verdict within 48hr.</div>
        </Link>
      </div>
    </div>
  )
}
