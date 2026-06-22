'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

const DIFFICULTY   = 113_757_508_517_000
const BLOCK_REWARD = 3.125

function dailyBTC(hashrate: number) {
  return (hashrate * 1e12 * 86400 * BLOCK_REWARD) / (DIFFICULTY * Math.pow(2, 32))
}

const SHOWCASE_MINERS = [
  { slug: 'antminer-s21-xp',    name: 'Antminer S21 XP',   hashrate: 270, efficiency: 13.5, badge: 'MOST EFFICIENT', color: '#f59e0b' },
  { slug: 'antminer-s21-pro',   name: 'Antminer S21 Pro',  hashrate: 234, efficiency: 15.0, badge: 'BEST VALUE',      color: '#00d4aa' },
  { slug: 'antminer-s21',       name: 'Antminer S21',      hashrate: 200, efficiency: 17.5, badge: null,              color: '#9ca3af' },
  { slug: 'antminer-s19-xp',    name: 'Antminer S19 XP',   hashrate: 140, efficiency: 21.5, badge: null,              color: '#9ca3af' },
  { slug: 'whatsminer-m60s',    name: 'Whatsminer M60S',   hashrate: 170, efficiency: 20.0, badge: null,              color: '#9ca3af' },
  { slug: 'whatsminer-m50s',    name: 'Whatsminer M50S',   hashrate: 126, efficiency: 26.0, badge: null,              color: '#9ca3af' },
]

// Geometric ASIC icon in gold
function MinerIcon({ color }: { color: string }) {
  return (
    <svg width="80" height="48" viewBox="0 0 80 48" fill="none" style={{ opacity: 0.9 }}>
      {/* Chassis */}
      <rect x="2" y="8" width="76" height="32" rx="3" fill="#111111" stroke={color} strokeWidth="1.2" />
      {/* LED grid 4×8 */}
      {Array.from({ length: 4 }, (_, row) =>
        Array.from({ length: 8 }, (_, col) => (
          <circle
            key={`${row}-${col}`}
            cx={12 + col * 8}
            cy={17 + row * 5.5}
            r="1.5"
            fill={color}
            opacity={Math.random() > 0.4 ? 0.9 : 0.2}
          />
        ))
      )}
      {/* Left fan */}
      <circle cx="6"  cy="24" r="4.5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6" />
      {/* Right fan */}
      <circle cx="74" cy="24" r="4.5" fill="none" stroke={color} strokeWidth="0.8" opacity="0.6" />
      {/* Top stripe */}
      <rect x="2" y="8" width="76" height="2" rx="1" fill={color} opacity="0.4" />
    </svg>
  )
}

