'use client'

// Interactive drawing overlay for the terminal chart.
//
// A transparent canvas sits exactly over the chart's main pane and renders
// every drawing on each visible-range change, so shapes stay welded to their
// bars while the user pans and zooms.
//
// Pointer events pass straight through to the chart in 'cursor' mode — that
// keeps native pan/zoom/crosshair behaviour intact — and are captured only
// while a drawing tool or 'select' is active.

import { useCallback, useEffect, useRef, useState } from 'react'
import type { IChartApi, ISeriesApi, Logical, SeriesType } from 'lightweight-charts'
import type { Candle } from '@/lib/chart/types'
import {
  FIB_LEVELS,
  FIB_LEVEL_COLORS,
  HIT_TOLERANCE,
  anchorCount,
  formatFibLevel,
  hitTest,
  logicalToTime,
  newDrawingId,
  snapToBar,
  timeToLogical,
  type Anchor,
  type Drawing,
  type DrawingTool,
  type Pt,
  type ShapeTool,
} from '@/lib/chart/drawings'

interface Props {
  chart: IChartApi | null
  series: ISeriesApi<SeriesType> | null
  candles: Candle[]
  tool: DrawingTool
  drawings: Drawing[]
  onChange: (drawings: Drawing[]) => void
  selectedId: string | null
  onSelect: (id: string | null) => void
  /** Called once a shape is committed, so the toolbar can drop back to Pan. */
  onCommit: () => void
  color: string
  priceFormatter: (price: number) => string
}

type DragMode =
  | { kind: 'none' }
  | { kind: 'draw'; tool: ShapeTool; anchors: Anchor[] }
  | { kind: 'move'; id: string; origin: Anchor[]; from: Anchor }
  | { kind: 'handle'; id: string; index: number }

