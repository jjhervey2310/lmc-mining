'use client'

import { Fragment, useState } from 'react'

// THE FINAL PLAN (locked 2026-07-27): 18 units, LuxOS overclock 300 TH/rig on Luxor
// pool (1% fee), Earl's $50k war chest, Jacob's monthly add-in. Launch-aware 48-month
// curve driven by the 24-month monthly BTC prediction table (base path) then
// extrapolation; April 2028 halving = hard ×0.5 hashprice cut. Earl repaid at
// operating months 18/36.

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

// 24-month monthly-average BTC predictions, merged Claude × GPT-4o 2026-07-27 from
// live data (ATH $126k Oct-25, -48%; June-26 low $58.6k; F&G 30d avg 23; hashrate
// +7%/yr) + historical post-bottom speed (2019: +240%/6mo; 2023: +160%/13mo, ATH in
// 16mo) + Jacob's thesis. base = bottom $54.5k Oct '26 then 2023-style recovery,
// prior ATH regained ~Feb '28; bear = $46.5k floor Nov '26, slow grind; bull = June
// '26 was the bottom. REFRESH MONTHLY (re-pull data, re-run GPT cross-check).
type PathName = 'bear' | 'base' | 'bull'
const MONTHLY_BTC: Record<PathName, Record<string, number>> = {
  bear: {
    '2026-07': 65000, '2026-08': 59000, '2026-09': 52750, '2026-10': 48500, '2026-11': 46500, '2026-12': 47500,
    '2027-01': 49500, '2027-02': 51500, '2027-03': 53500, '2027-04': 55500, '2027-05': 57500, '2027-06': 59500,
    '2027-07': 61500, '2027-08': 63500, '2027-09': 65500, '2027-10': 67500, '2027-11': 69500, '2027-12': 71500,
    '2028-01': 73500, '2028-02': 75500, '2028-03': 77500, '2028-04': 79500, '2028-05': 81500, '2028-06': 83500, '2028-07': 85500,
  },
  base: {
    '2026-07': 65000, '2026-08': 63500, '2026-09': 57500, '2026-10': 54500, '2026-11': 56500, '2026-12': 60000,
    '2027-01': 65000, '2027-02': 70500, '2027-03': 76500, '2027-04': 83000, '2027-05': 89000, '2027-06': 95000,
    '2027-07': 101000, '2027-08': 107000, '2027-09': 113000, '2027-10': 119000, '2027-11': 125000, '2027-12': 129500,
    '2028-01': 134000, '2028-02': 137500, '2028-03': 140500, '2028-04': 143000, '2028-05': 146000, '2028-06': 149000, '2028-07': 152000,
  },
  bull: {
    '2026-07': 65000, '2026-08': 69000, '2026-09': 74000, '2026-10': 78500, '2026-11': 85500, '2026-12': 92500,
    '2027-01': 101000, '2027-02': 109000, '2027-03': 117000, '2027-04': 125000, '2027-05': 132000, '2027-06': 139000,
    '2027-07': 146000, '2027-08': 153000, '2027-09': 160000, '2027-10': 167000, '2027-11': 174000, '2027-12': 181000,
    '2028-01': 188000, '2028-02': 195500, '2028-03': 203000, '2028-04': 210000, '2028-05': 215000, '2028-06': 220000, '2028-07': 225000,
  },
}
// Difficulty growth per path (%/yr): hashrate follows price with a lag (observed +7%/yr in the bear).
const DIFF_BY_PATH: Record<PathName, number> = { bear: 5, base: 10, bull: 18 }
const EXTRAP_BTC_YR = 15 // price growth applied beyond the 24-month table (months 25-48)
const POOL_FEE = 0.028 // Luxor all-in: pool fee + LuxOS OC dev fee (Jacob 2026-07-28)
const PRED_MONTHS = 24

