# Phase 4 — implementation of the pre-registration v2 (built 2026-10-03, BEFORE any result)

Code: `desk-loop/bt/phase4.py` (every frozen constant), `bt/universe.py`, `bt/research.py` (continuous OOS, boundary
accounting, scale, thirds, delisting exposure, per-state attribution, advancement), `bt/engine.py` (universe hook,
delisting stress exit), `bt_costs.scaled`, `bt_phase4.py` (runner; no store option exists). Tests: `desk-loop/test_phase4.py`
(26) — `npm run test:py` = 98. **No table has been run.** The runner refuses nothing but writes only to `--out`; nothing
reaches `research_runs` by construction (§8).

## Where the pre-registration needed a mechanical choice (each one made before any result; reviewer to confirm)
| § | Clarification | Why |
|---|---|---|
| 1 | "First eligible decision close of each UTC month" = the first decision close whose completed bar's UTC date is in that month AND at which at least one listed, non-excluded name has the full 90-bar window; the window must be exactly the last 90 daily bars (bar ending at t present, no gap). Membership before the first ranking is empty. Exclusion matches the base symbol (`WBTC`, `WBTC-USD`, `wbtc/usd`). | needed a definition of "eligible" and of a gap |
| 1 | Dropped-out names: the view's `universe()` no longer lists them, so no strategy can propose an entry; `bars()`/`closes()` still serve them, and every strategy iterates universe ∪ held names, so its own exit rule keeps running. `breakout20` (control) was changed the same way, otherwise a held non-member would have had no exit check at all. | literal reading of "no new entries, open positions continue under the strategy's own exit rule" |
| 2 | ×1.25 stress multiplies EVERY per-side component (fee, half-spread, slippage): 0.50% → 0.625%. The Phase 2 code stressed fees only; with Phase 2/3 spread = slippage = 0 the numbers are unchanged, so no earlier verdict moves. | §2 states 0.625% |
| 3 | Scale invariance is checked on the canonical continuous run ($10k vs $100k, normalised, 1e-6, same trade count). The delisting cells carry an absolute $50k floor and are therefore not scale-invariant by design; they are not part of the check. | R-K floor is in dollars |
| 4 | Continuous run: the parameter set of fold k governs every decision time t with test_start_k ≤ t < test_end_k; at a switch a fresh strategy instance is created (its internal clock, e.g. momentum's rebalance timer, restarts); positions carry; only the strategy's own rule, stop or target closes them. The sole `eod` exits are at the sample end. | "a switch never force-closes a position" |
| 4 | Boundary dependency: exits "caused solely by the boundary" = `eod` closes at INTERIOR fold ends. The last fold's end is the sample end, which the continuous run liquidates identically, so it cannot be a boundary dependency. Both counts are reported. Ex-boundary return = Π over folds of (fold final − interior eod P&L) / fold start − 1, compared with the chained return at 20% of |chained| or a sign flip. | the pre-registration did not say whether the sample end counts |
| 6/7 | Gate inputs are the CONTINUOUS run (verdict curve) under canonical costs; OOS fee stress = the continuous run under 0.625%; full-sample robustness (fees ×1.25/×1.5, ±20% parameter neighbours) uses the parameter set chosen in the most folds (ties: grid order), recorded as `params`. The chained per-fold OOS and its fee stress are kept in the manifest as selection evidence only. | §4: continuous run is the verdict curve |
| 7.4 | Chronological thirds = three contiguous segments of equal bar count on the verdict curve. | — |
| 7.7 | Delisting exposure: later-delisted = any name with a delisted date in `universe_history` (whether or not the trade ended in the delisting); trade share = trades in such names / all OOS trades; P&L share = Σ|P&L| in such names / Σ|P&L| (gross absolute, so losses count as exposure too). Material at ≥ 10% of either. Stress exit: close of the last completed bar in [entry, delisting) whose 3-bar median dollar volume ≥ max($50k, mult × slot_usd at the exit bar), × (1 − haircut), × (1 − side cost); a bar needs two predecessors (never a single print); none qualifies ⇒ exit price 0 (`delisted_unrecoverable`). "Survives" = canonical cell's continuous OOS total return > 0. Cells always run: canonical 10×/−50%, mild 5×/−25%, tail 20×/−100%; the 3×3 grid runs when exposure is material. | R-K / R-J |
| 8 | Per-regime-state reporting: each trade bucketed by the canonical label published at its entry decision; each daily curve return by the label at the bar's open; filter never applied (manifest `regime.applied = false`). | R-R |
| 5 | Benchmarks run on the same OOS span as the continuous run: `buy_and_hold(BTC)` with one slot = the whole book (max_positions 1, gross_cap 1.0); `cash` under canonical sizing. The negative control runs the full pipeline but its `trial_count` is null, its verdict is "control: not evaluated", and `trials_total` excludes it. | §5 |
| 9 | `bt_phase4.py --expect-data-hash 8df7990c93dcc632` refuses any other snapshot; `--fit-days/--test-days` other than 365/90 print a "not the table" warning. Export uses `SUPABASE_PUBLISHABLE_KEY` (+ `SUPABASE_URL`); no service-role key is read on that path. | R-L |

## Run order once the v2 acceptance is logged
```
cd desk-loop && SUPABASE_URL=... SUPABASE_PUBLISHABLE_KEY=... python3 bt_phase4.py --export state/md_daily_2026-10-02.json
python3 bt_phase4.py --snapshot state/md_daily_2026-10-02.json --expect-data-hash 8df7990c93dcc632 --out state/phase4
```
Estimated cost: ~2 s per full-history run at 419 symbols, ≈ 150 run-equivalents per candidate ⇒ under 30 minutes for
the table. Output: `state/phase4/table.md`, `table.json`, one manifest per candidate. The results doc
(`PHASE4-TOURNAMENT-RESULTS.md`) is written from those files and goes to independent review before anything is stored.
