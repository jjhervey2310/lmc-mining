# Phase 3 — regime engine on the frozen real snapshot (first run, 2026-10-03)

Snapshot: `md_daily_2026-10-02.json`, data_hash `8df7990c93dcc632`, universe_hash `64e00348d99bb713` (the verified Phase 2
snapshot). Canonical pair band 0.02 / vol_pct 0.90, design v2 (R-Q). Code: PR #47 @ 7b84ea7. Nothing written to
`research_runs` (`--no-store`).

## Label series (canonical)
| | |
|---|---|
| first non-`unknown` label | 2021-03-31 (385 BTC bars + breadth gates) |
| time in state | risk_on 19.5% · neutral 14.8% · risk_off 49.6% · unknown 16.1% |
| transitions | 62 over 2,400 bars |

## Layer diagnostics on untouched OOS windows (design §9; descriptive, parameters never chosen on OOS)
Forward BTC return after a bar carrying each label, and forward 30-bar max drawdown. n = labelled OOS bars.
| state | n | 1d mean / hit | 7d mean / hit | 30d mean / hit | fwd 30d DD mean |
|---|---|---|---|---|---|
| risk_on | 435 | +0.04% / 49% | +0.16% / 51% | +0.45% / 44% | −14.2% |
| neutral | 354 | +0.21% / 51% | +1.04% / 53% | +2.40% / 53% | −11.3% |
| risk_off | 1,168 | 0.00% / 49% | +0.15% / 50% | +1.92% / 53% | −13.6% |
| unknown | 23 | +0.68% / 61% | +1.78% / 57% | +1.66% / 48% | −16.5% |

**Reading, plainly:** on this data the canonical regime does not separate forward BTC outcomes in the direction its names
imply. `risk_on` bars are followed by the weakest 30-day returns and the lowest hit rate of the three market states, and
forward drawdowns are of the same size in every state. Half of all bars are `risk_off`. As a market-context layer it is
**not evidenced** on OOS. It is not wrong as code (72 tests, no-look-ahead proof), it is uninformative as a signal with
these inputs and thresholds.

## Overlay illustration (NOT an eligible evaluation — shown to demonstrate the rule, nothing else)
Candidate run: `sma_trend` 50/200 on a hand-picked 8-name list (BTC, ETH, SOL, LINK, AVAX, DOGE, ADA, LTC) — illustrative
only, not pre-registered, not a Phase 4 candidate.
| | unfiltered | regime-filtered |
|---|---|---|
| OOS total return | −30.2% | +8.8% |
| OOS max drawdown | −53.1% | −46.7% |
| OOS trades | 170 | 84 |
| OOS profit factor | — | 1.23 |
Gate unfiltered: `oos_positive` FAIL, fee stress FAIL (both), `not_single_year` FAIL, `not_top3_dependent` FAIL →
**overlay_eligible = false** ("fails a core check unfiltered"). This is exactly the rescue the hindsight rule forbids: a
losing strategy made to look positive by a filter. The filtered numbers are reported so the rule can be seen working; they
carry no evidential weight and are not compared.

Sensitivity (five non-canonical pairs, same candidate, descriptive only): band has no effect at any vol_pct (identical
84 trades); vol_pct 0.80 → −19.6% / PF 0.88, vol_pct 0.90 → +8.8% / PF 1.23. The outcome is driven almost entirely by
how often the volatility veto fires, not by the trend band.

## What this means for Phase 4
1. Phase 4 runs **unfiltered by default**. The regime label is recorded per bar and every candidate is still reported
   per state (design §8), so the question stays open with evidence accumulating, but no verdict uses the filter.
2. The layer is kept as built. Changing inputs or thresholds now, after seeing OOS, is the optimisation the design
   forbids; any revision is a new pre-registered design (v3) with its own review, tested first on the fit windows only.
3. The one informative observation worth carrying forward: the volatility veto alone moves outcomes; the trend band does
   not. A v3 proposal, if any, should test "vol-veto-only" as a hypothesis, pre-registered, not adopted from this table.
