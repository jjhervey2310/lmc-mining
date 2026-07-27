'use client'

import { useState } from 'react'

// The real LMC plan (June 4 revision) run against live hashprice: 48-month
// cumulative cash curve with AM loan and Earl's two repayments. Answers
// "how negative do we get, and when" at today's economics.
export default function PlanCashflow({ spotHashprice, liveSideIncome = 0 }: { spotHashprice: number; liveSideIncome?: number }) {
  const [option, setOption] = useState<'A' | 'B'>('A')
  const [th, setTh] = useState('300')
  const [side, setSide] = useState(String(Math.round(liveSideIncome)))
  const [earl18, setEarl18] = useState('37500')
  const [earl36, setEarl36] = useState('37500')
  const [chest, setChest] = useState('50000')
  const [sunrise, setSunrise] = useState(false)

  const units = option === 'A' ? 25 : 18
  const loanMo = 3551 // AM $140k @10% 48mo, per plan
  const thRig = parseFloat(th) || 300
  const sideMo = parseFloat(side) || 0
  const e18 = option === 'A' ? parseFloat(earl18) || 0 : 0
  const e36 = option === 'A' ? parseFloat(earl36) || 0 : 0

  const months: number[] = []
  let cum = option === 'A' ? parseFloat(chest) || 0 : 0
  for (let m = 1; m <= 48; m++) {
    const hosting = units * (sunrise && m >= 7 ? 135 : 225)
    const revenue = spotHashprice * thRig * units * 30.4
    let net = revenue - hosting - loanMo + sideMo
    if (m === 18) net -= e18
    if (m === 36) net -= e36
    cum += net
    months.push(cum)
  }
  const trough = Math.min(...months)
  const troughMo = months.indexOf(trough) + 1
  const monthlyNet = spotHashprice * thRig * units * 30.4 - units * 225 - loanMo + sideMo
  const end48 = months[47]
  const fmt = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(Math.round(n)).toLocaleString()}`

  // cumulative curve svg
  const w = 640, h = 110
  const lo = Math.min(trough, 0), hi = Math.max(...months, 0)
  const span = hi - lo || 1
  const y = (v: number) => h - ((v - lo) / span) * (h - 10) - 5
  const pts = months.map((v, i) => `${(i / 47) * w},${y(v)}`).join(' ')

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
        Plan cash flow — the real plan at today&apos;s hashprice (48 months)
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-[13px]">
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          structure
          <select value={option} onChange={(e) => setOption(e.target.value as 'A' | 'B')}
            className="border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500">
            <option value="A">A — 25 units + Earl</option>
            <option value="B">B — 18 units, no Earl</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          TH/rig
          <input value={th} onChange={(e) => setTh(e.target.value)}
            className="w-16 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          side income/mo (last 30d: ${Math.round(liveSideIncome)})
          <input value={side} onChange={(e) => setSide(e.target.value)}
            className="w-20 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        {option === 'A' && (
          <>
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              war chest (Earl loan)
              <input value={chest} onChange={(e) => setChest(e.target.value)}
                className="w-20 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              Earl @ mo 18
              <input value={earl18} onChange={(e) => setEarl18(e.target.value)}
                className="w-20 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
              Earl @ mo 36
              <input value={earl36} onChange={(e) => setEarl36(e.target.value)}
                className="w-20 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
            </label>
          </>
        )}
        <label className="flex items-center gap-1 pb-1 text-[11px] text-neutral-600">
          <input type="checkbox" checked={sunrise} onChange={(e) => setSunrise(e.target.checked)} />
          Sunrise $135 from mo 7
        </label>
      </div>

      <div className="mb-2 flex flex-wrap gap-5 text-[13px]">
        <span>monthly net (pre-Earl) <b className={monthlyNet >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(monthlyNet)}</b></span>
        <span>deepest hole <b className="text-red-600">{fmt(trough)}</b> <span className="text-neutral-500">(month {troughMo})</span></span>
        <span>cash at month 48 <b className={end48 >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(end48)}</b></span>
      </div>

      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="#d4d4d4" strokeDasharray="4 4" />
        <polyline points={pts} fill="none" stroke={end48 >= 0 ? '#16a34a' : '#dc2626'} strokeWidth="2" />
        {[18, 36].map((m) => e18 + e36 > 0 && option === 'A' ? (
          <g key={m}>
            <line x1={((m - 1) / 47) * w} x2={((m - 1) / 47) * w} y1="0" y2={h} stroke="#f59e0b" strokeDasharray="3 3" />
            <text x={((m - 1) / 47) * w + 3} y="12" fontSize="10" fill="#b45309">Earl mo {m}</text>
          </g>
        ) : null)}
      </svg>
      <div className="mt-1 text-[11px] text-neutral-500">
        Assumes today&apos;s hashprice (${spotHashprice.toFixed(4)}/TH/day) holds flat — no difficulty drift, no BTC move. AM loan $3,551/mo for all 48 months.
        Current structure: Earl lends $50k held as war chest (curve starts there), Jacob&apos;s $20k is the machine deposit (sunk, not in the curve), AM loan $3,551/mo. Earl repayment split is editable — set it to whatever you two agree. The plan&apos;s layers (job bridge, side income, referrals) go in &quot;side income&quot;. Sunrise is AM&apos;s hydro target, not a promise.
      </div>
    </div>
  )
}
