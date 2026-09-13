# Brief → code map

Where each requirement of the video-research brief is actually enforced.
Same discipline as [`desk-loop/docs/RULES-TO-CODE.md`](../../desk-loop/docs/RULES-TO-CODE.md):
**the code is the law, this file is the map.** If they disagree, the code is what runs — fix
the map in the same commit. A requirement that lives only in a docstring is marked as such.

Last verified against the code on **2026-09-13**.

## Scope and sources (§2)

| Requirement | Enforced in | Note |
|---|---|---|
| Resolve stable channel IDs, never rely on handles | `sources.py` `SOURCES` | Every entry carries `channel_id`; handles are informational. Resolved by reading `externalId` off the channel page on 2026-09-13. |
| Crypto Insider ambiguity → UNRESOLVED, ask, continue | `sources.py` (`crypto-insider`), `vr_sources.scope_status` | Two near-matches exist and neither is authoritative. Never crawled. |
| Do not silently expand into affiliated channels | `sources.py` (`related-candidates`, `scope_status='RELATED'`), `inventory.refresh()` | Only `scope_status='CONFIRMED'` is enumerated — asserted by `test_inventory.test_unresolved_sources_are_never_enumerated`. |
| Dedupe by video ID, retain playlist relationships | `inventory._upsert_videos()` + `vr_playlist_members` | Real case: 902 of the Sniper playlist's 907 entries also appear in Crypto Banter's channel tabs. |

## Inventory and completeness (§5, §6)

| Requirement | Enforced in | Note |
|---|---|---|
| Every inventory field | `vr_videos` + `inventory._video_row()` | — |
| Stages tracked **separately** (partial completion) | `vr_video_stages` (PK `video_id,stage`), `store.set_stage()` | Deliberately not one status column. |
| Idempotent + checkpointed | `store.upsert()` on declared conflict keys, `store.Run`, `inventory._resume_done()` | A restart skips finished listings. |
| **Pagination completeness is stored, never assumed** | `vr_inventory_runs.pagination_complete`, `inventory.run_listing()` | `true` only when yt-dlp exited 0, no cap was applied, and stderr carried no rate-limit/bot marker. |
| **No percentage against an unknown denominator** | `inventory.coverage_report()` | Returns `ratio=None` plus a `ratio_note` when the listing is incomplete, and withholds the source-level total when any listing is incomplete. |
| An inaccessible video stays an explicit gap | `vr_access_blockers`, `store.record_blocker()`, stage `UNAVAILABLE` | Never dropped from the inventory. |

## Access and transcripts (§4, §8, §13)

| Requirement | Enforced in | Note |
|---|---|---|
| **Creator captions vs ASR never conflated** | `captions.py` — `source_type` read from which dict the lang came out of (`subtitles` = creator, `automatic_captions` = ASR) | `en-orig` is ASR. Asserted by `test_captions.test_en_orig_is_never_creator`. Measured: these channels have **0 creator tracks**. |
| Machine-translated tracks are not extra languages | `captions.py` `_caption_langs()` | Asserted by `test_translated_tracks_are_not_counted`. |
| Timestamp alignment retained | `captions.parse_json3()` → `t_start_ms`/`t_end_ms` | json3, not vtt: vtt rounds to centiseconds. |
| Rate limits, backoff, bounded batches | `captions.Pacer`, `COOLDOWN_START/CAP`, `MAX_CONSECUTIVE_BLOCKS` | Exponential cooldown 300s → 3600s; aborts cleanly after 3 consecutive blocks. |
| Missing transcript never yields a summary | `captions._gate()` + `extract.validate()` (≥1 excerpt required) | A method with no inspected timestamp cannot validate. |
| Copyright: retain references, hashes, bounded excerpts | `captions.RETENTION='hash_only'`; full text only in the local private cache | `vr_transcripts` stores hash + counts, not text. |
| Chart-dependent rule stays INCOMPLETE | `extract.validate()` — `chart_dependent && !visual_resolved` may not be `PRECISE_AND_TESTABLE` | `vr_chart_observations` holds what was actually inspected. |
| Numeric uncertainty preserved | `vr_numeric_claims.ambiguous` + `ambiguity_note` (required when ambiguous) | Never silently corrected. |

## Presenters (§9)

| Requirement | Enforced in | Note |
|---|---|---|
| Multi-presenter channel ≠ attribution | `presenters.MULTI_PRESENTER_CHANNELS` | Crypto Banter at channel level yields `unknown`/`uncertain`. |
| **Kyle Doops not tagged from a bare "Kyle"** | `presenters.KYLE_BARE` / `KYLE_DECOYS` / `_kyle_blocked()` | "Kyle Samani" is a different person and appears in this archive. Requires "doops" or transcript self-identification. |
| Otherwise mark the speaker uncertain | `vr_video_presenters.confidence` | `confirmed \| probable \| uncertain`; `evidence` is NOT NULL. |

