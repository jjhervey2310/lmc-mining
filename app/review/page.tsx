import type { Metadata } from 'next'
import Link from 'next/link'
import LeadForm from '@/components/LeadForm'

export const metadata: Metadata = {
  alternates: { canonical: '/review' },
  title: 'Free Bitcoin Mining Deal Review — Get a Pass or Avoid Verdict',
  description:
    'Submit your Bitcoin mining deal for a free expert review. Tell us your miner model, hosting provider, costs, and contract terms. Get a Pass / Pass with Conditions / Avoid assessment within 48 hours.',
  openGraph: {
    title: 'Free Mining Deal Review | Lightning Mines',
    description: 'Submit your deal. Get an honest Pass or Avoid verdict within 48 hours. Free.',
    type: 'website',
  },
}

const ORANGE = '#f7931a'
const CARD_BG = '#111111'
const BORDER = '#222222'

const REVIEW_FIELDS = [
  {
    name: 'name',
    label: 'Your Name',
    type: 'text' as const,
    required: true,
    placeholder: 'John Smith',
  },
  {
    name: 'email',
    label: 'Email Address',
    type: 'email' as const,
    required: true,
    placeholder: 'you@example.com',
  },
  {
    name: 'miner_model',
    label: 'Miner Model',
    type: 'text' as const,
    required: true,
    placeholder: 'e.g. Antminer S21 Pro, Whatsminer M60S',
  },
  {
    name: 'number_of_miners',
    label: 'Number of Miners',
    type: 'text' as const,
    required: true,
    placeholder: 'e.g. 1, 5, 10',
  },
  {
    name: 'purchase_price',
    label: 'Purchase Price (per miner)',
    type: 'text' as const,
    placeholder: 'e.g. $3,800',
  },
  {
    name: 'hosting_provider',
    label: 'Hosting Provider',
    type: 'text' as const,
    placeholder: 'e.g. Abundant Mines, Compass Mining',
  },
  {
    name: 'hosting_cost',
    label: 'Hosting Cost',
    type: 'text' as const,
    placeholder: 'e.g. $225/month flat or $0.07/kWh',
  },
  {
    name: 'contract_length',
    label: 'Contract Length',
    type: 'text' as const,
    placeholder: 'e.g. 6 months, 12 months, month-to-month',
  },
  {
    name: 'setup_fee',
    label: 'Setup Fee or Deposit',
    type: 'text' as const,
    placeholder: 'e.g. $500 deposit, no setup fee',
  },
  {
    name: 'question',
    label: 'Your Question or Concern',
    type: 'textarea' as const,
    placeholder: 'What would you most like us to look at? Anything specific that feels off about this deal?',
  },
]

const SUCCESS_MESSAGE = `Your deal review has been submitted successfully.

You will receive a Pass / Pass with Conditions / Avoid assessment within 48 hours.

If you want the full profitability model, hosting provider comparison, and deployment plan, ask about our $97 Mining Deal Audit.`

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'Free Review', item: 'https://lightningmines.com/review' },
  ],
}

export default function ReviewPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>Free Review</span>
      </div>

      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-4 font-semibold"
          style={{ background: 'rgba(0,212,170,0.1)', color: '#00d4aa', border: '1px solid rgba(0,212,170,0.2)' }}
        >
          Free — No Credit Card Required
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Get Your Mining Deal Reviewed
        </h1>
        <p className="text-gray-400">
          Submit your deal and get a{' '}
          <strong className="text-white">Pass / Pass with Conditions / Avoid</strong> assessment
          within 48 hours. Completely free.
        </p>
      </div>

      <div className="rounded-2xl p-6 md:p-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
        <LeadForm
          leadType="deal_review"
          fields={REVIEW_FIELDS}
          submitLabel="Submit for Free Review"
          successMessage={SUCCESS_MESSAGE}
        />
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-gray-500">
        <div>
          <div className="text-lg mb-1 font-bold" style={{ color: ORANGE }}>48hr</div>
          <div className="text-xs">Response time</div>
        </div>
        <div>
          <div className="text-lg mb-1 font-bold" style={{ color: ORANGE }}>Free</div>
          <div className="text-xs">No cost, ever</div>
        </div>
        <div>
          <div className="text-lg mb-1 font-bold" style={{ color: ORANGE }}>Honest</div>
          <div className="text-xs">Pass or Avoid</div>
        </div>
      </div>

      {/* Free → $97 bridge: show the paid audit as the clear next step */}
      <div className="mt-12 rounded-2xl p-6 md:p-8" style={{ background: CARD_BG, border: `1px solid ${BORDER}`, borderLeft: `4px solid ${ORANGE}` }}>
        <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: ORANGE }}>
          Next step
        </div>
        <h2 className="text-xl font-bold text-white mb-2">
          Need more than a Pass / Avoid verdict?
        </h2>
        <p className="text-gray-400 text-sm mb-5">
          The free review gives you a fast go / no-go read. The <strong className="text-white">$97 Mining Deal Audit</strong> is
          the full workup — the exact numbers, the fixes, and a clear recommendation you can act on before you spend a dollar.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 text-sm">
          <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: `1px solid ${BORDER}` }}>
            <div className="font-semibold mb-2" style={{ color: '#00d4aa' }}>Free Review (this page)</div>
            <ul className="text-gray-400 space-y-1.5">
              <li>Pass / Pass with Conditions / Avoid verdict</li>
              <li>Turnaround within 48 hours</li>
              <li>High-level read on the deal</li>
            </ul>
          </div>
          <div className="rounded-xl p-4" style={{ background: '#0a0a0a', border: `1px solid ${ORANGE}` }}>
            <div className="font-semibold mb-2" style={{ color: ORANGE }}>$97 Mining Deal Audit</div>
            <ul className="text-gray-400 space-y-1.5">
              <li>Full profitability model for your exact setup</li>
              <li>Hosting recommendation + 12-month ROI at 3 BTC scenarios</li>
              <li>Written go / no-go report in 48 hours</li>
              <li>Money-back guarantee</li>
            </ul>
          </div>
        </div>
        <Link
          href="/audit"
          className="inline-block text-sm font-bold px-6 py-3 rounded-lg transition-opacity hover:opacity-90"
          style={{ background: ORANGE, color: '#0a0a0a' }}
        >
          See the $97 Mining Deal Audit →
        </Link>
        <p className="text-xs text-gray-600 mt-3">
          Planning a larger or financed deployment? The audit page also covers the $297 Deep Dive.
        </p>
      </div>
    </div>
  )
}
