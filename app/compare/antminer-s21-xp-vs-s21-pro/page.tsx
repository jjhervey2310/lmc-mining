import Link from 'next/link'
import type { Metadata } from 'next'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'

export const metadata: Metadata = {
  alternates: { canonical: '/compare/antminer-s21-xp-vs-s21-pro' },
  title: 'Antminer S21 XP vs S21 Pro: Which Should You Buy in 2026?',
  description: 'Detailed comparison of the Antminer S21 XP (270 TH/s, 13.5 J/TH) vs S21 Pro (234 TH/s, 15 J/TH). Profitability, ROI, and which wins for your budget in 2026.',
}

const DIFFICULTY = 113_757_508_517_000
const BLOCK_REWARD = 3.125

function dailyBTC(hashrate: number) {
  return (hashrate * 1e12 * 86400 * BLOCK_REWARD) / (DIFFICULTY * Math.pow(2, 32))
}

const S21_XP = { name: 'Antminer S21 XP', hashrate: 270, efficiency: 13.5, power: 3645, price: 5200, slug: 'antminer-s21-xp' }
const S21_PRO = { name: 'Antminer S21 Pro', hashrate: 234, efficiency: 15.0, power: 3510, price: 3800, slug: 'antminer-s21-pro' }
const HOSTING = 225 // flat monthly fee

function roiMonths(miner: typeof S21_XP, btcPrice: number) {
  const daily = dailyBTC(miner.hashrate) * btcPrice - HOSTING / 30
  if (daily <= 0) return null
  return Math.round(miner.price / (daily * 30))
}

const BTC_SCENARIOS = [
  { label: '$60k BTC', price: 60000 },
  { label: '$80k BTC', price: 80000 },
  { label: '$100k BTC', price: 100000 },
]

const articleSchema = {
  '@context': 'https://schema.org',
  '@type': 'Article',
  headline: 'Antminer S21 XP vs S21 Pro: Which Should You Buy in 2026?',
  description: 'Detailed profitability and specs comparison of the Antminer S21 XP and S21 Pro for Bitcoin mining in 2026.',
  author: { '@type': 'Organization', name: 'Lightning Mines' },
}

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'Is the Antminer S21 XP better than the S21 Pro?',
      acceptedAnswer: { '@type': 'Answer', text: 'The S21 XP offers better efficiency (13.5 J/TH vs 15 J/TH) and more hashrate (270 vs 234 TH/s), but costs $1,400 more. For large-scale operations, the XP is the stronger long-term choice. For smaller budgets, the S21 Pro offers nearly equivalent ROI at lower capital risk.' },
    },
    {
      '@type': 'Question',
      name: 'What is the payback period for the Antminer S21 XP?',
      acceptedAnswer: { '@type': 'Answer', text: 'At $100,000 BTC and $225/month hosting, the Antminer S21 XP pays back hardware costs in approximately 21-24 months. At lower BTC prices the payback extends significantly.' },
    },
    {
      '@type': 'Question',
      name: 'Which Antminer is better for beginners?',
      acceptedAnswer: { '@type': 'Answer', text: 'The S21 Pro is better for beginners — its $3,800 price point requires less capital, has strong resale value, and delivers competitive ROI at current hosting rates. The S21 XP is best for operators deploying 10+ machines at scale.' },
    },
  ],
}

