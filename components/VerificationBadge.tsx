interface VerificationBadgeProps {
  status: 'verified' | 'pending_verification'
  date?: string | null
  size?: 'sm' | 'md'
}

export default function VerificationBadge({ status, date, size = 'sm' }: VerificationBadgeProps) {
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm'

  if (status === 'verified') {
    return (
      <span
        className={`inline-flex items-center gap-1 ${textSize} font-medium px-2 py-0.5 rounded-full`}
        style={{ background: '#00d4aa20', color: '#00d4aa', border: '1px solid #00d4aa40' }}
      >
        <span>✓</span>
        <span>Verified{date ? ` ${new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}` : ''}</span>
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
