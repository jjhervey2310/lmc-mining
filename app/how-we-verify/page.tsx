import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  alternates: { canonical: '/how-we-verify' },
  title: 'How to Verify a Bitcoin Mining Hosting Provider Is Legit',
  description:
    'The exact checklist we use to tell a legitimate Bitcoin mining hosting provider from a scam: business identity, written pricing, verifiable facility, real contract terms, reputation signals, and sanctions screening. Plus what Verified, Pending, and Flagged mean on Lightning Mines.',
  openGraph: {
    title: 'How to Verify a Bitcoin Mining Hosting Provider Is Legit | Lightning Mines',
    description:
      'The concrete criteria that separate a legitimate mining hosting provider from a scam — and what Verified, Pending, and Flagged mean.',
    type: 'website',
  },
}

const CARD_BG = '#111111'
const BORDER = '#222222'
const ORANGE = '#f7931a'
const TEAL = '#00d4aa'
const RED = '#ff4757'

// ── Content (single source of truth: on-page text AND schema read from here) ──

const CHECKLIST: { title: string; detail: string }[] = [
  {
    title: 'The provider has a resolving domain and a verifiable business identity.',
    detail:
      'A legitimate hosting provider runs an official website that loads, plus a company name you can trace to a real registered business, physical address, and named people. If the only "proof" is a Telegram handle or a WhatsApp number, it is not verifiable.',
  },
  {
    title: 'Pricing is published in writing, in full, before you pay.',
    detail:
      'The all-in electricity rate ($/kWh), any hosting or management fee, setup costs, and how you are billed should all be stated in writing. A legitimate provider does not quote a headline rate and then reveal fees after your deposit clears.',
  },
  {
    title: 'The facility and power source can be independently verified.',
    detail:
      'You should be able to confirm where your machines physically sit and where the power comes from — a named data center, utility, or energy contract, not just "low-cost power" with no location. Real operators can show photos, an address, or a site visit.',
  },
  {
    title: 'The contract has real terms, including uptime, and a clear exit clause.',
    detail:
      'A legitimate agreement spells out contract length, stated uptime, who pays for downtime and repairs, and exactly how you cancel and retrieve your hardware. If there is no written way to leave, treat the deal as a way to trap your machines.',
  },
  {
    title: 'Third-party reputation signals exist and hold up.',
    detail:
      'Look for reviews on Trustpilot, discussion in independent mining forums, and named customers you can actually reach. A legitimate provider has a track record that predates its sales pitch; a scam has only testimonials it controls.',
  },
  {
    title: 'The provider is not subject to government sanctions.',
    detail:
      'Using a sanctioned entity can be illegal for US persons regardless of how good the deal looks. A legitimate provider is not on an OFAC or equivalent sanctions list, and its ownership does not trace back to one.',
  },
  {
    title: 'Support is responsive and answers hard questions directly.',
    detail:
      'Legitimate operators respond to specific questions about fees, downtime, and cancellation without dodging. Pressure to decide "today," vague answers, or a rep who disappears after the deposit are all signs to walk away.',
  },
  {
    title: 'Payment terms are reasonable and reversible where possible.',
    detail:
      'Be wary of any provider that demands the entire contract paid upfront in crypto to a personal wallet. Legitimate businesses invoice, accept traceable payment, and do not require irreversible transfers as the only option.',
  },
  {
    title: 'Claims are consistent everywhere and match the live math.',
    detail:
      'Guaranteed daily profits, fixed ROI timelines, and "risk-free" mining are red flags — real returns move with Bitcoin price and network difficulty. If the numbers a provider promises do not survive an honest calculator, they are marketing, not math.',
  },
]

const RED_FLAGS: string[] = [
  'Guaranteed returns, fixed ROI dates, or "risk-free" mining — real profitability changes with BTC price and difficulty.',
  'No written contract, or terms that change after you pay a deposit.',
  'No verifiable physical facility, address, or named power source.',
  'Full payment demanded upfront, in crypto, to a personal wallet.',
  'Pressure to decide immediately, or a rep who goes quiet once money moves.',
  'A domain that was registered recently, does not resolve, or has lapsed to a for-sale page.',
  'Reviews and testimonials that only appear on the provider’s own channels.',
  'Ownership or the entity itself appearing on a government sanctions list.',
]

const RESEARCH_STEPS: string[] = [
  'Official domain ownership and business identity',
  'Business registration where publicly available',
  'Published pricing, fees, and contract terms in writing',
  'Facility location and power source claims',
  'Customer-reported experiences (Trustpilot, public forums, mining community discussions)',
  'Sanctions screening against public lists',
  'Direct contact with the provider where possible',
]

