# Incidents — things that were silently broken in production

Newest first. One entry per defect that ran unnoticed. The point of this file is the **tell**: what would have
caught it sooner.

---

## 2026-09-10 — the 15-minute price sweep died on a marker row

**Severity: high.** Live for ~2 days (2026-09-08 → 2026-09-10).

**What broke.** A11 added two marker rows to `desk_triggers` — `derisk_watch` for BTC (#28) and SOL (#29), both
with `level = 0`, meaning "no resting stop by design; check the 20-week MA by hand". `price_check.py`'s `hit()`
fell through to its default branch for that unknown kind and computed `abs(price - level) / level` → **division by
zero**. The exception was uncaught, so `main()` aborted mid-loop.

**Why it mattered.** The sweep processed rows in whatever order PostgREST returned them and then stopped dead at
the first marker row. Every trigger after that point went unchecked on every run — including **NEAR's basket
catastrophe stop at $1.42** (`desk_triggers` #30) and the NEAR accumulation bid at $1.90 (#31), both created after
the marker rows. `state/last_price_check` stopped being written and the deep-wake escalation that fires when a
level is reached could not fire for any shadowed row.

**How it was found.** Not by an alert — by reading `price_check.py` while writing `RULES-TO-CODE.md`, then
reproducing it offline against the real row set. The DB agreed: UNI's bid (#19, ahead of the markers) alerted
normally on 09-09, while everything behind them sat silent.

**Fix.** `price_check.py` now skips any row with `level <= 0` — the same guard `triage.py` already had — and wraps
the per-row test so one malformed row can never take the whole sweep down again. Marker rows are notes, not price
lines. No `desk_triggers` row was touched.

**The tell, for next time.** `state/last_price_check` is only written on a clean run. If its mtime is older than
15 minutes, the sweep is crashing. `systemctl --failed` says the same thing. Neither was being checked.

**The general lesson.** Adding a row to `desk_triggers` is a code change. Any new `kind`, or any row whose `level`
is not a real price, must be checked against every consumer of that table: `price_check.py`, `trail.py`,
`triage.py`, `context.py`.

---

## 2026-09-10 — the anchor no-stop alert that would not stop (fixed same day)

**Severity: low (noise), but it trained the wrong instinct.**

`trail.py`'s stop-presence screen still enforced the retired v4 rule "stops on 100% of units, always" and fired
`kind='nostop'` for BTC and SOL on every wake — 6 alerts a day. A11 (ratified 2026-09-08) had deliberately removed
the resting anchor trails. Two days of alerts that the desk was right to ignore is exactly how a real alert gets
ignored later.

**Fix.** The screen was narrowed, not deleted: `common.resting_stop_required()` now owns both the anchor list and
the $5,000 threshold, so the rule lives in one place. Non-anchors still alert; the anchors start alerting again the
moment the book reaches $5,000, and if the book cannot be valued the screen fails loud.

**The general lesson.** An amendment ratified in `pa_memory` changes nothing until the code that enforces the old
rule is changed. `RULES-TO-CODE.md` exists so that gap is visible instead of assumed.

---

## 2026-09-10 — `desk_config.loop_budget_usd` was read by nothing

**Severity: low, but it made the heartbeat lie.**

The config row said $10/month. The heartbeat printed `$X/30` from the env's `MONTHLY_CAP_USD`, and `add_spend()`
halted at that same $30. The number that actually stopped wakes was neither: `budget_status()`'s
`max($5, 1.5% × book)`, about **$9.60/month** at the book's then size.

**Fix.** `common.loop_budget_usd()` reads the config row; the gate, the halt and the heartbeat all use it, and the
book-scaled allowance is capped by it. Env vars are Supabase-outage fallbacks only.

**The general lesson.** Three numbers claiming to be "the budget" meant no one number was. If a value is displayed
anywhere, the display must read the same source the enforcement does.
