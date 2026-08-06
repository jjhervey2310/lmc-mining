import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers } from '@/lib/daily-content'
import { Shell, Panel, Tile, checkAdmin, usd } from '../ui'
import TrendChart from '../trend-chart'
import FleetWhatIf from '../fleet-whatif'
import PlanCashflow from '../plan-cashflow'

// MINE SIM — live mining economics plus the full Lightning Mines fleet plan:
// spot tiles with day-over-day deltas, retarget countdown, 18-rig P&L, the
// what-if sliders, and the 48-month plan simulator.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function MiningPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const supabase = createServiceClient()
  const live = await getLivePriceData()
  const n = live && !('error' in live) ? computeDailyNumbers(live.price, live.difficulty) : null

  const [snapshots, income, retarget] = await Promise.all([
    supabase?.from('hashprice_snapshots').select('snapshot_date, btc_price, difficulty, hashprice_usd').order('snapshot_date', { ascending: false }).limit(30) ?? null,
    supabase?.from('income_log').select('amount, received_at').gte('received_at', new Date(Date.now() - 30 * 864e5).toISOString()) ?? null,
    fetch('https://mempool.space/api/v1/difficulty-adjustment', { next: { revalidate: 300 } })
      .then((r) => (r.ok ? (r.json() as Promise<{ remainingTime: number; difficultyChange: number }>) : null))
      .catch(() => null),
  ])

  const rows = (snapshots?.data ?? []) as { snapshot_date: string; btc_price: number; difficulty?: number; hashprice_usd?: number }[]
  const series = rows.map((r) => Number(r.btc_price)).reverse()
  const income30d = (income?.data ?? []).reduce((a, r) => a + Number(r.amount), 0)

  // Yesterday's snapshot → live vs prev % (index 1: index 0 is today's midnight snapshot).
  const prevSnap = rows[1]
  const prevN = prevSnap && Number(prevSnap.difficulty) > 0 ? computeDailyNumbers(Number(prevSnap.btc_price), Number(prevSnap.difficulty)) : null
  // Signed by |prev| so improving from a negative net still reads as "up".
  const pctVs = (cur: number, prev: number | undefined | null) =>
    prev != null && Math.abs(prev) > 1e-9 ? ((cur - prev) / Math.abs(prev)) * 100 : undefined

  return (
    <Shell secret={secret} active="mining">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="BTC" value={n ? `$${usd(n.btcPrice, 0)}` : '—'} spark={series.slice(-14)}
          prev={series.length > 1 ? `$${usd(series[series.length - 2], 0)}` : undefined}
          changePct={n && series.length > 1 ? ((n.btcPrice - series[series.length - 2]) / series[series.length - 2]) * 100 : undefined} />
        <Tile accent="cyan" label="Hashprice $/TH/d" value={n ? `$${usd(n.hashpricePerThDay, 4)}` : '—'}
          prev={prevN ? `$${usd(prevN.hashpricePerThDay, 4)}` : undefined}
          changePct={n && prevN ? pctVs(n.hashpricePerThDay, prevN.hashpricePerThDay) : undefined} />
        <Tile accent="green" label="S21 XP net/day" value={n ? `${n.profitable ? '+' : '-'}$${usd(Math.abs(n.s21NetDay))}` : '—'} tone={n?.profitable ? 'pos' : 'neg'}
          prev={prevN ? `${prevN.s21NetDay >= 0 ? '+' : '-'}$${usd(Math.abs(prevN.s21NetDay))}` : undefined}
          changePct={n && prevN ? pctVs(n.s21NetDay, prevN.s21NetDay) : undefined}
          sub={n ? `stock 270TH · no pool fee · breakeven $${usd(n.breakevenBtcPrice, 0)}` : undefined} />
        <Tile accent="purple" label="Difficulty" value={n ? `${(n.difficulty / 1e12).toFixed(1)}T` : '—'}
          prev={prevSnap?.difficulty ? `${(Number(prevSnap.difficulty) / 1e12).toFixed(1)}T` : undefined}
          changePct={n && prevSnap?.difficulty ? pctVs(n.difficulty, Number(prevSnap.difficulty)) : undefined}
          sub={retarget ? (() => {
            const totalMin = Math.max(0, Math.floor(retarget.remainingTime / 60000))
            const d = Math.floor(totalMin / 1440), h = Math.floor((totalMin % 1440) / 60)
            return `retarget in ${d}d ${h}h · est ${retarget.difficultyChange >= 0 ? '+' : ''}${retarget.difficultyChange.toFixed(1)}%`
          })() : undefined} />
        <Tile accent="cyan" label="S21 XP gross/day" value={n ? `$${usd(n.s21GrossDay)}` : '—'} sub="stock 270TH · no pool fee" />
        <Tile accent="green" label="Margin above breakeven" value={n ? `${(((n.btcPrice - n.breakevenBtcPrice) / n.breakevenBtcPrice) * 100).toFixed(1)}%` : '—'} tone={n && n.btcPrice > n.breakevenBtcPrice ? 'pos' : 'neg'} />
        <Tile accent="teal" label="Non-mining income 30d" value={`$${usd(income30d, 0)}`} tone={income30d >= 2300 ? 'pos' : income30d > 0 ? 'amber' : 'neg'} sub={`target $2,300/mo · tell the PA "log $97 audit"`} />
        <Tile accent="purple" label="Snapshots" value={String(rows.length)} sub="daily 00:00 UTC" />
      </div>

      {/* 18-rig fleet simulation (Jacob's fleet plan). ONE config drives every
          number in this panel: LuxOS OC 300TH, Luxor 2.8% all-in fee, hosting
          billed monthly at 18×$225. Month = day×30.42, year = month×12 — the
          conventions reconcile exactly (audit fix 2026-08-05). */}
      <div className="mt-3">
        <Panel accent="green" title="⛏ 18-rig fleet P&L — OC 300TH · Luxor 2.8%" right={<span className="text-[11px] text-neutral-500">live price+difficulty · Abundant Mines $225/mo per rig</span>}>
          {n ? (() => {
            const grossDay = n.hashpricePerThDay * 300 * 18 * (1 - 0.028)
            const hostMo = 18 * 225
            const hostDay = hostMo / 30.42
            const netDay = grossDay - hostDay
            const netMo = netDay * 30.42
            const sign = (v: number) => (v >= 0 ? '+' : '-')
            return (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <Tile accent="green" label="Revenue/day" value={`$${usd(grossDay)}`} sub="300TH × 18 · after 2.8% fee" />
                <Tile accent="green" label="Hosting" value={`$${usd(hostMo, 0)}/mo`} sub={`$${usd(hostDay)}/day`} />
                <Tile accent="green" label="Net/day" value={`${sign(netDay)}$${usd(Math.abs(netDay))}`} tone={netDay >= 0 ? 'pos' : 'neg'} />
                <Tile accent="green" label="Net/month" value={`${sign(netMo)}$${usd(Math.abs(netMo), 0)}`} tone={netMo >= 0 ? 'pos' : 'neg'} sub="30.42 days" />
                <Tile accent="green" label="Net/year" value={`${sign(netMo)}$${usd(Math.abs(netMo * 12), 0)}`} tone={netMo >= 0 ? 'pos' : 'neg'} sub="month × 12 · difficulty drift not modeled" />
              </div>
            )
          })() : <span className="text-[13px] text-red-600">Live data unavailable</span>}
          {n && <FleetWhatIf spotHashprice={n.hashpricePerThDay} rigs={18} hostingMoFleet={18 * 225} />}
          {n && <PlanCashflow spotHashprice={n.hashpricePerThDay} btcPrice={n.btcPrice} liveSideIncome={income30d} />}
        </Panel>
      </div>

      <div className="mt-3">
        <Panel accent="cyan" title={`Snapshots — last ${series.length} days`} right={<span className="text-[11px] text-neutral-500">BTC · hashprice · difficulty · each scaled to its own range</span>}>
          <TrendChart
            labels={rows.map((r) => r.snapshot_date).reverse()}
            series={[
              { key: 'btc', label: 'BTC', color: '#fbbf24', points: series, format: (v: number) => `$${usd(v, 0)}` },
              { key: 'hp', label: 'Hashprice', color: '#67e8f9', points: rows.map((r) => Number(r.hashprice_usd)).reverse().filter((v: number) => isFinite(v) && v > 0), format: (v: number) => `$${usd(v, 4)}` },
              { key: 'diff', label: 'Difficulty', color: '#c4b5fd', points: rows.map((r) => Number(r.difficulty)).reverse().filter((v: number) => isFinite(v) && v > 0), format: (v: number) => `${(v / 1e12).toFixed(1)}T` },
            ].filter((s) => s.points.length > 1)}
          />
          <table className="mt-3 w-full text-[13px]">
            <thead><tr className="text-left text-[11px] uppercase tracking-widest text-neutral-500"><th>date</th><th>BTC</th><th>difficulty</th><th>hashprice</th></tr></thead>
            <tbody>
              {rows.slice(0, 14).map((r) => (
                <tr key={r.snapshot_date} className="border-t border-neutral-100">
                  <td className="py-0.5 text-neutral-600">{r.snapshot_date}</td>
                  <td className="text-amber-600">${usd(Number(r.btc_price), 0)}</td>
                  <td className="text-neutral-700">{r.difficulty ? `${(Number(r.difficulty) / 1e12).toFixed(1)}T` : '—'}</td>
                  <td className="text-neutral-700">{r.hashprice_usd ? `$${usd(Number(r.hashprice_usd), 4)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </Shell>
  )
}
