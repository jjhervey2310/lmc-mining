'use client'

import { useState } from 'react'

// THE fleet config (Jacob, 2026-07-27): LuxOS overclock on Luxor pool — the only
// setup we run. Stock/fixed-payout comparisons removed; this box just answers
// "what does our fleet net at today's hashprice."
export default function FleetWhatIf({ spotHashprice, rigs, hostingMoFleet }: {
  spotHashprice: number
  rigs: number
  hostingMoFleet: number
}) {
  const [fee, setFee] = useState('2.8') // pool + LuxOS OC dev fee, all-in
  const [th, setTh] = useState('300')

  const feePct = Math.min(100, Math.max(0, parseFloat(fee) || 0))
  const ocTh = parseFloat(th) || 300

  // Hosting bills monthly; month = day × 30.42, year = month × 12 — same
  // conventions as the P&L tiles above so the two always reconcile.
  const LOAN_MO = 2485 // 18 × $6,900 − 5% = $117,990, minus Jacob's $20k deposit → $97,990 financed @10%/48mo (corrected 2026-08-10; was $140k/$3,551 sized for the old 25-unit plan)
  const revenueDay = spotHashprice * ocTh * rigs * (1 - feePct / 100)
  const revenueMo = revenueDay * 30.42
  const afterHostMo = revenueMo - hostingMoFleet
  const netMo = afterHostMo - LOAN_MO   // the real bottom line (audit 2026-08-06)
  const netDay = netMo / 30.42
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
        <span>revenue/mo <b className="text-neutral-800">{fmt(revenueMo)}</b></span>
        <span>after hosting <b className={afterHostMo >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(afterHostMo)}</b></span>
        <span>− loan {fmt(-LOAN_MO)}</span>
        <span>net/mo <b className={netMo >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(netMo)}</b></span>
        <span>net/yr <b className={netMo >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(netMo * 12)}</b></span>
      </div>
      <div className="mt-2 text-[11px] text-neutral-500">
        Spot: ${spotHashprice.toFixed(4)}/TH/day · hosting ${hostingMoFleet.toLocaleString()}/mo + AM loan $2,485/mo — net is after BOTH. OC +2 = 3,850W/rig vs 3,645
        stock — Abundant confirmed $225 stays flat even overclocked (Jacob 2026-08-05). Same config drives the plan predictor below.
      </div>
    </div>
  )
}
