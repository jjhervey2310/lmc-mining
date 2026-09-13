# video-research — YouTube archive ingest, read-only

**Operating reference: [`docs/`](docs/)** — [brief → code map](docs/BRIEF-TO-CODE.md) · [access methods](docs/ACCESS.md) · [first batch report](docs/FIRST-BATCH-REPORT.md)

Enumerates a fixed list of YouTube channels, ingests the timestamped captions it is allowed
to fetch, and records structured trading METHODS and CALLS with a citation for every claim.
Python 3, **stdlib only** plus `yt-dlp`. Storage is Supabase (19 `vr_*` tables) plus a local
private cache. It is read-only research: nothing here places an order, sizes a position or
touches a risk limit.

The discipline the whole package exists to enforce: **an absent measurement is recorded as
absent.** No transcript means no summary. A rule that depends on a chart nobody inspected
stays INCOMPLETE. A listing that stopped early yields the words "denominator unknown", not
a percentage.

## Commands

```bash
cd video-research          # all paths below are relative to it

python3 cli.py seed                     # source + presenter registry (idempotent)
python3 cli.py inventory                # enumerate every CONFIRMED listing
python3 cli.py inventory --sources crypto-banter --limit 50
python3 cli.py captions --limit 25      # transcript ingestion — slow on purpose
python3 cli.py captions --limit 10 --delay 60 --force
python3 cli.py import-transcripts --path <dir>            # owner-supplied transcripts
python3 cli.py import-transcripts --path <dir> --dry-run  # validate only, no creds needed
python3 cli.py status                   # coverage, stages, blockers, last runs, next step
python3 cli.py quality                  # the §22 acceptance checks
python3 cli.py blockers                 # what is stuck and what to do about it

python3 tests/test_acceptance.py        # 102 cases, no credentials, no network
python3 -m py_compile *.py
```

Every subcommand is safe to re-run, and every one ends with a RESUME block naming the
command that continues whatever it did not finish — including after Ctrl-C. Add `--json` to
any of them for machine-readable output.

Exit codes: `0` nothing outstanding · `1` ran, something failed or is still blocked ·
`2` could not run (no credentials, or a read failed) · `130` interrupted.

## Modules

| File | What it does |
|---|---|
| `sources.py` | The source registry, resolved to **channel IDs, not handles**. `CONFIRMED` sources are crawled; `UNRESOLVED` and `RELATED` are stored so the owner can see them and are never crawled. |
| `store.py` | Supabase REST layer. Every write is an upsert on a declared conflict key, which is what makes a re-run update instead of duplicate. Also stages, blockers, run log, checkpoints. |
| `inventory.py` | `yt-dlp --flat-playlist` enumeration of every listing. Owns `pagination_complete` and `coverage_report()` — the denominator rule. |
| `captions.py` | Per-video metadata + caption fetch, strictly serial with exponential cooldown. Owns the creator-vs-ASR distinction and the authorized-transcript import. |
| `presenters.py` | Who is speaking, or `unknown`. A name is a conclusion with cited evidence, never a default. |
| `extract.py` | The extraction schema, `validate()`, the untrusted-data prompt envelope, and extraction provenance. Calls no model itself. |
| `calls.py` | The call ledger: `receivable_at`, update grouping, scoring that withholds a win rate it cannot compute, news links that will not call sequence causation. |
| `quality.py` | The §22 acceptance checks, one function per numbered test, plus two static source scans. |
| `cli.py` | The operator surface. Everything above is reachable from here. |

## Where state lives

