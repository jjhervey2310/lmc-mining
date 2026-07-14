import type { Metadata } from 'next'
import Link from 'next/link'
import Calculator from '@/components/Calculator'
import BreakevenWidget from '@/components/BreakevenWidget'
import { getLivePriceData } from '@/lib/btc-price'

export const metadata: Metadata = {
  alternates: { canonical: '/calculator' },
  title: 'Bitcoin Mining ROI Calculator — Free Profitability Tool',
  description:
    'Free Bitcoin mining profitability calculator. Enter your miner model, hashrate, power, electricity cost, hosting cost, pool fee, and BTC price to calculate gross revenue, net profit, and breakeven analysis.',
  openGraph: {
    title: 'Bitcoin Mining ROI Calculator | Lightning Mines',
    description: 'Calculate your exact Bitcoin mining profitability. Live BTC price, real hardware specs, hosting cost breakdown.',
    type: 'website',
  },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I calculate Bitcoin mining profitability?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Bitcoin mining profitability = (hashrate / network difficulty) × block reward × BTC price × pool payout factor − electricity cost − hosting cost. Our calculator handles all of this automatically with live BTC price.',
      },
    },
    {
      '@type': 'Question',
      name: 'What inputs do I need for the mining calculator?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'You need: miner model (or custom hashrate in TH/s and power in watts), electricity cost per kWh, monthly hosting fee, pool fee percentage, and BTC price (auto-filled with live price).',
      },
    },
    {
      '@type': 'Question',
      name: 'Why does mining profitability change daily?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Bitcoin network difficulty adjusts every ~2 weeks based on total network hashrate. BTC price fluctuates continuously. Both factors directly affect your daily revenue. Always run fresh calculations before making capital decisions.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is a good efficiency rating for an ASIC miner?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'In 2026, anything at or below 20 J/TH (joules per terahash) is competitive. The Antminer S21 Pro at 15 J/TH is best-in-class for air cooling. Hardware above 25 J/TH faces compressed margins at standard hosting rates.',
      },
    },
  ],
}

const breadcrumbSchema = {
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: [
    { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
    { '@type': 'ListItem', position: 2, name: 'Calculator', item: 'https://lightningmines.com/calculator' },
  ],
}

export default async function CalculatorPage() {
  const priceResult = await getLivePriceData()
  const initialLiveData = 'error' in priceResult ? null : priceResult

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
        <span className="mx-2">/</span>
        <span>Calculator</span>
      </div>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Bitcoin Mining ROI Calculator
        </h1>
        <p className="text-gray-400 max-w-2xl">
          Enter your hardware specs, hosting cost, and electricity rate to calculate gross revenue,
          net profit/loss, monthly and annual projections, and breakeven BTC price.
          Live BTC price is loaded automatically.
        </p>
        <div
          className="inline-flex items-center gap-2 mt-4 px-3 py-1.5 rounded-lg text-xs"
          style={{ background: 'rgba(247,147,26,0.1)', color: '#f7931a', border: '1px solid rgba(247,147,26,0.2)' }}
        >
          ⚠️ Profitability changes daily based on BTC price and network difficulty. Always run fresh numbers before committing capital.
        </div>
      </div>

      {/* Calculator */}
      <Calculator initialLiveData={initialLiveData} />

      {/* Breakeven widget */}
      <div className="mt-10">
        <BreakevenWidget />
      </div>

      {/* FAQ */}
      <div className="mt-16">
        <h2 className="text-xl font-bold text-white mb-6">Calculator FAQ</h2>
        <div className="space-y-4">
          {faqSchema.mainEntity.map((faq, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: '#111111', border: '1px solid #222222' }}>
              <h3 className="text-white font-semibold text-sm mb-2">{faq.name}</h3>
              <p className="text-gray-400 text-sm leading-relaxed">{faq.acceptedAnswer.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Internal links */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/hosting" className="rounded-xl p-4 text-center block" style={{ background: '#111111', border: '1px solid #222222' }}>
          <div className="text-lg mb-1">🏗️</div>
          <div className="text-sm font-semibold text-white mb-1">Compare Hosting</div>
          <div className="text-xs text-gray-500">Find the right hosting cost to plug into your calculation</div>
        </Link>
        <Link href="/miners" className="rounded-xl p-4 text-center block" style={{ background: '#111111', border: '1px solid #222222' }}>
          <div className="text-lg mb-1">⚙️</div>
          <div className="text-sm font-semibold text-white mb-1">Compare Miners</div>
          <div className="text-xs text-gray-500">Find the best hardware specs to optimize your ROI</div>
        </Link>
        <Link href="/review" className="rounded-xl p-4 text-center block" style={{ background: '#111111', border: '1px solid #222222' }}>
          <div className="text-lg mb-1">🔍</div>
          <div className="text-sm font-semibold text-white mb-1">Free Deal Review</div>
          <div className="text-xs text-gray-500">Get an expert eye on your specific deal before you commit</div>
        </Link>
      </div>

      {/* Paid next step — calculator numbers pressure-tested by an expert */}
      <div className="mt-6 rounded-2xl p-6 md:p-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4" style={{ background: '#111111', border: '1px solid rgba(247,147,26,0.35)' }}>
        <div>
          <div className="text-base md:text-lg font-bold text-white mb-1">Numbers look good? Get them pressure-tested before you wire money.</div>
          <p className="text-sm text-gray-400 leading-relaxed">
            A calculator can&apos;t read your actual contract, difficulty assumptions, or hosting fine print. The Mining Deal Audit ($97) delivers a written go / no-go on your specific deal within 48 hours — or the full Build Plan ($297) if you&apos;re deploying at scale.
          </p>
        </div>
        <Link href="/audit#pricing" className="shrink-0 text-sm font-semibold px-6 py-3 rounded-lg text-center whitespace-nowrap" style={{ background: '#f7931a', color: '#000' }}>
          See Audit Options →
        </Link>
      </div>
    </div>
  )
}
