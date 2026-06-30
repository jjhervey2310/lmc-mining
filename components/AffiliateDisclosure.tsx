const BORDER = '#222222'

export default function AffiliateDisclosure() {
  return (
    <div
      className="rounded-lg px-4 py-3 text-xs leading-relaxed"
      style={{ background: 'rgba(247,147,26,0.05)', border: `1px solid ${BORDER}`, color: '#6b7280' }}
    >
      <strong style={{ color: '#9ca3af' }}>Affiliate Disclosure:</strong>{' '}
      Lightning Mines earns a commission when you sign up for a hosting provider through our links.
      This does not affect our rankings, reviews, or recommendations. We only list providers we have independently
      evaluated, and commissions never influence our editorial judgement.{' '}
      <a href="/how-we-verify" style={{ color: '#f7931a' }} className="hover:underline">
        How we verify providers →
      </a>
    </div>
  )
}
