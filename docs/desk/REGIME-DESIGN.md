# Phase 3 — Regime engine design, revision 2 (for acceptance before code)

Status: DRAFT v2 after independent review R-P (ChatGPT, 2026-10-03). No code until accepted. Architecture doc §3.
Changes from v1 are marked **[R-P n]**.

## 0. What it is and is not
A market-context layer that emits one small frozen label per completed daily bar, the same label for every strategy.
It cannot place orders, size positions, change stops, or alter any strategy's exits. Strategies may read the label at
decision time and use it only to decide whether to **propose new entries**. Phase 2 engine, allocator and exits are untouched.

## 1. States (three market states plus one failure state) and the canonical entry rule
| state | meaning | new long entries |
|---|---|---|
| `risk_on` | no hard veto; BTC trend and breadth aggregate positive | allowed |
| `neutral` | no hard veto; trend and breadth aggregate mixed | **blocked** **[R-P Q2]** (no `neutral_ok`; a "mean-reversion may enter in neutral" overlay is a pre-registered Phase 4 study compared against this rule, never part of Phase 3) |
| `risk_off` | a hard veto fired, or trend and breadth aggregate negative | blocked |
| `unknown` | an input missing, stale or without enough history (§5) | blocked |

No fourth market state in Phase 3. Adding one later is an architecture change with its own review.

## 2. Inputs (completed DAILY bars, Coinbase venue; "as of t" = bars with t_bar + 1d ≤ t) — exact math **[R-P 6]**
Let c_t be BTC's close of the last completed bar as of t.
| input | definition | history needed |
|---|---|---|
| SMA200_t | mean of the last 200 completed closes | 200 bars |
| SMA50_t | mean of the last 50 completed closes | 50 bars |
| slope_t | SMA50_t / SMA50_{t−20} − 1 ; sign(slope_t) with exact 0 counted as non-positive | 70 bars |
| vol_t | stdev of the last 20 daily log returns × √365 | 21 bars |
| volpct_t | percentile rank of vol_t within {vol_{t−364} … vol_t} **including** the current observation: (count of values ≤ vol_t) / 365 | 385 bars |
| dd_t | c_t / max(c over last 365 completed bars) − 1 | 365 bars |
| breadth_t | §2a | per §2a |
Until every lookback above exists, the state is `unknown` (explicit startup rule, not an accident). With Coinbase BTC
daily data from 2020-03-08 the first non-`unknown` label is possible from ~2021-03-28; breadth (§2a) may delay it further.

### 2a. Breadth, exact definition **[R-P 5]**
- `breadth_eligible(t)` = symbols listed at t under the frozen listing history (listed_at ≤ t < delisted_at) with ≥ 50
  completed daily bars as of t. Newly listed names without 50 bars are **not** eligible and therefore never count as missing.
- `fresh(t)` = members of breadth_eligible(t) that have the completed bar at t − 1d exactly.
- `coverage_t` = |fresh(t)| / |breadth_eligible(t)|.
- breadth is `unknown` if |breadth_eligible(t)| < 20 or coverage_t < 0.60. Otherwise
  breadth_t = share of fresh(t) with close_{t−1d} > own SMA50 (50 completed closes, own series).
- Early 2020 therefore reads `unknown` until 20 names have 50 bars. Accepted as honest.

Not inputs: Fear & Greed (the BTC **sweep** trigger, kept separate), DeFiLlama fundamentals (lagged; a selection input),
anything intraday, anything from `desk_watchlist` or paper results.

## 3. Classification **[R-P 2]**: hard vetoes first, then the ordinary classifier
Step 1, hard vetoes (either one → raw `risk_off`, regardless of everything else):
- `veto_vol`: volpct_t ≥ vol_pct
- `veto_dd`: dd_t ≤ −0.50 (fixed)
Step 2, ordinary classifier (only when no veto fired):
- trend_vote = +1 if c_t > SMA200_t × (1 + band) and slope_t > 0; −1 if c_t < SMA200_t × (1 − band), or (slope_t ≤ 0 and c_t < SMA200_t); else 0
- breadth_vote = +1 if breadth_t ≥ 0.55; −1 if breadth_t ≤ 0.35; else 0 (fixed cut-offs)
- raw = `risk_on` if trend_vote + breadth_vote ≥ +1; `risk_off` if ≤ −1; else `neutral`
Breadth is **not** a hard veto (too noisy); its collapse aggregates with trend. The state descriptions in §1 say so.

## 4. Thresholds: one canonical pair, shared by every strategy **[R-P 1]**
- Canonical Phase 3 specification, frozen now: **band = 0.02, vol_pct = 0.90**. Every strategy in Phase 4 reads the
  same label series from this pair. There is no per-strategy, per-fold or per-metric selection of regime thresholds.
- The other five pairs ({0.00, 0.02, 0.05} × {0.80, 0.90} minus canonical) are **robustness runs only**: each Phase 4
  report shows the candidate under all six label series, the canonical one is the result, the rest are sensitivity.
  They are never chosen after seeing a candidate's results, and no verdict is based on a non-canonical pair.
- Fixed and not tunable: breadth cut-offs 0.55 / 0.35, drawdown floor −0.50, hysteresis 3, lookbacks 200/50/20/365,
  eligibility 50 bars, minimum 20 names, coverage 60%.

## 5. Freshness and fail-closed
BTC inputs are stale if BTC's latest completed bar is older than t − 1d. Breadth is stale per §2a. Any stale or NaN input,
or missing history (§2), → `unknown`. No forward-fill; no partial bars (market-time rule: `completed_bars`, joins by
timestamp).