export default function DrawingCanvas({
  chart, series, candles, tool, drawings, onChange,
  selectedId, onSelect, onCommit, color, priceFormatter,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const dragRef = useRef<DragMode>({ kind: 'none' })
  /** Pointer position as a chart anchor, for the in-progress shape preview. */
  const previewRef = useRef<Anchor | null>(null)

  // Latest values for the imperative redraw loop, which is driven by chart
  // subscriptions and pointer handlers rather than by React renders. Written
  // in an effect (not during render) so concurrent rendering can't observe a
  // ref mutated by a render that was later discarded. This effect is declared
  // before the redraw effects, so React's in-order execution guarantees the
  // ref is current by the time they run.
  const stateRef = useRef({ drawings, selectedId, candles, tool, color })
  useEffect(() => {
    stateRef.current = { drawings, selectedId, candles, tool, color }
  })

  const active = tool !== 'cursor'

  // ── Coordinate conversion ─────────────────────────────────────────────

  const toX = useCallback((time: number): number | null => {
    if (!chart || !stateRef.current.candles.length) return null
    const logical = timeToLogical(stateRef.current.candles, time)
    return chart.timeScale().logicalToCoordinate(logical as Logical)
  }, [chart])

  const toY = useCallback((price: number): number | null => {
    return series ? series.priceToCoordinate(price) : null
  }, [series])

  const fromPointer = useCallback((clientX: number, clientY: number): Anchor | null => {
    const canvas = canvasRef.current
    if (!canvas || !chart || !series) return null
    const rect = canvas.getBoundingClientRect()
    const x = clientX - rect.left
    const y = clientY - rect.top
    const logical = chart.timeScale().coordinateToLogical(x)
    const price = series.coordinateToPrice(y)
    if (logical === null || price === null) return null
    return { time: logicalToTime(stateRef.current.candles, logical), price: price as number }
  }, [chart, series])

  const localPoint = useCallback((clientX: number, clientY: number): Pt | null => {
    const canvas = canvasRef.current
    if (!canvas) return null
    const rect = canvas.getBoundingClientRect()
    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  /** Projects a drawing's anchors into pixel space; null if any fall off. */
  const project = useCallback((anchors: Anchor[]): Pt[] | null => {
    const pts: Pt[] = []
    for (const a of anchors) {
      const x = toX(a.time)
      const y = toY(a.price)
      if (x === null || y === null) return null
      pts.push({ x, y })
    }
    return pts
  }, [toX, toY])

  // ── Rendering ─────────────────────────────────────────────────────────

  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const { width, height } = canvas.getBoundingClientRect()
    if (width <= 0 || height <= 0) return

    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const { drawings: list, selectedId: sel } = stateRef.current
    for (const d of list) {
      const pts = project(d.anchors)
      if (pts) drawShape(ctx, d.tool, pts, d.color, d.id === sel, width, priceFormatter, d.anchors)
    }

    // Live preview of the shape being dragged out. The pointer is resolved to
    // a real (time, price) anchor rather than a raw pixel, so preview labels
    // — the Fibonacci level prices especially — read correctly mid-drag.
    const drag = dragRef.current
    const preview = previewRef.current
    if (drag.kind === 'draw' && preview) {
      const anchors = [drag.anchors[0], preview]
      const pts = project(anchors)
      if (pts) {
        ctx.globalAlpha = 0.85
        drawShape(ctx, drag.tool, pts, stateRef.current.color, false, width, priceFormatter, anchors)
        ctx.globalAlpha = 1
      }
    }
  }, [project, priceFormatter])

  // ── Wire redraw to chart movement and resize ──────────────────────────

  useEffect(() => {
    if (!chart) return
    const handler = () => redraw()
    chart.timeScale().subscribeVisibleLogicalRangeChange(handler)
    return () => chart.timeScale().unsubscribeVisibleLogicalRangeChange(handler)
  }, [chart, redraw])

  useEffect(() => {
    redraw()
  }, [redraw, drawings, selectedId, size, candles])

  // Track the main pane's box so the overlay lines up with plot coordinates
  // (which exclude the price axis and the time axis).
  useEffect(() => {
    if (!chart) return
    let raf = 0
    const measure = () => {
      try {
        const pane = chart.paneSize(0)
        setSize((prev) =>
          prev.width === pane.width && prev.height === pane.height ? prev : { width: pane.width, height: pane.height },
        )
      } catch {
        // Chart disposed mid-frame.
      }
      raf = window.requestAnimationFrame(measure)
    }
    raf = window.requestAnimationFrame(measure)
    return () => window.cancelAnimationFrame(raf)
  }, [chart])

  // ── Pointer interaction ───────────────────────────────────────────────

  const findAt = useCallback((p: Pt): Drawing | null => {
    const { drawings: list } = stateRef.current
    // Topmost first, matching paint order.
    for (let i = list.length - 1; i >= 0; i--) {
      const pts = project(list[i].anchors)
      if (pts && hitTest(list[i].tool, pts, p, size.width)) return list[i]
    }
    return null
  }, [project, size.width])

  const handlesFor = useCallback((d: Drawing): Pt[] => project(d.anchors) ?? [], [project])

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    const p = localPoint(e.clientX, e.clientY)
    const anchor = fromPointer(e.clientX, e.clientY)
    if (!p || !anchor) return
    e.currentTarget.setPointerCapture(e.pointerId)

    if (tool === 'select') {
      // An endpoint handle on the selected shape wins over selecting another.
      const selected = stateRef.current.drawings.find((d) => d.id === stateRef.current.selectedId)
      if (selected) {
        const handles = handlesFor(selected)
        const idx = handles.findIndex((h) => Math.hypot(h.x - p.x, h.y - p.y) <= HIT_TOLERANCE + 2)
        if (idx >= 0) {
          dragRef.current = { kind: 'handle', id: selected.id, index: idx }
          return
        }
      }
      const hit = findAt(p)
      onSelect(hit?.id ?? null)
      if (hit) dragRef.current = { kind: 'move', id: hit.id, origin: hit.anchors.map((a) => ({ ...a })), from: anchor }
      return
    }

    // A shape tool: begin a new drawing.
    const shapeTool = tool as ShapeTool
    const snapped: Anchor = { time: snapToBar(stateRef.current.candles, timeToLogical(stateRef.current.candles, anchor.time)), price: anchor.price }
    if (anchorCount(shapeTool) === 1) {
      commit({ id: newDrawingId(), tool: shapeTool, anchors: [snapped], color: stateRef.current.color })
      return
    }
    dragRef.current = { kind: 'draw', tool: shapeTool, anchors: [snapped] }
    previewRef.current = snapped
  }

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    const p = localPoint(e.clientX, e.clientY)
    if (!p) return

    const drag = dragRef.current
    if (drag.kind === 'draw') {
      previewRef.current = fromPointer(e.clientX, e.clientY)
      redraw()
      return
    }
    if (drag.kind === 'move') {
      const anchor = fromPointer(e.clientX, e.clientY)
      if (!anchor) return
      const dt = anchor.time - drag.from.time
      const dp = anchor.price - drag.from.price
      update(drag.id, drag.origin.map((a) => ({ time: a.time + dt, price: a.price + dp })))
      return
    }
    if (drag.kind === 'handle') {
      const anchor = fromPointer(e.clientX, e.clientY)
      if (!anchor) return
      const target = stateRef.current.drawings.find((d) => d.id === drag.id)
      if (!target) return
      const next = target.anchors.map((a, i) => (i === drag.index ? anchor : a))
      update(drag.id, next)
      return
    }

    // Idle in select mode: hint that a shape is grabbable.
    if (tool === 'select') {
      const canvas = canvasRef.current
      if (canvas) canvas.style.cursor = findAt(p) ? 'move' : 'default'
    }
  }

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!active) return
    const drag = dragRef.current
    dragRef.current = { kind: 'none' }
    previewRef.current = null

    if (drag.kind === 'draw') {
      const anchor = fromPointer(e.clientX, e.clientY)
      if (!anchor) { redraw(); return }
      const snapped: Anchor = {
        time: snapToBar(stateRef.current.candles, timeToLogical(stateRef.current.candles, anchor.time)),
        price: anchor.price,
      }
      // A click without a drag is not a shape — discard rather than commit a
      // zero-length line the user then has to hunt down and delete.
      const start = drag.anchors[0]
      const pStart = project([start])?.[0]
      const pEnd = localPoint(e.clientX, e.clientY)
      if (pStart && pEnd && Math.hypot(pEnd.x - pStart.x, pEnd.y - pStart.y) < 4) { redraw(); return }
      commit({ id: newDrawingId(), tool: drag.tool, anchors: [start, snapped], color: stateRef.current.color })
    }
  }

  function commit(d: Drawing) {
    onChange([...stateRef.current.drawings, d])
    onSelect(d.id)
    onCommit()
  }

  function update(id: string, anchors: Anchor[]) {
    onChange(stateRef.current.drawings.map((d) => (d.id === id ? { ...d, anchors } : d)))
  }

  // Delete/Backspace removes the selection, unless focus is in a form field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const el = document.activeElement
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) return
      const sel = stateRef.current.selectedId
      if (!sel) return
      e.preventDefault()
      onChange(stateRef.current.drawings.filter((d) => d.id !== sel))
      onSelect(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onChange, onSelect])

  // z-10: the engine layers its own canvases at z-index 1 and 2, so the
  // overlay must sit explicitly above them or it never receives a pointer.
  return (
    <canvas
      ref={canvasRef}
      className="absolute left-0 top-0 z-10"
      style={{
        width: size.width ? `${size.width}px` : '100%',
        height: size.height ? `${size.height}px` : '100%',
        pointerEvents: active ? 'auto' : 'none',
        cursor: tool === 'select' ? 'default' : active ? 'crosshair' : 'default',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    />
  )
}

// ── Shape painting ──────────────────────────────────────────────────────

function drawShape(
  ctx: CanvasRenderingContext2D,
  tool: ShapeTool,
  pts: Pt[],
  color: string,
  selected: boolean,
  plotWidth: number,
  fmt: (v: number) => string,
  anchors: Anchor[],
) {
  ctx.save()
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = selected ? 2.5 : 1.6
  ctx.lineCap = 'round'
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, monospace'

  switch (tool) {
    case 'horizontal': {
      const y = pts[0].y
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(plotWidth, y)
      ctx.stroke()
      if (anchors[0]) label(ctx, fmt(anchors[0].price), plotWidth - 4, y - 4, color, 'right')
      break
    }

    case 'trendline': {
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      ctx.lineTo(pts[1].x, pts[1].y)
      ctx.stroke()
      break
    }

    case 'ray': {
      // Extend past the second anchor to the edge of the plot.
      const dx = pts[1].x - pts[0].x
      const dy = pts[1].y - pts[0].y
      const scale = dx === 0 ? 1e4 : Math.max(1, (plotWidth * 2) / Math.abs(dx))
      ctx.beginPath()
      ctx.moveTo(pts[0].x, pts[0].y)
      ctx.lineTo(pts[0].x + dx * scale, pts[0].y + dy * scale)
      ctx.stroke()
      break
    }

    case 'rect': {
      const x = Math.min(pts[0].x, pts[1].x)
      const y = Math.min(pts[0].y, pts[1].y)
      const w = Math.abs(pts[1].x - pts[0].x)
      const h = Math.abs(pts[1].y - pts[0].y)
      ctx.globalAlpha *= 0.12
      ctx.fillRect(x, y, w, h)
      ctx.globalAlpha = selected ? 1 : 0.85
      ctx.strokeRect(x, y, w, h)
      break
    }

    case 'fib': {
      const [a, b] = pts
      const left = Math.min(a.x, b.x)
      const span = b.y - a.y

      // Shade the bands between consecutive retracement levels.
      for (let i = 0; i < FIB_LEVELS.length - 1; i++) {
        const l1 = FIB_LEVELS[i]
        const l2 = FIB_LEVELS[i + 1]
        if (l1 > 1) break
        const y1 = a.y + span * l1
        const y2 = a.y + span * l2
        ctx.globalAlpha = 0.06
        ctx.fillStyle = FIB_LEVEL_COLORS[l1] ?? color
        ctx.fillRect(left, Math.min(y1, y2), plotWidth - left, Math.abs(y2 - y1))
      }
      ctx.globalAlpha = selected ? 1 : 0.9

      for (const level of FIB_LEVELS) {
        const y = a.y + span * level
        const lc = FIB_LEVEL_COLORS[level] ?? color
        ctx.strokeStyle = lc
        ctx.lineWidth = level === 0.618 ? 2 : 1.2
        ctx.setLineDash(level > 1 ? [4, 4] : [])
        ctx.beginPath()
        ctx.moveTo(left, y)
        ctx.lineTo(plotWidth, y)
        ctx.stroke()

        // Price at each level, which is the number traders actually want.
        const price = anchors.length === 2
          ? anchors[0].price + (anchors[1].price - anchors[0].price) * level
          : null
        const text = price === null || !Number.isFinite(price)
          ? formatFibLevel(level)
          : `${formatFibLevel(level)}  ${fmt(price)}`
        label(ctx, text, left + 4, y - 3, lc, 'left')
      }
      ctx.setLineDash([])

      // The anchor leg itself.
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      ctx.setLineDash([2, 3])
      ctx.beginPath()
      ctx.moveTo(a.x, a.y)
      ctx.lineTo(b.x, b.y)
      ctx.stroke()
      ctx.setLineDash([])
      break
    }
  }

  if (selected) {
    ctx.fillStyle = color
    for (const p of pts) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.strokeStyle = '#0a0a0a'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  ctx.restore()
}

function label(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  color: string,
  align: CanvasTextAlign,
) {
  ctx.save()
  ctx.textAlign = align
  ctx.textBaseline = 'bottom'
  const w = ctx.measureText(text).width
  const bx = align === 'right' ? x - w - 4 : x - 2
  ctx.globalAlpha = 0.75
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(bx, y - 11, w + 6, 13)
  ctx.globalAlpha = 1
  ctx.fillStyle = color
  ctx.fillText(text, x, y)
  ctx.restore()
}
