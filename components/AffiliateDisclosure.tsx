const ORANGE = '#f7931a'

export default function AffiliateDisclosure() {
  return (
    <div
      className="rounded-lg px-4 py-3 mb-6 text-sm leading-relaxed flex items-start gap-3"
      style={{
        background: 'rgba(247,147,26,0.10)',
        border: `1px solid ${ORANGE}`,
        color: '#e5e7eb',
      }}
    >
      <span aria-hidden="true" className="text-base leading-none mt-0.5" style={{ color: ORANGE }}>
        ⚑
      </span>
      <div>
        <strong style={{ color: ORANGE }}>Affiliate Disclosure:</strong>{' '}
        This page contains affiliate links. Lightning Mines earns a commission — at no extra cost to you —
        when you sign up through some of the links on this page (including Abundant Mines and Kaboomracks).
        Commissions never affect our rankings, reviews, or recommendations; we only list providers we have
        independently evaluated.{' '}
        <a href="/disclosures" style={{ color: ORANGE }} className="underline hover:no-underline whitespace-nowrap">
          Full disclosure policy →
        </a>
      </div>
    </div>
  )
}
