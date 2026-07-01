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
  ctx.shadowBlur = width * 8
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
    let raf = 0

    function spawn() {
      const W = canvas!.width
      const H = canvas!.height
      const zones: [Pt, Pt][] = [
        [{ x: rand(0, W * 0.15), y: rand(0, H * 0.25) }, { x: rand(W * 0.05, W * 0.3), y: rand(H * 0.05, H * 0.4) }],
        [{ x: rand(W * 0.85, W), y: rand(0, H * 0.25) }, { x: rand(W * 0.7, W * 0.95), y: rand(H * 0.05, H * 0.4) }],
        [{ x: rand(0, W * 0.15), y: rand(H * 0.7, H) }, { x: rand(W * 0.05, W * 0.3), y: rand(H * 0.55, H * 0.95) }],
        [{ x: rand(W * 0.85, W), y: rand(H * 0.7, H) }, { x: rand(W * 0.65, W * 0.95), y: rand(H * 0.55, H * 0.95) }],
        [{ x: 0, y: rand(H * 0.25, H * 0.75) }, { x: rand(W * 0.05, W * 0.2), y: rand(H * 0.2, H * 0.8) }],
        [{ x: W, y: rand(H * 0.25, H * 0.75) }, { x: rand(W * 0.8, W * 0.95), y: rand(H * 0.2, H * 0.8) }],
      ]
      const [from, to] = zones[Math.floor(Math.random() * zones.length)]
      const chaos = rand(25, 60)
      const trunk = buildPath(from, to, Math.floor(rand(7, 15)), chaos)
      const branches: Pt[][] = [trunk]
      const numBranches = Math.floor(rand(1, 4))
      for (let b = 0; b < numBranches; b++) {
        const origin = trunk[Math.floor(rand(1, trunk.length - 1))]
        const angle = rand(0, Math.PI * 2)
        const len = rand(30, 100)
        const end: Pt = { x: origin.x + Math.cos(angle) * len, y: origin.y + Math.sin(angle) * len }
        branches.push(buildPath(origin, end, Math.floor(rand(3, 7)), chaos * 0.5))
      }
      arcs.push({ paths: branches, start: performance.now(), duration: rand(140, 320) })
    }

    function loop(now: number) {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height)
      if (now - lastFire > nextIn) {
        spawn()
        lastFire = now
        nextIn = rand(8000, 12000)
      }
      for (let i = arcs.length - 1; i >= 0; i--) {
        const arc = arcs[i]
        const elapsed = now - arc.start
        if (elapsed > arc.duration) { arcs.splice(i, 1); continue }
        const p = elapsed / arc.duration
        let base = p < 0.12 ? p / 0.12 : p < 0.6 ? 1 : 1 - (p - 0.6) / 0.4
        if (p > 0.12 && p < 0.6 && Math.random() > 0.88) base *= 0.25
        const op = base * 0.28
        arc.paths.forEach((path, idx) => {
          const isTrunk = idx === 0
          drawPath(ctx!, path, op * 0.35, isTrunk ? 5 : 3, 'rgba(160,220,255,1)')
          drawPath(ctx!, path, op, isTrunk ? 1.5 : 0.9, 'rgba(230,245,255,1)')
        })
      }
      raf = requestAnimationFrame(loop)
    }

    lastFire = performance.now()
    nextIn = rand(1500, 4000)
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
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }}
    />
  )
}
