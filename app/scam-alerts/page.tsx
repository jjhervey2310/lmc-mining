import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  alternates: { canonical: '/scam-alerts' },
  title: 'Bitcoin Mining Scam Alerts — Red Flags, Warning Signs & Documented Fraud',
  description:
    'Documented fraud cases, exit scams, and SEC/DOJ enforcement actions in Bitcoin mining. Red flags checklist and 5 named scam patterns every miner needs to know.',
  openGraph: {
    title: 'Bitcoin Mining Scam Alerts | Lightning Mines',
    description: 'Documented fraud and bad actors in Bitcoin mining — know before you mine.',
    type: 'website',
  },
}

const ORANGE = '#f7931a'
const RED = '#ff4757'
const CARD_BG = '#111111'
const BORDER = '#222222'

type AlertStatus = 'defunct' | 'convicted' | 'charged' | 'flagged'

interface ScamAlert {
  name: string
  period: string
  what: string
  status: AlertStatus
  statusLabel: string
  sourceLabel?: string
  sourceUrl?: string
}

const ALERTS: ScamAlert[] = [
  {
    name: 'Compute North',
    period: 'Sep 2022',
    what: 'Filed Chapter 11 bankruptcy in September 2022 with hundreds of millions in debt, leaving customer mining equipment stranded in facilities without power or management. Assets were subsequently acquired by Generate Capital.',
    status: 'defunct',
    statusLabel: 'Defunct — assets acquired',
    sourceLabel: 'U.S. Bankruptcy Court filings (D. Minn.)',
    sourceUrl: 'https://www.coindesk.com/business/2022/09/22/bitcoin-mining-firm-compute-north-files-for-bankruptcy/',
  },
  {
    name: 'GAW Miners / ZenMiner (Josh Garza)',
    period: '2014–2015',
    what: 'Sold cloud hashing contracts ("Hashlets") and a virtual currency (Paycoin) that were largely fictitious — mining power sold far exceeded actual capacity. The SEC charged Josh Garza with securities fraud; he subsequently pleaded guilty to wire fraud and was sentenced to prison.',
    status: 'convicted',
    statusLabel: 'Convicted — Garza pleaded guilty',
    sourceLabel: 'SEC Release 2015-271',
    sourceUrl: 'https://www.sec.gov/news/pressrelease/2015-271.html',
  },
  {
    name: 'MiningMax',
    period: '2016–2018',
    what: 'Operated as a Ponzi scheme under the guise of cryptocurrency mining, recruiting investors worldwide with promises of mining returns. DOJ charged multiple principals with wire fraud and money laundering; estimated losses exceeded $250 million.',
    status: 'convicted',
    statusLabel: 'Convicted — principals sentenced',
    sourceLabel: 'DOJ press release',
    sourceUrl: 'https://www.justice.gov/usao-sdca/pr/south-korean-national-sentenced-prison-orchestrating-250-million-cryptocurrency-mining',
  },
  {
    name: 'Bitcoin Savings & Trust (Trendon Shavers)',
    period: '2011–2012',
    what: 'Promised 7% weekly returns on Bitcoin deposits under the guise of a Bitcoin investment fund. Operated as a classic Ponzi scheme. The SEC brought the first-ever Bitcoin securities fraud case against Shavers; he was convicted of securities fraud and wire fraud in 2014.',
    status: 'convicted',
    statusLabel: 'Convicted — sentenced 18 months',
    sourceLabel: 'SEC v. Shavers (E.D. Tex.)',
    sourceUrl: 'https://www.sec.gov/litigation/litreleases/2013/lr22694.htm',
  },
  {
    name: 'HashOcean',
    period: '2015–2016',
    what: 'A cloud mining platform that disappeared with user deposits, estimated at over $5 million. No verifiable evidence of real mining operations was ever produced. The site went offline without warning and principals were never publicly identified or charged.',
    status: 'defunct',
    statusLabel: 'Defunct — exit scam',
  },
  {
    name: 'Mining Capital Coin (MCC)',
    period: '2021–2022',
    what: 'The DOJ and SEC charged founder Luiz Capuci Jr. with orchestrating a $62 million fraud through fake cryptocurrency mining and trading platforms. Investors were promised mining returns and a proprietary trading bot that did not exist.',
    status: 'charged',
    statusLabel: 'Charged — DOJ/SEC enforcement',
    sourceLabel: 'DOJ press release',
    sourceUrl: 'https://www.justice.gov/usao-sdfl/pr/florida-man-charged-cryptocurrency-fraud-scheme-involving-mining-capital-coin',
  },
]

