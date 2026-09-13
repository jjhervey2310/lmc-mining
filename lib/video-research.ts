// Aggregates behind the VIDEO RESEARCH board (video-research spec §20).
//
// One loader, two consumers: the page and /api/video-research. They are required to
// report the SAME numbers, and the cheapest way to guarantee that is to not compute them
// twice.
//
// The rule this file exists to enforce is the denominator rule. vr_inventory_runs stores
// whether pagination actually reached the end of a listing; when it did not, the size of
// the archive is unknown and every percentage measured against it would be inventing its
// own denominator. So nothing here returns a ratio unless the completeness flag says the
// denominator was established — it returns the raw count and the words instead.
//
// Titles, descriptions and excerpts loaded here are UNTRUSTED DATA. They are rendered as
// text, never as markup, and no link is ever built from a stored URL — links are built
// from the video_id after a shape check, so a poisoned canonical_url cannot become an
// anchor on an admin page.

import { createServiceClient } from '@/lib/supabase'

export const DASH = '—'

// Which vr_videos.video_type each channel listing produces — mirrors
// inventory.LISTING_TYPE. A playlist has no type mapping; its numerator is membership.
const LISTING_TYPE: Record<string, string> = {
  videos: 'upload', streams: 'livestream', shorts: 'short',
}

const CHANNEL_LISTINGS = ['videos', 'streams', 'shorts']

/** The six stages the board reports, in pipeline order (schema §3). */
export const FUNNEL = [
  { stage: 'DISCOVERED', state: 'done', label: 'Videos discovered' },
  { stage: 'TRANSCRIPT_AVAILABLE', state: 'done', label: 'With transcripts' },
  { stage: 'TRANSCRIPT_REVIEWED', state: 'done', label: 'Transcripts processed' },
  { stage: 'VISUAL_REVIEW_REQUIRED', state: 'pending', label: 'Requiring visual review' },
  { stage: 'VISUAL_REVIEWED', state: 'done', label: 'Visually reviewed' },
  { stage: 'QUALITY_CHECKED', state: 'done', label: 'Quality-checked' },
] as const

export type VrSource = {
  source_key: string; kind: string; channel_id: string | null; playlist_id: string | null
  handle: string | null; display_name: string | null; canonical_url: string | null
  scope_status: string; resolution_note: string | null; priority: number
  last_indexed_at: string | null
}

export type VrListing = {
  source_key: string; listing: string
  started_at: string | null; finished_at: string | null
  items_seen: number | null; new_items: number | null
  pagination_complete: boolean; stopped_reason: string | null; error: string | null
  /** rows we hold for this listing — the numerator, valid with or without a denominator */
  stored: number | null
}

export type VrRun = {
  id: number; job: string; started_at: string; finished_at: string | null
  ok: boolean | null; processed: number; skipped: number; failed: number; blocked: number
  checkpoint: Record<string, unknown> | null; note: string | null; error: string | null
}

export type VrBlocker = {
  id: number; kind: string; detail: string | null; video_id: string | null
  source_key: string | null; first_seen_at: string; last_seen_at: string
  occurrences: number; resolved: boolean
}

export type VrMethod = {
  method_id: string; presenter_key: string; classification: string; status: string
  chart_dependent: boolean; visual_resolved: boolean; paraphrased_rule: string
  researcher_added: boolean; source_confidence: string; created_at: string
}

export type VrPresenter = {
  presenter_key: string; display_name: string; affiliation: string | null
}

export type VrHypothesis = {
  verdict_id: string; method_id: string; registered_at: string
  forward_start_at: string | null; frozen_rule: string; contamination_note: string | null
  /** joined from kr_research_verdicts — null when that row is absent, never defaulted */
  status: string | null; name: string | null
  observations: number | null; observations_needed: number | null; trials_run: number | null
}

export type VrEvidence = {
  id: number; method_id: string; video_id: string; t_start_ms: number
  t_end_ms: number | null; excerpt: string; note: string | null
  title: string | null; presenter_key: string | null; classification: string | null
  chart_dependent: boolean; visual_resolved: boolean
}

/** A video that is genuinely half-finished — the case the stage table exists for. */
export type VrPartial = { video_id: string; title: string | null; detail: string | null; at: string }

