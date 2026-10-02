# Scheduler inventory — pg_cron (Supabase) and the droplet

Verified 2026-10-02 04:50 UTC against `cron.job` and `cron.job_run_details` on project `bngwwalucfirmcymqall`.
CAUTION (from CLAUDE.md): `pg_net` is fire-and-forget, so `job_run_details` says "succeeded" whenever the HTTP post
was *sent*. Only the target table proves a job did its work.

## Current state: every pg_cron job is `active = false`

| jobid | job | schedule (UTC) | target | active | last run | runs, last 14d | trades real money? |
|---|---|---|---|---|---|---|---|
| 1 | daily-hashprice-snapshot | `0 0 * * *` | `/api/cron/hashprice-snapshot` | **false** | 2026-09-30 00:00 | 12 | no — mining data |
| 3 | weekly-newsletter | `0 15 * * 0` | `/api/cron/weekly-newsletter` | **false** | 2026-09-27 15:00 | 2 | no — sends email to all leads |
| 6 | weekly-analytics-review | `0 2 * * 1` | `/api/cron/weekly-analytics` | **false** | 2026-09-28 02:00 | 2 | no |
| 9 | comp-snapshot | `5 20 * * *` | `/api/cron/comp-snapshot` | **false** | 2026-09-29 20:05 | 11 | no — paper equity curve |
| 12 | runner-scout | `11 * * * *` | `/api/cron/runner-scout` | **false** | 2026-09-19 17:11 | 37 | no — writes `fund_radar` |
| 14 | desk-digest-8am | `0 14 * * *` | `select public.desk_digest()` | **false** | 2026-09-19 14:00 | 2 | no |

Jobs 1, 3, 6, 9 ran on schedule until **2026-09-27 → 09-30** and have not fired since; all four were set
`active = false` at some point between 2026-09-30 00:00 UTC and 2026-10-02. CLAUDE.md (as of 2026-09-21) lists them as
ACTIVE. Jobs 12 and 14 were paused on 2026-09-19/21 deliberately. **Cause of the 09-30 deactivation is unknown** — no
commit in this repo touches `cron.job` after 09-21.

**No cron job anywhere can place an order.** `comp-trader` (the only scheduled code that wrote trades, and only paper
ones) was deleted from `cron.job` on 2026-09-21; its route `app/api/cron/comp-trader/route.ts` still exists but
nothing calls it.

## Intended state

| job | intended | why |
|---|---|---|
| daily-hashprice-snapshot | **active** | feeds `/api/hashprice-history` and the site's charts; 2+ days of gap already |
| weekly-newsletter | **active** | Sunday send; next window 2026-10-04 15:00 UTC. Re-enabling means mail goes out — Jacob's call |
| weekly-analytics-review | **active** | Monday GA4/Clarity summary |
| comp-snapshot | **active** | daily equity-curve row for the AI Competition tab; harmless if the tab is retired |
| runner-scout | paused | superseded by the Phase 6 scanner; universe list is a hard-coded Sept snapshot |
| desk-digest-8am | paused | depends on the stalled droplet loop |

## Obsolete / to be replaced

- `app/api/cron/comp-trader/route.ts` — unscheduled; the sleeve logic is retired by the plan (§0). Delete in Phase 1.
- `runner-scout` — replaced by the 5x scanner (§6). Keep paused until then, then drop.
- Deleted on 2026-09-21 and not coming back: daily-content-drop, make-content-warm, heygen-quota-alert, morning-brief,
  job-verify, comp-trader, desk-watcher-15m.

## Added 2026-10-02 (Phase 1, data-only)

| jobid | job | schedule (UTC) | target | status |
|---|---|---|---|---|
| 15 | collector-health | `*/15 * * * *` | `select collector_health()` → `desk_health` | **active** |
| 16 | features-daily | `40 0 * * *` | `select compute_features_daily()` → `features_daily` | **active** |
| 18 | universe-sync | `10 0 * * *` | `/api/cron/universe-sync` | live 2026-10-02; ran `*/10` during the backfill, normalised 06:40 UTC |
| 17 | md-backfill | `*/2 * * * *` | `/api/cron/md-backfill` (40 chunks + 20 heads per run) | live 2026-10-02; 0 errors at 06:40 UTC (daily 108/489 cursors done, 267,699 daily bars, hourly not started); drops to `*/30` once the backlog is gone |
| 19 | fund-snapshot | `20 0 * * *` | `/api/cron/fund-snapshot` | live 2026-10-02 (5,383 protocol rows, F&G landed); ran `*/20` during the backfill, normalised 06:40 UTC |

Still to come: `desk-daily` — the daily brief (§13). Emits recommendations; never executes.

## The droplet (`desk-loop/`, systemd, Denver time) — separate machine

`lmc-price-check`, `lmc-trail`, `lmc-breakout`, `lmc-flow`, `lmc-history`, `lmc-a11`, `lmc-news`, `lmc-stage-study`,
`lmc-heartbeat`, `lmc-wake`, `lmc-wake-deep`. All alert-only; none places an order (`trail.py:39` and each script's
docstring). DB evidence says the loop stalled around 2026-09-22 (`desk_alert_log` last row 09-22, `flow_radar` 09-15)
except `history_sync`, which still updated `cg_history` on 2026-10-01. Not inspected directly — SSH-only from the Mac.

## How to change a schedule

`cron.schedule(...)` / `cron.alter_job(...)` via Supabase `execute_sql`, never `vercel.json` (CLAUDE.md). Re-enable
with `select cron.alter_job(<jobid>, active := true);`. Re-enabling 1, 6 and 9 is data-only; re-enabling 3 sends mail.
