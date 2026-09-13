-- video-research — persistent research memory for the YouTube archive project.
--
-- Namespace: vr_*. Nothing here touches kr_* (the Kraken collector + paper trader),
-- desk_* (the alert loop) or any website table. New tables only; no ALTER of anything
-- that existed before this file.
--
-- Two rules this schema encodes, because they are the ones that get lied about:
--
--   1. A video's processing STAGES are separate rows, not one status column. A video can
--      have a reviewed transcript and an unresolved chart at the same time, and that is
--      the normal case, not an edge case. One status column would force a single word
--      onto a genuinely partial state and the honest word ("partially complete") would
--      then be unavailable.
--   2. Coverage denominators are stored, never inferred. vr_inventory_runs records
--      whether pagination actually reached the end of a listing. A percentage computed
--      against an unknown denominator is banned at the query layer because the
--      denominator's completeness is a stored boolean, not an assumption.
--
-- Service-key only throughout: RLS on, no policies. anon/authenticated get nothing.

-- ---------------------------------------------------------------------------
-- 1. SOURCE REGISTRY  (spec §2, §19)
-- ---------------------------------------------------------------------------
create table if not exists vr_sources (
  source_key      text primary key,          -- stable local key, e.g. 'crypto-banter'
  kind            text not null,             -- channel | playlist
  channel_id      text,                      -- UC... — the stable identity, never the handle
  playlist_id     text,                      -- PL... when kind='playlist'
  handle          text,                      -- @CryptoBanterGroup — CAN CHANGE, informational only
  display_name    text,
  canonical_url   text not null,
  -- CONFIRMED      = identity resolved to a stable ID and in scope
  -- UNRESOLVED     = asked for by name, identity not established (spec §2 Crypto Insider)
  -- RELATED        = discovered affiliate; listed for scope confirmation, NOT crawled
  -- EXCLUDED       = explicitly out of scope
  scope_status    text not null default 'CONFIRMED',
  resolution_note text,
  priority        int  not null default 100, -- lower = processed first (spec §7)
  added_at        timestamptz not null default now(),
  last_indexed_at timestamptz,
  constraint vr_sources_kind_ck check (kind in ('channel','playlist')),
  constraint vr_sources_scope_ck check (scope_status in ('CONFIRMED','UNRESOLVED','RELATED','EXCLUDED'))
);
create index if not exists vr_sources_scope_idx on vr_sources(scope_status, priority);

-- ---------------------------------------------------------------------------
-- 2. ARCHIVE INVENTORY  (spec §5)
-- ---------------------------------------------------------------------------
create table if not exists vr_videos (
  video_id        text primary key,          -- the canonical dedupe key (spec §2, §22.1)
  channel_id      text,
  channel_name    text,                      -- current name; may drift
  channel_handle  text,                      -- current handle; may drift
  canonical_url   text not null,
  title           text,
  description     text,
  published_at    timestamptz,               -- earliest PUBLIC availability (spec §11)
  live_start_at   timestamptz,
  live_end_at     timestamptz,
  duration_s      int,
  video_type      text,                      -- upload | livestream | short | unknown
  availability    text,                      -- public | unlisted | private | deleted | unknown
  caption_langs   jsonb  not null default '[]'::jsonb,
  -- creator | auto | both | none | unknown  — spec §4 demands the distinction be kept
  caption_source  text   not null default 'unknown',
  chapters        jsonb,
  content_hash    text,                      -- hash of the metadata we last saw
  first_seen_at   timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  retry_count     int    not null default 0,
  last_error      text,
  constraint vr_videos_type_ck check (video_type in ('upload','livestream','short','unknown')),
  constraint vr_videos_caption_ck check (caption_source in ('creator','auto','both','none','unknown'))
);
create index if not exists vr_videos_channel_idx   on vr_videos(channel_id, published_at desc);
create index if not exists vr_videos_published_idx on vr_videos(published_at desc);
create index if not exists vr_videos_type_idx      on vr_videos(video_type);