## 6. Transitions and hysteresis **[R-P 4]**
- Published state changes to a new ordinary value only after the raw state has been that same value for **3 consecutive
  completed bars**. Any change in the candidate raw state resets its counter to 1.
- Hard fast-fail: a raw `risk_off` produced by `veto_vol` or `veto_dd` publishes after **1** bar, from any state including
  `unknown`. A raw `risk_off` produced only by the ordinary classifier (trend + breadth) follows the 3-bar rule.
- `unknown` publishes immediately when an input fails. Leaving `unknown` requires 3 consecutive **fresh** bars with the
  **same** raw state (fresh `risk_on`, `neutral`, `risk_on` does not clear it); the fast-fail exception above still applies.
- Every transition is logged with the causing bar, raw votes, vetoes, and the counter value.

## 7. Exposure to strategies without future data
- `AsOfView.regime()` → `(state, since_t, votes, vetoes)` computed from bars with t_bar + 1d ≤ view.t only, materialised
  into the view like bars (visibility cut; no reference to the full series).
- The label series is precomputed once per (market, threshold pair) into a timestamp-indexed table; the view returns the
  entry at the last completed bar. Test: the entry at t equals a recomputation on a market truncated at t, for every t.
- Strategies receive the label only through the view. `StrategyHygiene` forbids importing the regime module from
  `strategies.py`. The regime module has no reference to `Portfolio`, `Order` or the cost model (grep test).

## 8. What regime may affect
| entries | exits | sizing | strategy selection |
|---|---|---|---|
| YES, canonical rule: propose only when `risk_on` | NO | NO | YES: Phase 4 reports every candidate per state |

## 9. Validating the regime layer itself **[R-P 3]** (strategy-independent; OOS is never used to choose parameters)
Buy-and-hold is removed as the layer's acceptance test (one entry at the start makes it a start-date test). Instead, on
untouched OOS periods (the Phase 2 walk-forward test windows, canonical thresholds), report per published state:
- subsequent BTC returns over 1d / 7d / 30d (mean, median, hit rate) and forward 30d max drawdown
- share of time in each state and number of transitions
- the same table for each of the five robustness pairs
This describes what the labels mean out of sample. It does not accept or reject strategies. Phase 4 decides, per
candidate, whether filtering helps (§10). BTC buy-and-hold and cash remain mandatory benchmark rows in every report.

## 10. Phase 4 use and the hindsight rule **[R-P 7]**
- Order is fixed: unfiltered Phase 2 gate first. Only candidates that pass, or miss by exactly one check, are run filtered.
- Filtered beats unfiltered only if ALL hold on the same OOS folds: (a) higher OOS total return, (b) smaller OOS max
  drawdown, (c) filtered OOS trade count ≥ 50% of unfiltered, (d) filtered OOS trade count ≥ 100 (minimum absolute
  evidence), (e) improvement in at least one exposure-independent statistic: average net trade return or profit factor.
  A filter that wins only by sitting in cash fails (e) and is reported in those words.
- Regime thresholds are never chosen on OOS, never per candidate (§4). The house breakout rule stays rejected and is not
  run under regime. Phase 3 cannot rescue a strategy.

## 11. Manifest fields
`regime: {version: 2, canonical: true|false, band, vol_pct, breadth_hi: 0.55, breadth_lo: 0.35, drawdown_floor: -0.50,
hysteresis_bars: 3, fastfail: [veto_vol, veto_dd], lookbacks: {sma200: 200, sma50: 50, slope: 20, vol: 20, volpct: 365, dd: 365},
breadth: {min_bars: 50, min_names: 20, min_coverage: 0.60}, entry_rule: "risk_on only", data_hash, universe_hash,
first_label_t, transitions_count, pct_time: {risk_on, neutral, risk_off, unknown}}` — enough to recompute every label.

## 12. Tests (all before the engine is wired in)
- boundary: label at t uses only bars with t_bar + 1d ≤ t; a 50× spike in the bar opening at t cannot change it
- same-bar leakage: votes/vetoes at t on a truncated market equal the precomputed series at t, for every t
- startup: all labels are `unknown` until the longest lookback (385 bars) exists; first label appears exactly then
- veto precedence: trend +1 and breadth +1 with volpct ≥ 0.90 → raw `risk_off`; same with dd ≤ −0.50 → raw `risk_off`
- flip control: daily oscillation around SMA200 → no transition; a single cross → exactly 1 transition, 3 bars after
- counter reset: raw sequence on, on, neutral, on, on, on → publishes at the 6th bar, not the 3rd
- fast-fail: vol shock publishes `risk_off` after 1 bar, from `risk_on` and from `unknown`; leaving needs 3 same fresh bars
- unknown exit: fresh raw on, neutral, on → still `unknown`; on, on, on → `risk_on`
- breadth gates: 19 eligible names → `unknown`; 20 eligible with 59% coverage → `unknown`; 20 with 60% → labelled;
  a wave of new listings without 50 bars does not change coverage
- slope and percentile conventions: slope exactly 0 counts as non-positive; volpct includes the current observation
- entries: a strategy that proposes every bar proposes nothing in `neutral`, `risk_off` and `unknown`
- shared labels: two different strategies in one run read identical label series
- no side effects: regime module has no reference to Portfolio, Order or costs (grep)
- benchmark pairing: a filtered walk-forward output always carries its unfiltered twin and the six-pair sensitivity set

## 13. Resolved questions
1. Breadth minimum: 20 eligible names (§2a). 2. `neutral` blocks all new entries in Phase 3 (§1).