const STATUS_COLORS: Record<AlertStatus, { color: string; bg: string; border: string }> = {
  defunct:   { color: '#9ca3af', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.2)' },
  convicted: { color: RED,       bg: 'rgba(255,71,87,0.08)',   border: 'rgba(255,71,87,0.2)'   },
  charged:   { color: ORANGE,    bg: 'rgba(247,147,26,0.08)',  border: 'rgba(247,147,26,0.2)'  },
  flagged:   { color: ORANGE,    bg: 'rgba(247,147,26,0.08)',  border: 'rgba(247,147,26,0.2)'  },
}

const RED_FLAGS = [
  'No physical facility address or verifiable facility photos',
  'Guaranteed daily returns stated as a fixed percentage',
  'Cloud mining with no proof of hardware ownership or hash allocation',
  'High-pressure sales tactics or artificial urgency on large commitments',
  'Non-refundable deposits over $1,000 with no SLA or contract protection',
  'Compensation for recruiting new investors — any MLM or network structure',
  'No named principals with verifiable identity or company registration',
  'Contract terms that give the provider full discretion over your hardware',
  'No clear answer on billing method — kWh vs flat fee vs revenue share',
  'Electricity rates quoted dramatically below market (under $0.02/kWh)',
]

const WARNING_CHECKLIST = [
  { item: 'I have verified the physical facility address exists', critical: true },
  { item: 'I have seen dated photos or video of operating equipment', critical: true },
  { item: 'I have a signed contract with clear pricing, SLA, and exit clause', critical: true },
  { item: 'The company is registered in a real jurisdiction — I have verified this', critical: true },
  { item: 'I know the electricity rate or flat fee in writing, all-in', critical: true },
  { item: 'The company does not pay commissions for recruiting other investors', critical: false },
  { item: 'My deposit is refundable if the facility is not operational within 30 days', critical: false },
  { item: 'I have spoken with a real human at the company — not just email or chat', critical: false },
  { item: 'I have cross-referenced the company name against this page and SEC.gov', critical: false },
]

const SCAM_PATTERNS = [
  {
    name: 'Cloud Mining Fraud',
    description: 'Platforms sell "hashrate" or "mining contracts" without owning or operating actual hardware. Payouts come from new investor deposits, not mining revenue. The site disappears when inflows slow.',
    signals: ['No verifiable proof of hardware ownership', 'Guaranteed fixed daily returns', 'No transparency into mining pool or wallet address'],
  },
  {
    name: 'The Exit Scam',
    description: 'A legitimate-appearing hosting provider or cloud platform operates for months, building credibility and collecting deposits. Then the site goes offline, principals disappear, and customer funds are unrecoverable.',
    signals: ['Short company history under 2 years', 'Payment delays in the weeks before disappearance', 'Anonymous founders with no verifiable identity'],
  },
  {
    name: 'Ponzi / Mining MLM',
    description: 'Structured as a multi-level or recruitment-based scheme. Early participants receive returns paid from new investor deposits. Collapses when recruitment slows. The SEC and DOJ have charged dozens of these operations.',
    signals: ['Recruitment bonuses or referral commissions', 'Promises of passive income without a clear mechanism', 'Vague or shifting claims about mining operations'],
  },
  {
    name: 'Equipment Bait-and-Switch',
    description: 'Sellers advertise current-generation ASIC hardware at inflated prices, then deliver older, lower-efficiency models. Buyers discover the discrepancy months later when profitability is far below projections.',
    signals: ['Hardware price significantly above secondary market', 'Seller controls shipping and delivery timeline', 'No serial number verification before full payment'],
  },
  {
    name: 'Fake Hosting Contracts',
    description: 'Operators collect hosting deposits and setup fees for facilities that do not exist or cannot accommodate additional miners. Equipment may be shipped and confirmed received but never powered on or connected to a mining pool.',
    signals: ['No option to visit the facility', 'No confirmed mining pool connection with wallet verification', 'Uptime reports generated internally with no third-party verification'],
  },
]

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: [
    {
      '@type': 'Question',
      name: 'How do I know if a Bitcoin mining hosting provider is legitimate?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Verify the physical facility address, request dated photos or video of operating equipment, confirm the company is registered in a real jurisdiction, and get all pricing and contract terms in writing before sending any deposit. Legitimate providers do not resist due diligence.',
      },
    },
    {
      '@type': 'Question',
      name: 'What are the biggest red flags in a Bitcoin mining deal?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Guaranteed daily percentage returns, no verifiable physical facility, non-refundable large deposits, anonymous founders, MLM-style referral structures, and electricity rates dramatically below market are all serious red flags that indicate potential fraud.',
      },
    },
    {
      '@type': 'Question',
      name: 'What is a cloud mining scam?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Cloud mining scams sell "hashrate" or "mining contracts" without owning actual hardware. Payouts come from new investor deposits rather than real mining revenue, making them functionally identical to Ponzi schemes. The platform collapses when new investment slows.',
      },
    },
    {
      '@type': 'Question',
      name: 'Where can I report a Bitcoin mining scam?',
      acceptedAnswer: {
        '@type': 'Answer',
        text: 'Report suspected fraud to the SEC at sec.gov/tcr, the FBI Internet Crime Complaint Center at ic3.gov, the CFTC at cftc.gov/complaint, and your state attorney general. If money has been lost, also contact a securities attorney specializing in cryptocurrency fraud.',
      },
    },
  ],
}

