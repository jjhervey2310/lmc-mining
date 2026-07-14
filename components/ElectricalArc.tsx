'use client'

import { useEffect, useRef } from 'react'

interface Pt { x: number; y: number }

function lerp(a: number, b: number, t: number) { return a + (b - a) * t }
function rand(min: number, max: number) { return Math.random() * (max - min) + min }

function buildPath(from: Pt, to: Pt, segs: number, chaos: number): Pt[] {
  const pts: Pt[] = [from]
  for (let i = 1; i < segs; i++) {
    const t = i / segs
    const mx = lerp(from.x, to.x, t)
    const my = lerp(from.y, to.y, t)
    const dx = to.x - from.x, dy = to.y - from.y
    const len = Math.sqrt(dx * dx + dy * dy) || 1
    const off = rand(-chaos, chaos)
    pts.push({ x: mx + (-dy / len) * off, y: my + (dx / len) * off })
  }
  pts.push(to)
  return pts
}

function drawPath(ctx: CanvasRenderingContext2D, pts: Pt[], opacity: number, width: number, color: string) {
  if (pts.length < 2) return
  ctx.beginPath()
  ctx.moveTo(pts[0].x, pts[0].y)
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y)
  ctx.globalAlpha = opacity
  ctx.lineWidth = width
  ctx.strokeStyle = color
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.shadowColor = color
  ctx.shadowBlur = width * 10
  ctx.stroke()
  ctx.shadowBlur = 0
}

interface Arc {
  paths: Pt[][]
  start: number
  duration: number
}

export default function ElectricalArc() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const arcs: Arc[] = []
    let lastFire = 0
    let nextIn = rand(2000, 5000)
    let flashStart = -1
    const FLASH_MS = 75
    let raf = 0

    function spawn() {
      const W = canvas!.width
      const H = canvas!.height
      // Zones: from/to in opposite quadrants so bolts travel far across the screen
      const zones: [Pt, Pt][] = [
        [{ x: rand(0, W * 0.1),  y: rand(0, H * 0.15)       }, { x: rand(W * 0.5, W * 0.95), y: rand(H * 0.55, H)        }],
        [{ x: rand(W * 0.9, W),  y: rand(0, H * 0.15)       }, { x: rand(W * 0.05, W * 0.5), y: rand(H * 0.55, H)        }],
        [{ x: rand(0, W * 0.1),  y: rand(H * 0.85, H)       }, { x: rand(W * 0.5, W * 0.95), y: rand(0, H * 0.45)        }],
        [{ x: rand(W * 0.9, W),  y: rand(H * 0.85, H)       }, { x: rand(W * 0.05, W * 0.5), y: rand(0, H * 0.45)        }],
        [{ x: 0,                  y: rand(H * 0.15, H * 0.85)}, { x: rand(W * 0.55, W * 0.98), y: rand(H * 0.05, H * 0.95)}],
        [{ x: W,                  y: rand(H * 0.15, H * 0.85)}, { x: rand(W * 0.02, W * 0.45), y: rand(H * 0.05, H * 0.95)}],
        [{ x: rand(W * 0.1, W * 0.9), y: 0                  }, { x: rand(W * 0.05, W * 0.95), y: rand(H * 0.5, H)        }],
      ]
      const [from, to] = zones[Math.floor(Math.random() * zones.length)]
      const chaos = rand(45, 100)
      const trunk = buildPath(from, to, Math.floor(rand(14, 24)), chaos)
      const branches: Pt[][] = [trunk]
      const numBranches = Math.floor(rand(3, 7))
      for (let b = 0; b < numBranches; b++) {
        const origin = trunk[Math.floor(rand(1, trunk.length - 1))]
        const angle = rand(0, Math.PI * 2)
        const len = rand(100, 280)
        const end: Pt = { x: origin.x + Math.cos(angle) * len, y: origin.y + Math.sin(angle) * len }
        branches.push(buildPath(origin, end, Math.floor(rand(6, 12)), chaos * 0.6))
      }
      arcs.push({ paths: branches, start: performance.now(), duration: rand(180, 380) })
      flashStart = performance.now()
    }

    function loop(now: number) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)

      if (now - lastFire > nextIn) {
        spawn()
        lastFire = now
        nextIn = rand(4500, 6500)
      }

      // Brief screen-wide illumination flash when a bolt fires
      if (flashStart > 0) {
        const fp = (now - flashStart) / FLASH_MS
        if (fp < 1) {
          ctx!.globalAlpha = (1 - fp) * 0.07
          ctx!.fillStyle = 'rgba(200,230,255,1)'
          ctx!.fillRect(0, 0, canvas!.width, canvas!.height)
        } else {
          flashStart = -1
        }
        ctx!.globalAlpha = 1
      }

      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i]
        const elapsed = now - arc.start
        if (elapsed > arc.duration) { arcs.splice(i, 1); continue }
        const p = elapsed / arc.duration
        let base = p < 0.12 ? p / 0.12 : p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4
        if (p > 0.12 && p < 0.6 && Math.random() > 0.88) base *= 0.25
        const op = base * 0.65
        arc.paths.forEach((path, idx) => {
          const isTrunk = idx === 0
          // Wide ambient halo
          drawPath(ctx!, path, op * 0.14, isTrunk ? 18 : 9,   'rgba(120,195,255,1)')
          // Mid glow body
          drawPath(ctx!, path, op * 0.45, isTrunk ? 10 : 5,   'rgba(160,220,255,1)')
          // Bright electric core
          drawPath(ctx!, path, op * 0.90, isTrunk ? 3.5 : 1.8, 'rgba(235,248,255,1)')
        })
      }
      raf = requestAnimationFrame(loop)
    }

    lastFire = performance.now()
    nextIn = rand(800, 2200)
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: -1 }}
    />
  )
}
