import type { Metadata } from 'next'
import Link from 'next/link'
import AffiliateDisclosure from '@/components/AffiliateDisclosure'
import QuickAnswer from '@/components/QuickAnswer'

export const metadata: Metadata = {
  alternates: { canonical: '/best-bitcoin-mining-hosting' },
  title: 'Best Bitcoin Mining Hosting 2026 — Complete Guide',
  description: 'The definitive guide to Bitcoin mining hosting in 2026. Compare hosting providers, understand pricing models, avoid hidden fees, and find the best deal for your operation.',
  openGraph: {
    images: [{ url: '/api/og?title=Best+Bitcoin+Mining+Hosting+2026&sub=The+Complete+Guide', width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary_large_image',
    images: ['/api/og?title=Best+Bitcoin+Mining+Hosting+2026&sub=The+Complete+Guide'],
  },
}

const HOSTING_PROVIDERS = [
  {
    name: 'Abundant Miners',
    badge: '#1 Recommended',
    badgeColor: '#f59e0b',
    cooling: 'Air',
    rate: '$225/month flat',
    minMachines: 1,
    contract: 'Month-to-month',
    pros: ['Flat $225/month all-in — no hidden fees', 'No minimum machine count', 'Month-to-month — no lockup', 'Integrated financing available', 'US-based operations'],
    cons: ['Air cooling only — no immersion/hydro', 'Best for S21-class machines and below'],
    verdict: 'Best for most miners. Transparent pricing, no games, and low barrier to entry make Abundant Miners the default recommendation for anyone running air-cooled hardware.',
    href: 'https://abundantmines.com/ref/72/',
    affiliate: true,
    highlight: true,
  },
  {
    name: 'Compass Mining',
    badge: 'Large Scale',
    badgeColor: '#3d7aed',
    cooling: 'Air / Immersion',
    rate: '$0.05–0.09/kWh',
    minMachines: 5,
    contract: '12–36 months',
    pros: ['Large network of hosting sites', 'Immersion and air options', 'Good for 5+ machine deployments'],
    cons: ['kWh billing — costs harder to predict', 'Minimum machine counts', 'Longer contracts'],
    verdict: 'Best for larger deployments where you want flexibility across sites. Pricing becomes competitive at scale.',
    href: 'https://compassmining.io',
    affiliate: false,
    highlight: false,
  },
  {
    name: 'Blockstream Mining',
    badge: 'Institutional',
    badgeColor: '#a855f7',
    cooling: 'Air / Immersion',
    rate: 'Custom (enterprise)',
    minMachines: 50,
    contract: '24–36 months',
    pros: ['Enterprise-grade infrastructure', 'Multiple global locations', 'Custody and financial services'],
    cons: ['Minimum 50 machines', 'Custom pricing — less transparent', 'Long contracts'],
    verdict: 'Institutional-grade option for serious operators with 50+ machines and multi-site strategy needs.',
    href: 'https://blockstream.com/mining/',
    affiliate: false,
    highlight: false,
  },
]

const PRICING_MODELS = [
  {
    model: 'All-in flat fee (per machine)',
    example: '$225/month per machine',
    pros: 'Completely predictable cost. Easy to budget. No electricity bill surprises.',
    cons: 'Less flexible if you have very low-power machines (you may pay more per kWh effectively).',
    verdict: 'Best for most miners, especially those new to hosting.',
    score: 5,
  },
  {
    model: 'Per-kWh electricity billing',
    example: '$0.06/kWh',
    pros: 'Fair for low-power machines. Potential savings if your miner is very efficient.',
    cons: 'Requires you to calculate costs yourself. Power usage can fluctuate. Fees stack (often plus management fee).',
    verdict: 'Best when you have a highly efficient miner and can do the math. Risk: costs are harder to predict.',
    score: 3,
  },
  {
    model: 'Revenue share',
    example: '15–25% of mining revenue',
    pros: 'No upfront cost. Host shares your risk.',
    cons: 'Expensive at higher BTC prices. You give up upside when mining is profitable.',
    verdict: 'Avoid unless you have no capital. You pay the most when it matters most.',
    score: 2,
  },
  {
    model: 'Tokenized hosting contracts',
    example: 'Hosted mining tokens',
    pros: 'Can trade or transfer exposure.',
    cons: 'Complex. Often high fees embedded in token pricing. Regulatory uncertainty.',
    verdict: 'Not recommended. Unnecessary complexity with worse economics.',
    score: 1,
  },
]

const RED_FLAGS = [
  { flag: 'No SLA or uptime guarantee', why: 'Means the host has no accountability if your machines are down. Lost uptime = lost revenue.' },
  { flag: 'Minimum 24-month contracts on first sign-up', why: 'Legitimate hosts offer shorter initial terms. Locking you in long-term before you can verify reliability is a warning sign.' },
  { flag: 'Vague "electricity included" claims', why: 'Ask exactly what is included. Some hosts charge for cooling, network, or maintenance separately.' },
  { flag: 'No physical facility verification', why: "If you can't confirm the facility address, view images, or speak with other customers, treat it as high risk." },
  { flag: 'Payout in "mining tokens" instead of BTC', why: 'You mine BTC. You should be paid in BTC. Any intermediary token is unnecessary friction and often a red flag.' },
  { flag: 'Customer support only via Telegram', why: 'Professional hosts have email and phone support. Telegram-only communication is a common trait of fraudulent operations.' },
  { flag: 'Promises of guaranteed profit or fixed ROI', why: 'Mining profitability fluctuates with BTC price and network difficulty. No legitimate host guarantees returns.' },
]

const COOLING_TYPES = [
  {
    type: 'Air Cooling',
    desc: 'Standard ASIC miners (S19, S21, M60S) use air cooling. Heat is expelled via fans. Air-cooled facilities account for the majority of mining capacity globally.',
    cost: 'Lowest infrastructure cost',
    noise: 'Loud — not suitable for residential',
    efficiency: 'Baseline',
    best: 'Most miners. All standard Antminer and MicroBT machines.',
  },
  {
    type: 'Hydro Cooling',
    desc: 'Water-cooled variants (S21 Hydro, M60S Hydro) run liquid through integrated cooling blocks. Quieter and more efficient but require specialized hosting infrastructure.',
    cost: 'Higher — specialized equipment',
    noise: 'Significantly quieter',
    efficiency: '10–15% better than air at same hash rate',
    best: 'S21 Hydro and M60S Hydro owners. Limited hosting availability.',
  },
  {
    type: 'Immersion Cooling',
    desc: 'Miners are submerged in dielectric fluid. The fluid absorbs heat, which is removed via heat exchangers. Allows overclocking and dramatic noise reduction.',
    cost: 'Highest — specialized tanks and fluid',
    noise: 'Near-silent',
    efficiency: '20–30% better, enables overclocking',
    best: 'Large operations (50+ machines) seeking maximum efficiency and noise reduction.',
  },
]

const FAQ = [
  {
    q: 'What does Bitcoin mining hosting actually cost in 2026?',
    a: 'Flat-fee hosting for standard air-cooled miners runs $180–$300/month per machine depending on the provider and power rates in the facility location. Abundant Miners charges $225/month all-in — one of the most transparent pricing models available. kWh-based pricing typically runs $0.05–0.09/kWh plus a management fee of $20–$50/month per machine.',
  },
  {
    q: 'How many machines do I need to start hosted mining?',
    a: "Most retail-focused hosts like Abundant Miners accept single machines. Larger facilities typically have minimums of 5–50 machines. If you're starting out, find a host with no minimum machine requirement so you can test before scaling.",
  },
  {
    q: 'What is the difference between colocation and managed hosting?',
    a: 'Colocation means you ship your hardware to a facility that provides power and internet — you handle maintenance remotely or via occasional site visits. Managed hosting includes maintenance, firmware updates, and monitoring by the host. Most retail mining hosts offer managed hosting.',
  },
  {
    q: 'How do I verify a hosting provider is legitimate?',
    a: 'Request the physical facility address. Search for the facility on Google Maps and verify it exists. Ask for references from current customers. Check forums like Bitcoin Talk, Reddit r/BitcoinMining, and Compass Mining Discord. Confirm your hardware is insured and the host has a track record of at least 12 months.',
  },
  {
    q: 'What happens to my hardware if the hosting company goes out of business?',
    a: "This is a real risk. Legitimate hosts keep customer hardware ownership separate from operational assets. Before signing any contract, confirm: (1) hardware title remains with you, (2) you can retrieve machines with reasonable notice, (3) the host carries insurance. Avoid hosts that don't have clear hardware custody terms in writing.",
  },
  {
    q: 'Is it better to buy your own building and run miners yourself?',
    a: 'Self-hosting becomes economical at roughly 100+ machines depending on your power rate. Below that threshold, hosted rates are typically better than the total cost of facility setup, power procurement, maintenance staff, and insurance. Most serious miners start hosted and self-host only after they understand the operational complexity.',
  },
  {
    q: 'What is an SLA and do I need one?',
    a: "An SLA (Service Level Agreement) defines the uptime guarantee your host commits to — typically 95–99%. If the host misses the SLA, you may receive credits or fee reductions. Not all retail hosts offer formal SLAs, but any serious host should be willing to commit to uptime expectations in writing.",
  },
  {
    q: 'Can I use any mining pool when my miners are hosted?',
    a: 'Most hosts allow you to configure your own pool connection. Confirm this before signing — some managed hosting agreements require you to use a specific pool, which may not be optimal for your strategy.',
  },
]

const jsonLd = [
  {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: 'Best Bitcoin Mining Hosting 2026 — Complete Guide',
    description: 'The definitive guide to Bitcoin mining hosting in 2026. Compare providers, pricing models, and find the best deal for your operation.',
    author: { '@type': 'Person', name: 'Jacob H.' },
    publisher: { '@type': 'Organization', name: 'Lightning Mines', url: 'https://www.lightningmines.com' },
    dateModified: '2026-06-01',
  },
  {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ.map(f => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  },
  {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lightningmines.com' },
      { '@type': 'ListItem', position: 2, name: 'Best Bitcoin Mining Hosting 2026' },
    ],
  },
]

export default function BestBitcoinMiningHostingPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-8">
        <Link href="/" className="hover:text-white">Home</Link>
        {' / '}Best Bitcoin Mining Hosting 2026
      </div>

      {/* Summary box */}
      <div className="rounded-2xl p-6 mb-10" style={{ background: 'rgba(245,158,11,0.07)', border: '1px solid rgba(245,158,11,0.25)' }}>
        <div className="text-xs font-bold text-yellow-500 mb-2 tracking-widest">SUMMARY — WHAT TO KNOW</div>
        <ul className="space-y-2 text-sm text-gray-300">
          <li>· The all-in flat fee model ($225/month per machine) is the most transparent and beginner-friendly pricing structure</li>
          <li>· Abundant Miners is the top recommendation for air-cooled hosting with no minimum machine count and month-to-month terms</li>
          <li>· Red flags to watch: guaranteed returns, Telegram-only support, vague pricing, long lock-in contracts on first sign-up</li>
          <li>· Air, hydro, and immersion cooling require different hosting infrastructure — verify compatibility before shipping machines</li>
          <li>· Self-hosting only makes economic sense at 100+ machines; below that, hosted rates are usually better than the overhead cost</li>
        </ul>
      </div>

      {/* Hero */}
      <div className="mb-12">
        <div className="inline-flex items-center gap-2 text-xs px-3 py-1 rounded-full mb-4 font-semibold" style={{ background: 'rgba(245,158,11,0.1)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.2)' }}>
          UPDATED JUNE 2026 · 15 MIN READ
        </div>
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4">Best Bitcoin Mining Hosting 2026: The Complete Guide</h1>
        <p className="text-lg text-gray-400">
          Bitcoin mining hosting has become a mature industry — but it&apos;s still full of bad actors, hidden fees, and confusing pricing. This guide cuts through the noise. We cover how hosting works, what it costs, which providers we recommend, and exactly what to look for when evaluating a hosting deal.
        </p>
      </div>

      <AffiliateDisclosure />

      <QuickAnswer question="What is the best Bitcoin mining hosting in 2026?">
        The best Bitcoin mining hosting in 2026 keeps your all-in cost at or below roughly $0.08/kWh (or about $225/month flat per machine), runs a verifiable facility with a named power source, and puts pricing, uptime, and a clear exit clause in writing. Flat-rate hosting suits beginners who want predictable bills; per-kWh hosting rewards operators who can commit volume at cheap power. Whichever you choose, confirm the current terms in writing before you send a deposit.
      </QuickAnswer>

      {/* Table of contents */}
      <nav className="rounded-2xl p-5 mb-12" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <div className="text-xs font-semibold text-gray-500 mb-3 tracking-widest">CONTENTS</div>
        <ol className="space-y-2 text-sm" style={{ color: '#f59e0b' }}>
          <li><a href="#what-is-hosting" className="hover:underline">1. What is Bitcoin mining hosting?</a></li>
          <li><a href="#pricing-models" className="hover:underline">2. Hosting pricing models compared</a></li>
          <li><a href="#cooling-types" className="hover:underline">3. Cooling types and infrastructure</a></li>
          <li><a href="#providers" className="hover:underline">4. Top hosting providers 2026</a></li>
          <li><a href="#red-flags" className="hover:underline">5. Red flags and scams to avoid</a></li>
          <li><a href="#how-to-evaluate" className="hover:underline">6. How to evaluate a hosting deal</a></li>
          <li><a href="#self-host-vs-hosted" className="hover:underline">7. Self-hosting vs hosted mining</a></li>
          <li><a href="#faq" className="hover:underline">8. FAQ</a></li>
        </ol>
      </nav>

      {/* Section 1 */}
      <section id="what-is-hosting" className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">1. What Is Bitcoin Mining Hosting?</h2>
        <p className="text-gray-400 mb-4">
          Bitcoin mining hosting (also called colocation mining or managed mining) means shipping your mining hardware to a professional facility that provides power, cooling, internet connectivity, and physical security. You own the machines. The host provides the infrastructure.
        </p>
        <p className="text-gray-400 mb-4">
          The alternative — running miners at home or in a personal facility — is impractical for most people. A single Antminer S21 XP draws 3,551 watts and produces 75 decibels of noise. Multiply by 5–10 machines and you have a serious power and noise problem in a residential or small commercial space.
        </p>
        <p className="text-gray-400 mb-4">
          Professional hosts solve this. They source power at scale (often $0.04–0.06/kWh vs $0.12–0.18/kWh residential), have industrial cooling infrastructure, 24/7 monitoring, and security. The economics of mining look dramatically different at industrial power rates.
        </p>
        <div className="rounded-xl p-5 mt-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
          <div className="text-xs font-semibold text-gray-500 mb-3">EXAMPLE: THE MATH ON HOSTED VS HOME MINING</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left py-2 pr-4 text-gray-500 font-medium">Metric</th>
                <th className="text-right py-2 pr-4 text-gray-500 font-medium">Home Mining</th>
                <th className="text-right py-2 text-gray-500 font-medium">Hosted Mining</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300">
              <tr><td className="py-2 pr-4">Power Rate</td><td className="py-2 pr-4 text-right font-mono">$0.15/kWh</td><td className="py-2 text-right font-mono">$0.05/kWh*</td></tr>
              <tr><td className="py-2 pr-4">Daily Power Cost (S21 XP)</td><td className="py-2 pr-4 text-right font-mono">$12.78</td><td className="py-2 text-right font-mono text-green-400">$4.26</td></tr>
              <tr><td className="py-2 pr-4">Monthly Power Cost</td><td className="py-2 pr-4 text-right font-mono">$383</td><td className="py-2 text-right font-mono text-green-400">$128**</td></tr>
              <tr><td className="py-2 pr-4">All-in Monthly Cost</td><td className="py-2 pr-4 text-right font-mono">$383+</td><td className="py-2 text-right font-mono">$225 flat</td></tr>
            </tbody>
          </table>
          <p className="text-xs text-gray-600 mt-3">*Effective rate embedded in $225/month flat fee · **Power component only</p>
        </div>
      </section>

      {/* Section 2 */}
      <section id="pricing-models" className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">2. Hosting Pricing Models Compared</h2>
        <p className="text-gray-400 mb-6">There are four main ways hosting providers charge. The pricing model has a bigger impact on your profitability than most miners realize.</p>
        <div className="space-y-4">
          {PRICING_MODELS.map(m => (
            <div key={m.model} className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-white">{m.model}</h3>
                <div className="flex gap-1">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="w-3 h-3 rounded-sm" style={{ background: i < m.score ? '#f59e0b' : '#1f2937' }} />
                  ))}
                </div>
              </div>
              <div className="text-xs font-mono text-yellow-400 mb-3">{m.example}</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div><span className="text-gray-500">Pros: </span><span className="text-gray-300">{m.pros}</span></div>
                <div><span className="text-gray-500">Cons: </span><span className="text-gray-300">{m.cons}</span></div>
                <div><span className="text-gray-500">Verdict: </span><span className="text-gray-300">{m.verdict}</span></div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-xl p-4" style={{ background: 'rgba(0,212,170,0.07)', border: '1px solid #00d4aa30' }}>
          <p className="text-sm text-gray-300"><span className="font-semibold text-green-400">Bottom line:</span> For most miners, the all-in flat fee model wins on simplicity and predictability. Know your monthly cost before you ship a single machine.</p>
        </div>
      </section>

      {/* Section 3 */}
      <section id="cooling-types" className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">3. Cooling Types and Infrastructure Requirements</h2>
        <p className="text-gray-400 mb-6">Your hardware determines what type of hosting facility you need. This is non-negotiable — you cannot put a hydro-cooled miner in an air-cooled facility.</p>
        <div className="space-y-4">
          {COOLING_TYPES.map(c => (
            <div key={c.type} className="rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h3 className="font-semibold text-white mb-2">{c.type}</h3>
              <p className="text-sm text-gray-400 mb-3">{c.desc}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div><span className="text-gray-500">Cost: </span><span className="text-gray-300">{c.cost}</span></div>
                <div><span className="text-gray-500">Noise: </span><span className="text-gray-300">{c.noise}</span></div>
                <div><span className="text-gray-500">Efficiency: </span><span className="text-gray-300">{c.efficiency}</span></div>
                <div><span className="text-gray-500">Best for: </span><span className="text-gray-300">{c.best}</span></div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 4 */}
      <section id="providers" className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">4. Top Bitcoin Mining Hosting Providers 2026</h2>
        <p className="text-gray-400 mb-6">Our rankings are based on pricing transparency, contract terms, customer feedback, and operational track record. We disclose affiliate relationships clearly.</p>
        <div className="space-y-6">
          {HOSTING_PROVIDERS.map((p, i) => (
            <div
              key={p.name}
              className="rounded-2xl p-6"
              style={{
                background: p.highlight ? 'rgba(245,158,11,0.06)' : '#111827',
                border: `1px solid ${p.highlight ? '#f59e0b40' : '#1f2937'}`,
              }}
            >
              <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 mb-1">
                    <span className="text-lg font-bold text-white">#{i + 1} {p.name}</span>
                    <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold" style={{ background: p.badgeColor + '22', color: p.badgeColor }}>{p.badge}</span>
                    {p.affiliate && <span className="text-xs text-gray-600">[affiliate]</span>}
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-gray-500">
                    <span>Cooling: <span className="text-gray-300">{p.cooling}</span></span>
                    <span>·</span>
                    <span>Rate: <span className="text-white font-mono">{p.rate}</span></span>
                    <span>·</span>
                    <span>Min: <span className="text-gray-300">{p.minMachines} machine{p.minMachines > 1 ? 's' : ''}</span></span>
                    <span>·</span>
                    <span>Contract: <span className="text-gray-300">{p.contract}</span></span>
                  </div>
                </div>
                <a
                  href={p.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-sm font-bold px-5 py-2.5 rounded-xl"
                  style={{ background: p.highlight ? '#f59e0b' : '#1f2937', color: p.highlight ? '#000' : '#fff' }}
                >
                  {p.highlight ? 'Get Quote →' : 'Learn More →'}
                </a>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: '#00d4aa' }}>PROS</div>
                  <ul className="space-y-1">
                    {p.pros.map((pro, j) => <li key={j} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#00d4aa' }}>+</span>{pro}</li>)}
                  </ul>
                </div>
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: '#ff4757' }}>CONS</div>
                  <ul className="space-y-1">
                    {p.cons.map((con, j) => <li key={j} className="flex gap-2 text-sm text-gray-300"><span style={{ color: '#ff4757' }}>−</span>{con}</li>)}
                  </ul>
                </div>
              </div>
              <div className="rounded-lg p-3 text-sm" style={{ background: '#0a0e17' }}>
                <span className="font-semibold text-gray-300">Our take: </span>
                <span className="text-gray-400">{p.verdict}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 5 */}
      <section id="red-flags" className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">5. Hosting Red Flags and Scams to Avoid</h2>
        <p className="text-gray-400 mb-6">Bitcoin mining hosting has attracted its share of fraudulent operators. These are the warning signs we look for when evaluating a host.</p>
        <div className="space-y-3">
          {RED_FLAGS.map((r, i) => (
            <div key={i} className="flex gap-4 rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{ background: '#ff475720', color: '#ff4757' }}>✗</div>
              <div>
                <div className="font-semibold text-white text-sm mb-1">{r.flag}</div>
                <p className="text-sm text-gray-400">{r.why}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Section 6 */}
      <section id="how-to-evaluate" className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">6. How to Evaluate a Hosting Deal</h2>
        <p className="text-gray-400 mb-6">Use this framework before signing any hosting agreement. The goal is to understand your true all-in cost and verify the host is legitimate.</p>
        <div className="space-y-4">
          {[
            { step: 1, title: 'Calculate true monthly cost', body: 'For kWh billing: (machine wattage ÷ 1000) × 24 hours × 30 days × rate per kWh. Add any management fees. Compare to flat-fee alternatives. Our Deal Analyzer does this automatically.' },
            { step: 2, title: 'Verify uptime commitments', body: 'Ask for the SLA in writing. Legitimate hosts guarantee 95%+ uptime and specify what happens if they miss it. No SLA = no accountability.' },
            { step: 3, title: 'Confirm physical facility', body: 'Get the address. Search it on Google Maps. Ask for photos or a virtual tour. Ask which power utility serves the site and what the grid mix is.' },
            { step: 4, title: 'Check hardware ownership terms', body: 'The contract should clearly state that hardware remains your property at all times and that you can retrieve it with reasonable notice (typically 30 days).' },
            { step: 5, title: 'Ask about pool flexibility', body: 'Confirm you can configure your own mining pool. Some hosts require specific pool arrangements that may not be optimal for your strategy.' },
            { step: 6, title: 'Model the ROI at three BTC prices', body: 'Run your numbers at $75K, $100K, and $150K BTC to understand your range of outcomes. Know your breakeven hosting rate before signing.' },
          ].map(s => (
            <div key={s.step} className="flex gap-4 rounded-xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ background: '#f59e0b', color: '#000' }}>{s.step}</div>
              <div>
                <div className="font-semibold text-white mb-1">{s.title}</div>
                <p className="text-sm text-gray-400">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6">
          <Link href="/deal-analyzer" className="inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-xl btn-gold">
            Open Deal Analyzer — Model Any Hosting Deal →
          </Link>
        </div>
      </section>

      {/* Section 7 */}
      <section id="self-host-vs-hosted" className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">7. Self-Hosting vs Hosted Mining</h2>
        <p className="text-gray-400 mb-6">At some scale, building and operating your own facility makes economic sense. Here&apos;s how to think about the threshold.</p>
        <div className="rounded-xl overflow-hidden mb-6" style={{ border: '1px solid #1f2937' }}>
          <table className="w-full text-sm">
            <thead style={{ background: '#111827' }}>
              <tr>
                <th className="text-left py-3 px-4 text-gray-500 font-medium">Factor</th>
                <th className="text-center py-3 px-4 text-gray-500 font-medium">Hosted</th>
                <th className="text-center py-3 px-4 text-gray-500 font-medium">Self-Hosted</th>
              </tr>
            </thead>
            <tbody style={{ background: '#0a0e17' }}>
              {[
                ['Minimum scale', '1 machine', '100+ machines'],
                ['Capital required', 'Hardware only', 'Hardware + facility + electrical + cooling'],
                ['Power rate', '$0.04–0.07/kWh (industrial)', 'Depends on location ($0.03–0.12/kWh)'],
                ['Operational overhead', 'Managed by host', 'Requires staff or serious time commitment'],
                ['Setup time', 'Days–weeks', 'Months'],
                ['Risk', 'Counterparty risk (host)', 'Operational risk (you)'],
                ['Control', 'Limited', 'Full'],
              ].map(([factor, hosted, selfHosted], i) => (
                <tr key={i} className="border-t border-gray-800">
                  <td className="py-2.5 px-4 text-gray-400">{factor}</td>
                  <td className="py-2.5 px-4 text-center text-gray-300">{hosted}</td>
                  <td className="py-2.5 px-4 text-center text-gray-300">{selfHosted}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-gray-400">
          The inflection point is typically 100–200 machines, where the fixed cost of a facility begins to be amortized across enough revenue to beat hosted rates. Before you reach that scale, the operational complexity and capital requirements make hosting the better financial decision for most operators.
        </p>
        <p className="text-gray-400 mt-3">
          Our recommendation: Start hosted. Learn the operational side by visiting your host, understanding firmware management, and monitoring uptime. Self-host only when you have direct experience with what running miners actually looks like at scale.
        </p>
      </section>

      {/* Common Mistakes */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Common Mistakes When Choosing a Host</h2>
        <div className="space-y-3">
          {[
            { mistake: 'Choosing on price alone', fix: 'A $5/month cheaper rate means nothing if the host has 80% uptime. Uptime has a bigger impact on revenue than small price differences.' },
            { mistake: 'Not modeling the deal before signing', fix: 'Always run the numbers at multiple BTC price scenarios. Know your breakeven hosting rate before committing capital.' },
            { mistake: 'Signing long contracts without a track record', fix: 'Start with month-to-month or a 3-month contract. Only lock in longer terms once you have verified uptime and payment reliability.' },
            { mistake: 'Ignoring cooling type compatibility', fix: 'Verify that your specific machine model is compatible with the hosting facility\'s infrastructure before shipping.' },
            { mistake: 'Not reading the hardware ownership clauses', fix: 'Some contracts have ambiguous ownership language. Confirm in writing that you can retrieve your machines with 30 days notice.' },
          ].map((m, i) => (
            <div key={i} className="rounded-xl p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="flex gap-2 mb-1">
                <span style={{ color: '#ff4757' }}>✗</span>
                <span className="font-semibold text-white text-sm">{m.mistake}</span>
              </div>
              <div className="flex gap-2 pl-5">
                <span style={{ color: '#00d4aa' }}>→</span>
                <p className="text-sm text-gray-400">{m.fix}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Expert Tips */}
      <section className="mb-12">
        <h2 className="text-2xl font-bold text-white mb-4">Expert Tips from 8 Years of Mining Operations</h2>
        <div className="space-y-3">
          {[
            'Before you ship, test your machines at home for 48 hours under load. You want to know they work before they go into a facility.',
            'Set up hashrate monitoring alerts (most pools and firmware offer this). If your hashrate drops to zero, you want to know immediately — not at the next billing cycle.',
            'Negotiate a facility visit into your agreement. Being able to see your machines in person at least once per quarter is a reasonable ask.',
            'Keep a spare control board. The most common failure mode for ASIC miners is the control board, not the hash boards. A spare reduces downtime from weeks to hours.',
            'Understand your power draw before shipping. If you\'re running modified firmware with overclock settings, confirm the facility\'s per-machine power draw limits.',
          ].map((tip, i) => (
            <div key={i} className="flex gap-3 rounded-xl p-4" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
              <span className="shrink-0 font-bold" style={{ color: '#f59e0b' }}>{i + 1}.</span>
              <p className="text-sm text-gray-300">{tip}</p>
            </div>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mb-12">
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

      {/* Bottom Line */}
      <section className="rounded-2xl p-6 mb-12" style={{ background: 'rgba(0,212,170,0.07)', border: '1px solid #00d4aa30' }}>
        <h2 className="text-xl font-bold text-white mb-3">Bottom Line</h2>
        <p className="text-gray-300 mb-2">
          For most miners in 2026, Abundant Miners at $225/month flat is the cleanest, most transparent hosting option available. No long contracts, no minimum machine counts, and no hidden fees.
        </p>
        <p className="text-gray-400 mb-4">
          Before you sign with any host, run the deal through our Deal Analyzer to confirm the numbers work at your specific hardware efficiency and the hosting rate you&apos;re being quoted. A deal that looks profitable at $150K BTC may be unprofitable at $75K — know your margin of safety.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="https://abundantmines.com/ref/72/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-bold px-6 py-3 rounded-xl btn-gold"
          >
            Get Hosting Quote from Abundant Miners →
          </a>
          <Link href="/deal-analyzer" className="text-sm font-semibold px-6 py-3 rounded-xl" style={{ background: '#1f2937', color: '#fff' }}>
            Open Deal Analyzer
          </Link>
        </div>
      </section>

      {/* Internal links */}
      <div className="pt-8 border-t border-gray-800">
        <h3 className="text-sm font-semibold text-gray-400 mb-4">Related Resources</h3>
        <div className="flex flex-wrap gap-3">
          {[
            { href: '/hosts', label: 'All Hosting Providers' },
            { href: '/miners', label: 'Hardware Database' },
            { href: '/deal-analyzer', label: 'Deal Analyzer' },
            { href: '/mining-pools', label: 'Mining Pools Guide' },
            { href: '/university/bitcoin-mining-profitability', label: 'Profitability Guide' },
            { href: '/university/bitcoin-mining-hosting-contracts', label: 'Hosting Contracts Guide' },
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
