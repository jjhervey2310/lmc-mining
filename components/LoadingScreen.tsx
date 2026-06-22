'use client'

import { useEffect, useRef, useState } from 'react'

const MESSAGES = [
  'Fetching live hashrate...',
  'Analysing network difficulty...',
  'Loading miner database...',
  'Ready.',
]

// ── Minimal local lightning (no external deps) ────────────────────────────────
type LPt = [number, number]

function genBolt(x1: number, y1: number, x2: number, y2: number, r: number, d: number): LPt[] {
  if (d === 0) return [[x1, y1], [x2, y2]]
  const mx = (x1 + x2) / 2 + (Math.random() - 0.5) * r
  const my = (y1 + y2) / 2 + (Math.random() - 0.5) * r * 0.2
  return [...genBolt(x1, y1, mx, my, r * 0.6, d - 1), ...genBolt(mx, my, x2, y2, r * 0.6, d - 1).slice(1)]
}

function drawBolt(ctx: CanvasRenderingContext2D, pts: LPt[], alpha: number) {
  if (pts.length < 2) return
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round'
  const path = () => {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
  }
  ctx.globalAlpha = alpha * 0.1; ctx.strokeStyle = 'rgba(100,120,200,1)'; ctx.lineWidth = 20; path(); ctx.stroke()
  ctx.globalAlpha = alpha * 0.3; ctx.strokeStyle = 'rgba(150,170,255,1)'; ctx.lineWidth = 10; path(); ctx.stroke()
  ctx.globalAlpha = alpha * 0.6; ctx.strokeStyle = 'rgba(180,200,255,1)'; ctx.lineWidth = 4; path(); ctx.stroke()
  ctx.globalAlpha = alpha * 1.0; ctx.strokeStyle = 'rgba(220,230,255,1)'; ctx.lineWidth = 1.5; path(); ctx.stroke()
  ctx.restore()
}
// ─────────────────────────────────────────────────────────────────────────────

interface LBolt { pts: LPt[]; born: number; dur: number }

export default function LoadingScreen() {
  const [visible,  setVisible]  = useState(false)
  const [progress, setProgress] = useState(0)
  const [msgIdx,   setMsgIdx]   = useState(0)
  const [fading,   setFading]   = useState(false)

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boltsRef  = useRef<LBolt[]>([])
  const rafRef    = useRef<number>(0)
  const b50Ref    = useRef(false)
  const b90Ref    = useRef(false)
  const b100Ref   = useRef(false)

  // ── Canvas animation loop ────────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return
    if (!canvasRef.current) return
    const canvas = canvasRef.current as HTMLCanvasElement

    function tick() {
      const W = window.innerWidth, H = window.innerHeight
      const dpr = window.devicePixelRatio || 1
      const tw = Math.round(W * dpr), th = Math.round(H * dpr)
      if (canvas.width !== tw || canvas.height !== th) { canvas.width = tw; canvas.height = th }
      const ctx = canvas.getContext('2d')!
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      const now = performance.now()
      for (let i = boltsRef.current.length - 1; i >= 0; i--) {
        const b = boltsRef.current[i]
        const a = Math.max(0, 1 - (now - b.born) / b.dur)
        if (a <= 0) { boltsRef.current.splice(i, 1); continue }
        drawBolt(ctx, b.pts, a)
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [visible])

  // ── Loading timer ──────────────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (sessionStorage.getItem('hasSeenLoading')) return

    setVisible(true)

    const DURATION = 2500
    const TICK = 16
    let elapsed = 0

    const fireBolts = (count: number, central = false) => {
      const W = window.innerWidth, H = window.innerHeight
      const cx = W / 2, cy = H / 2
      for (let i = 0; i < count; i++) {
        const tx = central ? cx + (Math.random() - 0.5) * 40 : cx + (Math.random() - 0.5) * W * 0.5
        const ty = central ? cy + 20 : cy + (Math.random() - 0.5) * 80
        const sx = tx + (Math.random() - 0.5) * 450
        const sy = Math.random() * H * 0.15
        const pts = genBolt(sx, sy, tx, ty, central ? 50 : 80, 4)
        boltsRef.current.push({ pts, born: performance.now(), dur: central ? 600 : 350 })
      }
    }

    timerRef.current = setInterval(() => {
      elapsed += TICK
      const pct = Math.min((elapsed / DURATION) * 100, 100)
      setProgress(pct)
      setMsgIdx(Math.min(Math.floor((elapsed / DURATION) * MESSAGES.length), MESSAGES.length - 1))

      if (pct >= 50 && !b50Ref.current)  { b50Ref.current  = true; fireBolts(1) }
      if (pct >= 90 && !b90Ref.current)  { b90Ref.current  = true; fireBolts(2) }
      if (pct >= 99 && !b100Ref.current) { b100Ref.current = true; fireBolts(3, true) }

      if (elapsed >= DURATION) {
        if (timerRef.current) clearInterval(timerRef.current)
        setFading(true)
        setTimeout(() => {
          setVisible(false)
          sessionStorage.setItem('hasSeenLoading', '1')
        }, 700)
      }
    }, TICK)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#000000',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'opacity 0.7s cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: fading ? 0 : 1,
        pointerEvents: fading ? 'none' : 'all',
      }}
    >
      {/* Lightning canvas */}
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      />

      {/* Subtle radial glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 60% 40% at 50% 50%, rgba(245,158,11,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Wordmark */}
      <div style={{ marginBottom: '2.5rem', textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: '1.875rem',
          fontWeight: 900,
          letterSpacing: '-0.03em',
          background: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 50%, #d97706 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          lineHeight: 1,
        }}>
          LMC Mining
        </div>
        <div style={{
          fontSize: '0.6rem',
          color: '#374151',
          letterSpacing: '0.2em',
          marginTop: '6px',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          Intelligence Platform
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        width: '220px',
        height: '1.5px',
        background: 'rgba(245,158,11,0.1)',
        borderRadius: '1px',
        marginBottom: '1.25rem',
        overflow: 'visible',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{
          height: '100%',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #d97706, #f59e0b, #fbbf24)',
          borderRadius: '1px',
          transition: 'width 0.06s linear',
          position: 'relative',
        }}>
          <div style={{
            position: 'absolute',
            right: '-1px',
            top: '50%',
            transform: 'translateY(-50%)',
            width: '4px',
            height: '4px',
            borderRadius: '50%',
            background: '#fbbf24',
            boxShadow: '0 0 8px 3px rgba(251,191,36,0.8)',
          }} />
        </div>
      </div>

      {/* Status text */}
      <div style={{
        fontSize: '0.68rem',
        color: '#4b5563',
        letterSpacing: '0.04em',
        fontFamily: "'Courier New', monospace",
        minHeight: '1rem',
        transition: 'opacity 0.3s ease',
        position: 'relative',
        zIndex: 1,
      }}>
        {MESSAGES[msgIdx]}
      </div>
    </div>
  )
}
