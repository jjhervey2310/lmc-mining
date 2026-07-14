
interface Props {
  context?: 'hosting' | 'miners' | 'profitability'
}

const COPY: Record<NonNullable<Props['context']>, string> = {
  hosting: 'Hosting rates and terms are sourced directly from provider websites and confirmed via email outreach where possible. Data is reviewed monthly by Jacob Hervey, who has 8 years of direct experience in Bitcoin mining. Providers marked "Verify Direct" have not been independently confirmed — contact them before committing capital.',
  miners: 'Hardware specifications are sourced from manufacturer datasheets and confirmed against third-party benchmark reports. Market pricing reflects current secondary-market and distributor listings. Data is reviewed monthly by Jacob Hervey. Always verify current pricing with your supplier before purchase.',
  profitability: 'Profitability calculations use live BTC price and network difficulty from public APIs. Hashprice formula: (block reward × blocks/day × BTC price) ÷ network hashrate. Figures are updated in real time and exclude pool fees (~1%), minor operational costs, and hardware depreciation. Reviewed monthly by Jacob Hervey.',
}

export default function MethodologyCallout({ context = 'hosting' }: Props) {
  return (
    <div
      className="rounded-lg px-4 py-3 text-xs leading-relaxed mb-8"
      style={{ background: 'rgba(0,212,170,0.04)', border: `1px solid rgba(0,212,170,0.15)`, color: '#6b7280' }}
    >
      <strong style={{ color: '#00d4aa' }}>About our data:</strong>{' '}
      {COPY[context]}
    </div>
  )
}