| What | Where | Committed? |
|---|---|---|
| Inventory, transcript provenance, methods, calls, runs, blockers | Supabase, tables `vr_*` (schema: `schema.sql`) | no |
| **Full caption text** | `state/cache/transcripts/` — local, private | **no**, gitignored |
| yt-dlp scratch | `state/cache/work/` | no |
| Checkpoints | `vr_runs.checkpoint`, plus `vr_inventory_runs` per listing | no |
| Credentials | `video-research/.env` (or the repo's `.env.local`) | **no** |

`vr_transcripts` stores a hash, a segment count, a duration and a cache path — **not the
text**. The retention knob is `captions.RETENTION` and it is `hash_only`. Full transcripts
never reach the database and never leave the machine that fetched them.

Needs `SUPABASE_URL` and `SUPABASE_SERVICE_KEY`. Without them the store-backed commands say
"unreadable" and exit 2; they do **not** print zeros. `import-transcripts --dry-run` and the
test suite run without credentials.

## Rate-limit reality

Measured 2026-09-13, and every pacing decision follows from it:

- **Listing enumeration is not gated.** `yt-dlp --flat-playlist` walked all nine channel and
  playlist listings to the end, exit 0, no bot check.
- **The per-video player API is gated.** After roughly six calls it returns *"Sign in to
  confirm you're not a bot"* and HTTP 429. It recovers after a cooldown and re-trips.
- Worse, **the gate arrives as a warning with exit code 0**, and yt-dlp then falls back to a
  page with a title but no player response. Trusting the exit code would file a transient
  block as a permanent "this video has no captions". So `captions.py` classifies stderr on
  every run, and "no captions" additionally requires positive evidence that the player
  response arrived.

Hence the fetcher is deliberately slow: **one video per subprocess, one subprocess at a
time**, 20s between videos with ±35% jitter, English caption languages only (asking for all
of them is what tripped the gate during access testing), a 300s → 3600s exponential
cooldown, and a clean checkpointed abort after 3 consecutive blocks. Tune with `--delay`, or
`VR_CAPTION_DELAY` / `VR_CAPTION_MAX_BLOCKS`.

A full-archive transcript pass is a multi-day unattended job from a non-gated IP, not one
batch. No completion date is offered, because sustainable throughput from a working IP has
not been measured — and `cli.py captions` reports a rate only when at least one fetch
succeeded, since no successes means no denominator.

The gate is **not** worked around. No cookies, no impersonation, no account credentials.
The two supported remedies are: run from a residential IP, or supply authorized transcripts
in the format documented in [`docs/ACCESS.md`](docs/ACCESS.md).

## What this system does NOT do

- **It does not watch videos.** Nothing here decodes a frame. Every rule that depends on a
  drawn line, a pointed-at level or an on-screen indicator stays `visual_resolved=false` and
  cannot be classified `PRECISE_AND_TESTABLE`. This is the single largest gap in the
  project, and `status` prints it every time.
- **It does not trade.** It imports no broker client, writes to no positions, orders, fills
  or risk table, and reads no live price. Acceptance checks 22.13 and 22.14 inspect this
  package's own source with `ast` and fail if that ever stops being true. No video-derived
  signal can reach the paper trader.
- **It does not prove anyone profitable — or unprofitable.** The call ledger records what
  was said and when a viewer could first have acted on it. It has no price data joined to
  it, so calls sit at `outcome='open'`. Where the denominator still contains open or
  unscored groups, a win rate is withheld rather than estimated.
- **It does not summarise what it could not read.** A missing transcript produces a blocker
  row and a stage, never a summary. A method with no timestamped excerpt fails validation.
- **It does not retrain, fine-tune or update any model.** `extract.py` calls no model at
  all; it holds the schema, the validator and the provenance. Two model outputs agreeing is
  not independent evidence and does not raise confidence — only a human reading the cited
  timestamps can move `review_state` to `second_reviewed`.
- **It does not register a hypothesis.** A validated method is an input to preregistration,
  never the registration itself. Trials stay counted in the existing `kr_research_verdicts`
  ledger; this package adds no second counter.
- **It does not guess at a source.** Crypto Insider is `UNRESOLVED` and uncrawled because
  two near-matches exist and neither is authoritative. Affiliated Crypto Banter channels are
  listed as `RELATED` and are not crawled either.
- **It does not treat video text as instructions.** Titles, descriptions, chapter names and
  caption text are untrusted data throughout: stored, hashed, quoted and fenced, never
  executed, never used to change a rule, a risk setting or a hypothesis.

## Scheduling

Nothing is scheduled. `cli.py` is resumable and would run fine under a timer, but the brief
says to schedule only after the pipeline is verified end to end from a working IP, and that
has not happened. When it does, it belongs on the droplet next to the desk loop (systemd),
not in `vercel.json` and not under `pg_cron`.
