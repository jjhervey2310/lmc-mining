# desk-loop changelog

Newest first. Every entry names the commit's effect on **behaviour**, not just the files.

## 2026-09-15

- **`trail.py` + `common.py`: the stop screen now checks COVERAGE, not just presence.** It tested
  `not stops` — "is there a stop row for this symbol?" — and a row existing was taken as the law being
  met. After a DCA fill the old row is still there covering the OLD quantity, so the screen went quiet at
  exactly the moment the new units were naked. Under A12 (hold and DCA at written levels) that is the
  routine case, not an edge case: had all five resting bids filled overnight, NEAR would have carried a
  stop over 10.58 of 36.89 units, SYRUP 111.65 of 254.50, UNI 4.0026 of 12.4059 — roughly $125 of basket
  value unprotected, with no alert. `common.stop_coverage_gap()` now owns the question and `trail.py`
  raises `kind='stop_short'` (high-priority push, 6h dedupe like every other law screen) naming the
  uncovered quantity and its dollar value. Presence and coverage are separate failures with separate
  alert kinds; `common.resting_stop_required()` still owns WHETHER a stop is owed.
- **`desk_triggers.covers_qty` (new column): a stop row now records what it covers.** The unit count lived
  only in free-text `spec`, so the rule was unenforceable in code. Backfilled from the live broker orders
  (NEAR 10.58, SYRUP 111.65, UNI 4.0026). NULL means unknown and is reported as a BREACH rather than
  assumed good — the same fail-loud posture `resting_stop_required()` takes when the book cannot be
  valued. **Whoever places, extends or replaces a stop must set it.**

## 2026-09-10

- **`price_check.py`: the 15-minute sweep no longer dies on a marker row.** Rows with `level <= 0` (A11's
  `derisk_watch` markers) are skipped, and a malformed row can no longer abort the whole sweep. Triggers that were
  behind the crash point — NEAR's $1.42 basket catastrophe stop among them — are being checked again. See
  [`INCIDENTS.md`](INCIDENTS.md).
- **`trail.py` + `common.py`: the stop-presence screen follows A11.** BTC and SOL no longer alert `nostop` while
  the book is under $5,000; every non-anchor position still does. `common.resting_stop_required()` owns the anchor
  list (`ANCHOR_SYMS`) and the threshold (`ANCHOR_STANDING_TRAIL_USD`); `trail.py` imports the list instead of
  keeping a second copy. If the book cannot be valued, the screen requires a stop everywhere.
- **`common.py` + `heartbeat.py`: one budget number.** `desk_config.loop_budget_usd` is now read by the wake gate,
  the spend halt and the heartbeat line. The book-scaled allowance is capped by it. `LOOP_BUDGET_USD` /
  `MONTHLY_CAP_USD` in `.env` are fallbacks for a Supabase outage only.
- **`docs/`: this folder.** Rule → code map, deploy runbook, incident log.

## Earlier

Before 2026-09-10 the loop's history lives in the root `README.md` (build requests #7–#11) and the amendment log
at the foot of `pa_memory` topic `house-strategy`. Entries here start from the date this file was created.
