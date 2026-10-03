# Phase 3 — Regime engine design (for review before code)

Status: DRAFT for independent review (ChatGPT). No code until accepted. Architecture doc §3 / build order step 3.

## 0. What it is and is not
A market-context layer that emits one small frozen label per completed daily bar. It cannot place orders, size
positions, change stops, or alter any strategy's exits. Strategies may read the label at decision time and use it only to
decide whether to **propose new entries**. Everything else stays exactly as Phase 2 left it.

## 1. States (exactly three, plus one failure state)
| state | meaning |
|---|---|
| `risk_on` | BTC in an established uptrend with ordinary volatility and healthy breadth: new long entries allowed |
| `neutral` | mixed evidence: new entries allowed only for strategies that declare `neutral_ok=True` (mean-reversion class); trend/breakout classes do not propose |
| `risk_off` | BTC below trend or volatility shock or breadth collapse: no new long entries from any strategy |
| `unknown` | an input is missing or stale (§5): treated as `risk_off` for entries. Never silently mapped to `neutral` |

No fourth market state will be added in Phase 3. Adding one later is an architecture change with its own review.

## 2. Inputs (all from completed DAILY bars, Coinbase venue, timestamp = bar open; "as of t" means bars with t_bar + 1d ≤ t)
| input | definition | source |
|---|---|---|
| `trend` | BTC close vs SMA200 of closes, and sign of SMA50 slope over 20 bars | `md_candles` daily BTC (same series `features_daily` uses) |
| `vol` | BTC 20-day realised vol (stdev of daily log returns × √365) and its percentile within the trailing 365 completed bars | same |
| `breadth` | share of the **listed** universe (listing windows from `universe_history`, as in Phase 2) with close > own SMA50, over names with ≥ 50 bars as of t | `md_candles` daily, all symbols |
| `drawdown` | BTC close / max close over trailing 365 completed bars − 1 | same |

Not inputs: Fear & Greed (it is the BTC **sweep** trigger in §10 of the architecture, kept separate so the regime cannot
double-count sentiment), DeFiLlama fundamentals (daily snapshots arrive with a lag and are a selection input, not context),
anything intraday, anything from `desk_watchlist` or paper results.

## 3. Classification (fixed form; only the two starred thresholds are tunable, §9)
Per completed bar t compute three votes:
- trend_vote = +1 if close > SMA200 × (1 + band*) and SMA50 slope > 0; −1 if close < SMA200 × (1 − band*) or SMA50 slope < 0 with close < SMA200; else 0
- vol_vote = −1 if vol percentile ≥ vol_pct*; else 0 (volatility can only remove risk, never add it)
- breadth_vote = +1 if breadth ≥ 0.55; −1 if breadth ≤ 0.35; else 0 (fixed, not tuned)
Raw state: sum ≥ +1 → `risk_on`; sum ≤ −1 → `risk_off`; 0 → `neutral`. Drawdown ≤ −0.50 forces raw `risk_off`
regardless of votes (fixed, not tuned).

## 4. Transition logic and hysteresis
- The published state changes only after the raw state has been the same new value for **3 consecutive completed bars**
  (fixed). Until then the previous published state stands.
- Exception, fail-fast: a raw `risk_off` driven by the drawdown rule or by vol_vote = −1 publishes after **1** bar. Risk
  can be removed quickly; it is only added slowly.
- `unknown` publishes immediately and clears only when all inputs are fresh again for 3 consecutive bars.
- Every transition is written with the bar that caused it, the raw votes, and the number of bars the raw state had held.

## 5. Freshness and fail-closed
An input is stale if its latest completed bar is older than t − 1d (one missing daily bar) for BTC, or if fewer than 60%
of listed names have a bar at t−1 for breadth. Any stale or NaN input → `unknown`. The engine never forward-fills a
missing input and never computes a vote from a partial bar (market-time rule: `completed_bars` only, joins by timestamp).

## 6. Exposure to strategies without future data
- `AsOfView.regime()` returns `(state, since_t, votes)` computed from bars with t_bar + 1d ≤ view.t only, materialised by
  the engine into the view the same way bars are (visibility cut; no reference to the full series).
