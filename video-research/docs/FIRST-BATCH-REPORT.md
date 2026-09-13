# First batch — initial delivery report

Prepared 2026-09-13. Answers the brief's §23 in order. Every number here came from a command
that ran; nothing is projected.

---

## 1. Repository commit

Branch `claude/elegant-bohr-fqthx0`, first pipeline commit `99d4fb0`
("Add a video-research pipeline that records what it could not see"). See the branch head for
the dashboard and CLI commits that follow.

## 2. Confirmed channel IDs

Resolved on 2026-09-13 by fetching each channel page and reading `externalId`. Handles are
recorded but never relied on — they change, IDs do not.

| Source | Channel ID | Handle |
|---|---|---|
| Crypto Banter | `UCN9Nj4tjXbVTLYWN0EKly_Q` | `@CryptoBanterGroup` |
| Sniper Trading | `UC8ehOEIBdyITN3SDCm1KBCQ` | `@OfficialSniperTrading` |
| Benjamin Cowen | `UCRvqjQPSeaWn-uEx-w0XOIg` | `@benjaminjcowen` |
| The Sniper Crypto Trading Show | playlist `PLmOv2_vzOoGfhsqPsXJnoBEhPUK4Tqd1b` | hosted **on the Crypto Banter channel** |

The playlist is not on Official Sniper Trading. 904 of its 907 entries carry Crypto Banter's
channel ID.

## 3. Crypto Insider — UNRESOLVED

Not resolved, and deliberately not guessed. Two near-matches exist and neither is authoritative:

- `@cryptoinsider` → a channel displaying as **"Wide Angle By Waseem"** (`UCgEVPPnJoW_AmnKhb_D0-mw`). The handle matches; the name does not match the requested source at all.
- `@CryptoInsiders` → **"Crypto Insiders"** (`UCX1PK9XHaCK_Ftz1PAiFeMg`), a different, plural name.

Crawling either would be a guess presented as a source. It sits in `vr_sources` with
`scope_status='UNRESOLVED'` and is never enumerated.

**Action needed from the owner:** the exact channel URL. Then flip `scope_status` to
`CONFIRMED` and run `python3 cli.py inventory --sources crypto-insider`.

## 4. Inventory size and completeness

Enumerated 2026-09-13. Every listing below ran to the end of its pagination with yt-dlp
exit 0 and no rate-limit or bot error, so `pagination_complete = true` is evidence-backed
for all of them.

| Source | videos | streams | shorts | hours (where duration known) |
|---|---:|---:|---:|---:|
| Crypto Banter | 900 | 3,798 | 334 | 2,702.7 |
| Benjamin Cowen | 2,516 | 377 | 235 | 1,139.1 |
| Sniper Trading | 38 | 10 | 10 | 60.9 |
| **Listing items** | **3,454** | **4,185** | **579** | **3,902.8** |

- **8,223 unique videos** after dedupe by video ID (8,218 from channel listings + 5 that exist
  only in the playlist).
- Sniper Trading Show playlist: 907 entries, **902 of which also appear in Crypto Banter's
  channel tabs**. They resolve to one record each, with playlist membership kept separately.
- Shorts carry no duration in the flat listing, so the hours figure covers 7,644 of the 8,223
  videos. It is a floor, not a total.

**This is the discoverable public archive at the stated cutoff — not a sample.** What is *not*
established is how much of it we have processed; see §6 below.

## 5. Access methods — what worked and what failed

| Method | Result |
|---|---|
| `yt-dlp --flat-playlist` channel/playlist listing | **Works.** Not bot-gated. All nine listings completed. |
| Per-video player API (metadata + captions) | **Bot-gated from this IP.** Returns *"Sign in to confirm you're not a bot."* |
| YouTube Data API v3 | **Not used** — no API key is configured, and it would not solve captions anyway: `captions.download` requires OAuth as the channel owner, so third-party caption content is not available through it. Metadata only. |
| Cookie/impersonation workarounds | **Not attempted.** The brief forbids bypassing anti-bot controls and forbids requesting account cookies. |

Measured behaviour of the gate: the session's first ~6 player-API calls succeeded (including
one complete caption download). Sustained use then trips the gate; it recovers after a
cooldown and re-trips. At 40s pacing, three consecutive attempts were blocked and the caption
batch **aborted cleanly on a checkpoint**, which is the designed behaviour.