export default function MinerShowcase({ btcLive }: { btcLive: number | null }) {
  const sectionRef = useRef<HTMLDivElement>(null)
  const scrollRef  = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!sectionRef.current) return

    // Section fade in
    gsap.from(sectionRef.current, {
      opacity: 0,
      y: 50,
      duration: 0.8,
      ease: 'power2.out',
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 85%',
        once: true,
      },
    })

    // Cards stagger
    const cards = sectionRef.current.querySelectorAll('.miner-card')
    gsap.from(cards, {
      opacity: 0,
      y: 30,
      scale: 0.96,
      duration: 0.6,
      ease: 'power2.out',
      stagger: 0.1,
      scrollTrigger: {
        trigger: sectionRef.current,
        start: 'top 80%',
        once: true,
      },
    })
  }, [])

  // Mouse drag scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let isDown = false, startX = 0, scrollLeft = 0

    const onDown = (e: MouseEvent) => { isDown = true; startX = e.pageX - el.offsetLeft; scrollLeft = el.scrollLeft; el.style.cursor = 'grabbing' }
    const onUp = () => { isDown = false; el.style.cursor = 'grab' }
    const onMove = (e: MouseEvent) => {
      if (!isDown) return
      e.preventDefault()
      const x = e.pageX - el.offsetLeft
      el.scrollLeft = scrollLeft - (x - startX) * 1.4
    }

    el.addEventListener('mousedown', onDown)
    el.addEventListener('mouseup',   onUp)
    el.addEventListener('mouseleave',onUp)
    el.addEventListener('mousemove', onMove)
    return () => {
      el.removeEventListener('mousedown', onDown)
      el.removeEventListener('mouseup',   onUp)
      el.removeEventListener('mouseleave',onUp)
      el.removeEventListener('mousemove', onMove)
    }
  }, [])

  return (
    <section ref={sectionRef} className="py-16" style={{ background: '#050810' }}>
      <div className="max-w-7xl mx-auto px-4 mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Top Miners Analysed</h2>
          <p className="text-gray-500 text-sm mt-1">Ranked by efficiency — the metric that matters most</p>
        </div>
        <Link href="/miners" className="text-sm font-medium" style={{ color: '#f59e0b' }}>
          View all miners →
        </Link>
      </div>

      {/* Horizontal scroll container */}
      <div
        ref={scrollRef}
        className="overflow-x-auto pb-4"
        style={{
          cursor: 'grab',
          scrollSnapType: 'x mandatory',
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
        }}
      >
        <style>{`.miner-scroll::-webkit-scrollbar { display: none; }`}</style>
        <div className="miner-scroll flex gap-4 px-4 md:px-[max(1rem,calc((100vw-80rem)/2+1rem))]">
          {SHOWCASE_MINERS.map((m) => {
            const daily = dailyBTC(m.hashrate)
            const monthlyBTC = daily * 30
            const monthlyUSD = btcLive ? monthlyBTC * btcLive - 225 : null

            return (
              <Link
                key={m.slug}
                href={`/miners/${m.slug}`}
                className="miner-card block shrink-0"
                style={{
                  width: '280px',
                  scrollSnapAlign: 'start',
                  textDecoration: 'none',
                }}
              >
                <div
                  className="h-full rounded-2xl p-6 flex flex-col group"
                  style={{
                    background: '#0d1117',
                    border: `1px solid ${m.badge ? 'rgba(245,158,11,0.25)' : '#1f2937'}`,
                    height: '340px',
                    transition: 'transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'translateY(-8px)'
                    el.style.boxShadow = `0 20px 40px rgba(245,158,11,0.15)`
                    el.style.borderColor = 'rgba(245,158,11,0.5)'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLDivElement
                    el.style.transform = 'translateY(0)'
                    el.style.boxShadow = 'none'
                    el.style.borderColor = m.badge ? 'rgba(245,158,11,0.25)' : '#1f2937'
                  }}
                >
                  {m.badge && (
                    <div className="text-xs font-bold mb-3 px-2 py-0.5 rounded inline-block self-start" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                      {m.badge}
                    </div>
                  )}

                  {/* Icon */}
                  <div className="mb-4 flex items-center justify-center" style={{ height: '60px' }}>
                    <MinerIcon color={m.color} />
                  </div>

                  <h3 className="text-base font-bold text-white mb-4 group-hover:text-amber-400 transition-colors">
                    {m.name}
                  </h3>

                  <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="rounded-xl p-2.5 text-center" style={{ background: '#111827' }}>
                      <div className="text-xs text-gray-500 mb-0.5">Hashrate</div>
                      <div className="text-sm font-bold text-white">{m.hashrate} TH/s</div>
                    </div>
                    <div className="rounded-xl p-2.5 text-center" style={{ background: '#111827' }}>
                      <div className="text-xs text-gray-500 mb-0.5">Efficiency</div>
                      <div className="text-sm font-bold" style={{ color: m.efficiency < 16 ? '#f59e0b' : m.efficiency < 22 ? '#00d4aa' : '#9ca3af' }}>
                        {m.efficiency} J/TH
                      </div>
                    </div>
                  </div>

                  {monthlyUSD !== null && (
                    <div className="rounded-xl p-3 text-center mt-auto" style={{ background: monthlyUSD > 0 ? 'rgba(0,212,170,0.08)' : 'rgba(255,71,87,0.08)', border: `1px solid ${monthlyUSD > 0 ? 'rgba(0,212,170,0.2)' : 'rgba(255,71,87,0.2)'}` }}>
                      <div className="text-xs text-gray-500 mb-0.5">Net / month</div>
                      <div className="text-sm font-bold font-mono" style={{ color: monthlyUSD > 0 ? '#00d4aa' : '#ff4757' }}>
                        {monthlyUSD > 0 ? '+' : ''}{monthlyUSD.toFixed(0)} USD
                      </div>
                    </div>
                  )}
                </div>
              </Link>
            )
          })}

          {/* View all card */}
          <Link href="/miners" className="shrink-0 block" style={{ width: '220px', scrollSnapAlign: 'start', textDecoration: 'none' }}>
            <div className="h-full rounded-2xl flex flex-col items-center justify-center gap-3" style={{ background: '#0d1117', border: '1px dashed #1f2937', height: '340px' }}>
              <div style={{ fontSize: '1.5rem', color: '#374151' }}>→</div>
              <span className="text-sm font-semibold" style={{ color: '#4b5563' }}>View All Miners</span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  )
}
