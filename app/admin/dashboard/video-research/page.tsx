import type { Metadata } from 'next'
import { Shell, Panel, Tile, checkAdmin } from '../ui'
import {
  loadVideoResearch, coverageLabel, shareOfArchive, watchUrl, hhmmss,
  DASH, FUNNEL, type VrHypothesis, type VrSource,
} from '@/lib/video-research'

// VIDEO RESEARCH — the YouTube archive board (spec §20).
//
// This page reports on a READ-ONLY research pipeline. It sits beside the trading
// interface and touches nothing in it: no video-derived signal opens a trade, and the
// banner below says so on every render rather than in a doc nobody opens.
//
// Three display rules, all of them about not overstating what was actually done:
//
//   1. A percentage is only shown when its denominator was established. vr_inventory_runs
//      stores whether pagination reached the end of a listing; when it did not, the count
//      is shown with the literal words "denominator unknown". The helper lives in
//      lib/video-research.ts so the page and the API cannot drift apart on it.
//   2. A missing number renders as "—", never as 0 — the same rule as the LEVERAGE page.
//      0 is a measurement ("we looked, there were none"); a dash is "not measured".
//   3. A video whose transcript is read but whose chart could not be inspected is
//      "Transcript reviewed; chart-dependent entry unresolved". It is NOT "strategy
//      learned", and there is no wording anywhere on this board that implies a rule was
//      understood because a transcript was read.
//
// Every title, excerpt and note below is UNTRUSTED DATA from a third-party video. It is
// rendered as text, never as markup, and links are rebuilt from the video_id rather than
// from any stored URL.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

const fmt = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? DASH : v.toLocaleString()

const ago = (iso: string | null | undefined) => {
  if (!iso) return DASH
  const mins = (Date.now() - new Date(iso).getTime()) / 60000
  if (!Number.isFinite(mins)) return DASH
  if (mins < 90) return `${mins.toFixed(0)}m ago`
  if (mins < 2880) return `${(mins / 60).toFixed(0)}h ago`
  return `${(mins / 1440).toFixed(0)}d ago`
}

// Scope words are the source's own status, spelled out. UNRESOLVED and RELATED are not
// failures to hide — they are the record of what we deliberately did not crawl.
const SCOPE: Record<string, { chip: string; label: string; line: string }> = {
  CONFIRMED: {
    chip: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    label: 'CONFIRMED', line: 'identity resolved to a stable channel/playlist ID · crawled',
  },
  UNRESOLVED: {
    chip: 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300',
    label: 'BLOCKED — UNRESOLVED', line: 'identity not confirmed · NOT crawled',
  },
  RELATED: {
    chip: 'border-amber-500/50 bg-amber-400/10 text-amber-700 dark:text-amber-300',
    label: 'RELATED', line: 'listed for scope confirmation · NOT crawled',
  },
  EXCLUDED: {
    chip: 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400',
    label: 'EXCLUDED', line: 'explicitly out of scope',
  },
}