**Caption provenance — a finding, not a failure.** All three channels carry **zero creator
captions**. Measured on `c45OAsahluc`: yt-dlp `subtitles` (creator) = 0 languages,
`automatic_captions` = 157 including `en` and `en-orig`. Every transcript from these sources
is machine transcription, so every number inside one is a transcription risk. This is why
numeric claims carry an ambiguity flag rather than a silent correction.

**Remedy, in order of preference:**
1. Run `cli.py captions` from a residential IP — Jacob's Mac or the DigitalOcean droplet. The
   droplet is where the Supabase service key already lives, so this is the natural home.
2. Supply authorized timestamped transcripts in the documented JSON format
   (`docs/ACCESS.md`), ingested with `cli.py import-transcripts --path`.

## 6. Videos actually processed

**One.** Crypto Banter `5TIPLsQVSHI`, "While Bitcoin Stalls, These Altcoins Are Exploding",
published 2026-09-07, 681s, position 1 of the Sniper Trading Show playlist. Its English ASR
transcript (134 timestamped segments) was fetched before the gate closed and was read end to
end.

Coverage stated honestly: **1 of 8,223 discovered videos has a processed transcript.** That is
0.01%, against a denominator that *is* established. It is not "the archive has been reviewed",
and the dashboard will not render it as such.

## 7. Relevant visuals actually inspected

**Zero.** Nothing in this package looks at a video frame. Five statements in the one processed
video are chart-dependent and remain unresolved:

| Timestamp | Statement | Why unresolved |
|---|---|---|
| 03:54 | "for as long as Bitcoin is not above this area" | "this area" is pointed at, never stated |
| 04:22 | "if we lose that trend, we're looking for downside over here" | both references are drawn on screen |
| 03:44 | "we might be forming a very big inverse head and shoulders" | tied to a drawing the presenter himself calls poor |
| 06:34 | "Bitcoin dominance coming to the 200-day moving average" | level not stated numerically |
| 07:06 | "if I draw this trend over here" | explicitly a drawn line |

This is the largest open gap in the project.

## 8. Extracted methods, with timestamps

Four method records, all traceable to inspected source timestamps.

**A. Regime filter — do not trade chop** (`PARTIALLY_SPECIFIED`)
> [01:25] "There's a time for trading. The trading time is when the market is trending up or down, right? Right now, it's chopping. So, trading, I am not trading much right now."

A genuine stated reason *not* to trade. Blocked from testable because "chopping" is given no
measurable definition — no indicator, lookback, threshold or timeframe.

**B. Altcoin 200-day/trendline break accumulation** (`PARTIALLY_SPECIFIED`)
> [01:41] "Alts that are breaking the 200-day moving average and breaking long-term trends, buying for the bull run"
> [02:00] "Long-term spot, non-leveraged positions."
> [10:37] "Look for 200-day moving average breaks, trend line breaks, accumulate them... you can put some limit orders a little bit lower"

The most nearly testable of the four, and it has a stated mechanism (catch-up rotation while
BTC ranges and dominance falls). Blocked by two independent faults: **no stop or invalidation
anywhere**, and the trendline half of the trigger is chart-drawn and was not inspected.

**C. Bitcoin patience below resistance** (`PARTIALLY_SPECIFIED`)
> [00:23] "waiting for $74,000 to $75,000 on Bitcoin"
> [03:26] "$82,000 as resistance... then we start looking at the $90,000 to $100,000"
> [04:27] "Daily RSIs are still coming down... not going too crazy on the longs right now"

Blocked by unstated RSI settings, no invalidation, and three unreconciled figures for the same
buy zone ($74–75k, "mid-$70,000", $77k).

**D. Bybit promotional segment** (`SPONSORED_PROMOTIONAL`)
> [02:29] "If you don't have a Bybit account, sign up to Bybit... get up to a 20% sign-up bonus"

Classified so it is never mistaken for a method. The bullish framing inside this segment
("an incredible amount of money to be made") must not be read as a market view.

**Presenter attribution: `unknown` / `uncertain`.** Crypto Banter is multi-presenter and the
transcript never self-identifies. Playlist position is suggestive, not evidence.

## 9. Unresolved rules

