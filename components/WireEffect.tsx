'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

interface Wire {
  pts: [number, number][]
  total: number
  speed: number   // seconds per full pulse cycle
  phase: number   // 0-1 phase offset so wires don't all pulse together
  pulseLen: number // pixel length of the bright moving segment
}

function pathLen(pts: [number, number][]): number {
  let l = 0
  for (let i = 1; i < pts.length; i++) {
    const dx = pts[i][0] - pts[i - 1][0]
    const dy = pts[i][1] - pts[i - 1][1]
    l += Math.sqrt(dx * dx + dy * dy)
  }
  return l
}

function buildWires(W: number, H: number): Wire[] {
  const defs: { pts: [number, number][]; speed: number; phase: number }[] = [
    { pts: [[0, H * 0.22], [0, 0], [W * 0.22, 0]],                speed: 4.8, phase: 0.0  }, // top-left L
    { pts: [[W * 0.78, 0], [W, 0], [W, H * 0.22]],                speed: 5.5, phase: 0.38 }, // top-right L
    { pts: [[0, H * 0.78], [0, H], [W * 0.22, H]],                speed: 4.2, phase: 0.62 }, // bottom-left L
    { pts: [[W * 0.78, H], [W, H], [W, H * 0.78]],                speed: 6.1, phase: 0.18 }, // bottom-right L
    { pts: [[0, H * 0.5], [W * 0.05, H * 0.5]],                   speed: 2.8, phase: 0.81 }, // left mid nub
    { pts: [[W, H * 0.5], [W * 0.95, H * 0.5]],                   speed: 2.8, phase: 0.44 }, // right mid nub
  ]
  return defs.map(d => {
    const total = pathLen(d.pts)
    return { ...d, total, pulseLen: Math.min(total * 0.28, 70) }
  })
}

export default function WireEffect() {
  const ref = useRef<HTMLCanvasElement>(null)
  const pathname = usePathname()

  useEffect(() => {
    // Only run animation on inner pages
    if (pathname === '/') return

    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let raf = 0
    let wires: Wire[] = []
    const start = performance.now()

    function resize() {
      if (!canvas) return
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
      wires = buildWires(canvas.width, canvas.height)
    }
    resize()
    window.addEventListener('resize', resize)

    function draw(now: number) {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const elapsed = (now - start) / 1000

      for (const wire of wires) {
        const { pts, total, speed, phase, pulseLen } = wire
        const gapLen = Math.max(total - pulseLen, 1)

        // Faint base conduit line — always visible
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.strokeStyle = 'rgba(100,160,220,0.07)'
        ctx.lineWidth = 1
        ctx.setLineDash([])
        ctx.shadowBlur = 0
        ctx.stroke()

        // Corner junction dots — tiny anchor points at path vertices
        if (pts.length > 2) {
          for (let i = 1; i < pts.length - 1; i++) {
            ctx.beginPath()
            ctx.arc(pts[i][0], pts[i][1], 1.5, 0, Math.PI * 2)
            ctx.fillStyle = 'rgba(160,220,255,0.12)'
            ctx.fill()
          }
        }

        // Bright pulse traveling along the wire
        const cyclePos = ((elapsed / speed + phase) % 1) * total
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.setLineDash([pulseLen, gapLen])
        ctx.lineDashOffset = -(cyclePos - pulseLen)
        ctx.lineWidth = 1.5
        ctx.strokeStyle = 'rgba(180,225,255,0.85)'
        ctx.shadowColor = 'rgba(160,220,255,1)'
        ctx.shadowBlur = 5
        ctx.stroke()

        // Second wider glow layer — softer halo around the pulse
        ctx.beginPath()
        ctx.moveTo(pts[0][0], pts[0][1])
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
        ctx.setLineDash([pulseLen, gapLen])
        ctx.lineDashOffset = -(cyclePos - pulseLen)
        ctx.lineWidth = 4
        ctx.strokeStyle = 'rgba(100,180,255,0.12)'
        ctx.shadowBlur = 10
        ctx.stroke()

        ctx.shadowBlur = 0
        ctx.setLineDash([])
      }

      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [pathname])

  if (pathname === '/') return null

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 2,
      }}
    />
  )
}
