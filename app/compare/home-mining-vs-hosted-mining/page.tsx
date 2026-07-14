import Link from 'next/link'
import type { Metadata } from 'next'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'

export const metadata: Metadata = {
  alternates: { canonical: '/compare/home-mining-vs-hosted-mining' },
  title: 'Home Mining vs Hosted Mining: The Real Cost Comparison 2026',
  description: 'Should you mine at home or use a hosting provider? Real cost breakdown including electricity, hardware, risk, and ROI for both routes in 2026.',
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Home Mining vs Hosted Mining: The Real Cost Comparison 2026',
  description: 'Detailed cost and risk breakdown of home mining versus hosted mining for Bitcoin in 2026.',
  author: { '@type': 'Organization', name: 'Lightning Mines' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is home mining or hosted mining more profitable?',
      acceptedAnswer: { '@type': 'Answer', text: 'Hosted mining is more profitable for most US residential miners because industrial electricity rates ($0.04–0.07/kWh) are significantly lower than residential rates ($0.12–0.25/kWh). The cost difference often exceeds $100/month per machine, eliminating the home mining economics.' },
    },
    {
      '@type': 'Question',
      name: 'What electricity rate do I need to mine at home profitably?',
      acceptedAnswer: { '@type': 'Answer', text: 'For an Antminer S21 Pro to be more cost-effective at home than hosted at $225/month, your home electricity rate needs to be below approximately $0.057/kWh. Most US residential customers pay $0.12–0.25/kWh, making home mining economically uncompetitive.' },
    },
    {
      '@type': 'Question',
      name: 'What are the hidden costs of home Bitcoin mining?',
      acceptedAnswer: { '@type': 'Answer', text: 'Beyond electricity, home mining hidden costs include: noise management (75+ dB requires either soundproofing or dedicated space), heat management (miners generate 3–4 kW of heat each), increased insurance risk, potential utility contract violations, and significantly higher residential electricity rates.' },
    },
  ],
}

