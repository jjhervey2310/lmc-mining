# Desk review log

Every external review (ChatGPT, Codex, a human) gets answered here item by item: fixed, deferred with a reason, or
rejected with a reason. Disagreements that are empirical are settled by a backtest, named here, never by argument.
Newest review first.

---

## R-2026-10-02-A — ChatGPT review of PR #42 (Phase 0) and the PR #41 architecture

Reviewed heads: PR #42 `508a2a9`, PR #41 `4d09cce`. Response commit: see PR #42 history after this file lands.

### Code findings

| # | Severity (theirs) | Claim | Verdict | Action |
|---|---|---|---|---|
| 1 | BLOCKER (for any agent→live link) | `fund/buy` treats a shared header secret as authority to buy; no human identity bound to the order. | **Correct. Accepted as a design constraint, not a Phase 0 regression.** The route is a human tap endpoint and was the same before Phase 0; Phase 0's brief was "no secrets in query strings, server-side sizing", both done. | Recorded in §12b/§12 of the architecture (human approval binds proposal revision, venue, pair, side, cap, expiry; one-use; verified session). **No agent is ever given `ADMIN_SECRET`, exchange keys, or a service-role key** — written into CLAUDE.md. Phase 9 replaces this route; until then it stays a human-only tap. |
| 2 | HIGH | Concurrent requests can both pass the cash/holdings check and both place orders; no idempotency before the broker call. | **Correct.** | Fixed the cheap, honest part now: the tab sends one UUID per tap (`requestId`), the route passes it to Robinhood as `client_order_id` (broker-side idempotency — a retry cannot become a second fill), and a per-symbol in-flight guard serialises double-taps on the same instance. **Limit stated in code:** the guard is per serverless instance; a durable reservation row + reconciliation of unknown/timeout results is Phase 9 work and is listed there. Test: `clampOrderUsd` unchanged; the UUID pass-through is covered by the Robinhood adapter signature; a fake-broker concurrency test is scheduled with the Phase 9 reservation table (no point testing a guard we know is instance-local). |
| 3 | HIGH | Mixed clocks: breakout on completed closes, RS on CoinGecko's rolling intraday 7d. | **Correct — and it was on my own Phase 0 list (bug #4) and I had not fixed it.** | Fixed. `lib/desk/relative-strength.ts::rsCompletedPct` computes both 7-day returns from `cg_history` completed closes joined by timestamp; the timing route uses it for the signal *and* the tape input, and labels `rsSource`. CoinGecko rolling 7d remains only as a labelled fallback when no stored history exists. Test: `tests/relative-strength.test.ts` — adding today's partial point with a huge move does not change the result. |
| 4 | HIGH | `backtest.py` BTC end point timestamp-aligned but the 7-day start is still `bi - 7`; missing days shorten the window; no history → 0. | **Correct.** | Fixed. `market_time.ret_over()` finds both ends by timestamp (±half a bar for CoinGecko jitter) and returns `None` on any gap; `backtest.py` and `breakout_scan.py` treat `None` as "no signal on this bar" / "name unseen today", never as 0. Tests: `test_market_time.py::ReturnOver` (calendar days, missing start day, jitter). |
| 5 | HIGH | Legacy survivor-biased results are not approval evidence; first/last candles don't establish listing dates. | **Correct; already the architecture's position (§3 `universe_history`, §11).** | The `ASSUMPTIONS` stamp on every legacy result now says `universe=today's universe.json (survivorship-biased) — DIAGNOSTIC ONLY, not approval evidence`, and it is written **before** the first print so no copy of the output lacks it. `backtest_audit.py` (delisted pairs included) is the only legacy script that can feed evidence, and only after Phase 2 reruns it under the framework. |
| 6 | MEDIUM | `denverWeekStartIso` uses today's offset for Monday; wrong on a DST-transition Sunday. | **Correct.** | Fixed. Monday is found by calendar arithmetic, then its midnight is resolved with the offset sampled at *Monday's own noon* (`zonedMidnightUtc`). Tests added for Sun 2026-03-08 and Sun 2026-11-01. |
| 7 | MEDIUM | `bt_costs` lets NaN through, defaults venue/tier to "unspecified", and the scripts print before stamping. | **Correct on all three.** | Fixed. `CostModel` requires finite values and non-empty, non-"unspecified" `venue`/`tier` (now positional, no defaults); `--venue/--tier` and `BT_VENUE/BT_TIER` are required; stamp is applied before the first `print`. Tests: NaN/inf, missing provenance, stamp content. "Verify configured costs actually affect fills" — true for the legacy scripts only via their constants; the Phase 2 framework takes `CostModel` as the single cost input and will carry a test that changing it changes P&L. |

