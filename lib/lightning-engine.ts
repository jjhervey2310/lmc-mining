// Pure vanilla lightning engine — zero React dependencies.
// React calls init() once; the engine owns its canvas for the entire session.

interface LightningBolt {
  segments: Array<{ x1: number; y1: number; x2: number; y2: number }>
  opacity: number
  birthTime: number
  duration: number
}

class LightningEngine {
  private canvas: HTMLCanvasElement | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private bolts: LightningBolt[] = []
  private animationId: number | null = null
  private isRunning = false
  private stormTimeout: ReturnType<typeof setTimeout> | null = null

  init() {
    if (this.isRunning) return

    // Create a fixed overlay canvas that sits above everything on every page
    this.canvas = document.createElement('canvas')
    this.canvas.style.cssText = [
      'position:fixed',
      'top:0',
      'left:0',
      'width:100%',
      'height:100%',
      'pointer-events:none',
      'z-index:99999',
    ].join(';')
    document.body.appendChild(this.canvas)
    this.ctx = this.canvas.getContext('2d')

    this.resize()
    window.addEventListener('resize', () => this.resize())

    // Global click listener — added once, never removed
    window.addEventListener('click', (e: MouseEvent) => {
      this.fireBoltsAt(e.clientX, e.clientY, 3)
    }, { capture: true, passive: true })

    this.startStorm()

    this.isRunning = true
    this.animate()
  }

  private resize() {
    if (!this.canvas) return
    this.canvas.width = window.innerWidth
    this.canvas.height = window.innerHeight
  }

  fireBoltsAt(x: number, y: number, count = 3) {
    for (let i = 0; i < count; i++) {
      const startX = Math.random() * window.innerWidth
      const startY = -50 - Math.random() * 100
      this.bolts.push(this.generateBolt(startX, startY, x, y, 6))
    }
  }

  private generateBolt(
    x1: number, y1: number,
    x2: number, y2: number,
    depth: number,
  ): LightningBolt {
    const segments: LightningBolt['segments'] = []
    this.buildSegments(x1, y1, x2, y2, depth, 0.4, segments)
    return {
      segments,
      opacity: 1.0,
      birthTime: Date.now(),
      duration: 500 + Math.random() * 200,
    }
  }

  private buildSegments(
    x1: number, y1: number,
    x2: number, y2: number,
    depth: number,
    displacement: number,
    out: LightningBolt['segments'],
  ) {
    if (depth === 0) {
      out.push({ x1, y1, x2, y2 })
      return
    }
    const midX = (x1 + x2) / 2 + (Math.random() - 0.5) * displacement * 200
    const midY = (y1 + y2) / 2 + (Math.random() - 0.5) * displacement * 100
    this.buildSegments(x1, y1, midX, midY, depth - 1, displacement * 0.5, out)
    this.buildSegments(midX, midY, x2, y2, depth - 1, displacement * 0.5, out)
    if (Math.random() < 0.3 && depth > 2) {
      const bx = midX + (Math.random() - 0.5) * 300
      const by = midY + Math.random() * 200
      this.buildSegments(midX, midY, bx, by, depth - 2, displacement * 0.4, out)
    }
  }

  private startStorm() {
    const fire = () => {
      if (!this.isRunning) return
      const W = window.innerWidth
      const H = window.innerHeight
      const sx = Math.random() * W
      const ex = sx + (Math.random() - 0.5) * 400
      const ey = H * (0.3 + Math.random() * 0.7)
      const bolt = this.generateBolt(sx, -50, ex, ey, 5)
      bolt.duration = 400
      this.bolts.push(bolt)
      this.stormTimeout = setTimeout(fire, 300 + Math.random() * 700)
    }
    fire()
  }

  private animate() {
    if (!this.ctx || !this.canvas) return
    const now = Date.now()
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height)

    this.bolts = this.bolts.filter(bolt => {
      const age = now - bolt.birthTime
      if (age >= bolt.duration) return false
      bolt.opacity = 1 - age / bolt.duration
      this.renderBolt(bolt)
      return true
    })

    this.animationId = requestAnimationFrame(() => this.animate())
  }

  private renderBolt(bolt: LightningBolt) {
    if (!this.ctx) return
    const ctx = this.ctx
    for (const seg of bolt.segments) {
      // Outer atmospheric glow
      ctx.beginPath()
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.strokeStyle = `rgba(180,200,255,${(bolt.opacity * 0.15).toFixed(3)})`
      ctx.lineWidth = 20
      ctx.lineCap = 'round'
      ctx.stroke()

      // Mid glow
      ctx.beginPath()
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.strokeStyle = `rgba(200,220,255,${(bolt.opacity * 0.3).toFixed(3)})`
      ctx.lineWidth = 8
      ctx.stroke()

      // Core
      ctx.beginPath()
      ctx.moveTo(seg.x1, seg.y1)
      ctx.lineTo(seg.x2, seg.y2)
      ctx.strokeStyle = `rgba(230,240,255,${bolt.opacity.toFixed(3)})`
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  destroy() {
    if (this.animationId !== null) cancelAnimationFrame(this.animationId)
    if (this.stormTimeout !== null) clearTimeout(this.stormTimeout)
    if (this.canvas && document.body.contains(this.canvas)) {
      document.body.removeChild(this.canvas)
    }
    this.isRunning = false
    this.canvas = null
    this.ctx = null
    this.bolts = []
    this.animationId = null
    this.stormTimeout = null
  }
}

// Module singleton — created once, persists for the entire browser session
export const lightningEngine = new LightningEngine()
