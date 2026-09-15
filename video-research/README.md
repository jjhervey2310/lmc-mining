# video-research — learning from trading commentators, without believing them

**Operating reference: [`docs/`](docs/)** — [brief → code map](docs/BRIEF-TO-CODE.md) ·
[access methods and the transcript format](docs/ACCESS.md) ·
[first-batch report](docs/FIRST-BATCH-REPORT.md)

Turns the public YouTube archives of Crypto Banter, Sniper Trading and Benjamin Cowen into
**sourced, falsifiable method records** — and is built so that the parts we could not
establish stay visible instead of being smoothed over. Python 3, **stdlib only** plus
`yt-dlp`.

It is research memory, not a signal source. **No video-derived signal can open a trade.**
Nothing here imports a broker client, writes to `kr_paper_positions` or `desk_triggers`, or
touches a risk limit — and that is enforced by acceptance checks over the source, not by
intent.

## The modules

| File | What it does | Costs money? |
|---|---|---|
| `store.py` | Supabase REST, stage tracking, run checkpoints, blocker recording. stdlib only, same shape as `desk-loop/common.py`. Every write is an upsert on a declared conflict key — which is what makes a re-run update instead of duplicate | free |
| `sources.py` | The source registry, resolved to stable channel IDs. `UNRESOLVED` and `RELATED` sources are stored but never crawled | — |
| `inventory.py` | Resumable archive enumeration via `yt-dlp --flat-playlist`; owns `pagination_complete` and `coverage_report()` — the denominator rule | free |
| `captions.py` | Rate-limited, checkpointed transcript ingestion; creator-vs-ASR discipline; authorized-transcript import | free |
| `extract.py` | The extraction schema, its validator, and the untrusted-data prompt envelope. Calls no model itself | free (the model call is yours to make) |
| `presenters.py` | Attribution, including the guard that stops "Kyle" becoming Kyle Doops | free |
| `calls.py` | The historical call ledger, publication timing, and update grouping | free |
| `quality.py` | The brief's §22 acceptance checks, written to `vr_quality_checks` | free |
| `cli.py` | The operator surface — everything above is reachable from here | — |

## Commands

```bash
cd video-research                       # needs SUPABASE_URL + SUPABASE_SERVICE_KEY in .env

python3 cli.py seed                     # source + presenter registry (idempotent)
python3 cli.py inventory                # refresh the inventory; finished listings are skipped
python3 cli.py inventory --sources crypto-banter --limit 50
python3 cli.py captions --limit 25      # transcript ingestion, rate-limited and checkpointed
python3 cli.py captions --limit 10 --delay 60 --force
python3 cli.py import-transcripts --path ~/transcripts --dry-run   # validate, write nothing
python3 cli.py import-transcripts --path ~/transcripts             # ingest
python3 cli.py status                   # coverage, stages, last runs, blockers, next step
python3 cli.py quality                  # the acceptance checks
python3 cli.py blockers                 # open access blockers and their remedies

python3 tests/test_acceptance.py        # 102 cases, no credentials, no network
python3 -m py_compile *.py
```

Every subcommand is safe to re-run and prints a RESUME block naming the command that
continues whatever it did not finish — including after Ctrl-C. Add `--json` to any of them
for machine-readable output. Dashboard: `/admin/dashboard/video-research`.

Exit codes: `0` nothing outstanding · `1` ran, something failed or is still blocked ·
`2` could not run (no credentials, or a read failed) · `130` interrupted.

`--dry-run` and the test suite need no credentials. Everything else reports **"unreadable"**
and exits 2 rather than printing zeros: an empty archive and an archive we could not read
look identical in a count and mean opposite things.

## Where state lives

