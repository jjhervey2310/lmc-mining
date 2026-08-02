import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { getLivePriceData } from '@/lib/btc-price'
import { computeDailyNumbers } from '@/lib/daily-content'
import { getMarketQuotes } from '@/lib/markets'
import { Shell, Panel, Tile, DonutChart, checkAdmin, fetchPostiz, fetchHeygenQuota, denverDate, denverTime, usd } from './ui'
import FleetWhatIf from './fleet-whatif'
import PlanCashflow from './plan-cashflow'
import RivalEntry from './competition'

const COMP_START_CASH = 1000

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

const PLATFORM_ICON: Record<string, string> = { x: '𝕏', youtube: '▶', instagram: '📷', tiktok: '♪' }

export default async function Overview({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  const supabase = createServiceClient()
  const live = await getLivePriceData()
  const n = live && !('error' in live) ? computeDailyNumbers(live.price, live.difficulty) : null

  const today = denverDate()
  const weekEnd = new Date(Date.now() + 8 * 864e5).toISOString()
  const dayStart = new Date(Date.now() - 864e5).toISOString()

  const [snapshots, leads, cache, jobs, income, posts, quota, trades, weekly, quotes] = await Promise.all([
    supabase?.from('hashprice_snapshots').select('snapshot_date, btc_price').order('snapshot_date', { ascending: false }).limit(14) ?? null,
    supabase?.from('leads').select('lead_type, created_at') ?? null,
    supabase?.from('make_content_cache').select('cache_date, source, payload').gte('cache_date', today).order('cache_date').limit(8) ?? null,
    // Fresh-daily wire: today's discoveries only (never repeated), NEWEST-POSTED first —
    // postings may be up to 14 days old when needed to fill the wire (Jacob 2026-07-28).
    supabase?.from('job_finds').select('title, company, url, source, found_at, salary, posted_at').gte('found_at', dayStart).neq('status','applied').neq('status','hidden').order('posted_at', { ascending: false, nullsFirst: false }).order('fit_score', { ascending: false }).limit(25) ?? null,
    supabase?.from('income_log').select('amount, source, received_at').gte('received_at', new Date(Date.now() - 60 * 864e5).toISOString()) ?? null,
    fetchPostiz(dayStart, weekEnd),
    fetchHeygenQuota(),
    supabase?.from('comp_trades').select('traded_at, action, symbol, qty, price, note').order('traded_at') ?? null,
    supabase?.from('comp_weekly').select('week_of, contestant, cash_total').order('week_of', { ascending: false }).limit(30) ?? null,
    getMarketQuotes().catch(() => [] as Awaited<ReturnType<typeof getMarketQuotes>>),
  ])

  // ── trading competition: positions from the trade ledger (average cost) ──
  const tradeRows = trades?.data ?? []
  const book: Record<string, { qty: number; cost: number }> = {}
  let compCash = COMP_START_CASH
  for (const t of tradeRows) {
    const qty = Number(t.qty), price = Number(t.price)
    const p = (book[t.symbol] ??= { qty: 0, cost: 0 })
    if (t.action === 'buy') {
      p.qty += qty; p.cost += qty * price; compCash -= qty * price
    } else {
      const avg = p.qty ? p.cost / p.qty : 0
      p.qty -= qty; p.cost -= qty * avg; compCash += qty * price
    }
  }
  const priceOf = (sym: string) => quotes?.find((q) => q.symbol === sym)?.price
  const positions = Object.entries(book).filter(([, p]) => p.qty > 1e-12).map(([symbol, p]) => {
    const live = priceOf(symbol)
    const value = live != null ? p.qty * live : null
    return { symbol, qty: p.qty, avg: p.cost / p.qty, spent: p.cost, live, value, pnl: value != null ? value - p.cost : null }
  })
  const holdingsValue = positions.reduce((s, p) => s + (p.value ?? p.spent), 0)
  const compTotal = compCash + holdingsValue
  const weeklyRows = weekly?.data ?? []
  const latestRival = (name: string) => weeklyRows.find((w) => w.contestant === name)
  const board = [
    { name: 'CLAUDE', total: compTotal, week: 'live' },
    ...['gpt', 'gemini', 'perplexity'].map((c) => {
      const r = latestRival(c)
      return { name: c.toUpperCase(), total: r ? Number(r.cash_total) : null, week: r ? String(r.week_of) : '—' }
    }),
  ].sort((a, b) => (b.total ?? -1) - (a.total ?? -1))

  const allPosts = posts ?? []
  const todayPosts = allPosts
    .filter((p) => denverDate(new Date(p.publishDate)) === today)
    .sort((a, b) => a.publishDate.localeCompare(b.publishDate))
  const nowMs = Date.now()
  const nextPost = todayPosts.find((p) => new Date(p.publishDate).getTime() > nowMs && p.state === 'QUEUE')
  const queued = allPosts.filter((p) => p.state === 'QUEUE').length
  const countdown = nextPost
    ? (() => {
        const mins = Math.round((new Date(nextPost.publishDate).getTime() - nowMs) / 60000)
        return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m`
      })()
    : null

  const leadRows = leads?.data ?? []
  const leads7d = leadRows.filter((l) => Date.now() - new Date(l.created_at).getTime() < 7 * 864e5).length
  const leadsPrev7d = leadRows.filter((l) => {
    const age = Date.now() - new Date(l.created_at).getTime()
    return age >= 7 * 864e5 && age < 14 * 864e5
  }).length
  const btcSeries = (snapshots?.data ?? []).map((r) => Number(r.btc_price)).reverse()
  const cacheRows = (cache?.data ?? []) as { cache_date: string; source: string; payload: { theme?: string; hook?: string } }[]
  const incomeRows = income?.data ?? []
  const mtdStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime()
  const incomeMTD = incomeRows.filter((r) => new Date(r.received_at).getTime() >= mtdStart).reduce((a, r) => a + Number(r.amount), 0)
  const income30d = incomeRows.filter((r) => Date.now() - new Date(r.received_at).getTime() < 30 * 864e5).reduce((a, r) => a + Number(r.amount), 0)

  const health: { label: string; ok: boolean }[] = [
    { label: 'DATA FEED', ok: !!n },
    { label: 'CONTENT BANKED', ok: cacheRows.length > 0 },
    { label: 'QUEUE', ok: queued >= 4 },
    { label: 'RENDER BUDGET', ok: (quota ?? 0) >= 600 },
  ]

  return (
    <Shell secret={secret} active="overview" jobs={jobs?.data ?? []}>
      {/* Today's schedule: next-up focus + timeline strip */}
      <Panel
        title="Today's posts"
        right={<span className="text-[11px] text-neutral-500">{today} DEN</span>}
      >
        {nextPost ? (
          <div className="mb-3 flex flex-wrap items-baseline gap-3 border border-amber-400 bg-amber-50 px-3 py-2">
            <span className="text-[11px] uppercase tracking-widest text-neutral-600">Next up</span>
            <span className="text-2xl text-amber-600">{denverTime(nextPost.publishDate)} {PLATFORM_ICON[nextPost.platform] || ''} {nextPost.platform.toUpperCase()}</span>
            <span className="text-lg text-green-600">T-{countdown}</span>
            <span className="w-full truncate text-[12px] text-neutral-600 sm:w-auto sm:flex-1">{nextPost.content.split('\n')[0].slice(0, 80)}</span>
          </div>
        ) : (
          <div className="mb-3 text-[13px] text-neutral-600">
            {todayPosts.length ? 'All of today’s posts are out.' : 'Nothing scheduled today — check the CONTENT tab.'}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          {todayPosts.map((p) => {
            const past = new Date(p.publishDate).getTime() <= nowMs || p.state === 'PUBLISHED'
            const isNext = p.id === nextPost?.id
            return (
              <div key={p.id}
                className={`border px-2 py-1 text-[13px] ${isNext ? 'border-amber-500 text-amber-600' : past ? 'border-neutral-200 text-neutral-500' : 'border-neutral-300 text-neutral-800'}`}>
                {denverTime(p.publishDate)} {PLATFORM_ICON[p.platform] || ''} {p.platform}{past ? ' ✓' : ''}
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Health line */}
      <div className="my-3 flex flex-wrap gap-4 border border-neutral-200 bg-white px-3 py-1.5 text-[12px]">
        {health.map((h) => (
          <span key={h.label} className={h.ok ? 'text-green-600' : 'text-red-600'}>● {h.label}</span>
        ))}
        <span className="text-neutral-500">PA watchdog 6am — fixes first, emails only when needed</span>
      </div>

      {/* Big numbers + deltas + sparklines */}
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile label="BTC" value={n ? `$${usd(n.btcPrice, 0)}` : '—'} spark={btcSeries}
          prev={btcSeries.length > 1 ? `$${usd(btcSeries[btcSeries.length - 2], 0)}` : undefined}
          changePct={n && btcSeries.length > 1 ? ((n.btcPrice - btcSeries[btcSeries.length - 2]) / btcSeries[btcSeries.length - 2]) * 100 : undefined} />
        <Tile label="Hashprice $/TH/d" value={n ? `$${usd(n.hashpricePerThDay, 4)}` : '—'} />
        <Tile label="S21 XP net/day" value={n ? `${n.profitable ? '+' : '-'}$${usd(Math.abs(n.s21NetDay))}` : '—'} tone={n?.profitable ? 'pos' : 'neg'} sub={n ? `breakeven $${usd(n.breakevenBtcPrice, 0)} · Abundant Mines $225/mo flat` : undefined} />
        <Tile label="Difficulty" value={n ? `${(n.difficulty / 1e12).toFixed(1)}T` : '—'} />
        <Tile label="Leads 7d" value={String(leads7d)} tone={leads7d >= leadsPrev7d ? 'pos' : 'neg'} prev={String(leadsPrev7d)}
          changePct={leadsPrev7d ? ((leads7d - leadsPrev7d) / leadsPrev7d) * 100 : undefined} sub={`total ${leadRows.length}`} />
        <Tile label="Posts queued" value={String(queued)} tone={queued >= 4 ? 'amber' : 'neg'} sub="next 7 days" />
        <Tile label="HeyGen units" value={quota !== null ? String(quota) : '—'} tone={(quota ?? 0) >= 600 ? 'amber' : (quota ?? 0) >= 300 ? 'dim' : 'neg'} sub="week burns ~300–550" />
        <Tile label="Content banked" value={`${cacheRows.length}d`} tone={cacheRows.length ? 'amber' : 'neg'} sub="gate-passed days ahead" />
        <Tile label="Non-mining income MTD" value={`$${usd(incomeMTD, 0)}`} tone={incomeMTD >= 2300 ? 'pos' : incomeMTD > 0 ? 'amber' : 'neg'} sub={`target $2,300/mo · tell the PA "log $97 audit"`} />
      </div>

      {/* Trading competition: Claude vs GPT vs Gemini vs Perplexity, $1,000 each */}
      <div className="mt-3">
        <Panel title="🏆 Trading competition — my $1,000" right={<span className="text-[11px] text-neutral-500">winner keeps the membership</span>}>
          <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            <Tile label="Total (cash + holdings)" value={`$${usd(compTotal)}`} tone={compTotal >= COMP_START_CASH ? 'pos' : 'neg'}
              changePct={((compTotal - COMP_START_CASH) / COMP_START_CASH) * 100} prev={`$${usd(COMP_START_CASH, 0)} start`} />
            <Tile label="Cash in bank" value={`$${usd(compCash)}`} sub={`${((compCash / compTotal) * 100).toFixed(0)}% dry powder`} />
            <Tile label="Holdings value" value={`$${usd(holdingsValue)}`} sub={`${positions.length} position${positions.length === 1 ? '' : 's'}`} />
            <Tile label="Unrealized P&L" value={(() => { const t = positions.reduce((s, p) => s + (p.pnl ?? 0), 0); return `${t >= 0 ? '+' : '-'}$${usd(Math.abs(t))}` })()}
              tone={positions.reduce((s, p) => s + (p.pnl ?? 0), 0) >= 0 ? 'pos' : 'neg'} />
          </div>

          <table className="w-full max-w-2xl border border-neutral-200 font-mono text-[12px]">
            <thead>
              <tr className="bg-neutral-100 text-left text-[11px] uppercase tracking-wide text-neutral-500">
                <th className="px-2 py-1">held</th>
                <th className="px-2 py-1">qty</th>
                <th className="px-2 py-1">paid avg</th>
                <th className="px-2 py-1">spent</th>
                <th className="px-2 py-1">now</th>
                <th className="px-2 py-1">value</th>
                <th className="px-2 py-1">p&l</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.symbol} className="border-t border-neutral-100">
                  <td className="px-2 py-1 font-semibold text-amber-700">{p.symbol}</td>
                  <td className="px-2 py-1">{p.qty.toLocaleString('en-US', { maximumFractionDigits: 8 })}</td>
                  <td className="px-2 py-1">${usd(p.avg, p.avg < 10 ? 4 : 2)}</td>
                  <td className="px-2 py-1">${usd(p.spent)}</td>
                  <td className="px-2 py-1">{p.live != null ? `$${usd(p.live, p.live < 10 ? 4 : 2)}` : '—'}</td>
                  <td className="px-2 py-1">{p.value != null ? `$${usd(p.value)}` : '—'}</td>
                  <td className={`px-2 py-1 ${(p.pnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {p.pnl != null ? `${p.pnl >= 0 ? '+' : '-'}$${usd(Math.abs(p.pnl))} (${((p.pnl / p.spent) * 100).toFixed(1)}%)` : '—'}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-neutral-200 bg-neutral-50">
                <td className="px-2 py-1 font-semibold text-neutral-700">CASH</td>
                <td className="px-2 py-1" colSpan={4}></td>
                <td className="px-2 py-1">${usd(compCash)}</td>
                <td className="px-2 py-1"></td>
              </tr>
            </tbody>
          </table>

          {tradeRows.length > 0 && (
            <div className="mt-2 space-y-0.5 text-[11px] text-neutral-500">
              {tradeRows.slice(-4).reverse().map((t, i) => (
                <div key={i}>
                  <span className={t.action === 'buy' ? 'text-green-700' : 'text-red-700'}>{t.action.toUpperCase()}</span>
                  {' '}{Number(t.qty).toLocaleString('en-US', { maximumFractionDigits: 8 })} {t.symbol} @ ${usd(Number(t.price), Number(t.price) < 10 ? 4 : 2)}
                  {' · '}{String(t.traded_at).slice(0, 10)}{t.note ? ` — ${t.note}` : ''}
                </div>
              ))}
            </div>
          )}

          <div className="mt-3 border-t border-neutral-200 pt-2">
            <div className="mb-1 text-[11px] uppercase tracking-widest text-neutral-600">Leaderboard — latest reported</div>
            <div className="mb-2 flex flex-wrap gap-2">
              {board.map((b, i) => (
                <div key={b.name} className={`border px-3 py-1.5 font-mono text-[13px] ${i === 0 && b.total != null ? 'border-amber-500 bg-amber-50' : 'border-neutral-200'}`}>
                  <span className="text-neutral-500">#{i + 1}</span>{' '}
                  <span className={b.name === 'CLAUDE' ? 'font-bold text-amber-700' : 'text-neutral-700'}>{b.name}</span>{' '}
                  <span className={b.total == null ? 'text-neutral-400' : b.total >= COMP_START_CASH ? 'text-green-600' : 'text-red-600'}>
                    {b.total != null ? `$${usd(b.total)}` : 'no report'}
                  </span>{' '}
                  <span className="text-[10px] text-neutral-400">{b.week}</span>
                </div>
              ))}
            </div>
            <RivalEntry secret={secret} />
          </div>
        </Panel>
      </div>

      {/* Proportions */}
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <Panel title="Queue mix — by platform">
          <DonutChart center={String(queued)} data={Object.entries(
            allPosts.filter((p) => p.state === 'QUEUE').reduce<Record<string, number>>((a, p) => { a[p.platform] = (a[p.platform] || 0) + 1; return a }, {})
          ).map(([label, value]) => ({ label, value }))} />
        </Panel>
        <Panel title="Leads — by type">
          <DonutChart center={String(leadRows.length)} data={Object.entries(
            leadRows.reduce<Record<string, number>>((a, l) => { const t = (l as { lead_type?: string }).lead_type || '?'; a[t] = (a[t] || 0) + 1; return a }, {})
          ).map(([label, value]) => ({ label: label.replace('_', ' '), value }))} />
        </Panel>
      </div>

      {/* 18-rig fleet simulation (Jacob's fleet plan) */}
      <div className="mt-3">
        <Panel title="⛏ 18-rig fleet P&L — simulated" right={<span className="text-[11px] text-neutral-500">live price+difficulty · Abundant Mines $225/mo per rig</span>}>
          {n ? (
            <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
              <Tile label="Gross/day" value={`$${usd(18 * n.s21GrossDay)}`} />
              <Tile label="Hosting/day" value={`$${usd(18 * 7.5)}`} sub="$4,050/mo" />
              <Tile label="Net/day" value={`${18 * n.s21NetDay >= 0 ? '+' : '-'}$${usd(Math.abs(18 * n.s21NetDay))}`} tone={18 * n.s21NetDay >= 0 ? 'pos' : 'neg'} />
              <Tile label="Net/month" value={`${18 * n.s21NetDay >= 0 ? '+' : '-'}$${usd(Math.abs(18 * n.s21NetDay * 30), 0)}`} tone={18 * n.s21NetDay >= 0 ? 'pos' : 'neg'} />
              <Tile label="Net/year" value={`${18 * n.s21NetDay >= 0 ? '+' : '-'}$${usd(Math.abs(18 * n.s21NetDay * 365), 0)}`} tone={18 * n.s21NetDay >= 0 ? 'pos' : 'neg'} sub="difficulty drift not modeled" />
            </div>
          ) : <span className="text-[13px] text-red-600">Live data unavailable</span>}
          {n && <FleetWhatIf spotHashprice={n.hashpricePerThDay} rigs={18} thPerRig={270} hostingDayFleet={18 * 7.5} />}
          {n && <PlanCashflow spotHashprice={n.hashpricePerThDay} btcPrice={n.btcPrice} liveSideIncome={income30d} />}
        </Panel>
      </div>

      {/* Week strip */}
      <div className="mt-3">
        <Panel title="Week ahead — banked content">
          {cacheRows.length ? (
            <div className="space-y-1">
              {cacheRows.map((c) => (
                <div key={c.cache_date} className="grid grid-cols-[70px_120px_1fr] gap-2 text-[13px]">
                  <span className="text-amber-500">{c.cache_date.slice(5)}</span>
                  <span className={c.source === 'engine' ? 'text-green-600' : 'text-yellow-600'}>{c.payload?.theme || c.source}</span>
                  <span className="truncate text-neutral-600">{c.payload?.hook}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-[13px] text-red-600">Nothing banked — the 6am watchdog regenerates; see CONTENT tab.</span>
          )}
        </Panel>
      </div>
    </Shell>
  )
}
