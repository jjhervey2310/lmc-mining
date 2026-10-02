# `kr_*` collector — dependency note (Phase 0, 2026-10-02)

The LEVERAGE research desk (`app/admin/dashboard/leverage/*`, `app/api/research-pulse`) reads ~40 `kr_*` tables
(`kr_ohlcv`, `kr_deep_candles`, `kr_funding`, `kr_book`, `kr_tape`, `kr_market_stats`, `kr_stablecoins`,
`kr_chain_tvl`, `kr_paper_positions`, `kr_desk_fills`, `kr_desk_curve`, `kr_research_verdicts`, `kr_heartbeat`, …).
**Nothing in this repository writes to them.** The architecture plan (§3) adopts them as the market-data lake, so the
writer is a dependency we must be able to see.

## What is known (verified against Supabase on 2026-10-02 04:50 UTC)

| Fact | Evidence |
|---|---|
| The writer runs on **Jacob's laptop** | `kr_heartbeat.host = 'Jacobs-MacBook-Air.local'` — the only host ever recorded |
| It was alive at 04:47:53 UTC today | `kr_heartbeat.at`, `phase = 'push'`, `cycle = 1712` |
| It writes `kr_ohlcv` **every hour**, continuously | 73 consecutive hours with rows, 2026-09-29 04:00 → 2026-10-02 04:00 UTC (23,378 rows in 3 days) |
| Cycle cadence is about 5 minutes | `leverage/pulse.tsx` treats "a cycle plus its five-minute wait" as the staleness bound; phases include `reading 5-minute candles` |
| It re-runs its research six-hourly | `leverage/page.tsx:230, :795` ("written by the collector itself, six-hourly") |
| It holds no private exchange path | `leverage/page.tsx:13, :450` say a test in the collector enforces this — that test is not in this repo |
| It connects through PostgREST (Supabase REST), not a direct Postgres session | `pg_stat_activity` shows only `postgrest`, `mgmt-api`, `postgres_exporter` — no long-lived client connection from outside |
| It is **not** the DigitalOcean droplet | The droplet (`209.97.150.226`, `/root/lmc-desk`) runs the `desk-loop/` systemd timers; none of those units reference `kr_*` |

## What is unknown

- **Where the source code lives.** Not in this repo; not referenced by any script, doc, env var, Vercel config or
  Supabase migration here. Likely a separate directory or repo on the MacBook.
- **How it is launched** (launchd agent, a terminal left open, cron). `cycle = 1712` with ~5-minute cycles is roughly
  six days of continuous running, consistent with a long-lived process started around 2026-09-26.
- **Which credentials it uses** (service-role key vs. a scoped key) and whether any exchange keys are configured.
- **What stops it**: laptop sleep, lid closed, travel, OS update. A six-hourly research cadence from a laptop is not
  an always-on data layer.

## Risk to the plan

The whole backtest foundation (Phase 1 `md_candles` backfill, Phase 2 framework) inherits a data feed that stops when
a laptop sleeps, with no code review possible from here. Treat it as **best-effort history**, not infrastructure, until
its code is in this repo (or a sibling repo) and it runs on a machine that does not sleep.

## Action required from Jacob

1. Point to the collector's code (path on the MacBook or repo URL). Preferred: move it into this repo under
   `collector/` so it is versioned with the tables it writes.
2. Decide where it should run long-term (the existing droplet is the obvious candidate — same machine as `desk-loop/`).

## Heartbeat / health-check (implemented 2026-10-02: `collector_health()` every 15 min → `desk_health`, shown on the DESK tab; first reading `healthy`, heartbeat 245s, data 330s)

Original design, kept for reference:

Goal: know within 15 minutes when the collector stops, without the collector's cooperation.

- **Signal:** `kr_heartbeat.at` age. Healthy: < 10 min (cycle + wait). Degraded: 10–60 min. Dead: > 60 min.
  Secondary: `max(kr_ohlcv.collected_at)` age > 90 min (hourly bars) — catches a heartbeat that beats without writing.
- **Check:** pg_cron job `collector-health` every 15 minutes:
  `select public.collector_health()` — a SQL function that computes both ages, upserts one row into
  `desk_health (component='kr_collector', status, heartbeat_age_s, data_age_s, checked_at)`, and on a transition to
  `dead` calls `net.http_post` to the existing ntfy topic used by `desk-loop/common.py`.
  Data-only: reads two tables, writes one, posts one notification. Cannot trade.
- **Surface:** the existing `pulse.tsx` already turns red on a stale heartbeat; add `desk_health` to the daily brief
  (§13) so a dead collector is the first line of the day, not a footnote.
- **Rule for consumers:** `features_daily` and every backtest record the `max(collected_at)` they were built from;
  a run whose data is older than its decision time by more than one bar is marked `data_stale` and excluded from
  evidence.