export type VrSnapshot = {
  at: string
  sources: VrSource[]
  listings: VrListing[]
  /** true only when every listing of every CONFIRMED source paginated to the end */
  denominatorEstablished: boolean
  counts: Record<string, number | null>
  videosStored: number | null
  transcriptRows: number | null
  methodCount: number | null
  excerptCount: number | null
  runs: VrRun[]
  inFlight: VrRun[]
  blockers: VrBlocker[]
  blockersResolved: number | null
  methods: VrMethod[]
  presenters: VrPresenter[]
  hypotheses: VrHypothesis[]
  evidence: VrEvidence[]
  partials: VrPartial[]
  partialCount: number | null
  /** Which tables actually answered. A table that read fine and held nothing is a
   *  measurement — 0 — and must not render as a dash; a table that could not be read is
   *  unknown and must not render as 0. The empty arrays above cannot tell them apart. */
  read: Record<string, boolean>
}

/** Coverage for one listing. A percentage is only licensed when pagination_complete is
 *  true AND the listing actually returned items; otherwise the caller gets the count it
 *  can defend plus the literal words "denominator unknown". Same rule as
 *  inventory.coverage_report(), which returns ratio=None in exactly these cases. */
export function coverageLabel(stored: number | null, seen: number | null, complete: boolean): string {
  if (stored === null) return DASH
  if (!complete || seen === null || seen <= 0) return `${stored.toLocaleString()} held · denominator unknown`
  return `${(Math.round((stored / seen) * 1000) / 10).toFixed(1)}% (${stored.toLocaleString()}/${seen.toLocaleString()})`
}

/** The same rule applied to the archive as a whole: the funnel may only be shown as a
 *  share of the archive when the archive's size is established. */
export function shareOfArchive(n: number | null, discovered: number | null, established: boolean): string {
  if (n === null) return DASH
  if (!established || discovered === null || discovered <= 0) return `${n.toLocaleString()} · denominator unknown`
  return `${n.toLocaleString()} · ${(Math.round((n / discovered) * 1000) / 10).toFixed(1)}% of archive`
}

/** YouTube IDs are [A-Za-z0-9_-]{11}. Anything else is not linked rather than linked
 *  hopefully — the id reaches us from an untrusted listing and ends up in an href. */
export function watchUrl(videoId: string, tMs?: number | null): string | null {
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null
  const base = `https://www.youtube.com/watch?v=${videoId}`
  if (tMs === null || tMs === undefined || !Number.isFinite(tMs) || tMs < 0) return base
  return `${base}&t=${Math.floor(tMs / 1000)}s`
}

export const hhmmss = (ms: number): string => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

