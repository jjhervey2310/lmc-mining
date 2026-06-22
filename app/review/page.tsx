import type { Metadata } from 'next'
import LeadForm from '@/components/LeadForm'

export const metadata: Metadata = {
  title: 'Free Mining Deal Review',
  description:
    'Submit your Bitcoin mining deal for a free review. Get a Pass / Pass with Conditions / Avoid assessment within 48 hours.',
}

const REVIEW_FIELDS = [
  { name: 'name', label: 'Your Name', type: 'text' as const, required: true, placeholder: 'John Smith' },
  { name: 'email', label: 'Email Address', type: 'email' as const, required: true, placeholder: 'you@example.com' },
  {
    name: 'cooling_type',
    label: 'What cooling type are you considering?',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'air', label: 'Air Cooling' },
      { value: 'hydro', label: 'Hydro / Liquid Cooling' },
      { value: 'immersion', label: 'Immersion Cooling' },
      { value: 'not_sure', label: 'Not sure' },
    ],
  },
  {
    name: 'miner_model',
    label: 'What miner are you considering?',
    type: 'text' as const,
    placeholder: 'e.g. Antminer S21 Pro, Whatsminer M60S...',
  },
  {
    name: 'quoted_price',
    label: 'What price are you being quoted?',
    type: 'text' as const,
    placeholder: 'e.g. $4,500 for the miner, $225/month hosting',
  },
  {
    name: 'hosting_quote_details',
    label: 'Do you have a hosting quote? Paste details here.',
    type: 'textarea' as const,
    placeholder: 'Provider name, monthly rate, location, contract terms, deposit...',
  },
  {
    name: 'budget_range',
    label: 'Your budget range',
    type: 'select' as const,
    required: true,
    options: [
      { value: 'under_5k', label: 'Under $5,000' },
      { value: '5k_10k', label: '$5,000 – $10,000' },
      { value: '10k_25k', label: '$10,000 – $25,000' },
      { value: '25k_plus', label: '$25,000+' },
    ],
  },
  {
    name: 'anything_else',
    label: 'Anything else we should know?',
    type: 'textarea' as const,
    placeholder: 'Specific concerns, timeline, questions...',
  },
]

const SUCCESS_MESSAGE = `Your deal review has been submitted. You will receive a Pass / Pass with Conditions / Avoid assessment within 48 hours.

If you want the full profitability model, hosting provider comparison, and deployment plan, ask about our $97 Mining Profitability Audit.`

export default function ReviewPage() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      {/* Page view tracking */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
            fetch('/api/analytics', {
              method: 'POST',
              headers: {'Content-Type':'application/json'},
              body: JSON.stringify({event_type:'page_view',page:'/review'})
            }).catch(()=>{})
          `,
        }}
      />

      <div className="text-center mb-10">
        <div
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs mb-4"
          style={{ background: '#00d4aa15', color: '#00d4aa', border: '1px solid #00d4aa30' }}
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

      <div
        className="rounded-2xl p-6 md:p-8"
        style={{ background: '#111827', border: '1px solid #1f2937' }}
      >
        <LeadForm
          leadType="deal_review"
          fields={REVIEW_FIELDS}
          submitLabel="Submit for Free Review"
          successMessage={SUCCESS_MESSAGE}
        />
      </div>

      <div className="mt-8 grid grid-cols-3 gap-4 text-center text-sm text-gray-400">
        <div>
          <div className="text-lg mb-1" style={{ color: '#00d4aa' }}>48h</div>
          <div>Response time</div>
        </div>
        <div>
          <div className="text-lg mb-1" style={{ color: '#00d4aa' }}>Free</div>
          <div>No cost, ever</div>
        </div>
        <div>
          <div className="text-lg mb-1" style={{ color: '#00d4aa' }}>Honest</div>
          <div>Pass or Avoid</div>
        </div>
      </div>
    </div>
  )
}
