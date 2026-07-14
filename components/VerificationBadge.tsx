interface VerificationBadgeProps {
  status: 'verified' | 'pending' | 'contact_only' | 'unresponsive' | 'pending_verification'
  date?: string | null
  size?: 'sm' | 'md'
}

export default function VerificationBadge({ status, date, size = 'sm' }: VerificationBadgeProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  if (status === 'verified') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${textSize} font-medium px-2 py-0.5 rounded-full`}
        style={{ background: '#f7931a20', color: '#f7931a', border: '1px solid #f7931a40' }}
      >
        <span>ⓘ</span>
        <span>Listed — verify direct{date ? ` · reviewed ${new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}</span>
      </span>
    )
  }

  if (status === 'contact_only') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${textSize} font-medium px-2 py-0.5 rounded-full`}
        style={{ background: '#818cf820', color: '#818cf8', border: '1px solid #818cf840' }}
      >
        <span>✉</span>
        <span>Contact for Pricing</span>
      </span>
    )
  }

  if (status === 'unresponsive') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${textSize} font-medium px-2 py-0.5 rounded-full`}
        style={{ background: '#ff475720', color: '#ff4757', border: '1px solid #ff475740' }}
      >
        <span>✗</span>
        <span>Unresponsive</span>
      </span>
    )
  }

  return (
    <span
      className={`inline-flex items-center gap-1 ${textSize} font-medium px-2 py-0.5 rounded-full`}
      style={{ background: '#f59e0b20', color: '#f59e0b', border: '1px solid #f59e0b40' }}
    >
      <span>⏳</span>
      <span>Pending Verification</span>
    </span>
  )
}