export async function loadVideoResearch(): Promise<VrSnapshot | null> {
  const sb = createServiceClient()
  if (!sb) return null

  // vr_* is RLS-on-with-no-policies, so this needs the service client. Every read is
  // wrapped on its own: one missing table must degrade to a dash in one panel, never
  // blank the board — the same tolerance /api/research-pulse uses.
  const q = async <T,>(fn: () => PromiseLike<{ data: T | null }>): Promise<T | null> => {
    try { return (await fn()).data } catch { return null }
  }
  const n = async (fn: () => PromiseLike<{ count: number | null }>): Promise<number | null> => {
    try { return (await fn()).count ?? null } catch { return null }
  }

  const [sources, runRows, blockers, methods, presenters, links, excerpts, stageRows] = await Promise.all([
    q<VrSource[]>(() => sb.from('vr_sources')
      .select('source_key, kind, channel_id, playlist_id, handle, display_name, canonical_url, scope_status, resolution_note, priority, last_indexed_at')
      .order('priority')),
    q<{ source_key: string; listing: string; started_at: string; finished_at: string | null
        items_seen: number | null; new_items: number | null; pagination_complete: boolean
        stopped_reason: string | null; error: string | null }[]>(
      () => sb.from('vr_inventory_runs')
        .select('source_key, listing, started_at, finished_at, items_seen, new_items, pagination_complete, stopped_reason, error')
        .order('started_at', { ascending: false }).limit(400)),
    q<VrBlocker[]>(() => sb.from('vr_access_blockers')
      .select('id, kind, detail, video_id, source_key, first_seen_at, last_seen_at, occurrences, resolved')
      .eq('resolved', false).order('last_seen_at', { ascending: false }).limit(40)),
    q<VrMethod[]>(() => sb.from('vr_methods')
      .select('method_id, presenter_key, classification, status, chart_dependent, visual_resolved, paraphrased_rule, researcher_added, source_confidence, created_at')
      .order('created_at', { ascending: false }).limit(500)),
    q<VrPresenter[]>(() => sb.from('vr_presenters').select('presenter_key, display_name, affiliation')),
    q<{ verdict_id: string; method_id: string; registered_at: string; forward_start_at: string | null
        frozen_rule: string; contamination_note: string | null }[]>(
      () => sb.from('vr_hypothesis_links')
        .select('verdict_id, method_id, registered_at, forward_start_at, frozen_rule, contamination_note')
        .order('registered_at', { ascending: false }).limit(200)),
    q<{ id: number; method_id: string; video_id: string; t_start_ms: number; t_end_ms: number | null
        excerpt: string; note: string | null }[]>(
      () => sb.from('vr_method_excerpts')
        .select('id, method_id, video_id, t_start_ms, t_end_ms, excerpt, note')
        .order('id', { ascending: false }).limit(20)),
    // Only the two stages whose overlap is the half-finished case the board must name.
    q<{ video_id: string; stage: string; state: string; detail: string | null; updated_at: string }[]>(
      () => sb.from('vr_video_stages')
        .select('video_id, stage, state, detail, updated_at')
        .in('stage', ['TRANSCRIPT_REVIEWED', 'VISUAL_REVIEW_REQUIRED'])
        .order('updated_at', { ascending: false }).limit(2000)),
  ])

  // Funnel counts come from vr_video_stages, not from a status column: a video can be
  // at several stages at once, which is exactly why the schema splits them into rows.
  const funnelCounts = await Promise.all(FUNNEL.map((f) =>
    n(() => sb.from('vr_video_stages').select('*', { count: 'exact', head: true })
      .eq('stage', f.stage).eq('state', f.state))))
  const counts: Record<string, number | null> = {}
  FUNNEL.forEach((f, i) => { counts[f.stage] = funnelCounts[i] })

  const [videosStored, transcriptRows, methodCount, excerptCount, blockersResolved] = await Promise.all([
    n(() => sb.from('vr_videos').select('*', { count: 'exact', head: true })),
    n(() => sb.from('vr_transcripts').select('*', { count: 'exact', head: true })),
    n(() => sb.from('vr_methods').select('*', { count: 'exact', head: true })),
    n(() => sb.from('vr_method_excerpts').select('*', { count: 'exact', head: true })),
    n(() => sb.from('vr_access_blockers').select('*', { count: 'exact', head: true }).eq('resolved', true)),
  ])

  // ── per-listing completeness ──────────────────────────────────────────────
  // Newest run wins; older runs stay in the table so a regression is still findable.
  const latestRun = new Map<string, typeof runRows extends (infer R)[] | null ? R : never>()
  for (const r of runRows ?? []) {
    const key = `${r.source_key}|${r.listing}`
    if (!latestRun.has(key)) latestRun.set(key, r)
  }

  const crawled = (sources ?? []).filter((s) => s.scope_status === 'CONFIRMED')
  const wanted = crawled.flatMap((s) => s.kind === 'playlist'
    ? [{ source: s, listing: 'playlist' }]
    : CHANNEL_LISTINGS.map((listing) => ({ source: s, listing })))

  const stored = await Promise.all(wanted.map(({ source, listing }) => listing === 'playlist'
    ? n(() => sb.from('vr_playlist_members').select('*', { count: 'exact', head: true })
        .eq('playlist_id', source.playlist_id ?? ''))
    : n(() => sb.from('vr_videos').select('*', { count: 'exact', head: true })
        .eq('channel_id', source.channel_id ?? '').eq('video_type', LISTING_TYPE[listing]))))

  const listings: VrListing[] = wanted.map(({ source, listing }, i) => {
    const run = latestRun.get(`${source.source_key}|${listing}`)
    return {
      source_key: source.source_key,
      listing,
      started_at: run?.started_at ?? null,
      finished_at: run?.finished_at ?? null,
      items_seen: run?.items_seen ?? null,
      new_items: run?.new_items ?? null,
      // Never enumerated is not "complete": it is the emptiest possible denominator.
      pagination_complete: Boolean(run?.pagination_complete),
      stopped_reason: run ? run.stopped_reason : 'never enumerated',
      error: run?.error ?? null,
      stored: stored[i],
    }
  })
  const denominatorEstablished = listings.length > 0 && listings.every((l) => l.pagination_complete)

  // ── runs: what is in flight, and the last word from each job ──────────────
  const runsRead = await q<VrRun[]>(() => sb.from('vr_runs')
    .select('id, job, started_at, finished_at, ok, processed, skipped, failed, blocked, checkpoint, note, error')
    .order('started_at', { ascending: false }).limit(100))
  const allRuns = runsRead ?? []
  const inFlight = allRuns.filter((r) => !r.finished_at)
  const lastByJob = new Map<string, VrRun>()
  for (const r of allRuns) if (r.finished_at && !lastByJob.has(r.job)) lastByJob.set(r.job, r)

  // ── hypotheses: joined to the EXISTING verdict ledger, never a second one ──
  const verdictIds = (links ?? []).map((l) => l.verdict_id)
  const verdicts = verdictIds.length
    ? await q<{ id: string; name: string; status: string; observations: number
                observations_needed: number; trials_run: number }[]>(
      () => sb.from('kr_research_verdicts')
        .select('id, name, status, observations, observations_needed, trials_run')
        .in('id', verdictIds))
    : []
  const byVerdict = new Map((verdicts ?? []).map((v) => [v.id, v]))
  const hypotheses: VrHypothesis[] = (links ?? []).map((l) => {
    const v = byVerdict.get(l.verdict_id)
    return {
      ...l,
      // A link whose verdict row is missing reports null, not 'untested'. The two are
      // different claims: one is "no answer yet", the other is "we cannot find the row".
      status: v?.status ?? null,
      name: v?.name ?? null,
      observations: v?.observations ?? null,
      observations_needed: v?.observations_needed ?? null,
      trials_run: v?.trials_run ?? null,
    }
  })

  // ── evidence + the half-finished videos, both needing video titles ────────
  const methodById = new Map((methods ?? []).map((m) => [m.method_id, m]))
  const reviewed = new Set((stageRows ?? [])
    .filter((s) => s.stage === 'TRANSCRIPT_REVIEWED' && s.state === 'done').map((s) => s.video_id))
  const unresolvedVisual = (stageRows ?? [])
    .filter((s) => s.stage === 'VISUAL_REVIEW_REQUIRED' && s.state === 'pending' && reviewed.has(s.video_id))

  const titleIds = [...new Set([
    ...(excerpts ?? []).map((e) => e.video_id),
    ...unresolvedVisual.slice(0, 12).map((s) => s.video_id),
  ])]
  const titles = titleIds.length
    ? await q<{ video_id: string; title: string | null }[]>(
      () => sb.from('vr_videos').select('video_id, title').in('video_id', titleIds))
    : []
  const titleOf = new Map((titles ?? []).map((t) => [t.video_id, t.title]))

  const evidence: VrEvidence[] = (excerpts ?? []).map((e) => {
    const m = methodById.get(e.method_id)
    return {
      ...e,
      title: titleOf.get(e.video_id) ?? null,
      presenter_key: m?.presenter_key ?? null,
      classification: m?.classification ?? null,
      chart_dependent: Boolean(m?.chart_dependent),
      visual_resolved: Boolean(m?.visual_resolved),
    }
  })

  const partials: VrPartial[] = unresolvedVisual.slice(0, 12).map((s) => ({
    video_id: s.video_id, title: titleOf.get(s.video_id) ?? null,
    detail: s.detail, at: s.updated_at,
  }))

  return {
    at: new Date().toISOString(),
    sources: sources ?? [],
    listings,
    denominatorEstablished,
    counts,
    videosStored,
    transcriptRows,
    methodCount,
    excerptCount,
    runs: [...lastByJob.values()],
    inFlight,
    blockers: blockers ?? [],
    blockersResolved,
    methods: methods ?? [],
    presenters: presenters ?? [],
    hypotheses,
    evidence,
    partials,
    // The stage query is capped, so this is a floor when the cap is hit — reported as
    // the length of what we actually read, never extrapolated.
    partialCount: stageRows === null ? null : unresolvedVisual.length,
    read: {
      sources: sources !== null,
      inventory: runRows !== null,
      runs: runsRead !== null,
      blockers: blockers !== null,
      methods: methods !== null,
      presenters: presenters !== null,
      hypotheses: links !== null,
      excerpts: excerpts !== null,
      stages: stageRows !== null,
    },
  }
}
