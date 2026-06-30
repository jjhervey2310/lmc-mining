import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Scam Alerts — Known Fraud Cases & Bad Actors',
  description:
    'Documented fraud cases, exit scams, and SEC/DOJ enforcement actions in Bitcoin mining history. Educational reference for miners doing due diligence.',
  openGraph: {
    title: 'Bitcoin Mining Scam Alerts | Lightning Mines',
    description: 'Documented fraud and bad actors in Bitcoin mining — know before you mine.',
    type: 'website',
  },
}

const ORANGE = '#f7931a'
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
  convicted: { color: '#ff4757', bg: 'rgba(255,71,87,0.08)',   border: 'rgba(255,71,87,0.2)'   },
  charged:   { color: '#f7931a', bg: 'rgba(247,147,26,0.08)',  border: 'rgba(247,147,26,0.2)'  },
  flagged:   { color: '#f7931a', bg: 'rgba(247,147,26,0.08)',  border: 'rgba(247,147,26,0.2)'  },
}

export default function ScamAlertsPage() {
  return (
    <div style={{ background: '#0a0a0a', minHeight: '100vh' }}>
      <div className="max-w-4xl mx-auto px-4 py-10">

        <div className="text-xs text-gray-500 mb-6">
          <Link href="/" className="hover:text-white transition-colors">Home</Link>
          <span className="mx-2">/</span>
          <span>Scam Alerts</span>
        </div>

        <div className="flex items-start gap-3 mb-2">
          <span className="text-3xl">⚠️</span>
          <h1 className="text-3xl md:text-4xl font-bold text-white">
            Bitcoin Mining Scam Alerts
          </h1>
        </div>
        <p className="text-gray-400 text-sm mb-8 max-w-2xl">
          Documented fraud cases, Ponzi schemes, exit scams, and SEC/DOJ enforcement actions in Bitcoin mining history.
          Use this as a reference when evaluating providers — if a company&apos;s name, principals, or model resemble any of these cases, verify independently before committing capital.
        </p>

        {/* Disclaimer */}
        <div className="rounded-xl p-4 mb-10" style={{ background: 'rgba(247,147,26,0.07)', border: '1px solid rgba(247,147,26,0.2)' }}>
          <p className="text-xs leading-relaxed" style={{ color: '#d1a45a' }}>
            <strong style={{ color: ORANGE }}>Disclaimer:</strong> The information on this page is historical and educational in nature.
            It is sourced from publicly available court filings, SEC/DOJ press releases, and credible news coverage.
            This is not legal advice. Company statuses change — always verify current information independently
            through official government sources before making any financial decision. Lightning Mines does not
            provide legal counsel and accepts no liability for decisions made based on this page.
          </p>
        </div>

        {/* Alert count */}
        <div className="flex items-center gap-3 mb-6">
          <h2 className="text-lg font-bold text-white">Documented Cases</h2>
          <span className="text-xs px-2.5 py-1 rounded-full font-bold" style={{ background: 'rgba(255,71,87,0.15)', color: '#ff4757' }}>
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
                      style={{ background: 'rgba(255,71,87,0.12)', color: '#ff4757', border: '1px solid rgba(255,71,87,0.3)' }}
                    >
                      ⛔ FLAGGED
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

        {/* Submit tip */}
        <div className="mt-12 rounded-2xl p-6 text-center" style={{ background: CARD_BG, border: `1px solid ${BORDER}` }}>
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
          <Link href="/university/bitcoin-mining-hosting-red-flags" style={{ color: ORANGE }} className="hover:underline">
            Hosting Red Flags to Watch For
          </Link>
          <span className="text-gray-600 mx-2">·</span>
          <Link href="/university/how-to-avoid-bad-mining-deals" style={{ color: ORANGE }} className="hover:underline">
            How to Avoid Bad Mining Deals
          </Link>
        </div>

      </div>
    </div>
  )
}