// ── JSON-LD schema (answers below MUST match visible text above/below) ──

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'How We Verify', item: 'https://lightningmines.com/how-we-verify' },
  ],
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I know a Bitcoin mining hosting provider is legitimate?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'A legitimate Bitcoin mining hosting provider meets all of the following: it has a resolving domain and a verifiable business identity; it publishes full pricing in writing before you pay; its facility and power source can be independently verified; its contract states uptime and a clear exit clause; it has third-party reputation signals that hold up; it is not subject to government sanctions; its support answers hard questions directly; its payment terms are reasonable and reversible where possible; and its claims are consistent everywhere and match the live math. If a provider fails any one of these, treat it as unverified until it is resolved.',
      },
    },
    {
      '@type': 'Question',
      name: 'What are the red flags of a mining hosting scam?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'The clearest red flags are: guaranteed returns, fixed ROI dates, or "risk-free" mining; no written contract or terms that change after you pay; no verifiable physical facility, address, or named power source; full payment demanded upfront in crypto to a personal wallet; pressure to decide immediately or a rep who goes quiet after money moves; a domain that is newly registered, does not resolve, or has lapsed to a for-sale page; reviews that appear only on the provider’s own channels; and any entity that appears on a government sanctions list.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does Lightning Mines check before verifying a provider?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'For every provider we attempt to confirm: official domain ownership and business identity; business registration where publicly available; published pricing, fees, and contract terms in writing; facility location and power source claims; customer-reported experiences on Trustpilot, public forums, and mining community discussions; sanctions screening against public lists; and direct contact with the provider where possible. We do not accept self-reported claims at face value — pricing, uptime, and contract terms are checked against what the provider states publicly, not what they tell us in outreach.',
      },
    },
    {
      '@type': 'Question',
      name: 'What does a "Verified" badge on Lightning Mines mean?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'A Verified badge means we have confirmed, directly with the provider or through primary public sources, that the provider’s official website and contact information, stated electricity rates and billing structure, minimum machine requirements and contract terms, and facility locations and power source are current and accurate as of the date shown on their listing. The "Last Verified" date on every listing tells you how current that confirmation is.',
      },
    },
    {
      '@type': 'Question',
      name: 'What do "Pending" and "Flagged" mean on Lightning Mines?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'Pending means a provider is in our database with publicly available information, but we have not yet completed direct confirmation — treat it as a starting point for your own due diligence, not a guarantee. Flagged means we have specific, documented concerns such as customer complaints, delivery delays, or contract disputes. We do not remove flagged providers automatically; we surface what we found, and every flag links to its source.',
      },
    },
    {
      '@type': 'Question',
      name: 'Why are some mining hosting providers not listed on Lightning Mines at all?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'A provider is excluded — not just flagged — when we cannot confirm its stated website or business identity through any public source, when a guessed or pattern-matched domain returns no legitimate business presence, when we find evidence of closure, dormancy, or abandonment such as a domain lapsed to a for-sale listing, or when the entity is subject to active government sanctions that would make using its services illegal for US persons or entities. We are not a directory of every company that has ever offered mining hosting; absence from the site means one of the above, not nothing.',
      },
    },
    {
      '@type': 'Question',
      name: 'Is a Verified badge a guarantee that a provider is safe?',
      acceptedAnswer: {
        '@type': 'Answer',
        text:
          'No. Verified means the provider’s stated facts were confirmed against primary sources as of the Last Verified date — it is not a promise of returns or a substitute for your own due diligence. Mining profitability changes with Bitcoin price and network difficulty, and any provider’s status can change between checks. Always run your own numbers and read the contract before you commit.',
      },
    },
  ],
}

const howToSchema = {
  '@context': 'https://schema.org',
  '@type': 'HowTo',
  name: 'How to verify a Bitcoin mining hosting provider is legitimate',
  description:
    'A step-by-step checklist for judging whether a Bitcoin mining hosting provider is legitimate before you send money.',
  step: CHECKLIST.map((c, i) => ({
    '@type': 'HowToStep',
    position: i + 1,
    name: c.title,
    text: c.detail,
  })),
}

