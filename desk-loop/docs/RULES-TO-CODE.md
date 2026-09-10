# Rule → code map

Where every desk rule is actually enforced. Last verified against the code on **2026-09-10**.

The desk loop runs on the DigitalOcean droplet at `/root/lmc-desk` under **systemd timers** (Denver time),
not on Vercel and not under `pg_cron`. It is **alert-only**: nothing here places, cancels or modifies an order.

## The jobs

| Timer | When (MT) | Script | Costs money? |
|---|---|---|---|
| `lmc-price-check` | every :00/:15/:30/:45 | `price_check.py` | free |
| `lmc-trail` | :05/:20/:35/:50 | `trail.py` | free |
| `lmc-wake` | hourly :07 | `triage.py` (pure code) | free |
| `lmc-wake-deep` | 07:07 + on escalation | `wake.sh deep` | **paid**, budget-gated |
| `lmc-history` | 06:20 | `history_sync.py` | free |
| `lmc-breakout` | 06:45 | `breakout_scan.py` | free |
| `lmc-flow` | 07:20 | `flow_scan.py` | free |
| `lmc-news` | 07:40 | `news_sweep.py` | **paid**, budget-gated |
| `lmc-analyst` | 06:50/11:50/16:50/21:50 | `analyst_watch.py` | free |
| `lmc-heartbeat` | 08:00 | `heartbeat.py` | free |
| `lmc-stage-study` | 08:20 | `stage_study.py` | free |

## Position rules

| Rule | Enforced in | Constant / key |
|---|---|---|
| Rulebook beats formula — a `ratchet`/`stall` row's spec is pushed verbatim, never re-derived | `trail.py` main, step (1) | `DEDUPE_H = 6` |
| Ratchet/stall lines are **daily-close** based, never an intraday print | `trail.py` `last_completed_close()` | — |
| **Stop presence** — the law screen that writes `kind='nostop'` | `trail.py` main, step (2) → `common.resting_stop_required()` | `ANCHOR_SYMS`, `ANCHOR_STANDING_TRAIL_USD = 5000.0` |
| A11: anchor exempt from a resting stop while book < $5,000 | `common.resting_stop_required()` | same — **one place, both values** |
| A11 §4: every non-anchor position needs a stop row, always | `common.resting_stop_required()` returns `True` for non-anchors | — |
| A9: anchor 30% catastrophe trail off the highest completed close since entry, up only | `trail.py` main, step (3) | `ANCHOR_TRAIL = 0.30` |
| v4.1: sleeve 18% trail from +18%, widening to 25% past +50% | `trail.py` main, step (3) | `SLEEVE_TRAIL`, `SLEEVE_TRAIL_WIDE`, `TRAIL_ENGAGE_PCT`, `WIDE_AT_PCT` |
| Materiality — no proposal under 2% vs the **last proposal** | `trail.py` main, step (3) | `MATERIAL_PCT = 2.0` |
| A9: take a third at +50%, once per position | `trail.py` main, step (4) | `TAKE_PCT = 50.0` |
| A8 §5: rotation candidate after the third | `trail.py` main, step (5) | — |
| A9: sleeve-only breaker at 20% below its mark/cost high-water, clears at 10% | `common.sleeve_breaker()` | `BREAKER_DD`, `BREAKER_CLEAR` |
| v4 reclaim: sleeve stop-outs of the last 5 days closing back above the stop-out | `trail.py` `reclaim_candidates()` | `RECLAIM_DAYS = 5` |
| v4.1 flush playbook: BTC close 12% below its 20-day-high close | `trail.py` `flush_check()` | `FLUSH_DROP = 0.12` |
| Live price vs any armed level (stop / bid / rung / ratchet / target) | `price_check.py` `hit()` | `DEDUPE_HOURS = 6`, per-row `band_pct` |

## Loop-control rules

| Rule | Enforced in | Source of truth |
|---|---|---|
| Kill switch | `common.loop_enabled()`, checked at the top of every job | `desk_config.loop_enabled` |
| **Monthly AI budget** | `common.loop_budget_usd()` → `budget_status()` (gate) + `add_spend()` (halt) | `desk_config.loop_budget_usd` |
| Spend scales with the book | `common.budget_status()`: `min(budget, max(wake_min_usd, wake_budget_pct% × book))` | `desk_config.wake_budget_pct`, `wake_min_usd` |
| Daily burst allowance | `common.budget_status()` | month ÷ 30, ×3 burst |
| Quiet hours 23:00–08:00 → queue, don't push | `common.quiet_hours()` / `ntfy()` | flushed by `heartbeat.py` |
| Escalate a free triage to a paid deep wake | `triage.py` | `NEAR_STOP_PCT 6`, `NEAR_LINE_PCT 2`, `BOOK_MOVE_PCT 3`, `RADAR_SCORE_MIN 55` |
| Deposits are not market moves (book-move test) | `triage.py`, via `capital_flows` | — |

## `desk_alert_log.kind` — who writes what

`price_check.py` writes the trigger's own kind (`stop`, `bid`, `rung`, `deep_rung`, `ratchet`, `trail_high`, `target`, `breakout`).
`trail.py` writes `ratchet`, `stall`, `nostop`, `proposal`, `take_third`, `rotate`, `breaker`, `reclaim`, `reclaim_signal`, `flush`.
`heartbeat.py` writes the daily `pa_memory.loop-heartbeat` row.

## NOT in code — human-only, do not assume the loop is watching

| Rule | Status |
|---|---|
| **A11 §5: the 20-week-MA condition** — the trigger that arms anchor protection | **Not implemented.** `desk_triggers` #28/#29 (`derisk_watch`, level 0) are markers for a human. Nothing computes a weekly MA anywhere in `desk-loop/`. Since A11 the anchors are unwatched by the loop in both directions. |
| Tightening ladder 30 → 25 → 22 → 20%, hard floor 20% | Not implemented — desk judgement, announced and logged by hand. |
| Leverage ban below $10k | Not in code. Never automate this. |
| Blackout windows (CPI etc.) | Not in code — `pa_memory.catalyst-calendar` reaches the wake as context, nothing enforces it. |
| Evidence gate / two-book split (A10) | Prompt-level only (`wake_prompt.md`), not a code check. |

A marker row in `desk_triggers` with `level = 0` is a **note to the desk**, not a price line. `price_check.py` and
`triage.py` both skip them by design — see [`INCIDENTS.md`](INCIDENTS.md) for what happened when one of them didn't.
