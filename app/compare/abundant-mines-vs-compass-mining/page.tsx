import Link from 'next/link'
import type { Metadata } from 'next'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'
import QuickAnswer from '@/components/QuickAnswer'

export const metadata: Metadata = {
  alternates: { canonical: '/compare/abundant-mines-vs-compass-mining' },
  title: 'Abundant Mines vs Compass Mining: Hosting Comparison 2026',
  description: 'Side-by-side comparison of Abundant Mines ($225/mo flat) vs Compass Mining ($0.077/kWh). Pricing, locations, power, financing, and which is better for your setup.',
}

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Abundant Mines vs Compass Mining: Hosting Comparison 2026',
  description: 'Independent comparison of Abundant Mines and Compass Mining for Bitcoin hosting in 2026.',
  author: { '@type': 'Organization', name: 'Lightning Mines' },
}

export default function AbundantVsCompassPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> /{' '}
        <Link href="/hosts" className="hover:text-white">Hosting</Link> / Abundant Mines vs Compass Mining
      </div>

      <AffiliateDisclosure />

      <h1 className="text-3xl md:text-4xl font-bold text-white mt-4 mb-3 leading-tight">
        Abundant Mines vs Compass Mining:<br />Hosting Comparison 2026
      </h1>
      <p className="text-gray-400 mb-10 text-lg">
        Two of the most commonly considered hosting providers for US-based Bitcoin miners. Here&apos;s an independent side-by-side breakdown.
      </p>

      <QuickAnswer question="Abundant Mines or Compass Mining — which is better?">
        For most individual miners (1–20 machines), Abundant Mines is the stronger choice: a flat $225/month all-in rate with no machine minimum and month-to-month terms makes costs predictable and lowers the barrier to entry. Compass Mining fits larger operators better — its per-kWh billing ($0.05–0.09/kWh) and multi-site network reward those deploying at scale who can absorb minimums and longer contracts.
      </QuickAnswer>

      {/* Head-to-head table */}
      <div className="rounded-2xl overflow-hidden mb-10" style={{ border: '1px solid #1f2937' }}>
        <div className="grid grid-cols-3 text-sm font-semibold py-3 px-4" style={{ background: '#111827' }}>
          <div className="text-gray-400">Factor</div>
          <div className="text-center" style={{ color: '#f59e0b' }}>Abundant Mines</div>
          <div className="text-center text-white">Compass Mining</div>
        </div>
        {[
          { label: 'Pricing Model', abundant: '$225/mo flat fee', compass: '$0.077/kWh variable', winAbundant: true },
          { label: 'Predictability', abundant: 'Fixed — no bill surprises', compass: 'Variable by consumption', winAbundant: true },
          { label: 'Power Source', abundant: 'Columbia River Hydro', compass: 'Mixed (varies by facility)', winAbundant: true },
          { label: 'Location', abundant: 'Cascade Locks, Oregon', compass: 'US, Canada, Nordic countries', winAbundant: null },
          { label: 'Cooling', abundant: 'Air (immersion ~2028)', compass: 'Air and immersion available', winAbundant: false },
          { label: 'Financing', abundant: 'Yes — $140k @ 10% / 36mo', compass: 'No', winAbundant: true },
          { label: 'Insurance', abundant: 'Included', compass: 'Not included', winAbundant: true },
          { label: 'Min Contract', abundant: '12 months', compass: 'Varies by facility', winAbundant: null },
          { label: 'Min Units', abundant: '1 miner', compass: '1 miner', winAbundant: null },
          { label: 'Uptime SLA', abundant: '99%', compass: '98%', winAbundant: true },
          { label: 'Affiliate (Lightning Mines)', abundant: 'Yes — disclosed', compass: 'No', winAbundant: null },
        ].map((row, i) => (
          <div key={row.label} className="grid grid-cols-3 py-3 px-4 text-sm" style={{ background: i % 2 === 0 ? '#0d1421' : '#111827', borderTop: '1px solid #1a2332' }}>
            <div className="text-gray-400">{row.label}</div>
            <div className="text-center text-sm" style={{ color: row.winAbundant === true ? '#00d4aa' : '#9ca3af' }}>{row.abundant}</div>
            <div className="text-center text-sm" style={{ color: row.winAbundant === false ? '#00d4aa' : '#9ca3af' }}>{row.compass}</div>
          </div>
        ))}
      </div>

      {/* Cost comparison for S21 Pro */}
      <h2 className="text-2xl font-bold text-white mb-3">Real Cost Comparison: Antminer S21 Pro</h2>
      <p className="text-gray-400 text-sm mb-5">S21 Pro draws 3,510 W. At $0.077/kWh (Compass), monthly electricity cost = 3.51 kW × 24h × 30 days × $0.077 = <strong className="text-white">$194/month</strong>. Abundant Mines flat rate: <strong className="text-white">$225/month</strong>.</p>
      <div className="rounded-xl p-5 mb-10" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="grid grid-cols-3 text-xs font-semibold text-gray-500 mb-3">
          <div></div>
          <div className="text-center" style={{ color: '#f59e0b' }}>Abundant Mines</div>
          <div className="text-center text-white">Compass Mining</div>
        </div>
        {[
          { item: 'Electricity / month', abundant: '$225 (all-in)', compass: '$194 (est.)' },
          { item: 'Insurance', abundant: 'Included', compass: 'Not included (~$15–30/mo)' },
          { item: 'Power price lock', abundant: '12-month rate lock', compass: 'Rate can change' },
          { item: 'Effective total', abundant: '$225/mo — no surprises', compass: '$210–$225+/mo est.' },
        ].map((row, i) => (
          <div key={i} className="grid grid-cols-3 text-sm py-2 border-t border-gray-800">
            <div className="text-gray-400">{row.item}</div>
            <div className="text-center text-gray-300">{row.abundant}</div>
            <div className="text-center text-gray-300">{row.compass}</div>
          </div>
        ))}
        <p className="text-xs text-gray-600 mt-3">* Compass pricing estimated from $0.077/kWh rate. Actual bills vary by facility and miner model. Abundant Mines flat fee includes all costs.</p>
      </div>

      {/* Verdicts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#f59e0b' }}>BETTER FOR SMALL MINERS</div>
          <h3 className="text-lg font-bold text-white mb-2">Abundant Mines</h3>
          <p className="text-sm text-gray-400">Predictable flat fee, financing available, insurance included. Perfect for 1–20 machine operators who want zero billing surprises and lower capital requirements.</p>
        </div>
        <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs font-semibold mb-2 text-gray-400">BETTER FOR LARGE / DIVERSE SCALE</div>
          <h3 className="text-lg font-bold text-white mb-2">Compass Mining</h3>
          <p className="text-sm text-gray-400">Multiple facility locations and immersion options suit operators deploying 50+ machines across different geographies. Per-kWh pricing can be cheaper at scale with very efficient hardware.</p>
        </div>
      </div>

      {/* CTA */}
      <div className="rounded-2xl p-6 text-center" style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.25)' }}>
        <h3 className="font-bold text-white mb-2">Our Recommendation for Most Miners</h3>
        <p className="text-sm text-gray-400 mb-4">For 1–20 machines with predictable costs and the option of financing, Abundant Mines is the stronger choice. Use our Deal Analyzer to run your specific numbers.</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <a href="https://abundantmines.com/ref/72/" target="_blank" rel="noopener noreferrer"
            className="text-sm font-bold px-6 py-3 rounded-xl btn-gold">
            Get Started with Abundant Mines →
          </a>
          <Link href="/deal-analyzer" className="text-sm font-bold px-6 py-3 rounded-xl" style={{ border: '1px solid #374151', color: '#9ca3af' }}>
            Run the Numbers Free →
          </Link>
        </div>
        <p className="text-xs text-gray-600 mt-3">Lightning Mines earns a commission from Abundant Mines. Compass Mining is not affiliated.</p>
      </div>
    </div>
  )
}