function StatusBadge({ status }: { status: 'verified' | 'pending' | 'flagged' }) {
  const styles = {
    verified: { background: 'rgba(0,212,170,0.15)', color: TEAL, label: '✓ Verified' },
    pending:  { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', label: '⏳ Pending' },
    flagged:  { background: 'rgba(255,71,87,0.15)',  color: RED, label: '⚠ Flagged' },
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
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(howToSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>How We Verify</span>
      </div>

      <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">
        How to Verify a Bitcoin Mining Hosting Provider Is Legit
      </h1>
      <p className="text-gray-400 text-lg mb-6 leading-relaxed">
        Mining hosting scams cost buyers real money — often after a deposit is already gone. Below is the exact
        checklist we apply to separate a legitimate hosting provider from a scam, the red flags that should stop you
        cold, and what our Verified, Pending, and Flagged badges actually mean.
      </p>
      <p className="text-gray-500 text-sm mb-10 leading-relaxed">
        You can apply this checklist yourself to any provider — on this site or anywhere else. Verification is a
        process, not a badge: if a provider fails even one criterion, treat it as unverified until that gap is closed.
      </p>

      {/* ── CORE: the checklist ── */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-2xl mb-3">
          How do I know a Bitcoin mining hosting provider is legitimate?
        </h2>
        <p className="text-gray-400 mb-6 leading-relaxed">
          A legitimate Bitcoin mining hosting provider meets every one of the criteria below. Each is a standalone
          test — check them one at a time, and stop if any of them fails.
        </p>
        <ol className="space-y-5">
          {CHECKLIST.map((c, i) => (
            <li key={i} className="flex items-start gap-3">
              <span
                className="shrink-0 flex items-center justify-center rounded-full text-xs font-bold"
                style={{ width: 24, height: 24, background: 'rgba(0,212,170,0.15)', color: TEAL }}
              >
                {i + 1}
              </span>
              <div>
                <p className="text-white font-semibold text-[15px] leading-snug mb-1">{c.title}</p>
                <p className="text-sm text-gray-400 leading-relaxed">{c.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      {/* ── Red flags ── */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-2xl mb-3">
          What are the red flags of a mining hosting scam?
        </h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          Any one of these is reason to stop and get a second opinion before you send money. Several together almost
          always mean a scam.
        </p>
        <ul className="space-y-3 text-sm text-gray-400">
          {RED_FLAGS.map((flag, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="shrink-0 mt-0.5" style={{ color: RED }}>×</span>
              {flag}
            </li>
          ))}
        </ul>
        <div className="rounded-xl p-4 mt-5" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
          <p className="text-sm text-gray-400 leading-relaxed">
            <span className="text-white font-semibold">Not sure about a specific deal? </span>
            Submit it for a{' '}
            <Link href="/review" className="font-semibold hover:underline" style={{ color: TEAL }}>free deal review</Link>
            {' '}and get an honest Pass / Avoid verdict within 48 hours, or browse current{' '}
            <Link href="/scam-alerts" className="font-semibold hover:underline" style={{ color: RED }}>scam alerts</Link>.
          </p>
        </div>
      </div>

      {/* ── What Lightning Mines checks ── */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <h2 className="text-white font-bold text-2xl mb-3">
          What does Lightning Mines check before verifying a provider?
        </h2>
        <p className="text-gray-400 mb-4 leading-relaxed">
          Before any provider earns a Verified badge, we attempt to confirm each of the following against primary,
          public sources:
        </p>
        <ul className="space-y-2 text-sm text-gray-400 mb-4">
          {RESEARCH_STEPS.map((item, i) => (
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

      {/* ── Badge definitions ── */}
      <h2 className="text-white font-bold text-2xl mb-4 mt-10">
        What do Verified, Pending, and Flagged mean?
      </h2>

      {/* Verified */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-white font-bold text-xl">What &ldquo;Verified&rdquo; Means</h3>
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
              <span style={{ color: TEAL }} className="shrink-0 mt-0.5">✓</span>
              {item}
            </li>
          ))}
        </ul>
        <p className="text-gray-400 leading-relaxed">
          We re-confirm this information periodically. The &ldquo;Last Verified&rdquo; date on every listing tells
          you exactly how current that confirmation is. Verified is not a guarantee of returns or a substitute for
          your own due diligence — it means the stated facts checked out on the date shown.
        </p>
      </div>

      {/* Pending */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-white font-bold text-xl">What &ldquo;Pending&rdquo; Means</h3>
          <StatusBadge status="pending" />
        </div>
        <p className="text-gray-400 leading-relaxed">
          A Pending badge means a provider is in our database with publicly available information, but we have not
          yet completed direct confirmation. We list pending providers because partial information is still useful
          to you — but treat anything marked Pending as a starting point for your own due diligence, not a
          guarantee.
        </p>
      </div>

      {/* Flagged */}
      <div className="rounded-2xl p-6 mb-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <div className="flex items-center gap-3 mb-4">
          <h3 className="text-white font-bold text-xl">What &ldquo;Flagged&rdquo; Means</h3>
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
        <h2 className="text-white font-bold text-2xl mb-4">Why aren&apos;t some providers listed at all?</h2>
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
              <span className="shrink-0 mt-0.5" style={{ color: RED }}>×</span>
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