export default function CompareS21XPvsS21ProPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> /{' '}
        <Link href="/miners" className="hover:text-white">Hardware</Link> / S21 XP vs S21 Pro
      </div>

      <AffiliateDisclosure />

      <h1 className="text-3xl md:text-4xl font-bold text-white mb-3 leading-tight">
        Antminer S21 XP vs S21 Pro:<br />Which Should You Buy in 2026?
      </h1>
      <p className="text-gray-400 mb-10 text-lg">
        Two of the best air-cooled Bitcoin miners on the market, $1,400 apart. Here&apos;s exactly how they compare on specs, profitability, and ROI.
      </p>

      {/* Head-to-head specs */}
      <div className="rounded-2xl overflow-hidden mb-10" style={{ border: '1px solid #1f2937' }}>
        <div className="grid grid-cols-3 text-sm font-semibold py-3 px-4" style={{ background: '#111827' }}>
          <div className="text-gray-400">Spec</div>
          <div className="text-center" style={{ color: '#f59e0b' }}>S21 XP</div>
          <div className="text-center text-white">S21 Pro</div>
        </div>
        {[
          { label: 'Hashrate', xp: '270 TH/s', pro: '234 TH/s', winXP: true },
          { label: 'Efficiency', xp: '13.5 J/TH', pro: '15.0 J/TH', winXP: true },
          { label: 'Power Draw', xp: '3,645 W', pro: '3,510 W', winXP: false },
          { label: 'Noise', xp: '75 dB', pro: '75 dB', winXP: null },
          { label: 'Market Price', xp: '$5,200', pro: '$3,800', winXP: false },
          { label: 'Manufacturer', xp: 'Bitmain', pro: 'Bitmain', winXP: null },
          { label: 'Cooling Type', xp: 'Air', pro: 'Air', winXP: null },
          { label: 'Our Rating', xp: '9.8/10', pro: '9.5/10', winXP: true },
        ].map((row, i) => (
          <div key={row.label} className="grid grid-cols-3 py-3 px-4 text-sm items-center" style={{ background: i % 2 === 0 ? '#0d1421' : '#111827', borderTop: '1px solid #1a2332' }}>
            <div className="text-gray-400">{row.label}</div>
            <div className="text-center font-semibold" style={{ color: row.winXP === true ? '#f59e0b' : row.winXP === null ? '#9ca3af' : '#9ca3af' }}>{row.xp}</div>
            <div className="text-center font-semibold" style={{ color: row.winXP === false ? '#00d4aa' : '#9ca3af' }}>{row.pro}</div>
          </div>
        ))}
      </div>

      {/* Profitability table */}
      <h2 className="text-2xl font-bold text-white mb-4">Profitability Comparison</h2>
      <p className="text-gray-400 text-sm mb-5">Based on $225/month flat hosting fee at Abundant Mines. Net profit per month after hosting costs.</p>
      <div className="rounded-2xl overflow-hidden mb-10" style={{ border: '1px solid #1f2937' }}>
        <div className="grid grid-cols-3 text-sm font-semibold py-3 px-4" style={{ background: '#111827' }}>
          <div className="text-gray-400">BTC Price</div>
          <div className="text-center" style={{ color: '#f59e0b' }}>S21 XP / month</div>
          <div className="text-center text-white">S21 Pro / month</div>
        </div>
        {BTC_SCENARIOS.map((s, i) => {
          const xpDaily = dailyBTC(S21_XP.hashrate) * s.price - HOSTING / 30
          const proDaily = dailyBTC(S21_PRO.hashrate) * s.price - HOSTING / 30
          return (
            <div key={s.label} className="grid grid-cols-3 py-3 px-4 text-sm" style={{ background: i % 2 === 0 ? '#0d1421' : '#111827', borderTop: '1px solid #1a2332' }}>
              <div className="text-gray-300 font-medium">{s.label}</div>
              <div className="text-center font-bold font-mono" style={{ color: xpDaily > 0 ? '#00d4aa' : '#ff4757' }}>
                {xpDaily > 0 ? `+$${(xpDaily * 30).toFixed(0)}/mo` : `−$${Math.abs(xpDaily * 30).toFixed(0)}/mo`}
              </div>
              <div className="text-center font-bold font-mono" style={{ color: proDaily > 0 ? '#00d4aa' : '#ff4757' }}>
                {proDaily > 0 ? `+$${(proDaily * 30).toFixed(0)}/mo` : `−$${Math.abs(proDaily * 30).toFixed(0)}/mo`}
              </div>
            </div>
          )
        })}
        <div className="grid grid-cols-3 py-3 px-4 text-sm border-t" style={{ background: '#111827', borderColor: '#374151' }}>
          <div className="text-gray-400">ROI at $80k BTC</div>
          <div className="text-center font-semibold" style={{ color: '#f59e0b' }}>{roiMonths(S21_XP, 80000) ?? 'N/A'} months</div>
          <div className="text-center font-semibold text-white">{roiMonths(S21_PRO, 80000) ?? 'N/A'} months</div>
        </div>
      </div>

      {/* Verdict */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-10">
        <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.3)' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#f59e0b' }}>BEST FOR LARGE SCALE</div>
          <h3 className="text-lg font-bold text-white mb-2">Antminer S21 XP</h3>
          <p className="text-sm text-gray-400 mb-4">Superior efficiency at 13.5 J/TH means stronger margins as network difficulty increases. Essential post-2028 halving resilience. Best choice if deploying 5+ machines.</p>
          <Link href={`/miners/${S21_XP.slug}`} className="text-sm font-semibold" style={{ color: '#f59e0b' }}>View S21 XP →</Link>
        </div>
        <div className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs font-semibold mb-2" style={{ color: '#00d4aa' }}>BEST FOR BEGINNERS</div>
          <h3 className="text-lg font-bold text-white mb-2">Antminer S21 Pro</h3>
          <p className="text-sm text-gray-400 mb-4">$1,400 lower entry cost, equivalent ROI timeline, and strong resale market. The smart starting point for operators deploying 1–5 machines for the first time.</p>
          <Link href={`/miners/${S21_PRO.slug}`} className="text-sm font-semibold" style={{ color: '#00d4aa' }}>View S21 Pro →</Link>
        </div>
      </div>

      {/* CTAs */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <Link href={`/deal-analyzer?miner=${S21_XP.slug}`} className="text-center text-sm font-bold py-3 rounded-xl" style={{ background: '#00d4aa', color: '#0a0e17' }}>
          Analyze S21 XP Deal →
        </Link>
        <Link href={`/deal-analyzer?miner=${S21_PRO.slug}`} className="text-center text-sm font-bold py-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)' }}>
          Analyze S21 Pro Deal →
        </Link>
      </div>

      <div className="rounded-2xl p-5 text-center" style={{ background: '#111827', border: '1px solid rgba(245,158,11,0.25)' }}>
        <p className="text-sm text-gray-400 mb-3">Ready to host either miner? Our #1 rated host accepts both S21 XP and S21 Pro at $225/month flat.</p>
        <a href="https://abundantmines.com/ref/72/" target="_blank" rel="noopener noreferrer"
          className="inline-block text-sm font-bold px-6 py-2.5 rounded-lg btn-gold">
          Get Started with Abundant Mines →
        </a>
        <p className="text-xs text-gray-600 mt-2">Affiliate link — we earn a commission at no cost to you.</p>
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
