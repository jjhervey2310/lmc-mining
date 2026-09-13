# video-research — learning from trading commentators, without believing them

**Operating reference: [`docs/`](docs/)** — [brief → code map](docs/BRIEF-TO-CODE.md) ·
[access methods and the transcript format](docs/ACCESS.md) ·
[first-batch report](docs/FIRST-BATCH-REPORT.md)

Turns the public YouTube archives of Crypto Banter, Sniper Trading and Benjamin Cowen into
**sourced, falsifiable method records** — and is built so that the parts we could not
establish stay visible instead of being smoothed over.

It is research memory, not a signal source. **No video-derived signal can open a trade.**
Nothing here imports a broker client, writes to `kr_paper_positions` or `desk_triggers`, or
touches a risk limit — and that is enforced by acceptance checks over the source, not by
intent.

## The modules

| File | What it does | Costs money? |
|---|---|---|
| `store.py` | Supabase REST, stage tracking, run checkpoints, blocker recording. stdlib only, same shape as `desk-loop/common.py` | free |
| `sources.py` | The source registry, resolved to stable channel IDs. `UNRESOLVED` and `RELATED` sources are stored but never crawled | — |
| `inventory.py` | Resumable archive enumeration via `yt-dlp --flat-playlist`; stores whether each listing actually paginated to the end | free |
| `captions.py` | Rate-limited, checkpointed transcript ingestion; creator-vs-ASR discipline; authorized-transcript import | free |
| `extract.py` | The extraction schema, its validator, and the untrusted-data prompt envelope | free (the model call is yours to make) |
| `presenters.py` | Attribution, including the guard that stops "Kyle" becoming Kyle Doops | free |
| `calls.py` | The historical call ledger, publication timing, and update grouping | free |
| `quality.py` | The brief's §22 acceptance checks, written to `vr_quality_checks` | free |
| `cli.py` | The operator surface | — |

Storage is Supabase (`vr_*` tables, 19 of them, service-key only). Full transcript text lives
**only** in the local private cache under `state/cache/` and is gitignored — the database holds
hashes, counts and bounded excerpts.

## Commands

```bash
cd video-research                       # needs SUPABASE_URL + SUPABASE_SERVICE_KEY in .env

python3 cli.py seed                     # source + presenter registry (idempotent)
python3 cli.py inventory                # refresh the inventory; finished listings are skipped
python3 cli.py captions --limit 25      # transcript ingestion, rate-limited and checkpointed
python3 cli.py import-transcripts --path ~/transcripts --dry-run
python3 cli.py status                   # coverage, stages, last runs, blockers
python3 cli.py quality                  # the acceptance checks
python3 cli.py blockers                 # open access blockers and their remedies

python3 tests/test_acceptance.py        # runs with no credentials
```

Every subcommand is safe to re-run and prints the command that continues whatever it did not
finish. Dashboard: `/admin/dashboard/video-research`.

## The rate-limit reality

**The fetcher is deliberately slow, and that is not a bug to tune out.**

Channel *listing* is not bot-gated and runs at full speed. The *per-video* player API is: from
a datacenter IP it starts returning `Sign in to confirm you're not a bot` after a handful of
calls, and the flag persists for at least 40 minutes. Concurrency is what trips it — three
parallel jobs did it inside a minute during access testing.

So `captions.py` is strictly serial, paces itself (`VR_CAPTION_DELAY`, default 20s, with
jitter so the request train is not a metronome), backs off 300s → 3600s on a gate, and aborts
the batch cleanly after three consecutive blocks so the run ends on a checkpoint rather than
hammering. A blocked video is recorded in `vr_access_blockers`, never silently skipped.

If you are seeing constant blocks, the fix is not a shorter delay — it is a different IP, or
authorized transcripts. Both are in [`docs/ACCESS.md`](docs/ACCESS.md).

## The rules that shape the schema

Four decisions explain most of what looks unusual here:

1. **Processing stages are separate rows, not one status column.** A video with a reviewed
   transcript and an unresolved chart is *partially complete*, and that had to be expressible.
   One status column would force a single word onto it, and the honest word would be the one
   unavailable.
2. **Coverage denominators are stored, not inferred.** `vr_inventory_runs.pagination_complete`
   records whether a listing actually reached the end. `coverage_report()` returns `None` —
   never a number — for any listing where it did not, and the dashboard prints
   "denominator unknown" rather than inventing a total.
3. **A chart-dependent rule with no inspected chart cannot be `PRECISE_AND_TESTABLE`.**
   "Buy here", "this line", "below that wick" need the screen. Without it the rule stays
   incomplete rather than acquiring a level someone made up.
4. **A call's receivable time is publication plus the in-video offset.** Recording time is
   irrelevant. And because `receivable_at` is the *earliest* bound, any evaluation must enter
   at `calls.conservative_entry_at()` — the late edge — or it will hand a backtest a fill
   nobody could have taken.

## What this system does NOT do

- **It does not watch videos.** Nothing here looks at a single frame. Every chart-dependent
  rule is unresolved until a human records a `vr_chart_observations` row. This is the largest
  open gap in the project, and no amount of transcript volume closes it.
- **It does not trade, and cannot.** No order path, no risk-limit write, no broker import.
- **It does not prove anyone is profitable.** It evaluates *public calls*, which is not the
  same thing as an account: we do not know their real fills, their other positions, or their
  full history. Subscriber counts, screenshots and claimed monthly income are not evidence and
  are not stored as any.
- **It does not dismiss anyone either.** A method that comes out `PARTIALLY_SPECIFIED` is
  under-specified *for testing*, which is a statement about what was said on camera, not about
  the presenter's skill.
- **It does not retrain any model.** "Learning" here means persistent structured records,
  reproducible tests and prospective evaluation. Nothing about the underlying language model
  changes.
- **It does not promote a hypothesis.** Video-derived hypotheses register against
  `kr_research_verdicts` — the existing global trial ledger — and start `untested` like
  everything else. A presenter endorsing something is not evidence.
- **It does not run on a schedule.** No timer, no cron. The brief says to schedule only after
  the pipeline is verified, and a service that claims continuous monitoring it is not doing is
  worse than none.
