# Phase 2 reproduction — house breakout rule on the frozen daily snapshot

Run 2026-10-02 ~21:30 UTC from the cloud session, publishable key + read-only SELECT policies (no service-role key in any
agent path). Research run used `--no-store`: nothing was written to `research_runs`; the run_id below is an identifier only.
Code: PR #46 @ 3264acc.

## Snapshot (verified against the database before anything below was read)

| Proof | Value |
|---|---|
| Rows in snapshot | 444,684 |
| Rows in DB, `md_candles` venue=coinbase, interval=1440 | 444,684 (exact match) |
| Symbols with bars | 419 (DB: 419) |
| Listings (`universe_history`, coinbase) | 489, of which 88 carry a delisted date; 70 have no candles at all |
| Date span | 2020-03-08 → 2026-10-01 (min/max bar_time, matches DB) |
| Pagination check | 0 symbols with a row count that is a multiple of 1,000; 401 of 419 symbols end on 2026-10-01, the rest are delisted names |
| Listed-at by year | 2020: 32 · 2021: 72 · 2022: 71 · 2023: 26 · 2024: 46 · 2025: 109 · 2026: 63 (+70 no-candle rows) |
| data_hash | `8df7990c93dcc632` |
| universe_hash | `64e00348d99bb713` |
| Fee model | 0.95% per side taker, venue coinbase-daily, tier "legacy blended COST_SIDE per side (backtest_house.py)", spread 0, slippage 0 |
| Fill rule | decision at completed daily close; fill next open + cost; stop before target on the same bar; gap → open |
| Windows | walk-forward fit 365 days / test 90 days; 22 trials (1 param set × 22 folds) |

## INVALID runs, excluded from every comparison and gate

1. **Truncated snapshot** (296,646 rows): loader page size 5,000 exceeded the silent PostgREST cap of 1,000; every symbol with
   more than 1,000 days lost its 2023+ history. Results discarded, never recorded.
2. **Stale listings** (data_hash `38d4a3541e40a602`, universe_hash `d2c54931649902e1`, 444,684 rows): `universe_history.first_bar`
   had not been refreshed after the backfill, so 258 symbols were "unlisted" until 2025 and the honest engine saw 7 signals
   before 2025. Verdict "rejected" on that run is NOT evidence. Fixed by `universe_refresh_bars()` (already part of the
   nightly universe-sync job, which had only run while the backfill was partial).

## Reproduction (bt_run.py --strategy breakout_legacy, slot sizing gross_cap 1.0, max_positions 10, start $10,000)

```
run_id breakout_legacy-4509a3eae48cae50-8df7990c93dcc632-1790974180   (identifier only; not stored)
verdict  rejected          trial_count 22
no_fills 25  {"cash": 25}

in_sample  total_return -81.6%  max_drawdown -92.1%  sharpe -0.45  trades 596
oos        total_return -84.1%  max_drawdown -88.0%  sharpe -0.75  trades 546

gate  oos_positive FAIL · symbols>=min PASS · not_single_year FAIL · survives_fees_x1.25 FAIL ·
      not_top3_dependent FAIL · param_surface_smooth PASS · trials_recorded PASS
```

## Sizing attribution (NOT RESEARCH EVIDENCE — sizing attribution only; full text in ATTRIBUTION-2026-10-02.txt)

| cell | trades | total | avg/trade | max DD | win | PF | exposure | avg cash | no_fill |
|---|---|---|---|---|---|---|---|---|---|
| 1 legacy logic + legacy $100 fixed | 619 | -11.3% | -1.83% | -18.8% | 28% | 0.83 | 4.1% | 95.9% | n/a |
| 2 honest engine + legacy $100 fixed | 607 | -11.5% | -1.90% | -19.7% | 28% | 0.82 | 4.2% | 95.8% | slots 14 |
| 3 honest engine + slot, gross_cap 1.00 | 596 | -81.6% | -2.19% | -92.1% | 27% | 0.81 | 38.5% | 61.5% | cash 25 |
| 4 honest engine + slot, 0.95 (sensitivity) | 602 | -76.0% | -1.86% | -89.3% | 28% | 0.82 | 36.8% | 63.2% | cash 13, slots 6 |

Delisting treatment: legacy-symmetric in every cell (R-J). Rule in every cell: legacy "no take-profit: trail 12/18 only,
2/wk" (the engine has no partial sells).

## Reading

- **#1 vs #2 (correctness impact): small.** Trade count 619 → 607, average trade -1.83% → -1.90%, win rate and profit factor
  unchanged. The honest chronology, listing windows and all-or-none fills do not change what the rule is: a negative-expectancy
  entry with a 28% win rate and a profit factor below 1 across 6.5 years and 419 names. The legacy script's own headline
  (-0.91%/trade "best cell") was already saying this.
- **#2 vs #3 (allocator impact): large, and it is exposure, not edge.** Per-trade numbers barely move (-1.90% → -2.19%, PF
  0.82 → 0.81). What changes is deployment: the slot allocator puts ~38% of equity to work instead of ~4%, so the same losing
  rule compounds its losses ten times harder. The legacy $100/trade result looked survivable only because 96% of capital sat idle.
- **Capital starvation:** 25 `no_fill: cash` events at gross_cap 1.0; the rule wanted more exposure than it had.
- **Gate:** 4 of 7 checks fail, including both that matter most (OOS positive, survives +25% fees).

## Verdict

**Phase 2 framework: PASS.** The engine reproduces the legacy house backtest trade-for-trade within 2% on the real frozen
dataset (cell 1 vs 2), on a snapshot whose provenance is verified above, with every correction from reviews R-F through R-M
in place and no look-ahead path left open.

**House breakout rule as a candidate: FAIL / REJECTED.** It loses money in-sample and out-of-sample under honest
chronology, and it loses more the more capital it is given. It does not advance to Phase 4 as a baseline; it stays in the
tournament only as a documented negative control.

Independent review by ChatGPT pending before either line is treated as final.