export default function PlanCashflow({ spotHashprice, btcPrice, liveSideIncome = 0 }: { spotHashprice: number; btcPrice: number; liveSideIncome?: number }) {
  const [units, setUnits] = useState('18')
  const [th, setTh] = useState('300') // LuxOS +2 profile; stock is 270
  const [addIn, setAddIn] = useState('3000')
  const [side, setSide] = useState(String(Math.round(liveSideIncome)))
  const [chest, setChest] = useState('50000')
  const [earl18, setEarl18] = useState('37500')
  const [earl36, setEarl36] = useState('37500')
  const [launch, setLaunch] = useState('2026-12')
  // No add-in until the job lands (Jacob 2026-08-02): contributions start at this
  // month, not today. Default = launch month; set it earlier once hired.
  const [addStart, setAddStart] = useState('2026-12')
  // Add-in mode (Jacob 2026-08-05): 'flat' = full amount any month the plan wants
  // help, stops for good once Earl + a 3-month loan cushion are secured (bigger
  // checks, fewer of them). 'topup' = only the mine's actual shortfall that month,
  // capped at the add-in amount (smaller checks, they run longer).
  const [addMode, setAddMode] = useState<'flat' | 'topup'>('flat')
  // Sunrise ON by default; HALVING-TRIGGERED (Jacob confirmed 2026-07-28): AM's
  // $135 hydro rate is the ~40% discount they may offer when the halving starts,
  // NOT from op-mo 7. Still AM's target, not a signed rate — toggle off to stress.
  const [sunrise, setSunrise] = useState(true)
  const [scenario, setScenario] = useState('prediction')
  const [btcG, setBtcG] = useState('15')
  const [diffG, setDiffG] = useState('10')
  const [tab, setTab] = useState(0)
  // Luxor fixed/upfront pool payout (forward): lock H% of production at a fixed
  // $/TH/day for the first N operating months (tenors run 1-12mo). The locked
  // share is immune to difficulty drift AND the halving during its tenor.
  const [hedgePct, setHedgePct] = useState('0')
  const [hedgeMo, setHedgeMo] = useState('12')
  const [hedgePx, setHedgePx] = useState(spotHashprice.toFixed(4))

  const SCENARIOS: Record<string, [string, string]> = {
    prediction: ['15', '10'], flat: ['0', '0'], bear: ['-20', '5'], bull: ['60', '18'],
  }
  const pickScenario = (k: string) => { setScenario(k); if (SCENARIOS[k]) { setBtcG(SCENARIOS[k][0]); setDiffG(SCENARIOS[k][1]) } }

  const u = parseInt(units) || 18
  const loanMo = 3551 // AM $140k @10% 48mo, per plan
  const thRig = parseFloat(th) || 300
  const addMo = parseFloat(addIn) || 0
  const sideMo = parseFloat(side) || 0
  const e18 = parseFloat(earl18) || 0
  const e36 = parseFloat(earl36) || 0
  const bg = parseFloat(btcG) || 0
  const dg = parseFloat(diffG) || 0
  const hPct = Math.min(100, Math.max(0, parseFloat(hedgePct) || 0))
  const hMo = Math.min(12, Math.max(0, parseInt(hedgeMo) || 0))
  const hPx = parseFloat(hedgePx) || 0
  // Blend spot and locked hashprice while the forward tenor runs (op months 1..hMo).
  const effHp = (spot: number, opMonth: number) =>
    hPct > 0 && hPx > 0 && opMonth >= 1 && opMonth <= hMo ? spot * (1 - hPct / 100) + hPx * (hPct / 100) : spot

  // Calendar: month index 0 = the current month, always rolling.
  const now = new Date()
  const [ly, lm] = launch.split('-').map(Number)
  const launchIdx = Math.max(0, (ly - now.getFullYear()) * 12 + (lm - 1) - now.getMonth())
  const [ay, am] = (addStart || launch).split('-').map(Number)
  const addStartIdx = Math.max(0, (ay - now.getFullYear()) * 12 + (am - 1) - now.getMonth())
  const labelAt = (m: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1)
    return `${MONTH_NAMES[d.getMonth()]} ’${String(d.getFullYear()).slice(2)}`
  }
  const keyAt = (m: number) => {
    const d = new Date(now.getFullYear(), now.getMonth() + m, 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  }

  // April 2028 halving: subsidy 3.125→1.5625 BTC = hashprice ×0.5 from that month
  // (only if it's still ahead of us — past-halving spot already reflects it).
  const halvingIdx = (2028 - now.getFullYear()) * 12 + 3 - now.getMonth()
  const halved = (m: number) => (halvingIdx > 0 && m >= halvingIdx ? 0.5 : 1)

  // Price path per month for a prediction path: table while it lasts, then extrapolate.
  const priceSeries = (p: PathName, len: number): number[] => {
    const out: number[] = []
    let lastVal = btcPrice, lastM = 0
    for (let m = 0; m < len; m++) {
      const v = MONTHLY_BTC[p][keyAt(m)]
      if (v != null) { lastVal = v; lastM = m; out.push(v) }
      else out.push(lastVal * Math.pow(1 + EXTRAP_BTC_YR / 100, (m - lastM) / 12))
    }
    return out
  }
  const basePrice48 = priceSeries('base', 48)

  // Hashprice at month m: prediction mode rides the base monthly table; custom/preset
  // modes use %/yr drift. Both get the halving cut.
  const hpAt = (m: number) =>
    scenario === 'prediction'
      ? spotHashprice * halved(m) * (basePrice48[m] / btcPrice) / Math.pow(1 + DIFF_BY_PATH.base / 100, m / 12)
      : spotHashprice * halved(m) * Math.pow(1 + bg / 100, m / 12) / Math.pow(1 + dg / 100, m / 12)

  // 48-month engine: launch-aware, Luxor pool fee on revenue, Earl at op-months 18/36.
  // Add-in rule ("until Earl and the loan are easily paid" — Jacob 2026-07-27):
  // contribute addMo pre-launch, whenever the mine can't cover its own costs, and
  // until the war chest holds every remaining Earl repayment + a 3-month loan
  // cushion. Once all three clear, the add-in stops automatically.
  type Row = { live: boolean; revenue: number; hosting: number; loan: number; earl: number; mineNet: number; contrib: number; net: number; cum: number }
  const rows: Row[] = []
  let cum = parseFloat(chest) || 0
  for (let m = 0; m < 48; m++) {
    const live = m >= launchIdx
    const opMonth = m - launchIdx + 1
    const hosting = live ? u * (sunrise && halvingIdx > 0 && m >= halvingIdx ? 135 : 225) : 0
    const revenue = live ? effHp(hpAt(m), opMonth) * thRig * u * 30.42 * (1 - POOL_FEE) : 0
    const loan = live ? loanMo : 0
    const earl = opMonth === 18 ? e18 : opMonth === 36 ? e36 : 0
    const mineNet = live ? revenue - hosting - loan : 0
    const remainingEarl = (opMonth <= 18 ? e18 : 0) + (opMonth <= 36 ? e36 : 0)
    const contrib = m < addStartIdx ? 0
      : addMode === 'topup' ? (live ? Math.min(addMo, Math.max(0, -mineNet)) : 0)
      : (!live || mineNet < 0 || cum < remainingEarl + 3 * loanMo ? addMo : 0)
    const net = mineNet + contrib + sideMo - earl
    cum += net
    rows.push({ live, revenue, hosting, loan, earl, mineNet, contrib, net, cum })
  }
  const trough = Math.min(...rows.map((r) => r.cum))
  const troughMo = rows.findIndex((r) => r.cum === trough)
  const end48 = rows[47].cum
  const fmt = (n: number) => `${n < 0 ? '-' : '+'}$${Math.abs(Math.round(n)).toLocaleString()}`
  const usd0 = (n: number) => `$${Math.round(n).toLocaleString()}`

  // 24-month prediction rows per path (same engine + add-in rule, per-path prices/difficulty).
  const predRows = (p: PathName) => {
    const prices = priceSeries(p, PRED_MONTHS)
    let c = parseFloat(chest) || 0
    return prices.map((price, m) => {
      const live = m >= launchIdx
      const op = m - launchIdx + 1
      const hpm = spotHashprice * halved(m) * (price / btcPrice) / Math.pow(1 + DIFF_BY_PATH[p] / 100, m / 12)
      const revenue = live ? effHp(hpm, op) * thRig * u * 30.42 * (1 - POOL_FEE) : 0
      const hosting = live ? u * (sunrise && halvingIdx > 0 && m >= halvingIdx ? 135 : 225) : 0
      const mineNet = live ? revenue - hosting - loanMo : 0
      const remainingEarl = (op <= 18 ? e18 : 0) + (op <= 36 ? e36 : 0)
      const contrib = m < addStartIdx ? 0
        : addMode === 'topup' ? (live ? Math.min(addMo, Math.max(0, -mineNet)) : 0)
        : (!live || mineNet < 0 || c < remainingEarl + 3 * loanMo ? addMo : 0)
      const earl = op === 18 ? e18 : op === 36 ? e36 : 0
      const net = mineNet + contrib + sideMo - earl
      c += net
      return { price, live, revenue, mineNet, contrib, net, cum: c }
    })
  }
  const pred: Record<PathName, ReturnType<typeof predRows>> = { bear: predRows('bear'), base: predRows('base'), bull: predRows('bull') }

  // cumulative curve svg
  const w = 640, h = 110
  const lo = Math.min(trough, 0), hi = Math.max(...rows.map((r) => r.cum), 0)
  const span = hi - lo || 1
  const y = (v: number) => h - ((v - lo) / span) * (h - 10) - 5
  const pts = rows.map((r, i) => `${(i / 47) * w},${y(r.cum)}`).join(' ')
  const earlMarks = [launchIdx + 17, launchIdx + 35].filter((m) => m < 48)

  // ── Obligations & runway (Jacob 2026-08-02): monthly gap vs loan+hosting and
  // how long the war chest lasts with the $3k add-in and Earl repayments,
  // bear/base/bull side by side over the next 12 months. ──
  const obligationsMo = u * 225 + loanMo
  const runway = (p: PathName) => {
    const i = pred[p].findIndex((r) => r.cum < 0)
    return i < 0 ? '24mo+' : labelAt(i)
  }
  const launchRow = pred.base[Math.min(Math.max(launchIdx, 0), PRED_MONTHS - 1)]

  return (
    <div className="mt-3 border-t border-neutral-200 pt-3">
      <div className="mb-2 text-[11px] uppercase tracking-widest text-neutral-500">
        The final plan — 18 units · LuxOS OC 300TH · Luxor pool · Earl war chest · monthly add-in
      </div>

      {/* Obligations & war-chest runway */}
      <div className="mb-2 grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          { label: 'Obligations/mo (live)', value: usd0(obligationsMo), sub: `hosting ${usd0(u * 225)} + loan ${usd0(loanMo)}`, tone: 'text-neutral-800' },
          { label: 'First live month gap (base)', value: launchRow?.live ? fmt(launchRow.mineNet) : fmt(pred.base.find((r) => r.live)?.mineNet ?? 0), sub: 'mine revenue − obligations', tone: (launchRow?.live ? launchRow.mineNet : pred.base.find((r) => r.live)?.mineNet ?? 0) >= 0 ? 'text-green-600' : 'text-red-600' },
          { label: 'War chest at launch', value: usd0(launchIdx > 0 ? rows[launchIdx - 1].cum : parseFloat(chest) || 0), sub: `Earl $${Math.round((parseFloat(chest) || 0) / 1000)}k · your add-in from ${addStart}`, tone: 'text-neutral-800' },
          { label: 'War chest runway', value: runway('base'), sub: `bear ${runway('bear')} · bull ${runway('bull')} — with add-in + Earl paybacks`, tone: 'text-amber-600' },
        ].map((t) => (
          <div key={t.label} className="rounded border border-neutral-200 bg-white px-3 py-2">
            <div className="text-[10px] uppercase tracking-widest text-neutral-500">{t.label}</div>
            <div className={`font-mono text-xl font-bold ${t.tone}`}>{t.value}</div>
            <div className="text-[11px] text-neutral-500">{t.sub}</div>
          </div>
        ))}
      </div>

      {/* next 12 months: shortfall vs obligations + war chest, per path */}
      <div className="mb-3 overflow-x-auto">
        <table className="w-full border border-neutral-200 font-mono text-[11px]">
          <thead>
            <tr className="bg-neutral-100 text-left uppercase tracking-wide text-neutral-500">
              <th className="px-2 py-1">next 12 mo</th>
              <th className="px-2 py-1 text-red-700">bear gap</th>
              <th className="px-2 py-1">chest</th>
              <th className="px-2 py-1 text-amber-700">base gap</th>
              <th className="px-2 py-1">chest</th>
              <th className="px-2 py-1 text-green-700">bull gap</th>
              <th className="px-2 py-1">chest</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, m) => {
              const op = m - launchIdx + 1
              return (
                <tr key={m} className="border-t border-neutral-100">
                  <td className="px-2 py-0.5">{labelAt(m)}{m === launchIdx ? ' 🚀' : ''}{op === 18 ? ' 💰Earl' : ''}</td>
                  {(['bear', 'base', 'bull'] as PathName[]).map((p) => {
                    const r = pred[p][m]
                    return (
                      <Fragment key={p}>
                        <td className={`px-2 py-0.5 ${!r.live ? 'text-neutral-400' : r.mineNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.live ? fmt(r.mineNet) : 'pre-launch'}</td>
                        <td className={`px-2 py-0.5 ${r.cum >= 0 ? 'text-neutral-700' : 'font-bold text-red-600'}`}>{usd0(r.cum)}</td>
                      </Fragment>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
        <div className="mt-1 text-[10px] text-neutral-500">
          gap = mine revenue − hosting − loan (your money excluded) · chest = war chest after your ${Math.round(addMo / 1000)}k add-in, side income, and Earl repayments land · red chest = broke
        </div>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3 text-[13px]">
        {([
          ['units', units, setUnits, 'w-14'],
          ['TH/rig (OC)', th, setTh, 'w-16'],
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
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          add-in starts (job lands)
          <input type="month" value={addStart} onChange={(e) => setAddStart(e.target.value)}
            className="border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          add-in mode
          <select value={addMode} onChange={(e) => setAddMode(e.target.value as 'flat' | 'topup')}
            className="border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500">
            <option value="flat">flat — full $ when needed, stops early</option>
            <option value="topup">top-up — only the month&apos;s shortfall</option>
          </select>
        </label>
        <label className="flex items-center gap-1 pb-1 text-[11px] text-neutral-600">
          <input type="checkbox" checked={sunrise} onChange={(e) => setSunrise(e.target.checked)} />
          Sunrise $135 at halving
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-cyan-700">
          hedged % (Luxor fixed)
          <input value={hedgePct} onChange={(e) => setHedgePct(e.target.value)}
            className="w-16 border border-cyan-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-cyan-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-cyan-700">
          tenor (mo, ≤12)
          <input value={hedgeMo} onChange={(e) => setHedgeMo(e.target.value)}
            className="w-14 border border-cyan-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-cyan-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-cyan-700">
          locked $/TH/day
          <input value={hedgePx} onChange={(e) => setHedgePx(e.target.value)}
            className="w-20 border border-cyan-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-cyan-500" />
        </label>
        <label className="flex flex-col gap-1 text-[11px] text-neutral-600">
          path
          <select value={scenario} onChange={(e) => pickScenario(e.target.value)}
            className="border border-neutral-300 px-2 py-1 font-mono text-[13px] text-neutral-900 outline-none focus:border-amber-500">
            <option value="prediction">prediction (monthly table, base)</option>
            <option value="flat">flat (today forever)</option>
            <option value="bear">bear %/yr</option>
            <option value="bull">bull %/yr</option>
            <option value="custom">custom %/yr</option>
          </select>
        </label>
        {scenario !== 'prediction' && (
          <>
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
          </>
        )}
      </div>

      <div className="mb-2 flex flex-wrap gap-5 text-[13px]">
        <span>war chest at launch <b className="text-neutral-700">{usd0(launchIdx > 0 ? rows[launchIdx - 1].cum : parseFloat(chest) || 0)}</b></span>
        <span>deepest point <b className={trough < 0 ? 'text-red-600' : 'text-green-600'}>{fmt(trough)}</b> <span className="text-neutral-500">({labelAt(troughMo)})</span></span>
        <span>cash at month 48 <b className={end48 >= 0 ? 'text-green-600' : 'text-red-600'}>{fmt(end48)}</b></span>
        <span>hashprice mo 48 <b className="text-neutral-700">${hpAt(47).toFixed(4)}</b></span>
        <span>add-in stops <b className="text-neutral-700">{(() => { const i = rows.findIndex((r) => r.live && r.contrib === 0); return i < 0 ? 'never (48mo)' : labelAt(i) })()}</b> <span className="text-neutral-500">(total in: {usd0(rows.reduce((s, r) => s + r.contrib, 0))})</span></span>
        {hPct > 0 && hMo > 0 && (
          <span className="text-cyan-700">hedged <b>{hPct}%</b> @ ${hPx.toFixed(4)} for op-mo 1–{hMo} <span className="text-neutral-500">(locked share ignores difficulty + halving; real forwards price below spot — ask Luxor for a quote)</span></span>
        )}
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

      {/* 24-month prediction: monthly price tables (Claude × GPT merged), tab per month */}
      <div className="mt-4 mb-1 text-[11px] uppercase tracking-widest text-neutral-500">
        Next 24 months — monthly BTC predictions (Claude × GPT, merged 2026-07-27) — bear / base / bull
      </div>
      <div className="mb-2 flex items-center gap-1">
        <button onClick={() => setTab(Math.max(0, tab - 1))} disabled={tab === 0}
          className="border border-neutral-300 px-2 py-1 font-mono text-[12px] text-neutral-600 hover:border-amber-500 hover:text-amber-700 disabled:opacity-30">
          ◀
        </button>
        <select value={tab} onChange={(e) => setTab(Number(e.target.value))}
          className="border border-amber-500 bg-amber-50 px-2 py-1 font-mono text-[12px] text-amber-800 outline-none">
          {Array.from({ length: PRED_MONTHS }, (_, m) => (
            <option key={m} value={m}>{labelAt(m)}{m === halvingIdx ? ' ⛏½' : ''}</option>
          ))}
        </select>
        <button onClick={() => setTab(Math.min(PRED_MONTHS - 1, tab + 1))} disabled={tab === PRED_MONTHS - 1}
          className="border border-neutral-300 px-2 py-1 font-mono text-[12px] text-neutral-600 hover:border-amber-500 hover:text-amber-700 disabled:opacity-30">
          ▶
        </button>
      </div>
      <table className="w-full max-w-xl border border-neutral-200 font-mono text-[12px]">
        <thead>
          <tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-wide text-neutral-500">
            <th className="px-2 py-1">{labelAt(tab)}</th>
            <th className="px-2 py-1">BTC</th>
            <th className="px-2 py-1">revenue</th>
            <th className="px-2 py-1">mine net</th>
            <th className="px-2 py-1">my add-in</th>
            <th className="px-2 py-1">war chest</th>
          </tr>
        </thead>
        <tbody>
          {(['bear', 'base', 'bull'] as PathName[]).map((p) => {
            const r = pred[p][tab]
            return (
              <tr key={p} className={p === 'base' ? 'bg-amber-50/50' : ''}>
                <td className={`px-2 py-1 font-semibold ${p === 'bear' ? 'text-red-700' : p === 'bull' ? 'text-green-700' : 'text-amber-700'}`}>{p}</td>
                <td className="px-2 py-1">{usd0(r.price)}</td>
                <td className="px-2 py-1">{r.live ? usd0(r.revenue) : 'pre-launch'}</td>
                <td className={`px-2 py-1 ${!r.live ? 'text-neutral-400' : r.mineNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>{r.live ? fmt(r.mineNet) : '—'}</td>
                <td className={`px-2 py-1 ${r.contrib > 0 ? 'text-amber-700' : 'text-neutral-400'}`}>{r.contrib > 0 ? fmt(r.contrib) : 'stopped'}</td>
                <td className={`px-2 py-1 font-semibold ${r.cum >= 0 ? 'text-green-700' : 'text-red-600'}`}>{usd0(r.cum)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>

      <div className="mt-1 text-[11px] text-neutral-500">
        Add-in rule: your $3k/mo flows pre-launch, in any month the mine can&apos;t cover itself, and until the war chest holds all remaining Earl repayments + a 3-month loan cushion — then it stops automatically (&quot;until Earl and the loan are easily paid&quot;). &quot;Mine net&quot; = revenue − hosting − AM loan, your money excluded. Monthly predictions merged Claude + GPT-4o (2026-07-27) from live data (ATH $126k -48%, June low $58.6k, F&amp;G 30d avg 23, hashrate +7%/yr) and historical post-bottom speed (2019: +240% in 6mo; 2023: +160% in 13mo, ATH regained in 16). Base = Jacob&apos;s bottom-late-Sep/Oct thesis ($54.5k Oct) then a 2023-style recovery, prior ATH back ~Feb &apos;28; bear = $46.5k floor Nov; bull = June was the bottom. Difficulty +5/+10/+18%/yr per path; Luxor all-in fee 2.8% (pool + LuxOS OC dev fee) and the Apr &apos;28 halving (⛏½) are in every number. All revenue at LuxOS OC 300TH (needs Abundant&apos;s wattage OK). Models, not promises — refresh monthly. The 48-month curve rides the base table then +{EXTRAP_BTC_YR}%/yr.
      </div>
    </div>
  )
}
