import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  alternates: { canonical: '/mining-pools' },
  title: 'Best Bitcoin Mining Pools 2026 — Comparison & Review',
  description: 'Compare the best Bitcoin mining pools in 2026. Foundry USA, Antpool, Luxor, Braiins, Ocean — payout methods, fees, luck, and which pool is right for your operation.',
}

const POOLS = [
  {
    name: 'Foundry USA',
    rank: 1,
    hashrate: '~30–35% of network',
    payout: 'FPPS',
    fee: '0% (subsidized)',
    minPayout: '0.005 BTC',
    pros: ['Largest US-based pool', 'Full-pay-per-share — predictable income', 'No fee currently', 'Strong for institutional and hosted miners'],
    cons: ['Dominant market share raises centralization concerns', 'US regulatory exposure'],
    best: 'Hosted miners and large US-based operations',
    href: 'https://foundrydigital.com/mining-pools/',
    signupHref: 'https://foundrydigital.com/mining-pools/',
    color: '#f59e0b',
    affiliate: false,
    affiliateLabel: null,
  },
  {
    name: 'Antpool',
    rank: 2,
    hashrate: '~15–20% of network',
    payout: 'PPS+',
    fee: '2.5% (PPS+)',
    minPayout: '0.001 BTC',
    pros: ['Run by Bitmain — deep infrastructure', 'Low minimum payout', 'PPS+ includes transaction fees', 'Long track record'],
    cons: ['China-based — regulatory risk', 'Higher fee vs Foundry', 'Some transparency concerns'],
    best: 'Bitmain hardware owners who want integrated support',
    href: 'https://antpool.com',
    signupHref: 'https://antpool.com',
    color: '#3d7aed',
    affiliate: false,
    affiliateLabel: null,
  },
  {
    name: 'Luxor',
    rank: 3,
    hashrate: '~3–5% of network',
    payout: 'FPPS',
    fee: '0.3%',
    minPayout: '0.001 BTC',
    pros: ['US-based, transparent team', 'Excellent dashboard and hashrate analytics', 'ASIC firmware and hashrate marketplace', 'Good for small to mid-size operations'],
    cons: ['Smaller pool — lower luck buffer vs large pools', 'Newer than some competitors'],
    best: 'Miners who value data transparency and US jurisdiction',
    href: 'https://luxor.tech',
    signupHref: 'https://luxor.tech/referral',
    color: '#00d4aa',
    affiliate: true,
    affiliateLabel: 'Affiliate link',
  },
  {
    name: 'Braiins (Slush Pool)',
    rank: 4,
    hashrate: '~2–4% of network',
    payout: 'SCORE (variance reduction)',
    fee: '2%',
    minPayout: '0.001 BTC',
    pros: ['Oldest pool still operating (est. 2010)', 'Open-source firmware (Braiins OS)', 'SCORE payout reduces variance', 'EU-based, good for European miners'],
    cons: ['Smaller pool — more variance on lucky blocks', 'Higher fee than Luxor'],
    best: 'Miners running Braiins OS who want a trusted, long-running pool',
    href: 'https://braiins.com/pool',
    signupHref: 'https://braiins.com/os/plus',
    color: '#a855f7',
    affiliate: true,
    affiliateLabel: 'Affiliate link',
  },
  {
    name: 'Ocean',
    rank: 5,
    hashrate: '~1–2% of network',
    payout: 'TIDES (direct from coinbase tx)',
    fee: '0%',
    minPayout: 'No minimum — direct from block',
    pros: ['Zero fee', 'Pays directly from coinbase transaction — most decentralized', 'Backed by Bitcoin maximalists', 'No KYC required'],
    cons: ['Smallest of the major pools — highest variance', 'New architecture — less battle-tested', 'Requires patience for payouts on small operations'],
    best: 'Privacy-conscious miners and those who prioritize decentralization',
    href: 'https://ocean.xyz',
    signupHref: 'https://ocean.xyz',
    color: '#64748b',
    affiliate: false,
    affiliateLabel: null,
  },
]

