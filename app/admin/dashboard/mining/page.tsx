import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers } from '@/lib/daily-content'
import { Shell, Panel, Tile, Spark, checkAdmin, usd } from '../ui'

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function MiningPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const supabase = createServiceClient()
  const live = await getLivePriceData()
  const n = live && !('error' in live) ? computeDailyNumbers(live.price, live.difficulty) : null

  const [snapshots, jobs] = await Promise.all([
    supabase?.from('hashprice_snapshots').select('*').order('snapshot_date', { ascending: false }).limit(30) ?? null,
    supabase?.from('job_finds').select('title, company, url, source, found_at').order('found_at', { ascending: false }).limit(12) ?? null,
  ])
  const rows = (snapshots?.data ?? []) as { snapshot_date: string; btc_price: number; difficulty?: number; hashprice_usd_per_th_day?: number }[]
  const series = rows.map((r) => Number(r.btc_price)).reverse()

  return (
    <Shell secret={secret} active="mining" jobs={jobs?.data ?? []}>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="BTC" value={n ? `$${usd(n.btcPrice, 0)}` : '—'} />
        <Tile label="Hashprice $/TH/d" value={n ? `$${usd(n.hashpricePerThDay, 4)}` : '—'} />
        <Tile label="S21 XP net/day" value={n ? `${n.profitable ? '+' : '-'}$${usd(Math.abs(n.s21NetDay))}` : '—'} tone={n?.profitable ? 'pos' : 'neg'} />
        <Tile label="Breakeven BTC" value={n ? `$${usd(n.breakevenBtcPrice, 0)}` : '—'} sub="at $225/mo hosting" />
        <Tile label="Difficulty" value={n ? `${(n.difficulty / 1e12).toFixed(2)}T` : '—'} />
        <Tile label="S21 XP gross/day" value={n ? `$${usd(n.s21GrossDay)}` : '—'} />
        <Tile label="Margin above breakeven" value={n ? `${(((n.btcPrice - n.breakevenBtcPrice) / n.breakevenBtcPrice) * 100).toFixed(1)}%` : '—'} tone={n && n.btcPrice > n.breakevenBtcPrice ? 'pos' : 'neg'} />
        <Tile label="Snapshots" value={String(rows.length)} sub="daily 00:00 UTC" />
      </div>

      <div className="mt-3">
        <Panel title={`BTC — last ${series.length} snapshots`}>
          <Spark points={series} w={640} h={120} />
          <table className="mt-3 w-full text-[12px]">
            <thead><tr className="text-left text-[10px] uppercase tracking-widest text-neutral-600"><th>date</th><th>BTC</th><th>difficulty</th><th>hashprice</th></tr></thead>
            <tbody>
              {rows.slice(0, 14).map((r) => (
                <tr key={r.snapshot_date} className="border-t border-neutral-900">
                  <td className="py-0.5 text-neutral-500">{r.snapshot_date}</td>
                  <td className="text-amber-400">${usd(Number(r.btc_price), 0)}</td>
                  <td className="text-neutral-400">{r.difficulty ? `${(Number(r.difficulty) / 1e12).toFixed(1)}T` : '—'}</td>
                  <td className="text-neutral-400">{r.hashprice_usd_per_th_day ? `$${usd(Number(r.hashprice_usd_per_th_day), 4)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>
    </Shell>
  )
}