export default function HomeVsHostedPage() {
  // S21 Pro at home vs hosted cost comparison
  const MINER_WATTS = 3510
  const MINER_PRICE = 3800
  const HOSTING_FLAT = 225

  function monthlyCost(rate: number) {
    return (MINER_WATTS / 1000) * 24 * 30 * rate
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / Home Mining vs Hosted Mining
      </div>

      <AffiliateDisclosure />

      <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
        Home Mining vs Hosted Mining:<br />The Real Cost Comparison 2026
      </h1>
      <p className="text-gray-400 mb-10 text-lg">
        The honest numbers on whether mining from your home or using a professional hosting facility makes more financial sense. Spoiler: the answer depends almost entirely on your electricity rate.
      </p>

      {/* Electricity cost table */}
      <h2 className="text-2xl font-bold text-white mb-3">Electricity Cost Comparison</h2>
      <p className="text-sm text-gray-400 mb-5">Based on Antminer S21 Pro (3,510 W). Hosted comparison uses Abundant Mines at $225/month flat fee (electricity + cooling + insurance included).</p>
      <div className="rounded-2xl overflow-hidden mb-10" style={{ border: '1px solid #1f2937' }}>
        <div className="grid grid-cols-3 text-sm font-semibold py-3 px-4" style={{ background: '#111827' }}>
          <div className="text-gray-400">Electricity Rate</div>
          <div className="text-center text-white">Home Monthly Cost</div>
          <div className="text-center" style={{ color: '#f59e0b' }}>vs Hosted ($225)</div>
        </div>
        {[
          { rate: 0.05, label: '$0.05/kWh (industrial)' },
          { rate: 0.07, label: '$0.07/kWh (cheap US)' },
          { rate: 0.10, label: '$0.10/kWh (avg. US south)' },
          { rate: 0.14, label: '$0.14/kWh (avg. US national)' },
          { rate: 0.20, label: '$0.20/kWh (California avg.)' },
          { rate: 0.25, label: '$0.25/kWh (Hawaii/high-cost)' },
        ].map((row, i) => {
          const cost = monthlyCost(row.rate)
          const diff = cost - HOSTING_FLAT
          return (
            <div key={i} className="grid grid-cols-3 py-3 px-4 text-sm" style={{ background: i % 2 === 0 ? '#0d1421' : '#111827', borderTop: '1px solid #1a2332' }}>
              <div className="text-gray-300">{row.label}</div>
              <div className="text-center font-mono font-semibold text-white">${cost.toFixed(0)}/mo</div>
              <div className="text-center font-mono font-semibold" style={{ color: diff > 0 ? '#ff4757' : '#00d4aa' }}>
                {diff > 0 ? `+$${diff.toFixed(0)} more` : `$${Math.abs(diff).toFixed(0)} cheaper`}
              </div>
            </div>
          )
        })}
      </div>

      {/* Full cost breakdown */}
      <h2 className="text-2xl font-bold text-white mb-5">Full Cost Breakdown: Home vs Hosted</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <h3 className="font-bold text-white mb-4">Home Mining Costs</h3>
          <div className="space-y-3 text-sm">
            {[
              { item: 'Hardware (S21 Pro)', cost: '$3,800 one-time' },
              { item: 'Electricity (@ $0.14/kWh)', cost: '$355/month' },
              { item: 'Soundproofing / enclosure', cost: '$200–$1,500 one-time' },
              { item: 'Cooling / HVAC upgrade', cost: '$0–$2,000 one-time' },
              { item: 'Insurance (increased rider)', cost: '$20–$60/month' },
              { item: 'Maintenance (DIY)', cost: '2–5 hours/month' },
              { item: 'Noise / heat impact', cost: 'Quality of life cost' },
            ].map(row => (
              <div key={row.item} className="flex justify-between">
                <span className="text-gray-400">{row.item}</span>
                <span className="text-white font-medium text-right ml-4">{row.cost}</span>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t border-gray-700 font-semibold flex justify-between">
              <span className="text-gray-300">Effective monthly all-in</span>
              <span style={{ color: '#ff4757' }}>~$375–$450/mo</span>
            </div>
          </div>
        </div>
        <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.3)' }}>
          <h3 className="font-bold text-white mb-4">Hosted Mining Costs (Abundant Mines)</h3>
          <div className="space-y-3 text-sm">
            {[
              { item: 'Hardware (S21 Pro)', cost: '$3,800 one-time' },
              { item: 'Monthly hosting fee', cost: '$225/month (all-in)' },
              { item: 'Electricity', cost: 'Included in fee' },
              { item: 'Cooling', cost: 'Included in fee' },
              { item: 'Insurance', cost: 'Included in fee' },
              { item: 'Maintenance', cost: 'Handled by host' },
              { item: 'Setup', cost: '$0 (ship your miner)' },
            ].map(row => (
              <div key={row.item} className="flex justify-between">
                <span className="text-gray-400">{row.item}</span>
                <span className="text-white font-medium text-right ml-4">{row.cost}</span>
              </div>
            ))}
            <div className="pt-3 mt-3 border-t border-gray-700 font-semibold flex justify-between">
              <span className="text-gray-300">Effective monthly all-in</span>
              <span style={{ color: '#00d4aa' }}>$225/mo — guaranteed</span>
            </div>
          </div>
        </div>
      </div>

      {/* Risk comparison */}
      <h2 className="text-2xl font-bold text-white mb-5">Risk Comparison</h2>
      <div className="rounded-2xl overflow-hidden mb-10" style={{ border: '1px solid #1f2937' }}>
        {[
          { risk: 'Hardware damage', home: 'Full liability (no insurance)', hosted: 'Covered by host insurance' },
          { risk: 'Power outage', home: 'Earnings stop, no compensation', hosted: 'Host SLA covers downtime' },
          { risk: 'Noise complaints', home: 'Real risk in residential areas', hosted: 'Not your problem' },
          { risk: 'Utility rate increases', home: 'Direct margin impact', hosted: 'Rate-locked for contract term' },
          { risk: 'Fire / water damage', home: 'Home insurance may not cover', hosted: 'Facility insurance applies' },
          { risk: 'Resale liquidity', home: 'High (you own machine outright)', hosted: 'High (can exit contract, sell miner)' },
        ].map((row, i) => (
          <div key={row.risk} className="grid grid-cols-3 py-3 px-4 text-sm" style={{ background: i % 2 === 0 ? '#0d1421' : '#111827', borderBottom: '1px solid #1a2332' }}>
            <div className="text-gray-400 font-medium">{row.risk}</div>
            <div className="text-gray-300 text-center">{row.home}</div>
            <div className="text-center" style={{ color: '#00d4aa' }}>{row.hosted}</div>
          </div>
        ))}
      </div>

      {/* Verdicts by budget */}
      <h2 className="text-2xl font-bold text-white mb-5">Verdict by Budget</h2>
      <div className="space-y-3 mb-10">
        {[
          { budget: 'Under $5k total budget', verdict: 'Hosted', reason: 'No room for error on home setup costs. Hosted gives predictable ops from day one.' },
          { budget: '$5k–$20k', verdict: 'Hosted', reason: 'Industrial electricity advantages far outweigh residential rates at this scale.' },
          { budget: '$20k+ with cheap power (<$0.05/kWh)', verdict: 'Either', reason: 'At sub-$0.05/kWh, home economics become competitive. Still evaluate against hosted.' },
          { budget: 'Commercial / 50+ machines', verdict: 'Build your own facility', reason: 'At this scale, own-facility economics typically beat hosted options.' },
        ].map((row, i) => (
          <div key={i} className="rounded-xl p-4 flex items-start gap-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <div className="text-xs font-bold px-2 py-1 rounded shrink-0 mt-0.5" style={{ background: row.verdict === 'Hosted' ? 'rgba(245,158,11,0.15)' : '#1f2937', color: row.verdict === 'Hosted' ? '#f59e0b' : '#9ca3af' }}>{row.verdict}</div>
            <div>
              <div className="text-sm font-semibold text-white mb-0.5">{row.budget}</div>
              <p className="text-xs text-gray-400">{row.reason}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="rounded-2xl p-6 text-center" style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.25)' }}>
        <h3 className="font-bold text-white mb-2">Ready to Go Hosted?</h3>
        <p className="text-sm text-gray-400 mb-4">Abundant Mines offers $225/month flat-fee hosting in Cascade Locks, Oregon — hydro power, included insurance, and financing up to $140k.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="https://abundantmines.com/ref/72/" target="_blank" rel="noopener noreferrer"
            className="text-sm font-bold px-6 py-3 rounded-xl btn-gold">
            Get Started with Abundant Mines →
          </a>
          <Link href="/deal-analyzer" className="text-sm font-bold px-6 py-3 rounded-xl" style={{ border: '1px solid #374151', color: '#9ca3af' }}>
            Run the Numbers Free
          </Link>
        </div>
        <p className="text-xs text-gray-600 mt-3">Lightning Mines earns a commission from Abundant Mines at no cost to you.</p>
      </div>

      {/* FAQ */}
      <div className="mt-10">
        <h2 className="text-xl font-bold text-white mb-5">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {faqSchema.mainEntity.map((q) => (
            <div key={q.name} className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h3 className="font-semibold text-white mb-2">{q.name}</h3>
              <p className="text-sm text-gray-400">{q.acceptedAnswer.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