- The regime series is **precomputed once per market** into a timestamp-indexed table and the view returns the entry at
  the last completed bar. A test asserts the entry at t equals a recomputation from a market truncated at t
  (no look-ahead through the precompute).
- Strategies receive the label only through the view. The `StrategyHygiene` grep extends to forbid any import of the
  regime module from `strategies.py`.

## 7. What regime may affect
| entries | exits | sizing | strategy selection |
|---|---|---|---|
| YES: a strategy may decline to propose when the state forbids its class | NO: stops, trails and signal exits run unchanged | NO: slot allocator unchanged | YES: Phase 4 tournament reports each strategy per regime |

## 8. Baseline benchmark (mandatory, before any claim)
Every Phase 4 candidate runs twice on the same frozen snapshot and folds: unfiltered and regime-filtered. Both rows go in
the manifest. A filtered result is only reported next to its unfiltered twin and next to the same comparison for
`buy_and_hold(BTC)` and `cash`. If the filter improves a strategy only by cutting exposure (lower return, lower drawdown,
same per-trade stats), the report says so in those words.

## 9. Walk-forward for thresholds and anti-overfit limits
- Tunable: `band*` ∈ {0.00, 0.02, 0.05} and `vol_pct*` ∈ {0.80, 0.90} only. Six combinations. Nothing else moves.
- Selection inside each walk-forward fit window by the same `select` metric the strategy uses; applied to the test window.
  `trials` counts the regime grid × strategy grid. Chosen thresholds are recorded per fold.
- Hard limits: 3 states, 4 inputs, 2 tunable thresholds, 1 hysteresis length (fixed at 3). Any proposal to exceed these
  is a new review, not a parameter.
- Pass rule for the regime layer itself: it must not reduce OOS return of `buy_and_hold(BTC)` by more than it reduces its
  max drawdown (in ratio terms) across ≥ 3 of 4 regime-threshold choices; otherwise the layer is "not evidenced" and
  Phase 4 runs unfiltered.

## 10. Manifest fields
`regime: {version, states, inputs: [trend, vol, breadth, drawdown], band, vol_pct, breadth_hi: 0.55, breadth_lo: 0.35,
drawdown_floor: -0.50, hysteresis_bars: 3, fastfail: true, data_hash, universe_hash, transitions_count,
pct_time: {risk_on, neutral, risk_off, unknown}, filtered: bool}` — enough to recompute every label from the snapshot.

## 11. Tests (all must exist before the engine is wired into the engine loop)
- boundary: label at t uses only bars with t_bar + 1d ≤ t; a 50× spike in the bar opening at t cannot change it
- same-bar leakage: raw votes at t computed on a market truncated at t equal the precomputed series at t, for every t
- flip control: a synthetic path oscillating around SMA200 daily produces ≤ 1 transition per 3 bars; a path crossing once
  produces exactly 1 transition, 3 bars after the cross
- fast-fail: a vol shock publishes `risk_off` after 1 bar and needs 3 clean bars to leave
- missing data: deleting BTC's bar at t−1 yields `unknown` at t, not the previous state; breadth below 60% coverage yields
  `unknown`
- unknown blocks entries: a strategy that proposes every bar proposes nothing while `unknown`
- no side effects: regime module has no reference to `Portfolio`, `Order`, or the cost model (grep test)
- benchmark pairing: `walk_forward(..., regime=True)` output always carries its unfiltered twin

## 12. The hindsight rule (explicit)
Phase 3 cannot rescue a strategy. A strategy that fails the Phase 2 gate unfiltered is not re-tested under regime
filtering to find a passing configuration. The order is fixed: unfiltered gate first; only strategies that pass or are
within one failing check are run filtered, and the filtered result must beat the unfiltered one on OOS return **and**
max drawdown with the same trade count order of magnitude. Regime thresholds are chosen inside fit windows only, never on
the full sample, never after seeing OOS. The house breakout rule stays rejected and is not run under regime.

## 13. Open questions for the reviewer
1. Breadth needs ≥ 50 bars per name; early 2020 has few listed names, so breadth coverage < 60% there → `unknown` for the
   first months. Accept `unknown` there, or compute breadth only when ≥ 20 names qualify?
2. `neutral_ok` as a strategy attribute: acceptable, or should neutral forbid all new entries in Phase 3 and be relaxed only
   with Phase 4 evidence?
