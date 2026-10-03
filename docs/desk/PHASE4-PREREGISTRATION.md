# Phase 4 — Strategy tournament pre-registration, revision 2 (frozen before any result)

Status: v2 after independent review R-S (ChatGPT, 2026-10-03). Rules freeze on written acceptance; nothing below changes
once results start appearing. Changes from v1 are marked **[R-S n]**.

## 1. Data and universe
- Snapshot: the verified frozen daily snapshot, data_hash `8df7990c93dcc632`, universe_hash `64e00348d99bb713`, listing windows
  enforced (Phase 2). Venue of the history: Coinbase. **Limitation recorded in every manifest**: execution venue is Kraken; a
  candidate's research acceptance on Coinbase bars never equals broker approval, and Phase 10 requires Kraken paper reproduction.
- **Dynamic liquidity universe [R-S 1]**, frozen mechanics: on the first eligible decision close of each UTC calendar month,
  rank currently listed assets by mean daily dollar volume (close × volume) over the preceding 90 completed daily bars; all
  90 bars required; take the top 20; ties by symbol ascending; membership frozen until the next monthly ranking; ranking uses
  only data available at that close, trades begin next open; a name that drops out receives no new entries but open positions
  continue under the strategy's own exit rule; no forward-filling of missing volume; each month's membership and its hash go
  in the manifest.
- **Asset-class exclusion map, frozen now**: fiat-pegged stablecoins (USDT, USDC, DAI, PYUSD, USDS, FDUSD, TUSD, GUSD, USDP,
  EURC, EUROC) and wrapped or staked derivatives of listed assets (WBTC, WETH, CBETH, CBBTC, STETH, RETH, LSETH) are never
  eligible. No exclusion is added or removed after results.

## 2. Cost model **[R-S 2]**
| role | per side | provenance |
|---|---|---|
| canonical | Kraken Pro taker 0.40% + 0.05% half-spread + 0.05% slippage = **0.50%** | starter tier, ASSUMED until the live account tier is read before any paper trade (R-A) |
| stress | canonical × 1.25 = 0.625% | full-sample and OOS walk-forward (R-O) |
| severe sensitivity | legacy 0.95% | reported, never a verdict input |
Costs are explicit CostModel inputs with tier text; the manifest records all three.

## 3. Engine and sizing
Phase 2 engine unchanged. Canonical allocator **gross_cap 1.0, max_positions 10**, equal equity-scaled slots; verdicts use
it alone. Sizing sensitivities: gross_cap 0.95 and 0.90 **[R-S 4]**. No fixed-dollar cells in Phase 4. Scale invariance:
every candidate runs from $10k and $100k; normalised equity curves must agree to 1e-6.

## 4. Walk-forward and the fold-boundary rule **[R-S 3]**
- Parameter selection: fit 365 days, test 90 days, rolling; selection inside the fit window only; trials counted.
- **Fold results are reported individually as selection evidence.** The chained OOS curve is NOT presented as a live
  portfolio, because the engine liquidates at each fold boundary.
- **Continuous OOS run**: for each candidate, the parameters chosen in each fit window are applied in one continuous
  simulation across the whole OOS span without liquidation at boundaries (positions carry; only the parameter set switches at
  the boundary, and a switch never force-closes a position; the strategy's own exit rule does). This continuous run is the
  verdict curve.
- Boundary dependency: the per-fold run reports how many exits were caused solely by the boundary (`reason == "eod"` at a
  fold end). If removing those changes OOS total return by more than 20% of its absolute value, or flips its sign, the
  candidate is **inconclusive** until the continuous run is reviewed.

## 5. Candidates (frozen; nothing added after results)
| # | strategy | role | grid (≤ 4 points) |
|---|---|---|---|
| 1 | `sma_trend` on the dynamic universe | candidate | (fast, slow) ∈ {(20,100), (50,200)} |
| 2 | `momentum_top` | candidate | lookback ∈ {60, 90} × n ∈ {5, 10} |
| 3 | `mean_reversion` | candidate | dip ∈ {0.08, 0.10} × n ∈ {20, 30}; **n is the moving-average lookback, not a name count** |
| 4 | `breakout20` | negative control only | fixed; its result never enters selection, thresholds or trial accounting |
| 5 | `buy_and_hold(BTC)`, `cash` | benchmarks in every table | — |
Trial count = Σ grid points × folds for candidates 1–3.

## 6. Gate and verdict per candidate
Phase 2 gate (8 checks incl. OOS fee stress) + ≥ 100 OOS trades + scale invariance + boundary-dependency check (§4).
Verdict ∈ {accepted, rejected, inconclusive}. `research_accepted ≠ trade_approved`.

## 7. Advancement **[R-S 5]**
A candidate advances from Phase 4 only when ALL hold:
1. accepted by every core Phase 2 / OOS gate check
2. ≥ 100 OOS trades
3. normalised scale invariance at $10k / $100k
4. positive OOS return in ≥ 2 of 3 chronological thirds
5. positive OOS return under ×1.25 fee stress
6. not dependent on one year, one symbol, or the top three winners (existing gate checks)
7. survives the **canonical conservative delisting case** — 10× slot liquidity floor (3-day median dollar volume ≥
   max($50k, 10 × slot_usd)) with −50% recovery haircut — whenever later-delisted names account for ≥ 10% of OOS P&L or
   ≥ 10% of OOS trades; mild (5×, −25%) and tail (20×, −100%) cases reported, full grid reported when that exposure is material
8. no unexplained fold-boundary dependency (§4)
Destinations: **Phase 5 accumulation research** needs `research_accepted` (all eight). **Phase 10 paper** needs all eight
**plus** successful reproduction on Kraken paper-market data; Coinbase-bar acceptance is never broker approval.

## 8. Reporting (per candidate)
Per-fold table; continuous OOS curve; results per regime state (labels recorded, filter NOT applied, R-R); sizing
sensitivities; cost sensitivities; Monte Carlo block bootstrap; P&L by year and by symbol; `no_fill` breakdown; delisting
exposure share; monthly universe memberships; manifest with data_hash, universe_hash, universe-membership hash, cost records,
sizing, regime block, trials. Nothing is written to `research_runs` until the full table has been independently reviewed.

## 9. Hard rules
No candidate, grid point, exclusion, cost or threshold changes after the first result is seen. The negative control's
numbers are never used for any decision. Regime thresholds stay as in Phase 3 (R-R). A fresh snapshot (new data_hash)
re-runs the whole table under the same rules; it does not reopen them.
