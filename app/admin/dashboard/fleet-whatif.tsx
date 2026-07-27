'use client'

import { useState } from 'react'

// Luxor comparison for the 18-rig S21 XP fleet: stock vs LuxOS overclock,
// floating spot vs Luxor fixed-payout contract — all four combinations, one table.
export default function FleetWhatIf({ spotHashprice, rigs, thPerRig, hostingDayFleet }: {
  spotHashprice: number
  rigs: number
  thPerRig: number
  hostingDayFleet: number
}) {
  const [rate, setRate] = useState(spotHashprice.toFixed(4))
  const [fee, setFee] = useState('1')
  const [th, setTh] = useState('300')

  const fixed = parseFloat(rate) || 0
  const feePct = Math.min(100, Math.max(0, parseFloat(fee) || 0))
  const ocTh = parseFloat(th) || 300

  const net = (thRig: number, hp: number, poolFee: number) =>
    hp * thRig * rigs * (1 - poolFee / 100) - hostingDayFleet

  const rows = [
    { name: 'Without Luxor (stock, spot)', thRig: thPerRig, netDay: net(thPerRig, spotHashprice, 0), certainty: 'floats with market' },
    { name: 'LuxOS overclock only (spot)', thRig: ocTh, netDay: net(ocTh, spotHashprice, 0), certainty: 'floats with market' },
    { name: 'Fixed payout only (stock)', thRig: thPerRig, netDay: net(thPerRig, fixed, feePct), certainty: 'locked for tenor' },
    { name: 'LuxOS + fixed payout', thRig: ocTh, netDay: net(ocTh, fixed, feePct), certainty: 'locked for tenor' },
  ]
  const base = rows[0].netDay
  const fmt = (n: number, d = 0) => `${n < 0 ? '-' : '+'}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}`

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
        With Luxor vs without — same fleet, four ways
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          fixed $/TH/day (quote)
          <input value={rate} onChange={(e) => setRate(e.target.value)}
            className="w-24 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          OC TH/rig (284 +1 · 300 +2)
          <input value={th} onChange={(e) => setTh(e.target.value)}
            className="w-20 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          pool fee %
          <input value={fee} onChange={(e) => setFee(e.target.value)}
            className="w-16 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
      </div>
      <table className="w-full text-[13px]">
        <thead>
          <tr className="text-left text-[11px] uppercase tracking-widest text-neutral-500">
            <th className="pb-1">Scenario</th><th>TH/rig</th><th className="text-right">Net/day</th>
            <th className="text-right">Net/mo</th><th className="text-right">Net/yr</th>
            <th className="text-right">vs baseline/mo</th><th className="text-right">Revenue</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name} className={`border-t border-neutral-100 ${i === 0 ? 'text-neutral-500' : ''}`}>
              <td className="py-1">{r.name}</td>
              <td className="font-mono">{r.thRig}</td>
              <td className={`text-right font-mono ${r.netDay >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.netDay, 2)}</td>
              <td className={`text-right font-mono ${r.netDay >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.netDay * 30)}</td>
              <td className={`text-right font-mono ${r.netDay >= 0 ? 'text-green-600' : 'text-red-600'}`}>{fmt(r.netDay * 365)}</td>
              <td className={`text-right font-mono ${i === 0 ? 'text-neutral-400' : (r.netDay - base) * 30 >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {i === 0 ? '—' : fmt((r.netDay - base) * 30)}
              </td>
              <td className="text-right text-[11px] text-neutral-500">{r.certainty}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 text-[11px] text-neutral-500">
        Spot today: ${spotHashprice.toFixed(4)}/TH/day · hosting fixed at ${hostingDayFleet.toFixed(0)}/day either way.
        Fixed rows use your quote + fee; overclock rows need Abundant&apos;s OK on wattage (+2 = 3,850W/rig vs 3,645 stock).
        Locked = certainty, not extra profit: at a quote equal to spot, locked matches floating — its value shows when hashprice falls.
        Quotes: derivatives@luxor.tech.
      </div>
    </div>
  )
}
