'use client'

import { useState } from 'react'

// Luxor fixed-payout what-if: compare locking a $/TH/day rate (Luxor forward
// contract) against spot for the 18-rig S21 XP fleet. Pure client math.
export default function FleetWhatIf({ spotHashprice, rigs, thPerRig, hostingDayFleet }: {
  spotHashprice: number
  rigs: number
  thPerRig: number
  hostingDayFleet: number
}) {
  const [rate, setRate] = useState(spotHashprice.toFixed(4))
  const [fee, setFee] = useState('0')
  const [th, setTh] = useState(String(thPerRig))

  const fixed = parseFloat(rate) || 0
  const feePct = Math.min(100, Math.max(0, parseFloat(fee) || 0))
  const thRig = parseFloat(th) || thPerRig
  const grossDay = fixed * thRig * rigs * (1 - feePct / 100)
  const netDay = grossDay - hostingDayFleet
  const spotNetDay = spotHashprice * thRig * rigs - hostingDayFleet
  const deltaMo = (netDay - spotNetDay) * 30
  const fmt = (n: number, d = 2) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
        Luxor fixed-payout what-if — plug in a quote
      </div>
      <div className="flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          fixed $/TH/day
          <input value={rate} onChange={(e) => setRate(e.target.value)}
            className="w-24 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          TH/rig (LuxOS: 270 stock · 284 +1 · 300 +2)
          <input value={th} onChange={(e) => setTh(e.target.value)}
            className="w-20 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          pool fee %
          <input value={fee} onChange={(e) => setFee(e.target.value)}
            className="w-16 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <div className="flex flex-wrap gap-4 pb-1">
          <span>locked net/day <b className={netDay >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(netDay)}</b></span>
          <span>locked net/mo <b className={netDay >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(netDay * 30, 0)}</b></span>
          <span>vs spot/mo <b className={deltaMo >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(deltaMo, 0)}</b></span>
        </div>
      </div>
      <div className="mt-1 text-[11px] text-neutral-500">
        Spot today: ${spotHashprice.toFixed(4)}/TH/day. Locking below ${(hostingDayFleet / (thRig * rigs)).toFixed(4)} locks a loss (fleet hosting breakeven). Overclock needs Abundant's OK on wattage (+2 = 3,850W/rig vs 3,645 stock). Tenors 1–12&nbsp;mo, settles BTC/USD — quotes: derivatives@luxor.tech.
      </div>
    </div>
  )
}
