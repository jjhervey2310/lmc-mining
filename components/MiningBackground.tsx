'use client'

import Image from 'next/image'

interface Props {
  overlay?: number
  children?: React.ReactNode
  className?: string
}

export default function MiningBackground({ overlay = 0.72, children, className = '' }: Props) {
  return (
    <div className={`relative overflow-hidden ${className}`}>
      {/* Base image */}
      <Image
        src="https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=1920&q=85"
        alt="Bitcoin mining rig server racks"
        fill
        className="object-cover object-center"
        priority
        sizes="100vw"
      />

      {/* Dark overlay */}
      <div
        className="absolute inset-0"
        style={{ background: `rgba(8,8,8,${overlay})` }}
      />

      {/* Cable glow strips — simulate electrical energy in rack cables */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        {/* Horizontal strip 1 — upper rack area */}
        <div
          className="cable-glow cable-glow-1 absolute"
          style={{ top: '22%', left: 0, right: 0, height: '1px' }}
        />
        {/* Horizontal strip 2 — mid rack */}
        <div
          className="cable-glow cable-glow-2 absolute"
          style={{ top: '41%', left: '8%', right: '12%', height: '1px' }}
        />
        {/* Horizontal strip 3 — lower rack */}
        <div
          className="cable-glow cable-glow-3 absolute"
          style={{ top: '62%', left: '4%', right: '6%', height: '1px' }}
        />
        {/* Vertical strip — left rack column */}
        <div
          className="cable-glow cable-glow-4 absolute"
          style={{ left: '18%', top: '10%', bottom: '10%', width: '1px' }}
        />
        {/* Vertical strip — right rack column */}
        <div
          className="cable-glow cable-glow-5 absolute"
          style={{ right: '22%', top: '15%', bottom: '15%', width: '1px' }}
        />
        {/* Diagonal strip — cable bundle */}
        <div
          className="cable-glow cable-glow-6 absolute"
          style={{
            top: '30%',
            left: '35%',
            width: '30%',
            height: '1px',
            transform: 'rotate(-4deg)',
          }}
        />
      </div>

      {children}
    </div>
  )
}