// Verdict vocabulary is the LEVERAGE board's, unchanged — a video-derived hypothesis is
// judged by the same ledger and the same words as every other hypothesis.
const STATUS: Record<string, { dot: string; chip: string; label: string }> = {
  green: { dot: 'bg-emerald-500', chip: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', label: 'WORKS' },
  amber: { dot: 'bg-amber-500', chip: 'border-amber-500/50 bg-amber-400/10 text-amber-700 dark:text-amber-300', label: 'PROMISING' },
  red: { dot: 'bg-rose-500', chip: 'border-rose-500/50 bg-rose-500/10 text-rose-700 dark:text-rose-300', label: 'KILLED' },
  collecting: { dot: 'bg-sky-500', chip: 'border-sky-500/40 bg-sky-400/10 text-sky-700 dark:text-sky-300', label: 'FORWARD-TESTING' },
  untested: { dot: 'bg-neutral-300', chip: 'border-neutral-200 bg-neutral-50 text-neutral-500 dark:border-white/5 dark:bg-white/[0.02] dark:text-neutral-500', label: 'QUEUED' },
}
const UNLINKED = {
  dot: 'bg-neutral-400',
  chip: 'border-neutral-300 bg-neutral-100 text-neutral-600 dark:border-white/10 dark:bg-white/5 dark:text-neutral-400',
  label: 'VERDICT ROW NOT FOUND',
}
const statusOf = (h: VrHypothesis) => (h.status === null ? UNLINKED : STATUS[h.status] ?? STATUS.untested)

/** The action a blocked source needs from the owner. The note is our own registry text,
 *  not scraped content, so it is the honest place to read the next step from. */
function actionFor(s: VrSource): string {
  if (s.scope_status === 'UNRESOLVED') {
    return 'ACTION: owner supplies the exact channel URL, then scope_status flips to CONFIRMED. Nothing is crawled until then — crawling a near-match would be a guess presented as a source.'
  }
  if (s.scope_status === 'RELATED') {
    return 'ACTION: owner adds it explicitly if it belongs in scope. It is listed, not crawled.'
  }
  return ''
}

export default async function VideoResearchPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const data = await loadVideoResearch()

  // Shell's tab union is shared with every other dashboard page and this board is not on
  // the nav, so it reuses the parked 'videos' key rather than editing the shared shell.
  if (!data) {
    return (
      <Shell secret={secret} active="videos">
        <Panel accent="rose" title="⚠️ Cannot reach the research store">
          <div className="text-[13px] text-neutral-700 dark:text-neutral-300">
            SUPABASE_SERVICE_ROLE_KEY is not set for this deployment, so the vr_* tables
            cannot be read. Showing nothing rather than zeros — a zero here would read as
            &ldquo;nothing found&rdquo;, which is a different claim from &ldquo;not measured&rdquo;.
          </div>
        </Panel>
      </Shell>
    )
  }

  const { sources, listings, denominatorEstablished, counts, videosStored, transcriptRows,
          methodCount, excerptCount, runs, inFlight, blockers, blockersResolved,
          methods, presenters, hypotheses, evidence, partials, partialCount, read,
          methodsTruncated, stagesTruncated } = data

  const discovered = counts.DISCOVERED ?? null
  const crawled = sources.filter((s) => s.scope_status === 'CONFIRMED')
  const notCrawled = sources.filter((s) => s.scope_status !== 'CONFIRMED')
  const incomplete = listings.filter((l) => !l.pagination_complete)

  // Verdict tally, by the ledger's own words. A link with no verdict row is counted
  // separately rather than folded into 'untested'.
  const tally = {
    green: hypotheses.filter((h) => h.status === 'green').length,
    red: hypotheses.filter((h) => h.status === 'red').length,
    amber: hypotheses.filter((h) => h.status === 'amber').length,
    collecting: hypotheses.filter((h) => h.status === 'collecting').length,
    untested: hypotheses.filter((h) => h.status === 'untested').length,
    unlinked: hypotheses.filter((h) => h.status === null).length,
  }
  // One clock for the whole render — the snapshot's own timestamp. Asking the system what
  // time it is per comparison lets two figures on one page describe two different moments.
  const now = new Date(data.at).getTime()
  const forwardOpen = hypotheses.filter((h) =>
    h.forward_start_at !== null && new Date(h.forward_start_at).getTime() <= now).length

  // Per-presenter method board. 'unknown' is a real presenter key and is shown as one:
  // an unattributable rule must stay visible, not vanish into an attributed pile.
  const nameOf = new Map(presenters.map((p) => [p.presenter_key, p.display_name]))
  const hypoByMethod = new Map<string, number>()
  for (const h of hypotheses) hypoByMethod.set(h.method_id, (hypoByMethod.get(h.method_id) ?? 0) + 1)
  const presenterKeys = [...new Set([...methods.map((m) => m.presenter_key), ...presenters.map((p) => p.presenter_key)])]
  const board = presenterKeys.map((key) => {
    const mine = methods.filter((m) => m.presenter_key === key)
    return {
      key,
      name: nameOf.get(key) ?? key,
      total: mine.length,
      testable: mine.filter((m) => m.classification === 'PRECISE_AND_TESTABLE').length,
      preregistered: mine.filter((m) => m.status === 'preregistered').length,
      // The gap that matters: a chart-dependent rule nobody has looked at is INCOMPLETE,
      // however precise its words were.
      unresolved: mine.filter((m) => m.chart_dependent && !m.visual_resolved).length,
      researcherAdded: mine.filter((m) => m.researcher_added).length,
      hypotheses: mine.reduce((s, m) => s + (hypoByMethod.get(m.method_id) ?? 0), 0),
    }
  }).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name))

  const chartBlocked = methods.filter((m) => m.chart_dependent && !m.visual_resolved).length

  return (
    <Shell secret={secret} active="videos">
      {/* ── the standing banner — spec §20, rendered before any number ───── */}
      <div className="mb-3 rounded-xl border border-rose-500/50 bg-rose-500/10 px-4 py-3">
        <div className="text-[13px] font-bold uppercase tracking-widest text-rose-700 dark:text-rose-300">
          No video-derived signal can open a trade
        </div>
        <div className="mt-1 text-[13px] leading-relaxed text-neutral-700 dark:text-neutral-300">
          This board reports a <b>read-only research archive</b>. Nothing in the pipeline
          places an order, sizes a position or alters a risk limit, and no extracted rule
          reaches the trading interface. A method becomes tradeable only by being
          preregistered in the existing verdict ledger and surviving it — reading a
          transcript is not evidence, and is never reported here as if it were.
          A missing number shows as &ldquo;—&rdquo;, never as 0.
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile i={0} accent="cyan" label="Videos discovered" value={fmt(discovered)}
              sub={`${fmt(videosStored)} rows held · ${crawled.length} sources crawled`} />
        <Tile i={1} accent="blue" label="With transcripts" value={fmt(counts.TRANSCRIPT_AVAILABLE)}
              sub={`${fmt(transcriptRows)} caption records`} />
        <Tile i={2} accent="purple" label="Methods extracted" value={fmt(methodCount)}
              sub={`${fmt(excerptCount)} cited excerpts`} />
        <Tile i={3} accent="rose" label="Chart rules unresolved"
              value={read.methods ? `${methodsTruncated ? '≥' : ''}${chartBlocked}` : DASH}
              tone={chartBlocked ? 'neg' : 'dim'}
              sub={methodsTruncated
                ? `floor: only the newest ${methods.length} of ${fmt(methodCount)} methods were read`
                : 'no frame has been inspected by anything automated'} />
      </div>

      {/* ── sources and scope ───────────────────────────────────────────── */}
      <div className="mt-3">
        <Panel accent="teal" title="🎯 Sources included — and the ones deliberately not crawled">
          {sources.length === 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
              The source registry has not been seeded. Showing nothing rather than implying
              the archive has no sources.
            </div>
          ) : (
            <div className="space-y-2">
              {[...crawled, ...notCrawled].map((s) => {
                const scope = SCOPE[s.scope_status] ?? SCOPE.EXCLUDED
                const blockedRow = s.scope_status === 'UNRESOLVED'
                return (
                  <div key={s.source_key}
                       className={`rounded-lg border px-3 py-2 ${blockedRow ? 'border-rose-500/40 bg-rose-500/5' : 'border-neutral-200 dark:border-white/10'}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold text-neutral-800 dark:text-neutral-200">
                        {s.display_name ?? s.source_key}
                      </span>
                      <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider ${scope.chip}`}>
                        {scope.label}
                      </span>
                    </div>
                    <div className="mt-0.5 font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                      {s.kind} · {s.channel_id ?? s.playlist_id ?? 'no stable id'} · {scope.line}
                      {s.last_indexed_at && ` · indexed ${ago(s.last_indexed_at)}`}
                    </div>
                    {s.scope_status !== 'CONFIRMED' && (
                      <div className="mt-1.5 text-[12px] leading-snug text-neutral-700 dark:text-neutral-300">
                        {s.resolution_note && <div className="mb-1 opacity-80">{s.resolution_note}</div>}
                        <div className={blockedRow ? 'font-semibold text-rose-700 dark:text-rose-300' : 'text-amber-700 dark:text-amber-300'}>
                          {actionFor(s)}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── inventory completeness, per listing ─────────────────────────── */}
      <div className="mt-3">
        <Panel accent="cyan" title="📚 Inventory completeness — per listing"
               right={<span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                 {denominatorEstablished ? 'denominator established' : 'denominator unknown'}
               </span>}>
          <div className="mb-3 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
            <b>pagination_complete</b> is stored per enumeration, not inferred. It is true only
            when yt-dlp exited cleanly, no cap truncated the walk, and no bot-check or 429
            appeared. A listing that stopped for any other reason has an <b>unknown total</b>,
            so the coverage column shows the count we hold and the words
            &ldquo;denominator unknown&rdquo; rather than a percentage that would invent one.
          </div>
          {listings.length === 0 ? (
            <div className="rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
              No CONFIRMED source has a listing to enumerate yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th className="pb-1 pr-3">source</th>
                    <th className="pb-1 pr-3">listing</th>
                    <th className="pb-1 pr-3 text-right">items seen</th>
                    <th className="pb-1 pr-3 text-right">held</th>
                    <th className="pb-1 pr-3">pagination_complete</th>
                    <th className="pb-1 pr-3">stopped</th>
                    <th className="pb-1 pr-3">last run</th>
                    <th className="pb-1">coverage</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {listings.map((l) => (
                    <tr key={`${l.source_key}|${l.listing}`} className="border-t border-neutral-100 dark:border-white/5">
                      <td className="py-1 pr-3 font-sans">{l.source_key}</td>
                      <td className="py-1 pr-3">{l.listing}</td>
                      <td className="py-1 pr-3 text-right">{fmt(l.items_seen)}</td>
                      <td className="py-1 pr-3 text-right">{fmt(l.stored)}</td>
                      <td className={`py-1 pr-3 font-bold ${l.pagination_complete ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {String(l.pagination_complete)}
                      </td>
                      <td className="py-1 pr-3 text-neutral-500 dark:text-neutral-400">{l.stopped_reason ?? DASH}</td>
                      <td className="py-1 pr-3 text-neutral-500 dark:text-neutral-400">{ago(l.started_at)}</td>
                      <td className={`py-1 ${l.pagination_complete ? '' : 'text-amber-700 dark:text-amber-300'}`}>
                        {coverageLabel(l.stored, l.items_seen, l.pagination_complete)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {incomplete.length > 0 && (
            <div className="mt-2 border-t border-neutral-200 pt-2 text-[12px] text-amber-700 dark:border-white/10 dark:text-amber-300">
              {incomplete.length} of {listings.length} listings did not paginate to the end.
              No archive-wide percentage is shown anywhere on this page while that is true.
            </div>
          )}
        </Panel>
      </div>

      {/* ── the processing funnel ───────────────────────────────────────── */}
      <div className="mt-3">
        <Panel accent="blue" title="⚙️ Processing state — counts, not progress bars">
          <div className="mb-3 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
            Stages are separate records, not one status column, because a video can have a
            reviewed transcript and an unresolved chart at the same time — and that is the
            normal case. Each row is the number of videos at that stage.
            {!denominatorEstablished && ' The archive size is not established, so these are counts only.'}
          </div>
          <div className="space-y-1.5">
            {FUNNEL.map((f) => (
              <div key={f.stage} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-neutral-100 pb-1.5 last:border-0 dark:border-white/5">
                <span className="text-[13px] text-neutral-800 dark:text-neutral-200">{f.label}</span>
                <span className="font-mono text-[12px] text-neutral-600 dark:text-neutral-300">
                  {shareOfArchive(counts[f.stage] ?? null, discovered, denominatorEstablished)}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2">
            <div className="text-[11px] font-bold uppercase tracking-widest text-amber-700 dark:text-amber-300">
              Transcript reviewed; chart-dependent entry unresolved
            </div>
            <div className="mt-1 text-[12px] leading-snug text-neutral-700 dark:text-neutral-300">
              {partialCount === null
                ? 'Stage records could not be read, so this count is unknown.'
                : <>
                    <b>{stagesTruncated ? '≥' : ''}{fmt(partialCount)}</b> videos are in exactly this
                    state: the words were read, the chart the entry depends on was not inspected.
                    That is a partially complete video, not a learned strategy, and nothing on this
                    board will call it one until a human records a chart observation.
                    {stagesTruncated && ' The stage scan hit its row cap, so this is a floor: '
                      + 'some half-finished videos are not counted here.'}
                  </>}
            </div>
            {partials.length > 0 && (
              <ul className="mt-2 space-y-1">
                {partials.map((p) => {
                  const href = watchUrl(p.video_id)
                  return (
                    <li key={p.video_id} className="text-[12px] leading-snug">
                      {href
                        ? <a href={href} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-sky-700 underline-offset-2 hover:underline dark:text-sky-300">{p.video_id}</a>
                        : <span className="font-mono text-[11px] text-neutral-500">{p.video_id}</span>}
                      <span className="ml-2 text-neutral-700 dark:text-neutral-300">{p.title ?? 'title not stored'}</span>
                      <span className="ml-2 text-neutral-500 dark:text-neutral-400">· Transcript reviewed; chart-dependent entry unresolved</span>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>
        </Panel>
      </div>

      {/* ── jobs ────────────────────────────────────────────────────────── */}
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Panel accent="green" title="🏃 Current batch & last run per job">
          {inFlight.length === 0 ? (
            <div className="mb-2 rounded-lg border border-neutral-200 px-3 py-2 text-[12px] text-neutral-600 dark:border-white/10 dark:text-neutral-400">
              No batch in flight. Every vr_runs row has a finish time.
            </div>
          ) : (
            <div className="mb-2 space-y-1">
              {inFlight.map((r) => (
                <div key={r.id} className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">{r.job} · running</span>
                    <span className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400">started {ago(r.started_at)}</span>
                  </div>
                  <div className="font-mono text-[11px] text-neutral-600 dark:text-neutral-400">
                    {r.processed} done · {r.skipped} skipped · {r.failed} failed · {r.blocked} blocked
                  </div>
                  {r.checkpoint && (
                    <div className="mt-0.5 truncate font-mono text-[10px] text-neutral-500 dark:text-neutral-500">
                      checkpoint {JSON.stringify(r.checkpoint).slice(0, 120)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          {runs.length === 0 ? (
            <div className="text-[12px] text-neutral-500 dark:text-neutral-400">No finished run has been logged.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th className="pb-1 pr-3">job</th>
                    <th className="pb-1 pr-3">finished</th>
                    <th className="pb-1 pr-3 text-right">done</th>
                    <th className="pb-1 pr-3 text-right">skip</th>
                    <th className="pb-1 pr-3 text-right">fail</th>
                    <th className="pb-1 pr-3 text-right">block</th>
                    <th className="pb-1">ok</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {runs.map((r) => (
                    <tr key={r.id} className="border-t border-neutral-100 dark:border-white/5">
                      <td className="py-1 pr-3 font-sans">{r.job}</td>
                      <td className="py-1 pr-3 text-neutral-500 dark:text-neutral-400">{ago(r.finished_at)}</td>
                      <td className="py-1 pr-3 text-right">{fmt(r.processed)}</td>
                      <td className="py-1 pr-3 text-right">{fmt(r.skipped)}</td>
                      <td className={`py-1 pr-3 text-right ${r.failed ? 'text-rose-600 dark:text-rose-400' : ''}`}>{fmt(r.failed)}</td>
                      <td className={`py-1 pr-3 text-right ${r.blocked ? 'text-amber-600 dark:text-amber-400' : ''}`}>{fmt(r.blocked)}</td>
                      <td className={`py-1 ${r.ok === null ? 'text-neutral-400' : r.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                        {r.ok === null ? DASH : String(r.ok)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel accent="rose" title="🚧 Access blockers — gaps stay visible"
               right={<span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                 {blockersResolved === null ? DASH : `${blockersResolved} resolved`}
               </span>}>
          {blockers.length === 0 ? (
            <div className="text-[12px] text-neutral-600 dark:text-neutral-400">
              No unresolved blocker recorded. A silent skip is not possible here — every
              access failure writes a row, so an empty list is a measurement, not a guess.
            </div>
          ) : (
            <div className="space-y-1.5">
              {blockers.map((b) => (
                <div key={b.id} className="border-b border-neutral-100 pb-1.5 last:border-0 dark:border-white/5">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <span className="font-mono text-[12px] font-bold text-rose-600 dark:text-rose-300">{b.kind}</span>
                    <span className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400">
                      ×{fmt(b.occurrences)} · last {ago(b.last_seen_at)}
                    </span>
                  </div>
                  <div className="text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
                    {b.source_key && <span className="font-mono text-[11px]">{b.source_key} </span>}
                    {b.video_id && <span className="font-mono text-[11px]">{b.video_id} </span>}
                    {b.detail ?? 'no detail recorded'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* ── presenters, methods, hypotheses ─────────────────────────────── */}
      <div className="mt-3">
        <Panel accent="purple" title="🧾 Methods by presenter, and what was registered"
               right={
                 <span className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wider">
                   {(['green', 'red', 'amber', 'collecting'] as const).map((k) => (
                     <span key={k} className="flex items-center gap-1 text-neutral-500 dark:text-neutral-400">
                       <span className={`h-1.5 w-1.5 rounded-full ${STATUS[k].dot}`} />{STATUS[k].label}
                     </span>
                   ))}
                 </span>
               }>
          <div className="mb-3 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
            A method is a <b>paraphrased rule with cited timestamps</b>, not a strategy we hold.
            Only PRECISE_AND_TESTABLE methods may be preregistered, and they are registered in
            the <b>existing</b> verdict ledger — video work never starts a second trial counter,
            because that is how a trial count gets quietly reset.
          </div>

          {methodsTruncated && (
            <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
              Only the newest {methods.length} of {fmt(methodCount)} methods were read, so every
              figure in this table is a <b>floor</b>, not a total — including &ldquo;chart
              unresolved&rdquo;, which understates the gap rather than overstating it.
            </div>
          )}
          {board.length === 0 ? (
            <div className="text-[12px] text-neutral-500 dark:text-neutral-400">No methods extracted yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                  <tr>
                    <th className="pb-1 pr-3">presenter</th>
                    <th className="pb-1 pr-3 text-right">methods</th>
                    <th className="pb-1 pr-3 text-right">precise &amp; testable</th>
                    <th className="pb-1 pr-3 text-right">chart unresolved</th>
                    <th className="pb-1 pr-3 text-right">researcher variants</th>
                    <th className="pb-1 pr-3 text-right">preregistered</th>
                    <th className="pb-1 text-right">hypotheses</th>
                  </tr>
                </thead>
                <tbody className="font-mono">
                  {board.map((p) => (
                    <tr key={p.key} className="border-t border-neutral-100 dark:border-white/5">
                      <td className="py-1 pr-3 font-sans">{p.name}</td>
                      <td className="py-1 pr-3 text-right">{read.methods ? p.total : DASH}</td>
                      <td className="py-1 pr-3 text-right">{read.methods ? p.testable : DASH}</td>
                      <td className={`py-1 pr-3 text-right ${p.unresolved ? 'text-amber-600 dark:text-amber-400' : ''}`}>
                        {read.methods ? p.unresolved : DASH}
                      </td>
                      <td className="py-1 pr-3 text-right">{read.methods ? p.researcherAdded : DASH}</td>
                      <td className="py-1 pr-3 text-right">{read.methods ? p.preregistered : DASH}</td>
                      <td className="py-1 text-right">{read.hypotheses ? p.hypotheses : DASH}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-5">
            <Tile i={0} accent="purple" label="Registered" value={read.hypotheses ? String(hypotheses.length) : DASH} sub="video-derived hypotheses" />
            <Tile i={1} accent="green" label="Survived" value={read.hypotheses ? String(tally.green) : DASH} tone={tally.green ? 'pos' : 'dim'} sub="green in the ledger" />
            <Tile i={2} accent="rose" label="Killed" value={read.hypotheses ? String(tally.red) : DASH} tone={tally.red ? 'neg' : 'dim'} sub="ruled out — still information" />
            <Tile i={3} accent="cyan" label="Forward-testing" value={read.hypotheses ? String(tally.collecting) : DASH} sub={`${forwardOpen} with an open forward window`} />
            <Tile i={4} accent="amber" label="Queued / promising" value={read.hypotheses ? String(tally.untested + tally.amber) : DASH} sub={`${tally.amber} amber · ${tally.untested} untested`} />
          </div>
          {tally.unlinked > 0 && (
            <div className="mt-2 rounded-lg border border-amber-500/40 bg-amber-400/10 px-3 py-2 text-[12px] text-amber-800 dark:text-amber-200">
              {tally.unlinked} registered link{tally.unlinked === 1 ? ' has' : 's have'} no matching
              row in kr_research_verdicts. Counted here rather than folded into
              &ldquo;untested&rdquo; — a missing row is not the same claim as an unanswered question.
            </div>
          )}

          {hypotheses.length > 0 && (
            <div className="mt-3 space-y-1.5">
              {hypotheses.slice(0, 20).map((h) => {
                const s = statusOf(h)
                return (
                  <div key={h.verdict_id} className={`rounded-lg border px-2.5 py-2 ${s.chip}`}>
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="text-[13px] font-semibold">{h.name ?? h.verdict_id}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider opacity-70">{s.label}</span>
                    </div>
                    {/* Frozen rule text — OUR paraphrase as frozen at preregistration, shown
                        verbatim so a later edit to the method cannot be mistaken for the
                        thing that was actually tested. */}
                    <div className="mt-0.5 text-[11.5px] leading-snug opacity-85">{h.frozen_rule}</div>
                    <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10px] opacity-70">
                      <span>method {h.method_id}</span>
                      <span>registered {ago(h.registered_at)}</span>
                      <span>forward {h.forward_start_at ? ago(h.forward_start_at) : 'not started'}</span>
                      <span>obs {h.observations === null ? DASH : `${h.observations}/${h.observations_needed ?? DASH}`}</span>
                      <span>trials {h.trials_run === null ? DASH : h.trials_run}</span>
                    </div>
                    {h.contamination_note && (
                      <div className="mt-1 text-[11px] opacity-75">contamination: {h.contamination_note}</div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      {/* ── latest evidence ─────────────────────────────────────────────── */}
      <div className="mt-3">
        <Panel accent="amber" title="🔎 Latest evidence — every claim opens at its timestamp">
          <div className="mb-3 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
            Each excerpt links to the exact second it was taken from, so a paraphrase can be
            checked against what was actually said rather than trusted. Quoted text below is
            <b> untrusted third-party content</b>: it is displayed, never executed, and it
            cannot promote anything on this board.
          </div>
          {evidence.length === 0 ? (
            <div className="text-[12px] text-neutral-500 dark:text-neutral-400">
              No excerpts recorded yet. A method without a cited timestamp is not stored, so
              an empty list here means no rule has been extracted — not that the citations
              are missing.
            </div>
          ) : (
            <div className="space-y-2">
              {evidence.map((e) => {
                const href = watchUrl(e.video_id, e.t_start_ms)
                return (
                  <div key={e.id} className="border-b border-neutral-100 pb-2 last:border-0 dark:border-white/5">
                    <div className="flex flex-wrap items-baseline gap-x-2">
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer"
                           className="font-mono text-[11px] text-sky-700 underline-offset-2 hover:underline dark:text-sky-300">
                          ▶ {hhmmss(e.t_start_ms)}
                        </a>
                      ) : (
                        <span className="font-mono text-[11px] text-neutral-500">{hhmmss(e.t_start_ms)} · id not linkable</span>
                      )}
                      <span className="text-[12px] text-neutral-700 dark:text-neutral-300">{e.title ?? 'title not stored'}</span>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
                        {e.classification ?? 'unclassified'}
                        {e.presenter_key ? ` · ${e.presenter_key}` : ''}
                      </span>
                    </div>
                    <div className="mt-0.5 text-[12px] leading-snug text-neutral-600 dark:text-neutral-300">
                      &ldquo;{e.excerpt}&rdquo;
                    </div>
                    {e.chart_dependent && !e.visual_resolved && (
                      <div className="mt-0.5 font-mono text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300">
                        Transcript reviewed; chart-dependent entry unresolved
                      </div>
                    )}
                    {e.note && <div className="mt-0.5 text-[11px] text-neutral-500 dark:text-neutral-400">{e.note}</div>}
                  </div>
                )
              })}
            </div>
          )}
        </Panel>
      </div>

      <div className="mt-3 text-[11px] leading-relaxed text-neutral-500 dark:text-neutral-400">
        Read-only board. Nothing on this page can be actioned from this page, and no number
        here is a recommendation. Rendered {new Date(data.at).toISOString()}.
      </div>
    </Shell>
  )
}