Also noted and agreed: the Robinhood adapter is live-capable; `Broker` is an execution contract, not a review tool. The
Kraken/Coinbase stubs are the only "safe" members, and only because they refuse everything.

### The governance bridge (15-file proposal)

**Rejected for now; adopted in a lighter form.** Reasons:

- The repo has **zero** backtest runs in the new framework. Fifteen files of JSON schemas, validators, state machines
  and a CI workflow to govern evidence that does not exist yet is the wrong order. The same risk the review is worried
  about — a model declaring its own work accepted — is covered today by: Jacob is the only merger; every review and
  response is in this log; backtests are the tiebreaker and none exist.
- What is adopted now: this log (append-only, per review); the rule that **no model sets a final status** (statuses here
  are "fixed / deferred / rejected", never "approved"); `research_accepted ≠ trade_approved` written into §12b.
- What is adopted in Phase 2, when `research_runs` exists: an evidence manifest per run (code SHA, data snapshot hash,
  universe hash, `CostModel`, fill rule, folds, seeds, metrics, trial count) — that is the `evidence.schema.json` idea,
  attached to the thing it describes instead of a parallel tree. Review JSON and a validator come with it if two models
  are actually reviewing runs by then.
- `AGENTS.md`: not created. CLAUDE.md is the single instruction file; the three rules the review wants both agents to
  follow (no model consensus authorises money; no agent holds secrets; log every review) are in CLAUDE.md.
- Private Supabase review tables, RLS roles per agent, an MCP review API: deferred to Phase 9 with the recommendation
  cards, which is where a second agent would first need write access.

### Architecture disputes seeded (to be settled by backtest, Phase 4/8)

| Dispute | Competing claims | Test |
|---|---|---|
| D-1 BTC sweep | H-SWEEP-A (extreme fear only) vs B (fixed %) vs C (hybrid) | Phase 8: P(5 BTC in 5y) on resampled 2021–26 paths, same growth-account equity curve, Monte Carlo |
| D-2 Milestone risk table | Proposed caps vs. "they still blow up under correlated gaps" | Phase 7: portfolio simulation with 2022-05 (LUNA), 2022-11 (FTX), 2025-02 gap days; report worst-case heat realised vs cap |
| D-3 Alt-first growth | Alt engine vs. BTC/ETH DCA + cash baseline | Phase 4 tournament: net return, max DD, excluding top-3 winners, per-year |
| D-4 Exit complexity | §8b distribution/exit engine vs. a single trend-break exit | Phase 6: capital preserved across every ≥30% drawdown since 2021, net of whipsaw; entries and exits tested together |

Standing rule added to §8b/§10: reserve BTC is never inventory for the spot reverse grid; the two live in separate
ledgers (`btc_reserve_ledger` vs. growth-account positions) and no code path moves between them without a
`HUMAN_REVIEW_REQUIRED` flag.

### Collector

Agreed: `docs/COLLECTOR-UNKNOWN.md` is a report, not verification. Unknown provenance blocks promotion of any `kr_*`
derived result to evidence. The Phase 1 ingest records source timestamps, ingestion timestamps, gaps and checksums
per snapshot, and freezes snapshots per run.

### Open items carried forward

- Phase 9: durable order reservation + reconciliation; human approval binding; fake-broker concurrency test.
- Phase 2: evidence manifest per run; "changing CostModel changes P&L" test.
- Phase 1: collector provenance fields; snapshot freezing.
