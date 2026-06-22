'use client'

import { useEffect, useRef } from 'react'

const CHARS = '0123456789abcdef'
const CHAR_H = 16
const DRIFT_SPEED = 0.4

export default function HashMatrix() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      if (!canvas) return
      canvas.width = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
    }
    resize()

    const COLS = 20
    const rows = Math.ceil(canvas.height / CHAR_H) + 2
    const colWidth = canvas.width / COLS

    // Per-column state
    const chars = Array.from({ length: COLS }, () =>
      Array.from({ length: rows }, () => CHARS[Math.floor(Math.random() * CHARS.length)])
    )
    const offsets = Array.from({ length: COLS }, () => Math.random() * canvas.height)
    // Per-column brightness phases for shimmer
    const phases = Array.from({ length: COLS }, () => Math.random() * Math.PI * 2)

    // Update random chars every 500ms
    const charInterval = setInterval(() => {
      for (let col = 0; col < COLS; col++) {
        const row = Math.floor(Math.random() * rows)
        chars[col][row] = CHARS[Math.floor(Math.random() * CHARS.length)]
      }
    }, 500)

    let animId: number
    let frame = 0

    function draw() {
      if (!ctx || !canvas) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.font = `bold ${CHAR_H - 2}px 'Courier New', monospace`
      ctx.textAlign = 'center'

      for (let col = 0; col < COLS; col++) {
        const x = (col + 0.5) * colWidth
        offsets[col] = (offsets[col] + DRIFT_SPEED) % canvas.height
        const shimmer = (Math.sin(frame * 0.02 + phases[col]) + 1) / 2

        for (let row = 0; row < rows; row++) {
          const y = ((offsets[col] + row * CHAR_H) % canvas.height)
          // Fade toward bottom
          const distFromBottom = canvas.height - y
          const alpha = Math.min(distFromBottom / canvas.height, 1) * (0.15 + shimmer * 0.08)
          ctx.fillStyle = `rgba(245,158,11,${alpha.toFixed(3)})`
          ctx.fillText(chars[col][row], x, y)
        }
      }

      frame++
      animId = requestAnimationFrame(draw)
    }

    draw()

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      cancelAnimationFrame(animId)
      clearInterval(charInterval)
      ro.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none"
      aria-hidden="true"
    />
  )
}
