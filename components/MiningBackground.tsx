'use client'

interface Props {
  overlay?: number
  children?: React.ReactNode
  className?: string
}

export default function MiningBackground({ overlay = 0.68, children, className = '' }: Props) {
  return (
    <div className={`relative overflow-hidden ${className}`} style={{ background: '#0a0a0a' }}>
      <div
        className="mining-bg-image"
        style={{ backgroundImage: `url('https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=1920&q=90&auto=format&fit=crop')` }}
      />
      <div className="absolute inset-0" style={{ background: `rgba(8,8,8,${overlay})`, zIndex: 1 }} />
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 2 }} aria-hidden="true">
        <div className="cable-glow cable-glow-v1" />
        <div className="cable-glow cable-glow-v2" />
        <div className="cable-glow cable-glow-v3" />
        <div className="cable-glow cable-glow-v4" />
        <div className="cable-glow cable-glow-diag" />
      </div>
      <div className="mining-bg-vignette" style={{ zIndex: 3 }} />
      <div className="mining-bg-bottom-fade" style={{ zIndex: 3 }} />
      <div className="relative" style={{ zIndex: 10 }}>{children}</div>
    </div>
  )
}