| What | Where | Committed? |
|---|---|---|
| Inventory, transcript provenance, methods, calls, runs, blockers | Supabase, 19 `vr_*` tables (schema: `schema.sql`), service key only | no |
| **Full caption text** | `state/cache/transcripts/` — local, private | **no**, gitignored |
| yt-dlp scratch | `state/cache/work/` | no |
| Checkpoints | `vr_runs.checkpoint`, plus a `vr_inventory_runs` row per listing | no |
| Credentials | `video-research/.env` (or the repo's `.env.local`) | **no** |

`vr_transcripts` stores a hash, a segment count, a duration and a cache path — **not the
text**. The retention knob is `captions.RETENTION` and it is `hash_only`. Full transcripts
never reach the database.

## The rate-limit reality

**The fetcher is deliberately slow, and that is not a bug to tune out.**

Channel *listing* is not bot-gated and runs at full speed. The *per-video* player API is: from
a datacenter IP it starts returning `Sign in to confirm you're not a bot` after a handful of
calls, and the flag persists for at least 40 minutes. Concurrency is what trips it — three
parallel jobs did it inside a minute during access testing.

Worse, **the gate arrives as a warning with exit code 0**: yt-dlp then falls back to a page
that has a title but no player response. Trusting the exit code would file a transient block
as a permanent "this video has no captions". So `captions.py` classifies stderr on every run,
and "no captions" additionally requires positive evidence that the player response arrived.

So the fetcher is strictly serial — one video per subprocess, one subprocess at a time — paces
itself (`VR_CAPTION_DELAY`, default 20s, with ±35% jitter so the request train is not a
metronome), asks for English caption languages only (requesting all of them is what tripped
the gate during access testing), backs off 300s → 3600s on a gate, and aborts the batch
cleanly after three consecutive blocks so the run ends on a checkpoint rather than hammering.
A blocked video is recorded in `vr_access_blockers`, never silently skipped.

A full-archive transcript pass is a multi-day unattended job from a non-gated IP, not one
batch. No completion date is offered, because sustainable throughput from a working IP has
not been measured — and `cli.py captions` reports a rate only when at least one fetch
succeeded, since no successes means no denominator.

The gate is **not** worked around: no cookies, no impersonation, no account credentials. If
you are seeing constant blocks, the fix is not a shorter delay — it is a different IP, or
authorized transcripts. Both are in [`docs/ACCESS.md`](docs/ACCESS.md).

## The rules that shape the schema

Four decisions explain most of what looks unusual here:

1. **Processing stages are separate rows, not one status column.** A video with a reviewed
   transcript and an unresolved chart is *partially complete*, and that had to be expressible.
   One status column would force a single word onto it, and the honest word would be the one
   unavailable.
2. **Coverage denominators are stored, not inferred.** `vr_inventory_runs.pagination_complete`
   records whether a listing actually reached the end. A walk can stop for three reasons that
   look identical from outside — end of data, rate limit, or a caller `--limit` — and only the
   first licenses a percentage. `coverage_report()` returns `None` — never a number — for the
   other two, and `cli.py status` and the dashboard print "denominator unknown" rather than
   inventing a total.
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
  open gap in the project, no amount of transcript volume closes it, and `cli.py status`
  prints it every time.
- **It does not trade, and cannot.** No order path, no risk-limit write, no broker import, no
  live price read. Acceptance checks 22.13 and 22.14 inspect this package's own source with
  `ast` and fail if that ever stops being true.
- **It does not prove anyone is profitable.** It evaluates *public calls*, which is not the
  same thing as an account: we do not know their real fills, their other positions, or their
  full history. Subscriber counts, screenshots and claimed monthly income are not evidence and
  are not stored as any. No price data is joined to the ledger yet, so calls sit at
  `outcome='open'`, and a win rate is withheld wherever the denominator still contains open or
  unscored groups.
- **It does not dismiss anyone either.** A method that comes out `PARTIALLY_SPECIFIED` is
  under-specified *for testing*, which is a statement about what was said on camera, not about
  the presenter's skill.
- **It does not summarise what it could not read.** A missing transcript produces a blocker
  row and a stage, never a summary. A method with no timestamped excerpt fails validation.
- **It does not retrain, fine-tune or update any model.** "Learning" here means persistent
  structured records, reproducible tests and prospective evaluation. Nothing about the
  underlying language model changes. Two model outputs agreeing is not independent evidence
  and raises no confidence — only a human reading the cited timestamps can move `review_state`
  to `second_reviewed`.
- **It does not promote a hypothesis.** Video-derived hypotheses register against
  `kr_research_verdicts` — the existing global trial ledger, no second counter — and start
  `untested` like everything else. A presenter endorsing something is not evidence.
- **It does not guess at a source.** Crypto Insider is `UNRESOLVED` and uncrawled because two
  near-matches exist and neither is authoritative. Affiliated Crypto Banter channels are
  listed as `RELATED` and are not crawled either.
- **It does not treat video text as instructions.** Titles, descriptions, chapter names and
  caption text are untrusted data throughout: stored, hashed, quoted and fenced, never
  executed, and never able to change a rule, a risk setting or a hypothesis.
- **It does not run on a schedule.** No timer, no cron. The brief says to schedule only after
  the pipeline is verified end to end from a working IP, and a service that claims continuous
  monitoring it is not doing is worse than none. When it is scheduled, it belongs on the
  droplet next to the desk loop (systemd) — not in `vercel.json`, not under `pg_cron`.
