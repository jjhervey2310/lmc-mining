import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { absolute: 'Affiliate Disclosure | Lightning Mines' },
  description:
    'How Lightning Mines makes money. Our full FTC affiliate disclosure policy covering Abundant Mines, Kaboomracks, and every affiliate relationship on the site.',
  alternates: { canonical: '/disclosures' },
}

const ORANGE = '#f7931a'
const CARD = '#111111'
const BORDER = '#222222'

export default function DisclosuresPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">← Back to home</Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Affiliate Disclosure</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: July 2026</p>

      {/* Plain-English summary banner */}
      <div
        className="rounded-lg px-5 py-4 mb-10 text-sm leading-relaxed"
        style={{ background: 'rgba(247,147,26,0.10)', border: `1px solid ${ORANGE}`, color: '#e5e7eb' }}
      >
        <strong style={{ color: ORANGE }}>The short version:</strong>{' '}
        Some links on Lightning Mines are affiliate links. If you sign up for a product or service through
        one of them, we may earn a commission — at no additional cost to you. This never changes what we
        recommend or how we rank providers.
      </div>

      <div className="space-y-8 text-sm text-gray-300 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. What Affiliate Links Are</h2>
          <p>
            An affiliate link is a special URL that tells a partner company we referred you. When you click
            an affiliate link on Lightning Mines and later sign up, purchase, or fund an account, the partner
            may pay us a commission. You are never charged more for using our links — the price is identical
            whether you use our link or go to the partner directly.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. Who We Have Affiliate Relationships With</h2>
          <p className="mb-3">We currently earn affiliate commissions from the following partners:</p>
          <div className="space-y-3">
            <div className="rounded-lg p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <h3 className="font-semibold text-white mb-1">Abundant Mines</h3>
              <p className="text-gray-400">
                A Bitcoin mining hosting provider. Links to Abundant Mines (abundantmines.com) throughout our
                hosting guides, comparisons, and provider pages are affiliate links. We may earn a commission
                when you sign up for hosting through them.
              </p>
            </div>
            <div className="rounded-lg p-4" style={{ background: CARD, border: `1px solid ${BORDER}` }}>
              <h3 className="font-semibold text-white mb-1">Kaboomracks</h3>
              <p className="text-gray-400">
                An ASIC miner hardware marketplace. Links to Kaboomracks (kaboomracks.com) on our miner review
                and comparison pages are affiliate links. We may earn a commission when you purchase hardware
                through them.
              </p>
            </div>
          </div>
          <p className="mt-3 text-gray-400">
            If we add new affiliate partners in the future, we will update this page and continue to disclose
            those links clearly on the pages where they appear.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. How This Affects Our Content (It Doesn&apos;t)</h2>
          <p className="mb-3">
            Our editorial independence is the whole point of Lightning Mines. To protect it:
          </p>
          <ul className="space-y-2 text-gray-400">
            <li>· Commissions never influence our rankings, scores, reviews, or recommendations.</li>
            <li>· We only list and recommend providers we have independently evaluated.</li>
            <li>· We recommend non-affiliate options — and warn against providers — when the data supports it.</li>
            <li>· Our Lightning Score and verification process are applied the same way to every provider, affiliate or not.</li>
          </ul>
          <p className="mt-3">
            Learn more about our methodology on our{' '}
            <Link href="/how-we-verify" style={{ color: ORANGE }} className="underline hover:no-underline">
              How We Verify
            </Link>{' '}
            page.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Where You&apos;ll See Disclosures</h2>
          <p>
            In line with the U.S. Federal Trade Commission&apos;s Endorsement Guides, we place a clear and
            conspicuous affiliate disclosure near the top of every page that contains affiliate links —
            before you reach the links themselves. This page is our full, standing disclosure policy, and it
            is linked from every on-page disclosure.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Not Financial Advice</h2>
          <p>
            Lightning Mines provides educational information and tools about Bitcoin mining. Nothing on this
            site is personalized financial, investment, or tax advice. Bitcoin mining carries risk, and you
            should do your own research before purchasing hardware or signing up for hosting.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Questions</h2>
          <p>
            If you have any questions about our affiliate relationships or this disclosure, you can learn more{' '}
            <Link href="/about" style={{ color: ORANGE }} className="underline hover:no-underline">
              about who we are
            </Link>{' '}
            or email us at no-reply@lightningmines.com.
          </p>
        </section>

      </div>
    </div>
  )
}