export default function ScamAlertsPage() {
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />

      <div className="max-w-4xl mx-auto px-4 py-10">

        <div className="text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span>Scam Alerts</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
          Bitcoin Mining Scam Alerts
        </h1>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl">
          Documented fraud cases, named scam patterns, and a due-diligence checklist for evaluating any Bitcoin mining deal.
          If a company&apos;s name, principals, or business model resembles anything on this page, verify independently before committing capital.
        </p>

        {/* Disclaimer */}
        <div className="rounded-xl p-4 mb-10" style={{ background: 'rgba(247,147,26,0.07)', border: '1px solid rgba(247,147,26,0.2)' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#d1a45a' }}>
            <strong style={{ color: ORANGE }}>Disclaimer:</strong> This page is historical and educational. Sources are public court filings, SEC/DOJ press releases, and credible news coverage.
            This is not legal advice. Company statuses change — always verify through official government sources before making any financial decision.
          </p>
        </div>

        {/* Red Flags Section */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-white mb-2">10 Red Flags to Walk Away From</h2>
          <p className="text-sm text-gray-500 mb-5">Any single item on this list is cause for significant concern. Multiple items is cause to walk away entirely.</p>
          <div className="space-y-2">
            {RED_FLAGS.map((flag, i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-lg px-4 py-3 text-sm"
                style={{ background: 'rgba(255,71,87,0.05)', border: '1px solid rgba(255,71,87,0.12)' }}
              >
                <span className="shrink-0 font-bold mt-0.5" style={{ color: RED }}>✕</span>
                <span className="text-gray-300">{flag}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Warning Signs Checklist */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-white mb-2">Pre-Commitment Checklist</h2>
          <p className="text-sm text-gray-500 mb-5">Run through this before sending any deposit. Items marked critical are non-negotiable.</p>
          <div className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
            <div className="space-y-3">
              {WARNING_CHECKLIST.map((item, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div
                    className="w-5 h-5 rounded border shrink-0 mt-0.5"
                    style={{ borderColor: item.critical ? RED : BORDER, minWidth: '20px' }}
                  />
                  <div className="flex-1 text-sm text-gray-300 leading-relaxed">
                    {item.item}
                    {item.critical && (
                      <span className="ml-2 text-xs font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(255,71,87,0.15)', color: RED }}>
                        critical
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 5 Scam Patterns */}
        <div className="mb-12">
          <h2 className="text-xl font-bold text-white mb-2">5 Named Scam Patterns</h2>
          <p className="text-sm text-gray-500 mb-5">These patterns recur across decades of Bitcoin mining fraud. Learn to recognize the structure, not just the name.</p>
          <div className="space-y-4">
            {SCAM_PATTERNS.map((pattern, i) => (
              <div key={i} className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <div className="flex items-start gap-3 mb-3 flex-wrap">
                  <span className="text-xs font-bold px-2.5 py-1 rounded-full shrink-0" style={{ background: 'rgba(255,71,87,0.12)', color: RED }}>
                    Pattern {i + 1}
                  </span>
                  <h3 className="text-white font-bold text-base">{pattern.name}</h3>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed mb-4">{pattern.description}</p>
                <div>
                  <div className="text-xs font-semibold mb-2" style={{ color: ORANGE }}>Warning signals:</div>
                  <ul className="space-y-1">
                    {pattern.signals.map((s, j) => (
                      <li key={j} className="flex items-center gap-2 text-xs text-gray-400">
                        <span style={{ color: RED }}>▸</span> {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Documented Cases */}
        <div className="mb-12">
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-xl font-bold text-white">Documented Cases</h2>
            <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(255,71,87,0.15)', color: RED }}>
              {ALERTS.length} cases
            </span>
          </div>
          <div className="space-y-4">
            {ALERTS.map((alert) => {
              const sc = STATUS_COLORS[alert.status]
              return (
                <div key={alert.name} className="rounded-2xl p-6" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap mb-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <span
                        className="text-xs font-bold px-2.5 py-1 rounded-full"
                        style={{ background: 'rgba(255,71,87,0.12)', color: RED, border: '1px solid rgba(255,71,87,0.3)' }}
                      >
                        FLAGGED
                      </span>
                      <h3 className="text-white font-bold text-base">{alert.name}</h3>
                      <span className="text-xs text-gray-500 font-mono">{alert.period}</span>
                    </div>
                    <span
                      className="text-xs px-2.5 py-1 rounded-full font-medium whitespace-nowrap"
                      style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.border}` }}
                    >
                      {alert.statusLabel}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed mb-4">{alert.what}</p>
                  {alert.sourceUrl ? (
                    <a
                      href={alert.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs hover:underline"
                      style={{ color: ORANGE }}
                    >
                      Source: {alert.sourceLabel || alert.sourceUrl} ↗
                    </a>
                  ) : (
                    alert.sourceLabel && (
                      <span className="text-xs text-gray-600">Source: {alert.sourceLabel}</span>
                    )
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* CTA to audit */}
        <div className="rounded-2xl p-8 text-center mb-10" style={{ background: 'rgba(247,147,26,0.05)', border: '1px solid rgba(247,147,26,0.2)' }}>
          <div className="text-xs font-semibold px-3 py-1 rounded-full inline-block mb-4" style={{ background: 'rgba(247,147,26,0.12)', color: ORANGE }}>
            NOT SURE ABOUT A DEAL?
          </div>
          <h2 className="text-xl font-bold text-white mb-3">Get a Professional Second Opinion</h2>
          <p className="text-sm text-gray-400 mb-6 max-w-xl mx-auto">
            Before committing capital to any mining deal, get an independent review. We analyze your specific contract terms,
            hardware specs, and hosting offer against current market data — and give you a plain-English go/no-go verdict.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/audit"
              className="text-sm font-bold px-6 py-3 rounded-lg inline-block"
              style={{ background: ORANGE, color: '#000' }}
            >
              Book a $97 Mining Audit →
            </Link>
            <Link
              href="/review"
              className="text-sm font-semibold px-6 py-3 rounded-lg inline-block border text-gray-300 hover:text-white transition-colors"
              style={{ borderColor: BORDER }}
            >
              Free Deal Review →
            </Link>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="mb-10">
          <h2 className="text-xl font-bold text-white mb-5">Frequently Asked Questions</h2>
          <div className="space-y-4">
            {faqSchema.mainEntity.map((faq, i) => (
              <div key={i} className="rounded-xl p-5" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
                <h3 className="font-semibold text-white text-sm mb-2">{faq.name}</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{faq.acceptedAnswer.text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Submit tip */}
        <div className="rounded-2xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
          <h2 className="text-white font-bold mb-2">Know of another case we should add?</h2>
          <p className="text-sm text-gray-500 mb-4">
            We only list documented cases with verifiable sources. Submit a tip and we&apos;ll investigate.
          </p>
          <Link
            href="/review"
            className="text-sm font-bold px-6 py-3 rounded-lg inline-block"
            style={{ background: ORANGE, color: '#000' }}
          >
            Submit a Tip →
          </Link>
        </div>

        {/* Related links */}
        <div className="mt-8 text-sm text-center">
          <span className="text-gray-500">Related: </span>
          <Link href="/university/mining-contract-red-flags" style={{ color: ORANGE }} className="hover:underline">
            Mining Contract Red Flags
          </Link>
          <span className="text-gray-600 mx-2">·</span>
          <Link href="/how-we-verify" style={{ color: ORANGE }} className="hover:underline">
            How We Verify Providers
          </Link>
          <span className="text-gray-600 mx-2">·</span>
          <Link href="/university/bitcoin-mining-for-beginners" style={{ color: ORANGE }} className="hover:underline">
            Bitcoin Mining for Beginners
          </Link>
        </div>

      </div>
    </div>
  )
}
