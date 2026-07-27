'use client'

import { useState } from 'react'

// THE FINAL PLAN (locked 2026-07-27): 18 units + Earl's $50k war chest + Jacob's
// monthly add-in. Launch-aware 48-month curve plus a rolling 12-month PREDICTION
// (Claude base path, not just adjustable scenarios) with a tab per month.
// Earl repayments hit at launch+18 and launch+36.

// Claude's base prediction as of 2026-07-27: BTC +40%/yr (historical cycle pattern
// into a halving), difficulty +20%/yr. The April 2028 halving (subsidy 3.125→1.5625)
// is modeled as a hard 50% hashprice cut — the reason base is no longer 20/20:
// price MUST outrun difficulty into month ~21 or the plan needs its other levers
// (side income, Sunrise) to stay above water. Revisit monthly.
const PRED_BTC_YR = 40
const PRED_DIFF_YR = 20

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function PlanCashflow({ spotHashprice, btcPrice, liveSideIncome = 0 }: { spotHashprice: number; btcPrice: number; liveSideIncome?: number }) {
  const [units, setUnits] = useState('18')
  const [th, setTh] = useState('270')
  const [addIn, setAddIn] = useState('3000')
  const [side, setSide] = useState(String(Math.round(liveSideIncome)))
  const [chest, setChest] = useState('50000')
  const [earl18, setEarl18] = useState('37500')
  const [earl36, setEarl36] = useState('37500')
  const [launch, setLaunch] = useState('2026-12')
  const [sunrise, setSunrise] = useState(false)
  const [scenario, setScenario] = useState('prediction')
  const [btcG, setBtcG] = useState(String(PRED_BTC_YR))
  const [diffG, setDiffG] = useState(String(PRED_DIFF_YR))
  const [tab, setTab] = useState(0)

  const SCENARIOS: Record<string, [string, string]> = {
    prediction: [String(PRED_BTC_YR), String(PRED_DIFF_YR)],
    flat: ['0', '0'], bear: ['-20', '10'], bull: ['60', '35'],
  }
  const pickScenario = (k: string) => { setScenario(k); if (SCENARIOS[k]) { setBtcG(SCENARIOS[k][0]); setDiffG(SCENARIOS[k][1]) } }

  const u = parseInt(units) || 18
  const loanMo = 3551 // AM $140k @10% 48mo, per plan
  const thRig = parseFloat(th) || 270
  const addMo = parseFloat(addIn) || 0
  const sideMo = parseFloat(side) || 0
  const e18 = parseFloat(earl18) || 0
  const e36 = parseFloat(earl36) || 0
  const bg = parseFloat(btcG) || 0
  const dg = parseFloat(diffG) || 0

  // Calendar: month index 0 = the current month, always rolling.
  const now = new Date()
  const [ly, lm] = launch.split('-').map(Number)
  const launchIdx = Math.max(0, (ly - now.getFullYear()) * 12 + (lm - 1) - now.getMonth())
  const labelAt = (m: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1)
    return `${MONTH_NAMES[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`
  }

  // April 2028 halving: subsidy 3.125→1.5625 BTC = hashprice ×0.5 from that month
  // (only if it's still ahead of us — past-halving spot already reflects it).
  const halvingIdx = (2028 - now.getFullYear()) * 12 + 3 - now.getMonth()
  const halved = (m: number) => (halvingIdx > 0 && m >= halvingIdx ? 0.5 : 1)
  const hpAt = (m: number) => spotHashprice * halved(m) * Math.pow(1 + bg / 100, m / 12) / Math.pow(1 + dg / 100, m / 12)
  const btcAt = (m: number) => btcPrice * Math.pow(1 + bg / 100, m / 12)

  // One engine for both views: per-month rows, launch-aware, Earl at launch+18/+36.
  type Row = { live: boolean; revenue: number; hosting: number; loan: number; earl: number; net: number; cum: number }
  const rows: Row[] = []
  let cum = parseFloat(chest) || 0
  for (let m = 0; m < 48; m++) {
    const live = m >= launchIdx
    const opMonth = m - launchIdx + 1 // 1-based month of operation
    const hosting = live ? u * (sunrise && opMonth >= 7 ? 135 : 225) : 0
    const revenue = live ? hpAt(m) * thRig * u * 30.4 : 0
    const loan = live ? loanMo : 0
    const earl = opMonth === 18 ? e18 : opMonth === 36 ? e36 : 0
    const net = revenue - hosting - loan - earl + addMo + sideMo
    cum += net
    rows.push({ live, revenue, hosting, loan, earl, net, cum })
  }
  const trough = Math.min(...rows.map((r) => r.cum))
  const troughMo = rows.findIndex((r) => r.cum === trough)
  const end48 = rows[47].cum
  const fmt = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(Math.round(n)).toLocaleString()}`
  const usd0 = (n: number) => `$${Math.round(n).toLocaleString()}`

  // cumulative curve svg
  const w = 640, h = 110
  const lo = Math.min(trough, 0), hi = Math.max(...rows.map((r) => r.cum), 0)
  const span = hi - lo || 1
  const y = (v: number) => h - ((v - lo) / span) * (h - 10) - 5
  const pts = rows.map((r, i) => `${(i / 47) * w},${y(r.cum)}`).join(' ')
  const earlMarks = [launchIdx + 17, launchIdx + 35].filter((m) => m < 48)

  const t = rows[tab]

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
        The final plan — 18 units + Earl war chest + monthly add-in (48 months, launch-aware)
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-[13px]">
        {([
          ['units', units, setUnits, 'w-14'],
          ['TH/rig', th, setTh, 'w-16'],
          ['my add-in/mo', addIn, setAddIn, 'w-20'],
          [`side income/mo (last 30d: $${Math.round(liveSideIncome)})`, side, setSide, 'w-20'],
          ['war chest (Earl)', chest, setChest, 'w-20'],
          ['Earl @ op-mo 18', earl18, setEarl18, 'w-20'],
          ['Earl @ op-mo 36', earl36, setEarl36, 'w-20'],
        ] as [string, string, (v: string) => void, string][]).map(([label, val, set, width]) => (
          <label key={label} className="flex flex-col gap-1 text-[11px] text-neutral-600">
            {label}
            <input value={val} onChange={(e) => set(e.target.value)}
              className={`${width} border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500`} />
          </label>
        ))}
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          launch
          <input type="month" value={launch} onChange={(e) => setLaunch(e.target.value)}
            className="border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex items-center gap-1 pb-1 text-[11px] text-neutral-600">
          <input type="checkbox" checked={sunrise} onChange={(e) => setSunrise(e.target.checked)} />
          Sunrise $135 from op-mo 7
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          path
          <select value={scenario} onChange={(e) => pickScenario(e.target.value)}
            className="border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500">
            <option value="prediction">prediction (Claude base)</option>
            <option value="flat">flat (today forever)</option>
            <option value="bear">bear</option>
            <option value="bull">bull</option>
            <option value="custom">custom</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          BTC %/yr
          <input value={btcG} onChange={(e) => { setBtcG(e.target.value); setScenario('custom') }}
            className="w-14 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          difficulty %/yr
          <input value={diffG} onChange={(e) => { setDiffG(e.target.value); setScenario('custom') }}
            className="w-14 border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
      </div>

      <div className="mb-2 flex flex-wrap gap-5 text-[13px]">
        <span>war chest at launch <b className="text-neutral-700">{usd0(launchIdx > 0 ? rows[launchIdx - 1].cum : parseFloat(chest) || 0)}</b></span>
        <span>deepest hole <b className={trough < 0 ? 'text-red-600' : 'text-green-600'}>{fmt(trough)}</b> <span className="text-neutral-500">({labelAt(troughMo)})</span></span>
        <span>cash at month 48 <b className={end48 >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(end48)}</b></span>
        <span>hashprice mo 48 <b className="text-neutral-700">${hpAt(48).toFixed(4)}</b></span>
      </div>

      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="max-w-full">
        <line x1="0" x2={w} y1={y(0)} y2={y(0)} stroke="#d4d4d4" strokeDasharray="4 4" />
        {launchIdx > 0 && launchIdx < 48 && (
          <g>
            <line x1={(launchIdx / 47) * w} x2={(launchIdx / 47) * w} y1="0" y2={h} stroke="#0891b2" strokeDasharray="3 3" />
            <text x={(launchIdx / 47) * w + 3} y="12" fontSize="10" fill="#0e7490">launch</text>
          </g>
        )}
        {halvingIdx > 0 && halvingIdx < 48 && (
          <g>
            <line x1={(halvingIdx / 47) * w} x2={(halvingIdx / 47) * w} y1="0" y2={h} stroke="#7c3aed" strokeDasharray="3 3" />
            <text x={(halvingIdx / 47) * w + 3} y={h - 4} fontSize="10" fill="#6d28d9">halving ×0.5</text>
          </g>
        )}
        <polyline points={pts} fill="none" stroke={end48 >= 0 ? '#16a34a' : '#dc2626'} strokeWidth="2" />
        {earlMarks.map((m) => e18 + e36 > 0 ? (
          <g key={m}>
            <line x1={(m / 47) * w} x2={(m / 47) * w} y1="0" y2={h} stroke="#f59e0b" strokeDasharray="3 3" />
            <text x={(m / 47) * w + 3} y="24" fontSize="10" fill="#b45309">Earl</text>
          </g>
        ) : null)}
      </svg>

      {/* 12-month prediction, rolling from the current month, one tab per month */}
      <div className="mt-4 mb-1 text-[11px] uppercase tracking-widest text-neutral-500">
        Next 12 months — predicted, path: {scenario === 'prediction' ? `Claude base (BTC +${PRED_BTC_YR}%/yr, difficulty +${PRED_DIFF_YR}%/yr)` : scenario}
      </div>
      <div className="mb-2 flex flex-wrap gap-1">
        {Array.from({ length: 12 }, (_, m) => (
          <button key={m} onClick={() => setTab(m)}
            className={`border px-2 py-1 font-mono text-[11px] ${tab === m ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-neutral-300 text-neutral-600 hover:border-neutral-400'}`}>
            {labelAt(m)}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-1 border border-neutral-200 bg-neutral-50 px-3 py-2 font-mono text-[12px] text-neutral-800">
        <span>BTC <b>{usd0(btcAt(tab))}</b></span>
        <span>hashprice <b>${hpAt(tab).toFixed(4)}</b>/TH/day</span>
        <span>{t.live ? `revenue ${usd0(t.revenue)}` : 'pre-launch — no mining'}</span>
        {t.live && <span>hosting -{usd0(t.hosting)}</span>}
        {t.live && <span>AM loan -{usd0(t.loan)}</span>}
        <span>add-in +{usd0(addMo)}</span>
        <span>side +{usd0(sideMo)}</span>
        {t.earl > 0 && <span className="text-amber-700">Earl -{usd0(t.earl)}</span>}
        <span>net <b className={t.net >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(t.net)}</b></span>
        <span>war chest end <b className={t.cum >= 0 ? 'text-green-700' : 'text-red-600'}>{usd0(t.cum)}</b></span>
      </div>

      <div className="mt-1 text-[11px] text-neutral-500">
        Prediction = Claude&apos;s base path from today&apos;s live numbers (BTC ${btcPrice.toLocaleString()}, hashprice ${spotHashprice.toFixed(4)}) — a model, not a promise; bear/bull to stress it. The April 2028 halving is modeled as a hard 50% hashprice cut, so BTC growth must outrun difficulty into month ~{halvingIdx} or the plan leans on its other levers (side income ≥$500/mo flips base positive; Sunrise adds ~$1,620/mo). Pre-launch months bank the add-in into the war chest; Earl repayments at operating months 18 and 36. Jacob&apos;s $20k deposit is sunk and not in the curve. Sunrise is AM&apos;s hydro target, not a promise.
      </div>
    </div>
  )
}