const PAYOUT_METHODS = [
  { method: 'PPS (Pay Per Share)', desc: 'You get paid for every valid share submitted, regardless of whether the pool finds a block. Predictable but pool assumes all risk. Fee reflects this.', volatility: 'None' },
  { method: 'FPPS (Full PPS)', desc: 'Like PPS but also includes transaction fee income — a more complete picture of pool revenue. Standard for most large US pools.', volatility: 'None' },
  { method: 'PPS+ (PPS Plus)', desc: 'Combines PPS for block subsidies with PPLNS for transaction fees. Good balance of predictability and upside.', volatility: 'Low' },
  { method: 'PPLNS (Pay Per Last N Shares)', desc: 'Pays based on your share of the last N shares before a block is found. Higher variance but higher reward when pool gets lucky.', volatility: 'Medium–High' },
  { method: 'TIDES (Ocean)', desc: 'Direct payout from the coinbase transaction — most decentralized option. Variance depends on pool size.', volatility: 'High (small pool)' },
]

const FAQ = [
  {
    q: 'How do I choose a mining pool?',
    a: 'The most important factors are: pool fee (0–2.5%), payout method (PPS vs PPLNS), pool hash rate (larger = more predictable income), and jurisdiction (US vs China). For most hosted miners in the US, Foundry USA or Luxor are strong defaults.',
  },
  {
    q: 'Does pool choice affect my profitability?',
    a: "Yes — meaningfully. Pool fees range from 0% to 2.5%, which directly reduces revenue. Payout method affects variance: FPPS gives you the same income regardless of the pool's luck, while PPLNS ties your income to block-finding luck. For most miners, predictability (FPPS) is worth a small fee premium.",
  },
  {
    q: 'Can I switch pools without losing earnings?',
    a: "Yes. You simply point your miner's pool URL to the new pool. Any pending balance at your old pool will be paid out once you hit the minimum payout threshold. Check the minimum payout before switching so you don't leave small balances stranded.",
  },
  {
    q: 'What is pool luck and does it matter?',
    a: 'Pool luck measures how often a pool finds blocks relative to its expected frequency. Luck averages to 100% over time, but small pools experience more variance. If you\'re on a small pool, your daily income can swing significantly even at the same hash rate. Larger pools smooth this out.',
  },
  {
    q: 'What pool do Abundant Mines use for hosted machines?',
    a: 'Abundant Mines allows miners to connect to their pool of choice. Most customers use Foundry USA or Luxor. Contact them directly to confirm current options for your hardware type.',
  },
]

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(f => ({
    '@type': 'Question',
    name: f.q,
    acceptedAnswer: { '@type': 'Answer', text: f.a },
  })),
}

