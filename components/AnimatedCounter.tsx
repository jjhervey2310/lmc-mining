'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimatedCounterProps {
  end: number
  duration?: number
  delay?: number
  prefix?: string
  suffix?: string
  decimals?: number
}

export default function AnimatedCounter({
  end,
  duration = 1500,
  delay = 0,
  prefix = '',
  suffix = '',
  decimals = 0,
}: AnimatedCounterProps) {
  const [value, setValue] = useState(0)
  const startRef = useRef<number | null>(null)
  const rafRef = useRef<number>(0)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    startRef.current = null
    setValue(0)

    const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t))

    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts
      const progress = Math.min((ts - startRef.current) / duration, 1)
      setValue(parseFloat((easeOutExpo(progress) * end).toFixed(decimals)))
      if (progress < 1) rafRef.current = requestAnimationFrame(animate)
    }

    timerRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(animate)
    }, delay)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      cancelAnimationFrame(rafRef.current)
    }
  }, [end, duration, delay, decimals])

  const formatted = decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString()
  return <>{prefix}{formatted}{suffix}</>
}
