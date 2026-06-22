'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import gsap from 'gsap'

export default function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const contentRef = useRef<HTMLDivElement>(null)
  const barRef     = useRef<HTMLDivElement>(null)
  const prevPath   = useRef<string | null>(null)

  useEffect(() => {
    const isNavigation = prevPath.current !== null && prevPath.current !== pathname
    prevPath.current = pathname

    // Gold progress bar on navigation
    if (isNavigation && barRef.current) {
      gsap.killTweensOf(barRef.current)
      gsap.fromTo(
        barRef.current,
        { scaleX: 0, opacity: 1 },
        {
          scaleX: 1,
          duration: 0.45,
          ease: 'power2.out',
          onComplete: () => {
            gsap.to(barRef.current!, { opacity: 0, duration: 0.25, delay: 0.05 })
          },
        },
      )
    }

    // Page fade in
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 6 },
        { opacity: 1, y: 0, duration: 0.38, ease: 'power2.out', clearProps: 'all' },
      )
    }
  }, [pathname])

  return (
    <>
      {/* Gold navigation progress bar */}
      <div
        ref={barRef}
        aria-hidden="true"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          height: '2px',
          zIndex: 10000,
          background: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)',
          transformOrigin: 'left center',
          transform: 'scaleX(0)',
          opacity: 0,
          pointerEvents: 'none',
        }}
      />
      <div ref={contentRef}>{children}</div>
    </>
  )
}
