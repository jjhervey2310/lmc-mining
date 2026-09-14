// The drawing-tool model: geometry, hit-testing, and persistence.
//
// Anchors are stored in CHART space (a bar time and a price), never in pixels,
// so a drawing stays pinned to the bars it was drawn against as the user pans,
// zooms, or switches timeframe.
//
// Rendering converts time -> logical bar index -> x. Going via the logical
// index rather than calling timeToCoordinate directly matters: timeToCoordinate
// only resolves times that exist in the loaded series, so a trendline with an
// endpoint scrolled off-screen — or projected past the last bar, which is the
// whole point of a ray — would fail to draw.

import type { Candle } from './types'

export type DrawingTool =
  | 'cursor'
  | 'select'
  | 'trendline'
  | 'horizontal'
  | 'ray'
  | 'rect'
  | 'fib'

/** Tools that create a drawing (i.e. everything but the navigation modes). */
export type ShapeTool = Exclude<DrawingTool, 'cursor' | 'select'>

export interface Anchor {
  /** UTC seconds, snapped to a bar. */
  time: number
  price: number
}

export interface Drawing {
  id: string
  tool: ShapeTool
  anchors: Anchor[]
  color: string
}

export const DRAWING_COLORS = ['#f7931a', '#22d3ee', '#a78bfa', '#34d399', '#f87171', '#e5e7eb']

/** Fibonacci retracement levels, plus the two common extensions. */
export const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1, 1.272, 1.618]

/** Per-level tint — the golden ratio band is the one traders look for. */
export const FIB_LEVEL_COLORS: Record<number, string> = {
  0: '#9ca3af',
  0.236: '#60a5fa',
  0.382: '#34d399',
  0.5: '#fbbf24',
  0.618: '#f7931a',
  0.786: '#fb7185',
  1: '#9ca3af',
  1.272: '#a78bfa',
  1.618: '#a78bfa',
}

export function formatFibLevel(level: number): string {
  return level === 0 || level === 1 ? level.toFixed(0) : level.toFixed(3)
}

/** How many anchors a tool needs before it is complete. */
export function anchorCount(tool: ShapeTool): number {
  return tool === 'horizontal' ? 1 : 2
}

export const TOOL_LABELS: Record<DrawingTool, string> = {
  cursor: 'Pan',
  select: 'Select',
  trendline: 'Trend line',
  horizontal: 'Horizontal line',
  ray: 'Ray',
  rect: 'Rectangle',
  fib: 'Fibonacci retracement',
}

// ── Time <-> logical index ──────────────────────────────────────────────

/**
 * Fractional bar index for a time. Interpolates between bars and extrapolates
 * beyond the series using the median bar duration, so drawings anchored to
 * gaps (weekends, halts) or projected into the future still resolve.
 */
export function timeToLogical(candles: Candle[], time: number): number {
  const n = candles.length
  if (n === 0) return 0
  if (n === 1) return 0

  if (time <= candles[0].time) {
    const step = candles[1].time - candles[0].time
    return step > 0 ? (time - candles[0].time) / step : 0
  }
  const last = candles[n - 1]
  if (time >= last.time) {
    const step = last.time - candles[n - 2].time
    return step > 0 ? n - 1 + (time - last.time) / step : n - 1
  }

  let lo = 0
  let hi = n - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (candles[mid].time <= time) lo = mid
    else hi = mid
  }
  const span = candles[hi].time - candles[lo].time
  return span > 0 ? lo + (time - candles[lo].time) / span : lo
}

/** Inverse of timeToLogical: the bar time at a fractional index. */
export function logicalToTime(candles: Candle[], logical: number): number {
  const n = candles.length
  if (n === 0) return 0
  if (n === 1) return candles[0].time

  if (logical <= 0) {
    const step = candles[1].time - candles[0].time
    return Math.round(candles[0].time + logical * step)
  }
  if (logical >= n - 1) {
    const step = candles[n - 1].time - candles[n - 2].time
    return Math.round(candles[n - 1].time + (logical - (n - 1)) * step)
  }

  const lo = Math.floor(logical)
  const frac = logical - lo
  return Math.round(candles[lo].time + frac * (candles[lo + 1].time - candles[lo].time))
}

