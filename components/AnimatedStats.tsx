'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { daysToHalving } from '@/lib/constants'

gsap.registerPlugin(ScrollTrigger)

const DAYS_TO_HALVING = daysToHalving()
const MINERS_IN_DB = 22

interface Props {
  btcLive: number | null
}

function animateCounter(
  el: HTMLElement,
  target: number,
  format: (n: number) => string,
  duration = 1.8,
) {
  const obj = { val: 0 }
  gsap.to(obj, {
    val: target,
    duration,
    ease: 'power2.out',
    onUpdate() {
      el.textContent = format(obj.val)
    },
  })
}

export default function AnimatedStats({ btcLive }: Props) {
  const sectionRef  = useRef<HTMLDivElement>(null)
  const btcRef      = useRef<HTMLSpanElement>(null)
  const hashRef     = useRef<HTMLSpanElement>(null)
  const halvRef     = useRef<HTMLSpanElement>(null)
  const minerRef    = useRef<HTMLSpanElement>(null)
  const hasEntered  = useRef(false)
  const btcDone     = useRef(false)
  const btcLiveRef  = useRef(btcLive)

  // Keep ref in sync so ScrollTrigger closure always reads latest value
  useEffect(() => { btcLiveRef.current = btcLive }, [btcLive])

  // Section reveal + non-BTC counters — created once on mount
  useEffect(() => {
    if (!sectionRef.current) return

    ScrollTrigger.create({
      trigger: sectionRef.current,
      start: 'top 80%',
      once: true,
      onEnter() {
        hasEntered.current = true

        gsap.from(sectionRef.current!, {
          opacity: 0,
          y: 40,
          duration: 0.7,
          ease: 'power2.out',
        })

        if (hashRef.current)  animateCounter(hashRef.current, 690, n => `${Math.round(n)} EH/s`)
        if (halvRef.current)  animateCounter(halvRef.current, DAYS_TO_HALVING, n => `${Math.round(n)}`)
        if (minerRef.current) animateCounter(minerRef.current, MINERS_IN_DB, n => `${Math.round(n)}`, 1.2)

        // If BTC price is already available, run counter now
        if (btcRef.current && btcLiveRef.current && !btcDone.current) {
          btcDone.current = true
          animateCounter(btcRef.current, btcLiveRef.current, n => `$${Math.round(n).toLocaleString()}`)
        }
      },
    })
  }, [])

  // BTC counter — fires when live price arrives after section has entered
  useEffect(() => {
    if (!btcLive || !hasEntered.current || btcDone.current) return
    btcDone.current = true
    if (btcRef.current) {
      animateCounter(btcRef.current, btcLive, n => `$${Math.round(n).toLocaleString()}`)
    }
  }, [btcLive])

  const STATS = [
    {
      ref: btcRef,
      label: 'Bitcoin Price',
      sublabel: 'Live from CoinGecko · Updates every 60s',
      init: btcLive ? `$${btcLive.toLocaleString()}` : 'Loading...',
    },
    {
      ref: hashRef,
      label: 'Network Hashrate',
      sublabel: 'Estimated live',
      init: '— EH/s',
    },
    {
      ref: halvRef,
      label: 'Days to Next Halving',
      sublabel: 'April 2028 · Block reward halves again',
      init: `${DAYS_TO_HALVING}`,
    },
    {
      ref: minerRef,
      label: 'Miners Analysed',
      sublabel: 'Real specs · No marketing claims',
      init: `${MINERS_IN_DB}`,
    },
  ]

  return (
    <section
      ref={sectionRef}
      className="relative overflow-hidden"
      style={{ background: '#050810', borderTop: '1px solid #0d1421', borderBottom: '1px solid #0d1421' }}
    >
      {/* Gold radial glow */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'radial-gradient(ellipse 70% 120% at 50% 50%, rgba(245,158,11,0.04) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div className="max-w-6xl mx-auto px-4 py-16 relative">
        <div className="grid grid-cols-2 md:grid-cols-4">
          {STATS.map((s, i) => (
            <div key={s.label} className="relative text-center px-6 py-4">
              {/* Vertical divider */}
              {i > 0 && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 hidden md:block"
                  style={{ width: '1px', height: '3rem', background: 'linear-gradient(to bottom, transparent, rgba(245,158,11,0.3), transparent)' }}
                />
              )}
              <div className="text-3xl md:text-4xl font-black font-mono mb-2" style={{ color: '#f59e0b', letterSpacing: '-0.02em' }}>
                <span ref={s.ref}>{s.init}</span>
              </div>
              <div className="text-sm font-semibold text-white mb-1">{s.label}</div>
              <div className="text-xs" style={{ color: '#374151' }}>{s.sublabel}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
