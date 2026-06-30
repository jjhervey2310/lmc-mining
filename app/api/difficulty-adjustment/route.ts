import { NextResponse } from 'next/server'

interface DiffAdj {
  progressPercent: number
  difficultyChange: number
  remainingBlocks: number
  remainingTime: number
  nextRetargetHeight: number
  timeAvg: number
  adjustedTimeAvg: number
  previousRetarget: number
  estimatedRetargetDate: number
  expectedBlocks: number
}

let cached: { data: DiffAdj; timestamp: number } | null = null
const CACHE_MS = 5 * 60 * 1000

export async function GET() {
  const now = Date.now()
  if (cached && now - cached.timestamp < CACHE_MS) {
    return NextResponse.json({ ...cached.data, cached: true })
  }
  try {
    const res = await fetch('https://mempool.space/api/v1/difficulty-adjustment', {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
    if (!res.ok) throw new Error(`upstream ${res.status}`)
    const data: DiffAdj = await res.json()
    cached = { data, timestamp: now }
    return NextResponse.json({ ...data, cached: false })
  } catch {
    if (cached) return NextResponse.json({ ...cached.data, cached: true, stale: true })
    return NextResponse.json({ error: 'Difficulty data unavailable' }, { status: 503 })
  }
}

export const dynamic = 'force-dynamic'