## Methods and extraction (§10, §14)

| Requirement | Enforced in | Note |
|---|---|---|
| Full structured record | `vr_methods` + `extract.EXTRACTION_SCHEMA` | — |
| The eight classifications | `extract.CLASSIFICATIONS` + DB check constraint | — |
| `PRECISE_AND_TESTABLE` needs entry **and** stop | `extract.validate()` | Downgrade message names the fix. |
| Explicit unknowns and interpretation choices | `vr_methods.unknowns`, `interpretation_choices` (NOT NULL, list) | `PARTIALLY_SPECIFIED` must name its gaps. |
| Researcher completions are labelled variants | `extract.validate()` — `researcher_added` requires `is_variant_of` | And counts as another trial. |
| Untrusted source text | `extract.UNTRUSTED_PREAMBLE`, `_scrub()`, `build_prompt()` | Transcript is fenced as data; it cannot instruct, change risk policy or promote a hypothesis. |
| Provenance: extractor/model/prompt version, hashes | `vr_extractions` + `extract.record_extraction()` | — |
| Second review before implementation | `extract.needs_second_review()`, `vr_extractions.review_state` | Triggers on numeric settings, leverage, or chart dependence. |
| Two models agreeing is not independent evidence | `extract.py` module docstring | **Docstring-level only** — a human discipline, not a code gate. |
| Sponsored content classified | `extract.detect_sponsorship()` → `SPONSORED_PROMOTIONAL` | Conservative; returns the matched evidence. |

## Call ledger (§11, §12)

| Requirement | Enforced in | Note |
|---|---|---|
| **A viewer can never act before publication** | `calls.receivable_time()`, `calls.PrePublicationError` | Upload: `published_at + offset`. Recording time is ignored. |
| Day-level publication precision carried | `calls.published_precision()`, `DAY_PRECISION_UNCERTAINTY_S = 86400` | The flat listing gives a date, not a timestamp. |
| Livestream segment timing is approximate | `LIVE_UNCERTAINTY_S = 300`; unknown start → `STREAM_UNKNOWN_UNCERTAINTY_S = 86400`, basis `stream_start_unknown` | — |
| Repeated updates ≠ several wins | `calls.group_id_for()`, `vr_calls.update_group`, `superseded_by`, `calls.score_summary()` | Scoring counts distinct `update_group`s. |
| Unscorable is not a win or a loss | `calls.score_summary()` | Reported as its own bucket. |
| Losing and cancelled calls retained | `calls.py` (no delete path) | Deletion is forbidden by §3. |
| Sequence is not causation | `calls.link_news()` + `vr_news_links.relationship` | `presenter_cites_event` requires a citation of at least `MIN_CITATION_CHARS`, else downgraded to `association_only`. |
| Wallet cohorts frozen before evaluation | `calls.freeze_cohort()`, `calls.CohortDrift` | Freeze timestamp is real and stored. |

## Research memory and boundaries (§3, §15, §19, §20)

| Requirement | Enforced in | Note |
|---|---|---|
| **Reuse the existing global trial ledger** | `vr_hypothesis_links.verdict_id` → `kr_research_verdicts` | No second trial counter. `trials_run` stays where it already lives. |
| Contamination: history-learned ≠ out-of-sample | `vr_hypothesis_links.contamination_note`, `forward_start_at` | — |
| Paper-only; no order path | acceptance checks `22.13`/`22.14` (static source inspection) | The package imports no broker client and writes to no `kr_paper_positions` / `desk_triggers` / risk table. |
| No video-derived signal opens a trade | Standing banner on the dashboard + `22.14` | — |
| Dashboard must not overstate | `app/admin/dashboard/video-research/page.tsx` | Missing number renders as an em dash, never `0`; "denominator unknown" replaces any percentage lacking an established denominator. |

## NOT in code — human-only, do not assume the pipeline is doing it

| Item | Status |
|---|---|
| **Visual/chart inspection** | **Not implemented and not attempted.** Nothing in this package looks at a frame. Every chart-dependent rule stays `visual_resolved=false` until a human records a `vr_chart_observations` row. This is the largest open gap. |
| Backtesting / execution modelling (§16, §17) | Not implemented here. The brief's execution requirements (fees, funding, spread, partial fills, intrabar resolution) belong to the existing evaluation stack, not to this ingest pipeline. No video method has been tested. |
| Outcome scoring of calls (§11 outcome, §18) | Ledger schema and grouping exist; **no price data is joined yet**, so every loaded call sits at `outcome='open'` or `unscorable`. |
| News/wallet timeline population (§12) | Table and guards exist; no rows collected. |
| "Two model outputs agreeing is not evidence" | Docstring discipline, not a code gate. |
| Scheduled/unattended operation (§21) | `cli.py` is runnable and resumable, but **no timer or cron is installed**. Deliberate: the brief says to schedule only after the pipeline is verified. |
