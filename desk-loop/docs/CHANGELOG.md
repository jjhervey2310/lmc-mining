# desk-loop changelog

Newest first. Every entry names the commit's effect on **behaviour**, not just the files.

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
