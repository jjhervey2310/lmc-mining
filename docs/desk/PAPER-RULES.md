# Shadow paper ledger — frozen rules (v1, 2026-10-02)

Answers review R-2026-10-02-B. Rules are versioned; a position records the `rule_version` it was opened under and is graded under that version only.

## Book
- One shared paper book: **$1,000**. Max **10%** per name, max **50%** gross exposure. No position opens if either cap is breached — it is logged as `no_entry: capital`.
- Nothing here touches a broker. Paper only.

## Entry
- A thesis states an **exact trigger** (price level and/or condition) and an **entry expiry**. If the trigger never fires before expiry → outcome `no_entry`, graded separately from the thesis claim.
- Fill = **next completed 5-minute bar close after the decision timestamp** (`decided_at`), plus taker fee + slippage. Never the bar the decision was made on.
- Costs: Kraken **base tier 0.40% maker / 0.80% taker** and **0.10% slippage** per side until the live account tier is read into `desk_config` — deliberately conservative.
- `v0-provisional` (the four positions opened 2026-10-02 05:20Z): entry was the *last* 5m close at decision, not the next. Kept and labelled; they count toward the discretionary record, never toward scanner evidence.

## Exit
- Observation frequency: daily close for stops/targets (5m bars when available for the symbol). Exit fill = the observation close that breaches the level, with costs.
- Gap through a stop → fill at the observation close (worse than the stop), not at the stop.
- **Ambiguous candle** (touches stop and target in the same bar): stop first, unless finer bars resolve the order.
- Time exit at `expires_at` (horizon measured from **creation**, stated per thesis) at that day's close.
- Precedence: fundamental invalidation > price stop > target > time.

## Grading — three separate scores, never blended
1. **Claim**: did the falsifiable prediction happen by the deadline? (yes / no / unresolvable)
2. **Path**: did price reach the target before the stop within the horizon? (yes / no / no_entry / expired)
3. **Trade**: net return after costs of the prescribed trade from the recorded fill. Also max drawdown while open.
No hindsight entries, no revised stops: edits create a new thesis revision graded on its own; the original keeps its grade.

## Provenance
- Every thesis insert/update writes an immutable row to `desk_watchlist_revisions` (trigger). Deletes are refused.
- Every selection pass writes `desk_selection_log`: pool considered, selected, rejected with reasons, criteria, prior holdings.
- `desk_watchlist.used_in_scanner_dev = true` on any thesis whose outcome informed a feature, threshold or rule. Those are development data and are excluded from scanner validation.
- Probability fields stay **unknown** until a predeclared reference class exists (Phase 4). A number without a reference class is not recorded.

## What this ledger can and cannot show
- Can: whether the hand-written theses were right, and whether the prescribed trades paid after costs.
- Cannot: validate a scanner later built with knowledge of these outcomes. That evidence comes only from frozen rules on untouched periods/assets.
