'use client'

import { useEffect, useState } from 'react'
import { daysToHalving } from '@/lib/constants'

/**
 * Renders the number of days until the next Bitcoin halving, computed in the
 * browser at mount time. Using client-side state (not a build-time value)
 * guarantees every surface across the site shows the SAME number — the old
 * bug was static pages baking a stale build-day count (e.g. 650) while dynamic
 * pages showed the live count (e.g. 641).
 *
 * Pass `suffix` (default " days") or set it to "" to render the bare number.
 */
export default function HalvingDays({ suffix = ' days' }: { suffix?: string }) {
  // Initialise with a deterministic value for SSR, then correct on the client.
  const [days, setDays] = useState<number | null>(null)

  useEffect(() => {
    setDays(daysToHalving())
  }, [])

  return (
    <span suppressHydrationWarning>
      {days === null ? '—' : days}
      {suffix}
    </span>
  )
}
