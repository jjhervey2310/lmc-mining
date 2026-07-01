'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'

interface Props {
  href?: string
  onClick?: () => void
  children: React.ReactNode
  variant?: 'primary' | 'outline'
  className?: string
}

export default function LightningButton({ href, onClick, children, variant = 'primary', className = '' }: Props) {
  const btnRef = useRef<HTMLDivElement>(null)
  const [bolts, setBolts] = useState<{ id: number; x: number; y: number }[]>([])
  const counter = useRef(0)

  function handleClick(e: React.MouseEvent) {
    const rect = btnRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    const id = counter.current++
    setBolts(prev => [...prev, { id, x, y }])
    setTimeout(() => setBolts(prev => prev.filter(b => b.id !== id)), 600)
    onClick?.()
  }

  const baseStyle = variant === 'primary'
    ? 'btn-gold-hero text-sm font-bold px-8 py-4 rounded-xl'
    : 'btn-outline-hero text-sm font-medium px-8 py-4 rounded-xl'

  const inner = (
    <div ref={btnRef} className={`lightning-btn relative overflow-hidden ${baseStyle} ${className}`} onClick={handleClick}>
      {children}
      {bolts.map(bolt => (
        <svg
          key={bolt.id}
          className="lightning-strike"
          style={{ position: 'absolute', left: bolt.x - 12, top: bolt.y - 24, width: 24, height: 48, pointerEvents: 'none' }}
          viewBox="0 0 24 48"
          fill="none"
          aria-hidden="true"
        >
          <polyline points="14,0 8,20 13,20 6,48 18,18 12,18 18,0" fill="rgba(255,220,80,0.95)" stroke="rgba(255,255,200,0.9)" strokeWidth="0.5" />
          <polyline points="14,0 8,20 13,20 6,48 18,18 12,18 18,0" fill="none" stroke="rgba(255,200,50,0.4)" strokeWidth="3" strokeLinecap="round" />
        </svg>
      ))}
    </div>
  )

  if (href) return <Link href={href}>{inner}</Link>
  return inner
}
