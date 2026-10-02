# Shadow paper ledger — frozen rules (v2, 2026-10-02)

Answers reviews R-2026-10-02-B and R-2026-10-02-C. Rules are versioned; a position records the `rule_version` and `monitoring_convention` it was opened under and is graded under those only. v1 is superseded; its one contradiction (close-based exits mixed with intrabar touch logic) is resolved below.

## Book
- One shared paper book: **$1,000**. Max **10%** per name, max **50%** gross exposure. Breach → `no_entry: capital`, logged.
- Paper only. Nothing touches a broker.

## Monitoring convention — ONE per thesis, fixed at creation, never changed by data availability
| Convention | Decision clock | Trigger test | Fill | Ambiguity |
|---|---|---|---|---|
| `daily-close` (default) | completed UTC daily close | stop/target/invalidation tested on **closes only**; intrabar touches do not count | the **next completed 5-minute bar close** after the triggering daily close, plus costs | none possible (one close per day) |
| `intrabar-5m` (only for names with continuous 5m coverage at creation) | each completed 5m bar | level **touched** by the bar's high/low | that bar's close, plus costs | bar touches stop and target → **stop first** |

If the 5-minute feed is missing when a fill is due, the fill is **not** substituted with a daily open or close: the position is marked `fill_unavailable` and the outcome is `unresolved` for that leg. Missing data never silently changes the convention or the event.

## Entry
- Exact trigger (level and/or condition) and an **entry expiry** stated in the thesis. Trigger never fires → `no_entry`, graded separately from the claim.
- Fill = per convention above, after the decision timestamp (`decided_at`). Never the bar that revealed the trigger.
- Costs until the live Kraken tier is read: **0.40% maker / 0.80% taker** + **0.10% slippage** per side.

## Exit
- Precedence when conditions coincide: fundamental invalidation > stop > target > time.
- Gap through a stop (daily-close): fill at the next 5m close after the breaching daily close, wherever that is.
- Time exit at `expires_at` (horizon from **creation**), filled per convention.

## Grading — four separate scores, never blended
1. **Claim** — did the falsifiable prediction happen by the deadline? yes / no / unresolvable.
2. **Path** — target before stop within the horizon? yes / no / no_entry / expired.
3. **Trade** — net return after costs from the recorded fill; max drawdown while open.
4. **Benchmark-relative** (R-C) — same dollars into **BTC at the alt's executable entry timestamp**, liquidated in the same fractions at the alt's actual paper exit timestamps, with BTC's execution costs under the same fee methodology. Record `btc_entry_px`, `btc_exit_px`, `alt_net_return`, `btc_net_return`, `excess_return_pp = alt − BTC`, and both drawdowns. No entry → `not_applicable`. This measures **asset selection conditional on the chosen timing**; it does not validate the timing and is not risk-adjusted alpha. The alt's percentage stops/targets are **never** applied to BTC.
   Book level: the whole $1,000 ledger (idle cash included) vs BTC buy-and-hold vs cash on fixed evaluation dates (1st of each month).
No hindsight entries, no revised stops: an edit is a new revision graded on its own.

## Probability fields (R-C)
Two separate columns, never conflated:
- `reference_class_rate` — an empirical rate from a **reproducible sampling rule**, stored with `reference_class_ref` pointing at the versioned definition. Minimum definition: predicted event (target, stop, horizon, clock origin, conditional on entry or not); eligible population (venue, tradability then, liquidity threshold, minimum history, **delisted/failed included**); sampling rule (every qualifying signal from a specified trigger, fixed overlap policy); predetermined conditioning (e.g. liquidity band, BTC regime, measured with information available then); observation period and data cutoff (only outcomes resolved before the forecast timestamp); outcome rules identical to the forecast's; estimate with successes / eligible / resolved / exclusions / distinct assets and time clusters / method / uncertainty interval; provenance (query version, code and dataset hashes, limitations).
- `thesis_probability` — the forecast. Using the reference-class rate unchanged is fine **if labelled**. Any upward or downward move from it is a **subjective adjustment** recorded in `probability_adjustment_note`; it is never described as calibrated.
- No sample-count gate. Overlapping observations from one rally are not independent; uncertainty must account for dependence across assets and time. Small samples may give a clearly labelled descriptive rate. Inadequate coverage or an unreproducible denominator → **unknown**. Phase 4 is not the determining factor; the definition is.
- A reference-class rate for a *path* event (e.g. "touch +30% before −15% by the deadline, conditional on entry") says nothing about whether a written fundamental claim is true.

## Evidence classes
- `exploratory` — the four positions opened 2026-10-02 05:20Z (`v0-provisional`, last-close fill, no benchmark at entry). Visible, graded for the record, **excluded from probability calibration and benchmark evidence**.
- `discretionary` — v2-compliant hand-written theses. Development data for the scanner, never its validation.
- `scanner` — frozen rules on untouched periods/assets. The only class that can validate the scanner.

## Provenance (unchanged from v1)
Trigger-written immutable revisions (`desk_watchlist_revisions`); deletes refused; `desk_selection_log` per pass; `used_in_scanner_dev` flag; `fee_model` and `rule_version` on every position.