export default function MiningPoolsPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Header */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full mb-4 font-semibold" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
          UPDATED JUNE 2026
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Best Bitcoin Mining Pools 2026</h1>
        <p className="text-gray-400 max-w-2xl mx-auto text-lg">
          Pool choice affects your real revenue by up to 2.5%. Here&apos;s how the major pools compare — fees, payout methods, and which fits your operation.
        </p>
        <div className="mt-4 inline-block text-xs px-3 py-1.5 rounded-lg" style={{ background: '#1f2937', color: '#6b7280' }}>
          Some links on this page are affiliate links. We earn a small commission if you sign up. This does not affect our comparison or rankings.
        </div>
      </div>

      {/* Quick comparison table */}
      <section className="rounded-2xl p-6 mb-12" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-lg font-semibold text-white mb-4">Quick Comparison</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 pr-4 text-gray-500 font-medium">Pool</th>
                <th className="text-left py-2 pr-4 text-gray-500 font-medium">Hashrate</th>
                <th className="text-left py-2 pr-4 text-gray-500 font-medium">Payout</th>
                <th className="text-left py-2 pr-4 text-gray-500 font-medium">Fee</th>
                <th className="text-left py-2 text-gray-500 font-medium">Min Payout</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {POOLS.map(p => (
                <tr key={p.name}>
                  <td className="py-3 pr-4">
                    <span className="font-semibold" style={{ color: p.color }}>{p.name}</span>
                  </td>
                  <td className="py-3 pr-4 text-gray-300">{p.hashrate}</td>
                  <td className="py-3 pr-4 text-gray-300">{p.payout}</td>
                  <td className="py-3 pr-4 font-mono text-white">{p.fee}</td>
                  <td className="py-3 text-gray-400">{p.minPayout}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Pool detail cards */}
      <div className="space-y-6 mb-16">
        {POOLS.map(pool => (
          <div key={pool.name} className="rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <span className="text-lg font-bold" style={{ color: pool.color }}>#{pool.rank} {pool.name}</span>
                </div>
                <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                  <span>Payout: <span className="text-gray-300">{pool.payout}</span></span>
                  <span>·</span>
                  <span>Fee: <span className="font-mono text-white">{pool.fee}</span></span>
                  <span>·</span>
                  <span>Share: <span className="text-gray-300">{pool.hashrate}</span></span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <a
                  href={pool.signupHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-bold px-4 py-2 rounded-lg"
                  style={pool.affiliate
                    ? { background: '#f59e0b', color: '#000' }
                    : { background: pool.color + '22', color: pool.color, border: `1px solid ${pool.color}44` }}
                >
                  {pool.affiliate ? 'Join Pool →' : 'Visit Pool →'}
                </a>
                {pool.affiliateLabel
                  ? <span className="text-[10px]" style={{ color: '#6b7280' }}>{pool.affiliateLabel}</span>
                  : <span className="text-[10px]" style={{ color: '#6b7280' }}>No affiliate — direct link</span>
                }
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: '#00d4aa' }}>PROS</div>
                <ul className="space-y-1">
                  {pool.pros.map((p, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#00d4aa' }}>+</span>{p}</li>
                  ))}
                </ul>
              </div>
              <div>
                <div className="text-xs font-semibold mb-2" style={{ color: '#ff4757' }}>CONS</div>
                <ul className="space-y-1">
                  {pool.cons.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#ff4757' }}>−</span>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-xs text-gray-500"><span className="text-gray-400 font-medium">Best for:</span> {pool.best}</p>
          </div>
        ))}
      </div>

      {/* Payout method explainer */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6">Payout Methods Explained</h2>
        <div className="space-y-3">
          {PAYOUT_METHODS.map(m => (
            <div key={m.method} className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-semibold text-white text-sm">{m.method}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1f2937', color: '#9ca3af' }}>
                  Variance: {m.volatility}
                </span>
              </div>
              <p className="text-sm text-gray-400">{m.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-6">Frequently Asked Questions</h2>
        <div className="space-y-4">
          {FAQ.map((f, i) => (
            <div key={i} className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h3 className="font-semibold text-white mb-2">{f.q}</h3>
              <p className="text-sm text-gray-400">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="rounded-2xl p-6 flex flex-col md:flex-row items-center gap-5" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white mb-1">Know your pool. Know your ROI.</h2>
          <p className="text-sm text-gray-400">Use our Deal Analyzer to model your net revenue at different pool fees and payout structures.</p>
        </div>
        <Link href="/deal-analyzer" className="shrink-0 btn-gold text-sm font-bold px-6 py-3 rounded-xl whitespace-nowrap">
          Open Deal Analyzer →
        </Link>
      </section>

      {/* Internal links */}
      <div className="mt-12 pt-8 border-t border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">Related Resources</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { href: '/miners', label: 'Hardware Database' },
            { href: '/hosts', label: 'Hosting Providers' },
            { href: '/deal-analyzer', label: 'Deal Analyzer' },
            { href: '/university/bitcoin-mining-profitability', label: 'Profitability Guide' },
            { href: '/buy-bitcoin', label: 'Where to Buy Bitcoin' },
          ].map(l => (
            <Link key={l.href} href={l.href} className="text-sm px-4 py-2 rounded-lg" style={{ background: '#111827', border: '1px solid #1f2937', color: '#9ca3af' }}>
              {l.label}
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
