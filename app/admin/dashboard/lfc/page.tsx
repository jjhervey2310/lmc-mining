import type { Metadata } from 'next'
import { Shell, checkAdmin } from '../ui'
import NewsColumn from './news-column'
import AnfieldBackdrop from './anfield'
import { getFixtures, getTable, getNews, getRomano } from '@/lib/lfc'

// LFC — the one page on the terminal that ignores the house palette entirely.
// Liverpool red (#C8102E) and Anfield gold (#F6EB61) throughout, per Jacob:
// "make sure that page is completely Liverpool'd".

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

const RED = '#C8102E'
const GOLD = '#F6EB61'

function LfcPanel({ title, right, children }: { title: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-[#1a0206] shadow-lg">
      <div className="flex items-baseline justify-between px-3 py-2" style={{ background: RED }}>
        <span className="text-[12px] font-bold uppercase tracking-widest text-white">{title}</span>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </div>
  )
}

export default async function LfcPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)

  const [fixtures, table, news, romano] = await Promise.all([
    getFixtures().catch(() => ({ next: [], last: [] })),
    getTable().catch(() => []),
    getNews().catch(() => []),
    getRomano().catch(() => []),
  ])
  const romanoLfc = romano.filter((p) => p.lfc).slice(0, 6)

  const lfc = table.find((r) => r.isLiverpool)
  const nextUp = fixtures.next[0]
  const form = fixtures.last.slice(0, 5).map((f) => {
    if (f.homeScore == null || f.awayScore == null) return '·'
    const us = f.home ? f.homeScore : f.awayScore
    const them = f.home ? f.awayScore : f.homeScore
    return us > them ? 'W' : us < them ? 'L' : 'D'
  })

  const kickoff = (ts: string | null, date: string | null) => {
    const d = ts ? new Date(ts.replace(' ', 'T') + 'Z') : date ? new Date(date) : null
    if (!d || isNaN(d.getTime())) return date ?? 'TBC'
    return d.toLocaleString('en-US', { timeZone: 'America/Denver', weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <Shell secret={secret} active="lfc">
      {/* Anfield header */}
      <div className="relative mb-3 min-h-[220px] overflow-hidden rounded-xl border border-white/10">
        <AnfieldBackdrop />
        <div className="relative flex flex-wrap items-center justify-between gap-3 px-4 pb-4 pt-5">
          <div>
            <div className="text-2xl font-black uppercase tracking-tight text-white">Liverpool FC</div>
            <div className="text-[12px] font-semibold italic" style={{ color: GOLD }}>You&apos;ll Never Walk Alone</div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            {lfc && (
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/70">Position</div>
                <div className="font-mono text-3xl font-black text-white">{lfc.rank}<span className="text-sm">{lfc.rank === 1 ? 'st' : lfc.rank === 2 ? 'nd' : lfc.rank === 3 ? 'rd' : 'th'}</span></div>
              </div>
            )}
            {lfc && (
              <div className="text-center">
                <div className="text-[10px] uppercase tracking-widest text-white/70">Points</div>
                <div className="font-mono text-3xl font-black" style={{ color: GOLD }}>{lfc.points}</div>
              </div>
            )}
            {form.length > 0 && (
              <div className="text-center">
                <div className="mb-1 text-[10px] uppercase tracking-widest text-white/70">Form</div>
                <div className="flex gap-1">
                  {form.reverse().map((r, i) => (
                    <span key={i} className={`flex h-6 w-6 items-center justify-center rounded text-[11px] font-black ${
                      r === 'W' ? 'bg-emerald-500 text-white' : r === 'D' ? 'bg-neutral-400 text-black' : r === 'L' ? 'bg-black/50 text-white/80' : 'bg-white/20 text-white/60'
                    }`}>{r}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {nextUp && (
          <div className="relative border-t border-white/20 bg-black/40 px-4 py-2 text-[13px] text-white">
            <span className="font-bold uppercase tracking-wide" style={{ color: GOLD }}>Next up</span>
            {' · '}{nextUp.home ? 'vs' : 'away to'} <b>{nextUp.opponent}</b>
            {' · '}{kickoff(nextUp.timestamp, nextUp.date)} DEN
            {nextUp.league ? ` · ${nextUp.league}` : ''}
          </div>
        )}
      </div>

      <div className="grid gap-3 lg:grid-cols-[1fr_360px]">
        {/* Transfer news column — the main event */}
        <LfcPanel title="📰 Transfer news & LFC wire" right={<span className="text-[10px] text-white/70">tap a story to interrogate it</span>}>
          <NewsColumn items={news} secret={secret} />
          <div className="mt-2 border-t border-white/10 pt-2 text-[10px] leading-relaxed text-neutral-500">
            ●●● tier-1 desk (Guardian, Sky, BBC) · ●● LFC desk (Echo, This Is Anfield) · ● aggregator.
            Stories citing Fabrizio Romano are badged and pinned. Transfer talk is rumour until the club confirms it.
          </div>
        </LfcPanel>

        <div className="space-y-3">
          <LfcPanel title="🚨 Fabrizio Romano — live"
            right={<span className="text-[10px] text-white/70">{romano.length ? `${romanoLfc.length} LFC of ${romano.length}` : 'feed unavailable'}</span>}>
            {romanoLfc.length ? (
              <div className="space-y-2">
                {romanoLfc.map((p) => (
                  <a key={p.id} href={p.link} target="_blank" rel="noreferrer"
                    className="block border-l-2 pl-2 text-[12px] leading-snug text-neutral-200 hover:text-white" style={{ borderColor: GOLD }}>
                    {p.text.slice(0, 220)}{p.text.length > 220 ? '…' : ''}
                  </a>
                ))}
              </div>
            ) : (
              <div className="text-[12px] text-neutral-400">
                {romano.length
                  ? 'Romano is posting, but nothing about Liverpool right now.'
                  : 'His X feed is unreachable at the moment — the news column still badges any story that cites him.'}
              </div>
            )}
          </LfcPanel>

          <LfcPanel title="⚽ Fixtures">
            <div className="space-y-2">
              {fixtures.next.slice(0, 5).map((f) => (
                <div key={f.id} className="border-l-2 pl-2 text-[12px]" style={{ borderColor: RED }}>
                  <div className="font-semibold text-neutral-100">{f.home ? 'vs' : '@'} {f.opponent}</div>
                  <div className="text-[10px] text-neutral-400">{kickoff(f.timestamp, f.date)}{f.league ? ` · ${f.league}` : ''}</div>
                </div>
              ))}
              {!fixtures.next.length && <div className="text-[12px] text-neutral-400">No fixtures listed.</div>}
            </div>
          </LfcPanel>

          <LfcPanel title="📋 Results">
            <div className="space-y-2">
              {fixtures.last.slice(0, 5).map((f) => {
                const us = f.home ? f.homeScore : f.awayScore
                const them = f.home ? f.awayScore : f.homeScore
                const w = us != null && them != null && us > them
                const d = us != null && them != null && us === them
                return (
                  <div key={f.id} className="flex items-center justify-between gap-2 text-[12px]">
                    <span className="min-w-0 truncate text-neutral-200">{f.home ? 'vs' : '@'} {f.opponent}</span>
                    <span className={`shrink-0 rounded px-2 py-0.5 font-mono font-bold ${w ? 'bg-emerald-500/20 text-emerald-300' : d ? 'bg-white/10 text-neutral-300' : 'bg-black/40 text-neutral-400'}`}>
                      {us ?? '-'}–{them ?? '-'}
                    </span>
                  </div>
                )
              })}
              {!fixtures.last.length && <div className="text-[12px] text-neutral-400">No results listed.</div>}
            </div>
          </LfcPanel>

          <LfcPanel title="🏆 Premier League" right={<span className="text-[10px] text-white/70">top 8</span>}>
            {table.length ? (
              <table className="w-full font-mono text-[11px]">
                <thead>
                  <tr className="text-left uppercase tracking-wide text-neutral-500">
                    <th className="py-1">#</th><th>club</th><th className="text-center">pl</th><th className="text-center">gd</th><th className="text-right">pts</th>
                  </tr>
                </thead>
                <tbody>
                  {table.slice(0, 8).map((r) => (
                    <tr key={r.team} className={r.isLiverpool ? 'font-bold' : ''} style={r.isLiverpool ? { background: `${RED}33`, color: GOLD } : undefined}>
                      <td className="py-0.5">{r.rank}</td>
                      <td className="truncate">{r.team}</td>
                      <td className="text-center">{r.played}</td>
                      <td className="text-center">{r.goalDiff > 0 ? `+${r.goalDiff}` : r.goalDiff}</td>
                      <td className="text-right">{r.points}</td>
                    </tr>
                  ))}
                  {lfc && lfc.rank > 8 && (
                    <tr className="font-bold" style={{ background: `${RED}33`, color: GOLD }}>
                      <td className="py-0.5">{lfc.rank}</td><td className="truncate">{lfc.team}</td>
                      <td className="text-center">{lfc.played}</td>
                      <td className="text-center">{lfc.goalDiff > 0 ? `+${lfc.goalDiff}` : lfc.goalDiff}</td>
                      <td className="text-right">{lfc.points}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            ) : <div className="text-[12px] text-neutral-400">Table unavailable.</div>}
          </LfcPanel>

          <LfcPanel title="🔴 The Kop">
            <div className="flex flex-wrap gap-2 text-[11px]">
              {[
                ['Official site', 'https://www.liverpoolfc.com'],
                ['Fixtures', 'https://www.liverpoolfc.com/fixtures'],
                ['Romano on X', 'https://x.com/FabrizioRomano'],
                ['This Is Anfield', 'https://www.thisisanfield.com'],
                ['Echo LFC', 'https://www.liverpoolecho.co.uk/all-about/liverpool-fc'],
                ['PL table', 'https://www.premierleague.com/tables'],
              ].map(([label, href]) => (
                <a key={label} href={href} target="_blank" rel="noreferrer"
                  className="rounded-full border px-2.5 py-1 text-neutral-300 transition-colors hover:text-white"
                  style={{ borderColor: `${RED}99` }}>
                  {label} ↗
                </a>
              ))}
            </div>
          </LfcPanel>
        </div>
      </div>
    </Shell>
  )
}