**All of them.** Not one method reached `PRECISE_AND_TESTABLE`, and the reason is the same
each time: **no stop or invalidation is ever stated**, and entries lean on drawn trend lines.

That is the finding, not a processing failure. Supplying a stop would create a labelled
researcher variant and consume a trial — it has not been done.

Also unresolved: 9 of 11 numeric claims are flagged ambiguous, including one that matters —
[10:37] "keep a nice 5 to 10% move on altcoins that have not moved just yet" is ambiguous
between *expect a 5–10% pullback to buy into* and *expect a 5–10% move up*. The adjacent
limit-order instruction favours the first reading, but the sentence alone does not settle it,
so it was **not** silently resolved.

## 10. Quality-review results

11 checks recorded in `vr_quality_checks`, all passing:

| Check | Result |
|---|---|
| `dedupe_playlist_channel` | PASS — 0 duplicate video IDs across a 902-video overlap |
| `no_transcript_no_summary` | PASS — 0 methods without an inspected source |
| `chart_rule_incomplete` | PASS — 0 chart-dependent unresolved rules marked testable |
| `numeric_uncertainty_kept` | PASS — 0 ambiguous claims without a note |
| `presenter_attribution` | PASS — 0 rows without evidence; kyle-doops attributed to nothing |
| `no_prepublication_entry` | PASS — 0 of 10 calls receivable before publication |
| `updates_not_double_counted` | PASS — 0 update_groups with multiple live heads |
| `researcher_variants_labelled` | PASS — 0 unlabelled researcher additions |
| `hypothesis_traceable` | PASS (**vacuous** — no hypothesis registered yet) |
| `untrusted_text_inert` | PASS — hostile text enveloped as data; no order/risk mutator defined |
| `no_auto_trade_path` | PASS — no broker import; all 30 literal writes target `vr_` tables |

The vacuous pass is labelled as such and is not offered as evidence of correctness.

