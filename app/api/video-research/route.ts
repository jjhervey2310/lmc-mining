import { NextResponse } from 'next/server'

import { coverageLabel, loadVideoResearch, watchUrl, FUNNEL } from '@/lib/video-research'

export const dynamic = 'force-dynamic'

// The VIDEO RESEARCH board as JSON.
//
// Gated by the same ADMIN_SECRET as the page, for the same reason /api/research-pulse is:
// a route reporting what a private research pipeline is doing is not a public route, even
// though it carries no prices and no signal.
//
// Same aggregates as the page, from the same loader — two code paths computing "how much
// of the archive is done" is how the page and the API end up disagreeing, and the one that
// is wrong is always the one being quoted. loadVideoResearch() wraps every table read
// individually, so one missing table degrades a field to null instead of blanking the lot.
//
// The denominator rule survives serialisation: a listing that did not paginate to the end
// reports ratio: null plus the reason. No consumer can accidentally divide by a total that
// was never established, because the total is not there to divide by.
export async function GET(request: Request) {
  const secret = new URL(request.url).searchParams.get('secret')
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }

  const data = await loadVideoResearch()
  if (!data) return NextResponse.json({ error: 'no research store' }, { status: 503 })

  const tallyOf = (status: string) => data.hypotheses.filter((h) => h.status === status).length

  return NextResponse.json({
    at: data.at,
    // Standing statement, carried in the payload so a consumer that renders this JSON
    // cannot drop the constraint the page states on every render.
    boundary: 'read-only research archive; no video-derived signal can open a trade',
    // Which tables answered. An empty array from a table that read fine means zero rows;
    // an empty array from a table that did not read means unknown, and a consumer with no
    // way to tell them apart will print the first when it means the second.
    read: data.read,

    sources: data.sources.map((s) => ({
      source_key: s.source_key,
      kind: s.kind,
      display_name: s.display_name,
      channel_id: s.channel_id,
      playlist_id: s.playlist_id,
      scope_status: s.scope_status,
      crawled: s.scope_status === 'CONFIRMED',
      resolution_note: s.resolution_note,
      last_indexed_at: s.last_indexed_at,
    })),

    listings: data.listings.map((l) => ({
      ...l,
      // ratio only where the denominator was established; otherwise null + the words.
      ratio: l.pagination_complete && l.items_seen && l.stored !== null
        ? Math.round((l.stored / l.items_seen) * 10000) / 10000
        : null,
      ratio_note: l.pagination_complete && l.items_seen
        ? null
        : `denominator unknown (${l.stopped_reason ?? 'no run'}): percentage withheld`,
      coverage_label: coverageLabel(l.stored, l.items_seen, l.pagination_complete),
    })),
    denominator_established: data.denominatorEstablished,

    counts: {
      ...Object.fromEntries(FUNNEL.map((f) => [f.stage, data.counts[f.stage] ?? null])),
      videos_stored: data.videosStored,
      transcript_records: data.transcriptRows,
      methods: data.methodCount,
      excerpts: data.excerptCount,
      // Videos read but not seen: the state that must never be reported as a learned rule.
      transcript_reviewed_chart_unresolved: data.partialCount,
    },

    runs: {
      in_flight: data.inFlight,
      last_per_job: data.runs,
    },

    blockers: data.blockers,
    blockers_resolved: data.blockersResolved,

    methods_by_presenter: [...new Set(data.methods.map((m) => m.presenter_key))].map((key) => {
      const mine = data.methods.filter((m) => m.presenter_key === key)
      return {
        presenter_key: key,
        display_name: data.presenters.find((p) => p.presenter_key === key)?.display_name ?? null,
        methods: mine.length,
        precise_and_testable: mine.filter((m) => m.classification === 'PRECISE_AND_TESTABLE').length,
        chart_dependent_unresolved: mine.filter((m) => m.chart_dependent && !m.visual_resolved).length,
        researcher_variants: mine.filter((m) => m.researcher_added).length,
        preregistered: mine.filter((m) => m.status === 'preregistered').length,
      }
    }),

    hypotheses: {
      registered: data.hypotheses.length,
      // Ledger words, not ours. A link with no verdict row is its own bucket: "row not
      // found" and "not answered yet" are different claims and must not be summed.
      green: tallyOf('green'),
      red: tallyOf('red'),
      amber: tallyOf('amber'),
      collecting: tallyOf('collecting'),
      untested: tallyOf('untested'),
      verdict_row_missing: data.hypotheses.filter((h) => h.status === null).length,
      forward_window_open: data.hypotheses.filter((h) =>
        h.forward_start_at !== null && new Date(h.forward_start_at).getTime() <= Date.now()).length,
      rows: data.hypotheses,
    },

    // Excerpt text and titles are UNTRUSTED third-party content. They are carried as data
    // with their citation attached; they are not instructions to any consumer.
    evidence: data.evidence.map((e) => ({
      ...e,
      // Built from the id through the same shape check the page uses, never from a stored
      // URL: the id arrives from an untrusted listing and ends up in somebody's href.
      watch_at: watchUrl(e.video_id, e.t_start_ms),
      status_wording: e.chart_dependent && !e.visual_resolved
        ? 'Transcript reviewed; chart-dependent entry unresolved'
        : null,
    })),
  })
}