/** Nearest real bar time — drawings snap to bars, as they do in TradingView. */
export function snapToBar(candles: Candle[], logical: number): number {
  if (!candles.length) return 0
  const i = Math.min(candles.length - 1, Math.max(0, Math.round(logical)))
  // Past the last bar, keep the projected time so rays can extend forward.
  if (logical > candles.length - 1) return logicalToTime(candles, logical)
  return candles[i].time
}

// ── Geometry ────────────────────────────────────────────────────────────

export interface Pt {
  x: number
  y: number
}

/** Shortest distance from a point to a finite segment. */
export function distanceToSegment(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Distance to a ray that starts at `a`, passes through `b`, and continues. */
export function distanceToRay(p: Pt, a: Pt, b: Pt): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lenSq = dx * dx + dy * dy
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq)
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

export const HIT_TOLERANCE = 7

/**
 * Whether a pointer at `p` is touching the drawing whose anchors project to
 * `pts`. Fib and rectangle are tested on their edges and level lines rather
 * than their fill, so a large shape doesn't swallow every click inside it.
 */
export function hitTest(tool: ShapeTool, pts: Pt[], p: Pt, plotWidth: number): boolean {
  if (!pts.length) return false

  switch (tool) {
    case 'horizontal':
      return Math.abs(p.y - pts[0].y) <= HIT_TOLERANCE

    case 'trendline':
      return pts.length > 1 && distanceToSegment(p, pts[0], pts[1]) <= HIT_TOLERANCE

    case 'ray':
      return pts.length > 1 && distanceToRay(p, pts[0], pts[1]) <= HIT_TOLERANCE

    case 'rect': {
      if (pts.length < 2) return false
      const x1 = Math.min(pts[0].x, pts[1].x)
      const x2 = Math.max(pts[0].x, pts[1].x)
      const y1 = Math.min(pts[0].y, pts[1].y)
      const y2 = Math.max(pts[0].y, pts[1].y)
      const nearV = (p.y >= y1 - HIT_TOLERANCE && p.y <= y2 + HIT_TOLERANCE)
      const nearH = (p.x >= x1 - HIT_TOLERANCE && p.x <= x2 + HIT_TOLERANCE)
      return (
        (nearV && (Math.abs(p.x - x1) <= HIT_TOLERANCE || Math.abs(p.x - x2) <= HIT_TOLERANCE)) ||
        (nearH && (Math.abs(p.y - y1) <= HIT_TOLERANCE || Math.abs(p.y - y2) <= HIT_TOLERANCE))
      )
    }

    case 'fib': {
      if (pts.length < 2) return false
      const left = Math.min(pts[0].x, pts[1].x)
      // The level lines run to the right edge of the plot.
      if (p.x < left - HIT_TOLERANCE || p.x > plotWidth + HIT_TOLERANCE) return false
      return FIB_LEVELS.some((level) => {
        const y = pts[0].y + (pts[1].y - pts[0].y) * level
        return Math.abs(p.y - y) <= HIT_TOLERANCE
      })
    }

    default:
      return false
  }
}

// ── Persistence ─────────────────────────────────────────────────────────

const STORAGE_PREFIX = 'lm-terminal-drawings:'

function storageKey(symbolId: string): string {
  return `${STORAGE_PREFIX}${symbolId}`
}

export function loadDrawings(symbolId: string): Drawing[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(storageKey(symbolId))
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    // Hand-edited or stale storage shouldn't crash the chart.
    return parsed.filter(
      (d): d is Drawing =>
        d && typeof d.id === 'string' && typeof d.tool === 'string' &&
        Array.isArray(d.anchors) &&
        d.anchors.every((a: Anchor) => Number.isFinite(a?.time) && Number.isFinite(a?.price)),
    )
  } catch {
    return []
  }
}

export function saveDrawings(symbolId: string, drawings: Drawing[]): void {
  if (typeof window === 'undefined') return
  try {
    if (drawings.length) {
      window.localStorage.setItem(storageKey(symbolId), JSON.stringify(drawings))
    } else {
      window.localStorage.removeItem(storageKey(symbolId))
    }
  } catch {
    // Private mode or a full quota — drawings stay in memory for the session.
  }
}

export function newDrawingId(): string {
  return `d${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}