-- Playlist membership is many-to-many: one video ID, many playlists (spec §2 "deduplicate
-- by video ID while RETAINING playlist and presenter relationships").
create table if not exists vr_playlist_members (
  playlist_id text not null,
  video_id    text not null references vr_videos(video_id) on delete cascade,
  position    int,
  source_key  text references vr_sources(source_key),
  seen_at     timestamptz not null default now(),
  primary key (playlist_id, video_id)
);
create index if not exists vr_playlist_members_video_idx on vr_playlist_members(video_id);

-- ---------------------------------------------------------------------------
-- 3. PROCESSING STAGES  (spec §5 — "track these stages separately")
-- ---------------------------------------------------------------------------
create table if not exists vr_video_stages (
  video_id   text not null references vr_videos(video_id) on delete cascade,
  stage      text not null,
  state      text not null,        -- pending | done | blocked | unavailable | n/a
  detail     text,
  updated_at timestamptz not null default now(),
  primary key (video_id, stage),
  constraint vr_stage_name_ck check (stage in (
    'DISCOVERED','METADATA_ONLY','TRANSCRIPT_AVAILABLE','TRANSCRIPT_REVIEWED',
    'VISUAL_REVIEW_REQUIRED','VISUAL_REVIEWED','RULES_EXTRACTED','QUALITY_CHECKED',
    'BLOCKED','UNAVAILABLE')),
  constraint vr_stage_state_ck check (state in ('pending','done','blocked','unavailable','n/a'))
);
create index if not exists vr_video_stages_stage_idx on vr_video_stages(stage, state);

-- ---------------------------------------------------------------------------
-- 4. INVENTORY RUNS — the stored completeness denominator  (spec §6, §22.15)
-- ---------------------------------------------------------------------------
create table if not exists vr_inventory_runs (
  id              bigserial primary key,
  source_key      text not null references vr_sources(source_key),
  listing         text not null,             -- videos | streams | shorts | playlist
  started_at      timestamptz not null default now(),
  finished_at     timestamptz,
  items_seen      int not null default 0,
  new_items       int not null default 0,
  -- THE denominator honesty flag. false => any % computed off this listing is a lie.
  pagination_complete boolean not null default false,
  stopped_reason  text,                      -- end_of_listing | rate_limited | error | cap
  cutoff_at       timestamptz,               -- inventory snapshot cutoff (spec §6)
  error           text
);
create index if not exists vr_inventory_runs_src_idx on vr_inventory_runs(source_key, listing, started_at desc);

-- ---------------------------------------------------------------------------
-- 5. PRESENTER ATTRIBUTION  (spec §9, §22.7)
-- ---------------------------------------------------------------------------
create table if not exists vr_presenters (
  presenter_key text primary key,            -- 'kyle-doops', 'benjamin-cowen', 'unknown'
  display_name  text not null,
  affiliation   text,
  notes         text
);

create table if not exists vr_video_presenters (
  video_id      text not null references vr_videos(video_id) on delete cascade,
  presenter_key text not null references vr_presenters(presenter_key),
  -- How we know. An unsupported guess must land as 'uncertain', never as a name.
  evidence      text not null,
  evidence_kind text not null,               -- title | description | channel | transcript | manual
  confidence    text not null default 'uncertain',  -- confirmed | probable | uncertain
  at            timestamptz not null default now(),
  primary key (video_id, presenter_key),
  constraint vr_vp_conf_ck check (confidence in ('confirmed','probable','uncertain'))
);

-- ---------------------------------------------------------------------------
-- 6. TRANSCRIPTS  (spec §4, §8, §13)
-- ---------------------------------------------------------------------------
-- Copyright posture (spec §13): this table holds PROVENANCE, never the full text by
-- default. Full caption text lives in the local private cache on the processing box;
-- what persists here is the hash, the segment count and bounded excerpts attached to a
-- specific extracted rule. retention='hash_only' is the default for that reason.
create table if not exists vr_transcripts (
  video_id      text not null references vr_videos(video_id) on delete cascade,
  lang          text not null,
  source_type   text not null,               -- creator | auto   (spec §4: never conflate)
  fetched_at    timestamptz not null default now(),
  format        text,                        -- json3 | vtt | srt
  segment_count int,
  duration_ms   bigint,
  text_hash     text,                        -- sha256 of normalised text (spec §14 input hash)
  retention     text not null default 'hash_only',  -- hash_only | excerpts | full
  local_ref     text,                        -- path in the private cache, if retained locally
  primary key (video_id, lang, source_type),
  constraint vr_tx_src_ck check (source_type in ('creator','auto')),
  constraint vr_tx_ret_ck check (retention in ('hash_only','excerpts','full'))
);

-- ---------------------------------------------------------------------------
-- 7. METHOD LIBRARY  (spec §10)
-- ---------------------------------------------------------------------------
create table if not exists vr_methods (
  method_id        text primary key,
  presenter_key    text not null references vr_presenters(presenter_key),
  -- Classification drives everything downstream: only PRECISE_AND_TESTABLE may be
  -- preregistered without a labelled researcher completion (spec §10, §22.11).
  classification   text not null,
  paraphrased_rule text not null,            -- OUR words. Excerpts live in vr_method_excerpts.
  asset            text,
  product          text,                     -- spot | perp | future | option | unstated
  direction        text,                     -- long | short | both | unstated
  timeframe        text,
  regime_conditions text,
  indicator_settings jsonb,
  entry_trigger    text,
  entry_timing     text,
  order_type       text,
  stop_invalidation text,
  position_sizing  text,
  leverage_rule    text,
  profit_targets   text,
  trailing_exit    text,
  time_exit        text,
  reentry          text,
  do_not_trade     text,                     -- reasons to stay out (spec §1)
  economic_rationale text,
  -- The three honesty columns.
  unknowns         jsonb not null default '[]'::jsonb,  -- explicit gaps, never silently filled
  interpretation_choices jsonb not null default '[]'::jsonb,
  source_confidence text not null default 'low',
  -- A rule whose entry depends on a chart we could not inspect is INCOMPLETE (spec §8).
  chart_dependent  boolean not null default false,
  visual_resolved  boolean not null default false,
  status           text not null default 'extracted',   -- extracted | reviewed | rejected | preregistered
  -- Researcher-supplied completions are variants, never the presenter's rule (spec §10, §22.11)
  is_variant_of    text references vr_methods(method_id),
  researcher_added boolean not null default false,
  extractor_version text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint vr_methods_class_ck check (classification in (
    'PRECISE_AND_TESTABLE','PARTIALLY_SPECIFIED','DISCRETIONARY','GENERAL_EDUCATION',
    'MARKET_COMMENTARY','RETROSPECTIVE_EXAMPLE','PERFORMANCE_CLAIM','SPONSORED_PROMOTIONAL')),
  constraint vr_methods_conf_ck check (source_confidence in ('low','medium','high')),
  constraint vr_methods_status_ck check (status in ('extracted','reviewed','rejected','preregistered'))
);
create index if not exists vr_methods_presenter_idx on vr_methods(presenter_key, classification);
create index if not exists vr_methods_status_idx    on vr_methods(status);

-- Every method must trace to inspected source timestamps (spec §13, §22.16).
create table if not exists vr_method_excerpts (
  id          bigserial primary key,
  method_id   text not null references vr_methods(method_id) on delete cascade,
  video_id    text not null references vr_videos(video_id),
  t_start_ms  bigint not null,
  t_end_ms    bigint,
  excerpt     text not null,                 -- BOUNDED quote, not the transcript
  note        text
);
create index if not exists vr_method_excerpts_method_idx on vr_method_excerpts(method_id);
create index if not exists vr_method_excerpts_video_idx  on vr_method_excerpts(video_id);

-- Numeric claims carry their own uncertainty (spec §8, §22.6).
create table if not exists vr_numeric_claims (
  id           bigserial primary key,
  method_id    text references vr_methods(method_id) on delete cascade,
  video_id     text not null references vr_videos(video_id),
  t_ms         bigint not null,
  kind         text not null,                -- price | percent | leverage | indicator_setting | size
  raw_text     text not null,                -- exactly as transcribed
  parsed_value double precision,
  unit         text,
  ambiguous    boolean not null default false,
  ambiguity_note text,
  visual_checked boolean not null default false
);
create index if not exists vr_numeric_claims_method_idx on vr_numeric_claims(method_id);

-- Chart inspection record (spec §8).
create table if not exists vr_chart_observations (
  id             bigserial primary key,
  video_id       text not null references vr_videos(video_id) on delete cascade,
  t_ms           bigint not null,
  asset          text,
  venue          text,
  product        text,
  timeframe      text,
  chart_timestamp text,
  chart_timezone  text,
  indicators     jsonb,
  levels         jsonb,
  candles_were   text,                       -- historical | current_at_publication | unknown
  inspected_by   text not null,              -- who/what actually looked
  inspected_at   timestamptz not null default now(),
  note           text,
  constraint vr_chart_candles_ck check (candles_were in ('historical','current_at_publication','unknown'))
);

-- ---------------------------------------------------------------------------
-- 8. HISTORICAL CALL LEDGER  (spec §11)
-- ---------------------------------------------------------------------------
create table if not exists vr_calls (
  call_id        text primary key,
  video_id       text not null references vr_videos(video_id) on delete cascade,
  presenter_key  text references vr_presenters(presenter_key),
  t_ms           bigint,                     -- position within the video
  -- The two times that stop a backtest awarding a pre-publication entry (spec §11, §22.8)
  published_at   timestamptz,                -- video public
  receivable_at  timestamptz,                -- earliest a viewer could ACT on this segment
  receivable_basis text,                     -- how receivable_at was derived
  receivable_uncertainty_s int,              -- +/- seconds (livestream segment timing)
  asset          text,
  product        text,
  direction      text,                       -- long | short | flat | none
  call_type      text not null,              -- actionable | conditional | opinion | hindsight | unscorable
  conditional    boolean not null default false,
  entry_condition text,
  entry_zone     text,
  invalidation   text,
  target         text,
  horizon        text,
  stated_confidence text,
  still_available_after boolean,             -- was the entry reachable after publication
  superseded_by  text references vr_calls(call_id),   -- updates chain, so one trade != many wins
  update_group   text,                       -- all updates to one trade share this (spec §22.9)
  outcome        text,                       -- win | loss | flat | cancelled | unscorable | open
  outcome_note   text,
  missing_info   jsonb not null default '[]'::jsonb,
  created_at     timestamptz not null default now(),
  constraint vr_calls_type_ck check (call_type in
    ('actionable','conditional','opinion','hindsight','unscorable')),
  constraint vr_calls_outcome_ck check (outcome is null or outcome in
    ('win','loss','flat','cancelled','unscorable','open'))
);
create index if not exists vr_calls_video_idx  on vr_calls(video_id);
create index if not exists vr_calls_asset_idx  on vr_calls(asset, published_at desc);
create index if not exists vr_calls_group_idx  on vr_calls(update_group);

-- ---------------------------------------------------------------------------
-- 9. NEWS / WALLET TIMELINE  (spec §12)
-- ---------------------------------------------------------------------------
create table if not exists vr_news_links (
  id             bigserial primary key,
  call_id        text references vr_calls(call_id) on delete cascade,
  video_id       text references vr_videos(video_id),
  primary_source text,
  event_at       timestamptz,
  published_at   timestamptz,
  received_at    timestamptz,
  statement_t_ms bigint,
  wallet_observation text,
  price_when_actionable double precision,
  spread_bps     double precision,
  -- Sequence is not causation. This column exists to stop the inference (spec §12).
  relationship   text not null,
  note           text,
  constraint vr_news_rel_ck check (relationship in (
    'presenter_cites_event','event_preceded_call_rationale_unstated','event_followed_call',
    'association_only','no_documented_connection'))
);

-- ---------------------------------------------------------------------------
-- 10. EXTRACTION PROVENANCE  (spec §14)
-- ---------------------------------------------------------------------------
create table if not exists vr_extractions (
  id              bigserial primary key,
  video_id        text not null references vr_videos(video_id) on delete cascade,
  method_id       text references vr_methods(method_id) on delete set null,
  extractor_version text not null,
  model_id        text not null,
  prompt_version  text not null,
  input_hash      text not null,
  output_hash     text not null,
  extracted_at    timestamptz not null default now(),
  schema_valid    boolean not null default false,
  uncertainty     text,
  review_state    text not null default 'unreviewed',  -- unreviewed | second_reviewed | rejected
  reviewer        text,
  reviewed_at     timestamptz,
  review_note     text,
  constraint vr_extractions_review_ck check (review_state in ('unreviewed','second_reviewed','rejected'))
);
create index if not exists vr_extractions_video_idx  on vr_extractions(video_id);
create index if not exists vr_extractions_method_idx on vr_extractions(method_id);

-- ---------------------------------------------------------------------------
-- 11. HYPOTHESIS BRIDGE  (spec §15, §19 — reuse the EXISTING trial ledger)
-- ---------------------------------------------------------------------------
-- Video-derived hypotheses are registered in kr_research_verdicts, the global register
-- that already carries trials_run. This table is the join, not a second ledger — a
-- competing ledger is exactly how a trial count gets quietly reset.
create table if not exists vr_hypothesis_links (
  verdict_id    text primary key,            -- kr_research_verdicts.id (no FK: different subsystem)
  method_id     text not null references vr_methods(method_id),
  registered_at timestamptz not null default now(),
  frozen_rule   text not null,               -- the rule text AS FROZEN at preregistration
  frozen_hash   text not null,
  interpretation_choices jsonb not null default '[]'::jsonb,
  success_criteria text,
  kill_criteria    text,
  variants_registered jsonb not null default '[]'::jsonb,
  contamination_note text,                   -- spec §15: learned-from-history is not OOS
  forward_start_at timestamptz               -- the 90-day forward window (spec §24)
);

-- ---------------------------------------------------------------------------
-- 12. RUN LOG / CHECKPOINTS  (spec §21)
-- ---------------------------------------------------------------------------
create table if not exists vr_runs (
  id          bigserial primary key,
  job         text not null,
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  ok          boolean,
  processed   int not null default 0,
  skipped     int not null default 0,
  failed      int not null default 0,
  blocked     int not null default 0,
  checkpoint  jsonb,                         -- resume token; restart must not reprocess
  note        text,
  error       text
);
create index if not exists vr_runs_job_idx on vr_runs(job, started_at desc);

-- ---------------------------------------------------------------------------
-- 13. ACCESS BLOCKERS  (spec §6, §20, §23 — a gap must stay visible)
-- ---------------------------------------------------------------------------
create table if not exists vr_access_blockers (
  id           bigserial primary key,
  video_id     text references vr_videos(video_id) on delete cascade,
  source_key   text references vr_sources(source_key),
  kind         text not null,                -- rate_limited | bot_check | private | deleted
                                             -- | members_only | no_captions | region_blocked | other
  detail       text,
  first_seen_at timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  occurrences   int not null default 1,
  resolved      boolean not null default false
);
create index if not exists vr_access_blockers_kind_idx on vr_access_blockers(kind, resolved);

-- ---------------------------------------------------------------------------
-- 14. QUALITY REPORT  (spec §19 extraction quality report, §22 acceptance tests)
-- ---------------------------------------------------------------------------
create table if not exists vr_quality_checks (
  id         bigserial primary key,
  at         timestamptz not null default now(),
  check_key  text not null,                  -- maps to a spec §22 acceptance test
  passed     boolean not null,
  observed   jsonb,
  note       text
);
create index if not exists vr_quality_checks_key_idx on vr_quality_checks(check_key, at desc);

-- ---------------------------------------------------------------------------
-- RLS: service-key only, matching the kr_* and desk_* convention.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'vr_sources','vr_videos','vr_playlist_members','vr_video_stages','vr_inventory_runs',
    'vr_presenters','vr_video_presenters','vr_transcripts','vr_methods','vr_method_excerpts',
    'vr_numeric_claims','vr_chart_observations','vr_calls','vr_news_links','vr_extractions',
    'vr_hypothesis_links','vr_runs','vr_access_blockers','vr_quality_checks']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;

comment on table vr_videos is
  'Archive inventory, one row per video ID. Deduped by video_id; playlist membership lives in vr_playlist_members so a video in three playlists is still one record.';
comment on table vr_inventory_runs is
  'Stores whether pagination actually completed. A coverage percentage may only be shown against a listing whose pagination_complete is true (spec 22.15).';
comment on table vr_video_stages is
  'Per-stage processing state. Deliberately not a single status column on vr_videos: a video with a reviewed transcript and an unresolved chart is partially complete, and that must be expressible.';
comment on table vr_hypothesis_links is
  'Join to kr_research_verdicts, the EXISTING global trial ledger. Video work never starts a second trial counter.';