**A defect found and fixed during review.** `receivable_at` answers §11 ("earliest time the
call could be received"), so for a day-precision upload it is *midnight* plus the offset — the
optimistic edge. An evaluator entering there could take a fill up to 24h early, and the
`PrePublicationError` invariant cannot catch it because midnight *is* `published_at` as stored.
`calls.conservative_entry_at()` now returns the late edge, and both DB columns carry comments
saying so. The two answers coincide when publication is known to the second.

## 11. Hypotheses suitable for preregistration

**None.** No hypothesis has been registered in `kr_research_verdicts`, and none should be yet:

- All three trading methods are `PARTIALLY_SPECIFIED`, and the brief permits preregistering
  only what is precise enough to test without researcher completion.
- Every one requires a second review before implementation (`needs_second_review()` fires on
  all three — chart dependence and numeric settings).
- One video is not a basis for any claim about any presenter.

**Method B is the one to watch.** It has a stated economic mechanism, a named indicator and an
explicit no-leverage constraint. If a second occurrence of the same rule appears in other
videos with an invalidation attached, it becomes a candidate. As a researcher-completed
variant it is testable today, but that costs a trial and must be labelled — not worth spending
on a single-source reading.

## 12. Tests run

- **136 unit tests pass** across `tests/test_inventory.py` (13), `tests/test_captions.py` (41),
  `tests/test_extract.py` (43) and `tests/test_calls.py` (39). All run without credentials.
- **`tests/test_acceptance.py`: 88 passed, 0 failed, 14 skipped (102 total).** The skips are
  the store-backed checks, labelled `no Supabase credentials` — never silently passed. It also
  asserts the meta-properties that make the rest trustworthy: the 16 check keys match the
  brief exactly and in order; `skipped` and `error` map to `passed=False` and never to a pass;
  the vacuous note is exactly the mandated string; a check that raises becomes `state=error`
  rather than crashing the run.
- `npx tsc --noEmit` clean; `npm run build` completes with no type errors.
- The four real extracted methods were validated against `extract.validate()` — **all four
  valid**.
- Five negative controls rejected as required: claiming `PRECISE_AND_TESTABLE` with no stop;
  `researcher_added` without a parent; an excerpt stripped of its timestamp; a method with no
  excerpts; an ambiguous number with no note.
- `quality.py` run without credentials correctly **SKIPS** the 14 store-backed checks with an
  explicit label rather than silently passing, and passes the 2 static ones.
- The 9 store-backed checks were then run directly as SQL against live data — all pass.

## 13. Storage and resource use

- Supabase: 19 new `vr_*` tables. Text is bounded — full transcripts are **not** stored in the
  database.
- **Inventory load complete.** `vr_videos` = 8,223, `vr_video_stages` = 16,451
  (8,223 × 2, plus the 5 pipeline rows for the one processed video),
  `vr_playlist_members` = 907. Every one of the nine channel listings reports **100.0%**
  stored-against-seen, and each of those percentages is legitimate because its
  `pagination_complete` is true — the denominators were measured, not assumed.
- The dedupe case is now proven on real data rather than asserted: **9,125 listing rows**
  (8,218 channel + 907 playlist) resolved to **8,223 unique videos with zero duplicate IDs**.
  902 playlist entries also appear in Crypto Banter's own tabs and collapse to one record
  each; the 5 that exist only in the playlist carry `video_type='unknown'`, because no
  channel listing ever said what they are.
- To refresh later: `python3 cli.py inventory`. It upserts, re-enumerates a listing whose
  last run completed (so new uploads are picked up) and resumes one that was interrupted.
  `vr_playlist_members` rows are FK-guarded on `vr_videos`, so any skipped while their video
  was absent land on the next pass rather than being lost.
- Local private cache: 11 MB of working data this session (620 KB enumeration output, the rest
  yt-dlp scratch). One transcript is 27 KB as json3.
- Extrapolated, all 8,223 transcripts would be roughly 200–350 MB of json3 in the local cache,
  with only hashes and bounded excerpts reaching the database.
- **No paid API calls were made.** No API key was used and no subscription was purchased.
- Throughput is the binding constraint, not storage: see §5. A full-archive transcript pass is
  a multi-day unattended job from a non-gated IP, not a single batch. No completion date is
  offered because sustainable throughput from a working IP has not been measured.

## 14. Commands to resume and inspect progress

```bash
cd video-research

# Requires SUPABASE_URL + SUPABASE_SERVICE_KEY in video-research/.env
python3 cli.py seed          # source + presenter registry (idempotent)
python3 cli.py inventory     # refresh the archive inventory; skips finished listings
python3 cli.py captions --limit 25   # transcript ingestion, rate-limited and checkpointed
python3 cli.py status        # coverage, stage counts, blockers, last runs
python3 cli.py quality       # acceptance checks
python3 cli.py blockers      # open access blockers and their remedies

python3 tests/test_acceptance.py     # runs with no credentials
```

Every subcommand is safe to re-run and prints the resume command for whatever it did not
finish. Dashboard: `/admin/dashboard/video-research`.

---

## 15. Relationship to the November 1 milestone (§24)

This is an additional research source and is **not** a reason to delay the outstanding
evidence audit. Nothing here consumed the audit's work, changed a risk limit, or touched the
paper trader.

What can honestly be committed to by November 1 depends entirely on one thing: **whether the
caption path runs from a non-gated IP.** From this environment it cannot.

- **If the pipeline is moved to the droplet or the Mac** (§5 remedy 1), the binding constraint
  becomes throughput, which has not yet been measured on a working IP. The right next step is
  a measured 100-video batch to establish a real rate before any completion date is offered.
  Prioritisation is already implemented: Sniper Trading and the Sniper show playlist first,
  then risk/exit/when-not-to-trade vocabulary, then Cowen, then the rest of Crypto Banter.
- **If it is not moved**, archive coverage by November 1 is 1 video, and that should be
  reported as such rather than dressed up.

On the brief's specific November 1 questions, the honest current answers are: archive coverage
0.01% of an established denominator; 4 methods extracted; 3 rejected as underspecified for
testing (all for the same missing stop/invalidation); 0 hypotheses tested; 0 killed; 0
candidates with fresh forward evidence; 0 passing the existing gates. The 90-day forward
requirement and all approved risk limits are untouched.

## What this delivery does not claim

- It does not claim the archive has been watched. One video of 8,223 has a processed transcript.
- It does not claim any presenter is or is not profitable. Nothing has been tested.
- It does not claim any method works. None is testable as stated.
- It does not claim any chart was inspected. None was.
- No video-derived signal can reach the paper trader, and nothing here touches a risk limit.
