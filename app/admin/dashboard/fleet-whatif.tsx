'use client'

import { useState } from 'react'

// THE fleet config (Jacob, 2026-07-27): LuxOS overclock on Luxor pool — the only
// setup we run. Stock/fixed-payout comparisons removed; this box just answers
// "what does our fleet net at today's hashprice."
export default function FleetWhatIf({ spotHashprice, rigs, hostingDayFleet }: {
  spotHashprice: number
  rigs: number
  thPerRig?: number
  hostingDayFleet: number
}) {
  const [fee, setFee] = useState('2.8') // pool + LuxOS OC dev fee, all-in
  const [th, setTh] = useState('300')

  const feePct = Math.min(100, Math.max(0, parseFloat(fee) || 0))
  const ocTh = parseFloat(th) || 300

  const revenueDay = spotHashprice * ocTh * rigs * (1 - feePct / 100)
  const netDay = revenueDay - hostingDayFleet
  const fmt = (n: number, d = 0) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
        The fleet — {rigs} rigs · LuxOS OC · Luxor pool · today&apos;s hashprice
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          OC TH/rig (284 +1 · 300 +2)
          <input value={th} onChange={(e) => setTh(e.target.value)}
            className="w-20 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          Luxor fee % (pool + dev, all-in)
          <input value={fee} onChange={(e) => setFee(e.target.value)}
            className="w-16 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
      </div>
      <div className="flex flex-wrap gap-6 font-mono text-[13px]">
        <span>revenue/day <b className="text-neutral-800">{fmt(revenueDay, 2)}</b></span>
        <span>net/day <b className={netDay >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(netDay, 2)}</b></span>
        <span>net/mo <b className={netDay >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(netDay * 30.4)}</b></span>
        <span>net/yr <b className={netDay >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(netDay * 365)}</b></span>
      </div>
      <div className="mt-2 text-[11px] text-neutral-500">
        Spot: ${spotHashprice.toFixed(4)}/TH/day · hosting ${hostingDayFleet.toFixed(0)}/day. OC +2 = 3,850W/rig vs 3,645
        stock — needs Abundant&apos;s wattage OK. Same config drives the plan predictor below.
      </div>
    </div>
  )
}
