# Crypto Desk Architecture — $1,000,000 + 5 BTC

Status: PROPOSAL (2026-10-02). No trading code changed yet. Approve, amend, or reject before implementation.

North star: own 5 BTC permanently, build $1M of additional liquid capital, never take a catastrophic loss. Every component below is judged against that, not against trade-level P&L.

**Strategic emphasis (set 2026-10-02):** the objective is to capture major dips and ride major upside, not to harvest small trades. Priority order of engines: (1) Accumulation / dip engine, (2) Distribution & exit engine ("the down bot"), (3) 5x discovery, (4) regime + router that connects them. Grid trading is a secondary, optional harvester for RANGE regimes and is only built if the tournament shows it beats cash net of fees.

---

## Operating thesis (Jacob, 2026-10-02)

Stated rules, recorded verbatim in intent and converted into testable hypotheses:

1. **Alts are the profit engine.** The growth account trades alts for asymmetric upside. BTC is not traded — it is accumulated.
2. **Realized alt profit has two exits:** redeploy into the next qualified trade, or park in stablecoins earmarked for BTC.
3. **BTC is bought only when the Fear & Greed index reads Extreme Fear.** (Hypothesis H-SWEEP-A, see §10.)
4. **We keep going until $1M + 5 BTC.** No fixed horizon on individual trades; the 5-year target is the clock.

Implications the system enforces:
- **BTC-earmarked bucket** (`reserve_pending_usd`): stable balance that alt engines cannot draw on. Only the sweep rule moves it into BTC. Prevents the reserve being recycled into the next alt trade.
- **Stablecoin choice is venue-dependent.** Robinhood lists USDC, not USDT. Kraken US lists both. The design uses "USD-stable" and resolves per broker; never assume USDT.
- **The exit engine is the critical path.** Alt profit only exists once realized; alts routinely draw down 80-95% and most do not recover. Phases 5 and 6 are built together.
- **Fear & Greed** (alternative.me, free, daily since 2018-02) becomes a first-class input: stored daily in `fund_snapshots_daily`, used by the sweep policy and as a regime feature. Caveat: it is a composite of volatility, volume, social, dominance, trends — partly price-derived, so it is not independent of the price features.

## 0. Audit verdict — what exists today

Four separate trading systems live in this repo. None is a grid/Pionex system. Verdict per system:

| System | State | Verdict |
|---|---|---|
| **A. AI Competition paper ledger** (`lib/comp-trader.ts`, `comp_*` tables, trading tab) | Dead — pg_cron job deleted 09-21, last run 08-31 | Keep the tables and equity-curve UI; retire the trader logic (sleeve sizing is noise, see bugs) |
| **B. Robinhood desk** (`lib/robinhood.ts`, `lib/desk-timing.ts`, `app/api/fund/*`, ROBINHOOD tab) | Live, manual-tap buys only | **Reuse.** Broker client, price-fallback chain, `gradeTiming()`, kill switch are solid |
| **C. desk-loop/** (Python, DigitalOcean droplet) | Stalled ~09-22; alert-only | **Reuse the method, not the runtime.** `backtest_audit.py` is the only honest backtest in the repo |
| **D. LEVERAGE research desk** (`kr_*` tables, external collector) | Collector live (10-02), 441k candles back to 2021, Kraken/Deribit/HL/Llama | **Reuse as the market-data lake.** Richest asset we own. Collector code is NOT in this repo |

Discrepancy: CLAUDE.md says 4 pg_cron jobs active; `cron.job` shows all 6 `active=false`. Nothing is scheduled right now. `comp_snapshots` last written 09-29.

### Reusable (keep, build on)
- `lib/robinhood.ts` — Ed25519-signed Robinhood Crypto client: `marketBuy`, `stopLimitSell`, `awaitFill`, `listOpenOrders`.
- `lib/desk-cg.ts` — price chain Robinhood → Coinbase → CoinGecko → `cg_history` (stale-flagged).
- `lib/desk-timing.ts:gradeTiming()` — pure A–F entry grade; chase law, extension, RS, volume. Testable.
- `app/api/fund/timing/route.ts` — regime (BTC vs SMA200/SMA50) and breakout (20d high + 1.5× vol + RS>0 + ext≤15%).
- `desk-loop/backtest_audit.py` — next-bar-open entry, 0.95%/side + 1% alt slippage, delisted-pair universe, 2023-24 fit / 2025-26 test, top-N-winner exclusion.
- `desk-loop/flow_scan.py` — already pulls DeFiLlama fees/DEX/TVL/stablecoins into `flow_radar`.
- `kr_ohlcv`, `kr_deep_candles`, `kr_funding`, `kr_book`, `kr_market_stats`, `kr_stablecoins`, `kr_chain_tvl` — multi-year OHLCV + microstructure.
- `kr_paper_positions` / `kr_desk_fills` / `kr_desk_curve` / `kr_research_verdicts` — a working paper-trade + deflated-Sharpe verdict schema.
- `cg_history` — 1y daily closes for 82 ids, shared by TS and Python.

### Dead / fragile (do not build on)
- `comp-trader` sleeve logic; `runner-scout` hard-coded symbol list; `analyst_watch.py` (referenced, missing); legacy `fund_grid`/`fund_trades`/`fund_holdings`/`fund_watchlist` tables; hard-coded Sept-2026 CPI/FOMC blackout dates in `timing/route.ts:168-170`.

### Bugs and bias risks found (fix before any of these feed a decision)
1. `comp-data.ts` sell path credits cash for `qty` while position only drops by `min(qty, p.qty)` — oversell mints cash.
2. `comp-trader.ts:115` sleeve adaptation measures top-ups, not skill.
3. SMA20 in comp-trader and `breakout_scan.regime()` include today's **partial bar**. Regime is defined three different ways across `timing/route.ts`, `breakout_scan.py`, `backtest_audit.py`.
4. Timing RS uses CoinGecko rolling 7d (intraday) while breakout uses completed closes — mixed clock.
5. `backtest.py:72` aligns BTC RS by array index, not timestamp; `backtest.py`, `backtest_house.py`, `backtest_breakout_full.py` fill at signal-bar close and can signal on a partial bar. Survivorship in all but `backtest_audit.py`.
6. `fund/buy` accepts `?secret=` in query string (leaks to logs) and a client-set `usd` that bypasses sleeve/floor sizing.
7. `fund_radar` daily row overwritten hourly.
8. `DENVER_OFFSET_H = -6` hard-coded; ignores DST.

---

## 1. Execution-venue reality check (Pionex / Webot)

Jurisdiction is fixed: **US citizen, resident in Denver, Colorado.** That removes every ambiguity below to one answer.

- **"Webot" = Pionex.** Webot US is the rebrand of Pionex.US. (Webot EU / Pionew Ireland exists but is irrelevant now.)
- **Global pionex.com is off the table.** Its ToS excludes US nationals and residents; you are both. Do not onboard there.
- **Webot US:** spot only, no futures, no leveraged/margin grid, 48 states. Colorado appears supported (support site blocked the fetch — needs one confirmation). Reported fees **0.1% maker / 0.5% taker** — 10× global Pionex taker. Bots are limit-order based so they mostly pay maker, but any market fill (bot start/stop, stop-loss) pays 0.5%.
- **No public API docs for Webot US.** The Pionex Bot API (create/adjust/cancel grids, `aiStrategy`, `checkParams`) is documented for pionex.com only. Whether Webot US exposes it is unconfirmed.
- Pionex klines: 500/request, **10,000-candle cap** (≈7 days of 1m, ≈416 days of 1h). Not a historical data source.
- Pionex's "AI strategy" picks range + grid count from 7/30/180-day backtests. A hypothesis to test, nothing more.

**Venue comparison for a Colorado resident (spot only everywhere; V = verified on official page 2026-10-02, S = secondary source):**

| Venue | Maker / taker at $10k–50k/mo | Low-caps (SPX, FARTCOIN, MOG, GIGA, PENGU, POPCAT) | Order types | AI connectivity | Verdict |
|---|---|---|---|---|---|
| **Kraken Pro** | **0.22% / 0.38%** (V) | All six listed on USD (S) | Trailing stop, OCO, OTO, stop/TP-limit (V) | Official MCP w/ paper mode, OAuth, keys with separate withdraw perm + IP allow-list (V) | **Primary alt venue + BTC reserve** |
| Coinbase Advanced | 0.35% / 0.75% (S, post Sept-2026 hike) | SPX, PENGU, POPCAT, WIF, GIGA, MOG; fastest meme listing cadence (S) | Bracket TP/SL, stop-limit; no trailing | Remote MCP (ChatGPT + Claude), OpenAPI 3.1, scoped keys (V) | Secondary broker for listing breadth; route by depth |
| OKX US | 0.20% / 0.35% (V) | Unverified | Algo orders (US parity U) | Agent Trade Kit w/ demo (S) | Dark horse — verify alt list before funding |
| Robinhood Crypto | 0.35/0.75 explicit or 0.35–0.85% spread (S) | None of the six | Market, limit, stop-limit; **no WS, no candles, no sandbox** | Trading MCP (S) | Legacy — existing holdings only, no new capital |
| Binance.US | 0% / 0.02% (V) | None found | Full API | Community only | ~$22M/day volume; BTC/ETH leg at most |
| Webot (ex-Pionex.US) | 0.05–0.5% (U, conflicting) | None found | Bot API (Pionex parity U) | Pionex AI Kit MCP (V for Pionex) | **No** — ~$11M/day, 0.43% avg spread eats any bot edge |
| Gemini ActiveTrader | 0.40% / 0.80% (V) | None | Stop-limit; real sandbox | OpenAPI spec | Most expensive at tier; 2026 financial stress |
| Crypto.com / Bybit / KuCoin / Bitget / Hyperliquid | — | — | — | — | Not available to US retail |
| On-chain (Jupiter/Solana, Uniswap/Base) | 1–3% round trip on $100M memes incl. MEV + slippage (S) | Everything, incl. BRETT and <$100M caps | Swap only | Jupiter MCP, Birdeye/GeckoTerminal OHLCV | Discovery universe now; ring-fenced sleeve later; no 1099-DA |

**Consequences**
1. **Bear-market engine = cash rotation + trend exits + spot reverse-grid logic only.** No shorts, no futures grid, no leverage. Leverage research (system D) stays research.
2. **Grid economics must be re-run at Webot US maker fees (~0.2% round trip).** Steps under ~0.5% are marginal; the optimizer treats fee tier as a first-class input and must be able to return `GRID_NOT_VIABLE`. If Webot's bots lose to a self-run grid on Kraken at 0.16/0.26 (we already have Kraken data), the honest answer is to run our own grid logic through a broker we control, not to use Pionex at all.
3. **Execution abstraction is mandatory.** `Broker` interface with `kraken` (primary — data lake already Kraken), `coinbase` (secondary, listing breadth), `robinhood` (exists, legacy holdings only), `manual` (recommendation card → you execute by hand). Pionex/Webot bot layer dropped: volume and spread make it uncompetitive. Day one, the grid engine outputs *parameters you type into Webot*; it needs no API access to be useful.
4. **Action before funding:** open Kraken Pro (if not already), create a trade-only API key with IP allow-list and no withdraw permission; confirm USDC rewards eligibility in Colorado; glance at OKX US's tradable list. The Webot support ticket is no longer needed.
5. Timezone for all "daily" logic is `America/Denver` (tz-aware, replaces the hard-coded `DENVER_OFFSET_H = -6`). Tax: every realized trade is a US taxable event — `tax_events` stays in the design and every recommendation card shows estimated short-term tax drag.

## 2. Target architecture

```
                 ┌──────────────── DATA LAYER (Supabase) ────────────────┐
 Market data ───►│ kr_* lake (exists) + md_candles (new, unified OHLCV)  │
 DeFiLlama ─────►│ fund_snapshots_daily (new, point-in-time vintages)    │
 Venue lists ───►│ universe_history (new, who was listable when)         │
                 └────────────────────────┬──────────────────────────────┘
                                          ▼
                 ┌──────────────── FEATURE LAYER ────────────────────────┐
                 │ features_daily: vol, RS, compression, breakout dist,  │
                 │ fundamentals Δ (24h..1y), accel/decel flags           │
                 └────────────────────────┬──────────────────────────────┘
                                          ▼
   ┌──────────────┬───────────────┬───────┴───────┬───────────────┬────────────────┐
   │ REGIME       │ 5X DISCOVERY  │ ACCUMULATION  │ GRID OPTIMIZER│ LET-WINNERS-RUN│
   │ engine       │ scanner       │ confidence    │ (fee-aware)   │ range→trend    │
   └──────┬───────┴───────┬───────┴───────┬───────┴───────┬───────┴────────┬───────┘
          └───────────────┴───────────────┼───────────────┴────────────────┘
                                          ▼
                 ┌──────────────── STRATEGY ROUTER ──────────────────────┐
                 │ regime × asset class → candidate strategies → EV rank │
                 │ portfolio risk gate (heat, corr, concentration)       │
                 └────────────────────────┬──────────────────────────────┘
                                          ▼
                 ┌──────────────── RECOMMENDATION ───────────────────────┐
                 │ recommendations table (full card, §10)                │
                 │ NO auto-execution. Human approves.                    │
                 └──────────┬─────────────────────────────┬──────────────┘
                            ▼                             ▼
                 ┌─────────────────────┐        ┌──────────────────────┐
                 │ EXECUTION (Broker)  │        │ BTC RESERVE          │
                 │ robinhood (exists)  │        │ profit sweep ledger  │
                 │ pionex-bot (maybe)  │        │ never auto-sold      │
                 │ manual card         │        └──────────────────────┘
                 └──────────┬──────────┘
                            ▼
                 ┌──────────────── LEARNING LOOP ────────────────────────┐
                 │ research_db: every test, config, result, regime, miss │
                 │ strategy tournament · missed-opportunity post-mortems │
                 │ backtest framework (walk-forward, MC, OOS, costs)     │
                 └───────────────────────────────────────────────────────┘
```

Runtime: Next.js API routes on Vercel (scheduled by Supabase pg_cron + pg_net, per CLAUDE.md) for daily/hourly jobs; **Python stays for backtests** (long-running, numpy-friendly) run locally or on the droplet, writing results to Supabase. Dashboard: new `/admin/dashboard/desk` tab, reusing existing panels where possible.

---

## 3. Historical data storage

**Principle: every row carries `observed_at`.** Nothing is ever "the value on date X"; it is "the value for date X as we saw it at observed_at." This is the only defence against DeFiLlama's retroactive revisions and against survivorship.

### New tables
| Table | Key | Purpose |
|---|---|---|
| `md_candles` | (venue, symbol, interval, bar_time) | Unified OHLCV. Backfilled from `kr_deep_candles` (2021→), Coinbase, CoinGecko daily; forward-filled by cron. Intervals: 1h, 4h, 1d (1m/5m/15m only forward from today, only for live names). `is_complete` flag; **consumers must filter `is_complete = true`**. |
| `fund_snapshots_daily` | (snapshot_date, llama_slug) | Daily pull of free DeFiLlama: TVL, fees, revenue, holders revenue, DEX vol, OI, stablecoin supply per chain, treasury. Plus `observed_at`. Point-in-time from day one. |
| `fund_backfill` | (as above) | One-time pull of historical series, tagged `vintage = 'backfill-2026-10'`. **Indicative only** — never used as evidence in a backtest claiming point-in-time validity. |
| `token_map` | llama_slug → gecko_id → venue symbols | Join key. Child→parent protocol resolution (gecko_id lives on parent). |
| `universe_history` | (venue, symbol, listed_at, delisted_at) | Who was tradeable when. Seeded from `kr_deep_candles` first/last bars + Robinhood list + Webot list when confirmed. Backtests select universe **as of bar date**. |
| `features_daily` | (symbol, date) | Computed features (§4). Recomputed, never hand-edited. |
| `regimes_daily` | (symbol, date) | Regime label + probabilities + inputs. BTC, ETH, alt-index, each candidate. |

### Sources
- **Market:** `kr_*` lake (primary, Kraken), Coinbase (delisted pairs — already used in `backtest_audit.py`), CoinGecko (breadth, market cap), Pionex klines (live venue price only). Robinhood bid/ask for live execution price.
- **Fundamentals:** DeFiLlama free tier. Pro ($300/mo) behind `DEFILLAMA_API_KEY` flag, **not purchased** until backtests show fundamental features add out-of-sample edge. Paywalled items we live without initially: perps volume, unlocks, bridges, raises, categories, token liquidity. Unlocks sourced from CoinGecko/Tokenomist free pages if needed.

### Known data caveats (recorded here so no one "discovers" them later)
- DeFiLlama rewrites history when adapters change; `listedAt` missing for ~20% and absent before Oct 2021; fees series start = backfill start, not launch.
- `kr_*` collector code is external — treat as a dependency with a heartbeat check, not something we can fix.
- Pionex klines capped at 10k candles; irrelevant for history.

---

## 4. Feature layer (shared by all engines)

Computed once daily per symbol, on **completed bars only**, into `features_daily`:

- Price/vol: returns 1/7/30/90d, realized vol 20/60d, vol percentile (1y), ATR, Bollinger width percentile (compression), distance to 20/50/200d high, SMA20/50/200 slopes, drawdown from ATH.
- Relative strength: vs BTC, vs ETH, vs alt-index (equal-weight top-50 ex-BTC/ETH), 7/30/90d.
- Volume: 7d/30d ratio, volume-before-price flag (volume z-score > 2 while |return| < 1σ), dollar volume, turnover (vol/mcap).
- Microstructure (where `kr_book` exists): spread bps, depth, slippage for $1k/$10k.
- Fundamentals Δ (where mapped): TVL, fees, revenue, holders revenue, DEX vol, OI, stablecoin supply — 24h/7d/30d/90d/180d/1y, each tagged **accelerating / stable / decelerating / collapsing** by comparing 30d slope to 90d slope.
- Structural: market cap bucket, FDV/mcap ratio (dilution overhang), listing age, venue availability flags (robinhood, webot_us, coinbase).

---

## 5. Market regime engine

One definition, one place (`lib/desk/regime.ts`), replacing the three divergent copies. Statistical, not visual.

Labels: RANGE, LOW_VOL, HIGH_VOL, ACCUMULATION, BREAKOUT, UPTREND, PARABOLIC, DISTRIBUTION, DOWNTREND, BREAKDOWN, CAPITULATION, RECOVERY, UNKNOWN.

Inputs: trend (price vs SMA50/200, slope sign), vol regime (20d vol percentile), range test (ADX-like efficiency ratio / Hurst proxy), drawdown from 1y high, 20d breakout/breakdown flags, volume confirmation. Output = label **plus per-label probability** and the raw inputs, so the router can act on confidence, not just the label.

Hard rule: inputs use **last completed bar** only. Partial-bar bug class (§0 #3) is eliminated structurally by reading `md_candles where is_complete`.

Validation: regime labels are only useful if they predict forward return/vol distributions. Test: does 20d forward return distribution differ materially across labels, out of sample? If not, the label is noise and gets merged.

---

## 6. 5x discovery engine

Two halves, strictly separated:

**6a. Historical study (research, Python).** Universe = everything in `universe_history` 2021→ (including dead coins — survivorship killer). Find every 90d window with ≥5× from trough. For each, record features at T-90/60/30/7/0/+30 **from `features_daily` computed as of those dates**. Compare against matched non-movers (same mcap bucket, same BTC regime). Output: which features had lift *before* the move, with base rates. If base rates are near-random after costs, say so and park the engine.

**6b. Live scanner (daily cron).** Scores current universe on the features 6a validated. Output per coin: ASYMMETRY_CASE (text, from data), RISKS, CONFIDENCE (calibrated to 6a base rates, not vibes). Writes `watchlist_5x`. Never says "will run"; says "P(≥3× in 180d) ≈ X% vs base Y%."

Anti-hype gate: scanner must find at least one *negative* (dilution, declining revenue, venue illiquidity, correlation to a sector already extended) per candidate or it flags the entry as INSUFFICIENT_EVIDENCE.

---

## 7. Accumulation engine

Classification: NO_INTEREST → WATCH → EARLY_ACCUMULATION → STRONG_ACCUMULATION → BREAKOUT → TREND_CONFIRMED.

Score components (each 0–1, weights fitted in backtest, not hand-set): fundamentals accelerating; price basing (low vol percentile + flat SMA50 + higher lows); volume-before-price; RS vs alt-index > 0; dilution low (FDV/mcap < 1.5, no major unlock in 60d where known); liquidity adequate (slippage for intended size < 0.5%); BTC regime not DOWNTREND/BREAKDOWN; compression (BB width < 20th pct); breakout proximity (< 10% from 50d high).

Explicit rule: **falling price alone adds zero.** Price-down + fundamentals-down = NO_INTEREST, flagged "value trap pattern."

Sizing ladder: EARLY = 1 tranche, STRONG = up to 3 tranches, BREAKOUT = complete to target weight — tranche size from portfolio risk gate (§9), not fixed dollars. Replaces the hard-coded $50 / 15% sleeve in `desk-timing.ts` with a parameter table.

---

## 8. Grid optimizer + let-winners-run

### Grid optimizer
Inputs: candle history, **fee tier (maker/taker, venue)**, spread, intended capital. Searches lower/upper range, grid count, arithmetic vs geometric, stop/take-profit, over regime-conditioned windows. Reports **total return including inventory mark-to-market** — never "grid profit" alone — and compares against buy-and-hold and cash over the same window. Must be able to output `GRID_NOT_VIABLE` (fees > expected per-grid edge, or regime ≠ RANGE/LOW_VOL).

Pionex `aiStrategy` recommendations are pulled (if API available) and backtested as **one more candidate** in the search, never adopted by default.

### Let-winners-run (range→trend transition)
Daily, for every active grid: compute regime; if transition to BREAKOUT/UPTREND with confidence > threshold and volume confirmation, recommend STOP_GRID + HOLD_INVENTORY + TRAILING_EXIT (ATR-multiple or 20d-low trail). The asset is reclassified GRID_ASSET → POTENTIAL_RUNNER and handed to the accumulation/trend path. Backtest question: across 2021-26, did "stop grid on trend detection" beat "let the grid sell into the trend" net of whipsaws? The answer decides the threshold, and might be "no."

---

## 8b. Distribution & exit engine — "the bot for the way down"

Spot-only means this engine cannot make dollars from a fall. It makes money by **not giving back gains** and by **owning more coins after the drawdown than before**. Four components, all backtested separately:

1. **Distribution exit (sell into strength).** Trigger: regime PARABOLIC or DISTRIBUTION with confidence above threshold — e.g. price > 2.5× ATR above SMA50, 30d return in top 5% of history, volume climax, RS vs BTC rolling over, funding/OI blow-off where `kr_funding`/`kr_market_stats` cover the name. Action: tranche sells (25/25/25/25) into strength, remainder on trailing stop. This is the mirror of the accumulation ladder and is the component that decides whether a 5x is kept.
2. **Trend-break exit (go to cash).** Trigger: BTC regime → DOWNTREND/BREAKDOWN (weekly close < SMA50w, or daily close < SMA200 with falling slope), or asset breaks 20d low on volume. Action: growth account to cash floor per milestone table, keep reserve BTC untouched. Cash is a position; the tournament scores CASH against every alternative.
3. **Spot reverse grid (accumulate coins on the way down).** For assets we intend to own through the cycle (BTC first, ETH candidate): sell inventory on rallies inside a falling range, buy back lower, ending the drawdown with more coins per dollar. Fee-sensitive — same `GRID_NOT_VIABLE` gate as §8. Never applied to alts we don't want to hold.
4. **Capitulation re-entry (the dip half).** Trigger: drawdown from ATH > threshold, volume climax, RS vs BTC turning up, **fundamentals intact or accelerating** (`features_daily`), BTC regime CAPITULATION/RECOVERY. Action: ladder back in with the accumulation engine's tranche sizing. **Hard invalidation:** price down + fundamentals decelerating/collapsing = NO_INTEREST ("dying coin, not a dip"). Falling price alone never adds score.

Backtest questions this engine must answer before it drives anything: across 2021-22 and every ≥30% alt drawdown since, did (1)+(2) preserve more capital than hold, net of fees and whipsaw re-entries? Did (4) pick recoveries at better than base rate, excluding coins that never recovered (survivorship — the universe includes the dead ones)?

## 9. Strategy router + portfolio risk

Router: `(regime, asset_class, venue_fees, portfolio_state) → ranked strategies with EV estimates`. Initial table matches the brief (RANGE→grid if net > cash; ACCUMULATION→build; BREAKOUT→add on confirm; UPTREND→hold; PARABOLIC→harvest; DISTRIBUTION→reduce; DOWNTREND→cash; CAPITULATION→watch for re-entry). It is **data, not code** (a `router_rules` table with version), so the tournament can swap it and backtests can test routing vs. a single-strategy baseline.

Portfolio risk gate (hard limits, enforced before any recommendation is emitted):
- Max portfolio heat (sum of distance-to-stop × size) ≤ X% of growth capital.
- Correlation-adjusted exposure: alts treated as one bet with BTC beta; cap on effective BTC-beta exposure.
- Concentration: single name ≤ 10% growth capital (exists in `desk-timing.ts`), single sector ≤ 25%.
- Cash floor by milestone (below).

Milestone ladder (starting proposal — to be stress-tested, numbers are the hypothesis):

| Growth capital | Max heat | Max single alt | Min cash | BTC sweep of realized profit |
|---|---|---|---|---|
| < $10k | 15% | 10% | 5% | 10% |
| $10k–25k | 12% | 10% | 10% | 15% |
| $25k–50k | 10% | 8% | 15% | 20% |
| $50k–100k | 8% | 7% | 20% | 25% |
| $100k–250k | 7% | 6% | 25% | 30% |
| $250k–500k | 6% | 5% | 30% | 35% |
| $500k–1M | 5% | 4% | 35% | 40% |

Transition from capital creation → preservation is this table, not a mood.

---

## 10. BTC reserve + profit sweep

Tables: `btc_reserve_ledger` (buys, source = sweep/deposit, cost basis, sats), `btc_reserve_state` view (owned, target 5, progress %, cost basis, USD value).

Sweep policy is a **parameter** because the right answer is empirical. Three candidates are tested head-to-head:
- **H-SWEEP-A (Jacob's rule):** realized alt profit → BTC-earmarked stable bucket; convert to BTC only on days F&G ≤ 25 (Extreme Fear). Risk to test: long stretches with no trigger (most of 2024-25) while BTC rises; first extreme-fear print is rarely the low (2022 ran for months).
- **H-SWEEP-B (fixed):** `sweep_pct` of realized profit → BTC immediately, per milestone row.
- **H-SWEEP-C (hybrid):** floor % always, multiplier rising with fear (e.g. 1× at F&G 50, 2× at 35, 4× at ≤25), plus a time cap — if the bucket has waited > N days, release a tranche regardless. Backtest: simulate 2021-26 growth-account equity paths (from tournament winners) under 5/10/20/25/50% and dynamic (by portfolio size, by BTC drawdown-from-ATH) sweeps. Metric: P(reach 5 BTC within N years) vs. growth-account terminal value. Monte Carlo on resampled returns, not just the one historical path.

Hard rules: reserve BTC is never an input to any sizing or sell logic. Any strategy output that implies selling reserve BTC writes a `HUMAN_REVIEW_REQUIRED` flag and stops.

---

## 11. Backtesting framework

Promote `backtest_audit.py`'s discipline into a shared Python package (`desk-loop/bt/`):

- **Data access object** that only serves bars with `bar_time < as_of` and universe members with `listed_at ≤ as_of < delisted_at`. Look-ahead becomes a type error, not a code-review item.
- **Fills:** signal on completed bar → entry at next bar open, with venue-specific fee (maker/taker), spread, and size-dependent slippage from `kr_book` where available (else conservative constant).
- **Stops:** check entry bar's own low (fixes the minor optimism noted in audit).
- **Walk-forward:** rolling fit/test windows, not one split. Parameter sensitivity: report metric surface ±20% on each parameter; reject if edge collapses.
- **Monte Carlo:** block-bootstrap of trade sequence and of return series; report 5th-percentile drawdown.
- **Robustness report:** result excluding top 1/3/5 winners, per-regime breakdown, per-coin breakdown, per-year breakdown.
- Every run writes to `research_runs` (config hash, universe snapshot id, data vintage, metrics, verdict). The research DB from the brief *is* this table plus `strategy_tournament` and `missed_opportunities`.

Anti-overfitting gate (automated, applied to every run): REJECT if edge exists on < 3 coins, or in only one calendar year, or disappears at +25% fees, or Sharpe drops > 50% when top 3 winners removed, or parameter surface is a spike.

### Look-ahead & survivorship risk register
| Risk | Where it bites | Mitigation |
|---|---|---|
| Partial bar in SMA/regime | existing comp-trader, breakout_scan | `is_complete` filter, DAO enforces `bar_time < as_of` |
| Same-bar fills | backtest.py, backtest_house.py | next-open fills only |
| Index-aligned RS | backtest.py:72 | timestamp joins only |
| Universe = today's list | all but backtest_audit | `universe_history`, delisted pairs included |
| DeFiLlama revisions | any fundamental backtest | `observed_at` vintages; backfill tagged indicative |
| Protocols listed late with backfilled history | 5x study | require `listedAt ≤ as_of` or mark unknown |
| Intraday RS vs completed-close breakout | timing route | single clock: completed bars |
| Hard-coded dates/offsets | timing route | config table, tz-aware |
| Pionex AI params fitted on same window we test | grid optimizer | treat as candidate, test OOS |

---

## 12. Recommendation card (every emitted recommendation)

`recommendations` table, one row = one card, status DRAFT → APPROVED → EXECUTED / REJECTED / EXPIRED. Fields, all mandatory: pair, current price, strategy, capital, entry plan, accumulation plan, take-profit plan, exit/invalidation, expected upside, expected downside, max acceptable loss, asset regime, BTC regime, liquidity (slippage est.), volume, fundamentals summary, why now, why this coin, why this strategy, what would make us wrong, historical analogues (from 6a), backtest result id, OOS result id, confidence (calibrated). A card with any null field cannot leave DRAFT.

Execution: APPROVED cards go to the Broker interface. `robinhood` broker reuses `fund/buy` after fixing §0 #6 (header-only secret, server-side sizing). `manual` broker renders Webot parameters for you to enter. No cron ever executes.

---

## 12b. Always-on loop and the automation ladder

**An LLM chat session is not a 24/7 process.** The always-on component is code: a scheduled loop (Supabase pg_cron → Vercel routes for hourly/daily work; the `desk-loop` droplet pattern for sub-hourly watching). The loop computes signals and rules deterministically and **calls an LLM (Claude via API, ChatGPT via API) only for judgment calls** — ambiguous regime transitions, thesis review, catalyst interpretation. The LLM returns a structured decision; code validates it against the risk gate and executes. The LLM never holds exchange keys.

Both AIs connect through the desk, not to the exchange: one broker integration per venue in `lib/brokers/`, one audit log, one kill switch (`desk_config.loop_enabled`), trade-only API keys with IP allow-list.

Automation ladder — each level requires the previous level's evidence:

| Level | Autonomous scope | Entry condition |
|---|---|---|
| 0 | None. Cards emitted, human approves every order | Phases 0–9 |
| 1 | Paper trading, fully autonomous, 60–90 days | Phase 10 |
| 2 | Live, hard-capped: per-trade ≤ $X, ≤ Y% growth capital per name, protective stop on every entry, daily loss limit halts the loop, exits automated first | Paper hit-rate and drawdown within backtest CI |
| 3 | Caps raised per milestone table; entries automated | ≥ 90 days live at level 2 with no limit breaches |

Non-negotiable at every level: kill switch, trade-only keys, position limits enforced in code (not in the prompt), full decision log (`agent_decisions`: inputs, model, output, action, outcome). A reserve-BTC sell can never be automated at any level.

**News trading.** Fast headline reaction is treated as a hypothesis expected to fail after fees and latency: by the time a pipeline reads, reasons and orders, the spike is priced. Slow catalysts (CEX listings, unlock schedules, regulatory rulings, protocol upgrades) play out over days and are tracked as catalyst features in `features_daily`. Both are tested in the tournament; neither is assumed.

## 13. Daily question job

One cron (`/api/cron/desk-daily`, after candles close UTC) answers the 13 daily questions into `desk_daily_brief` and the dashboard: regime per BTC/ETH/alts; material changes; new 5x candidates; volume-before-price names; accelerating fundamentals; grids to continue / stop (trend transition); positions to accumulate / leave alone / deteriorating; sweep due; portfolio heat vs limit; progress to $1M + 5 BTC.

---

## 14. Dashboard

New `/admin/dashboard/desk`: NORTH STAR strip (growth $ / $1M, BTC / 5, combined, %), MARKET strip (BTC/ETH/alt regime + risk), 5X WATCHLIST table, ACTIVE STRATEGIES table (incl. grids with inventory-inclusive P&L), DAILY BRIEF, pending RECOMMENDATION cards with approve/reject. Reuses `perf-chart.tsx`, `comp-panel.tsx` patterns. LEVERAGE tab stays as research.

---

## 15. Build order (proposed)

Each phase ends with a measurable gate. Nothing in phase N+1 starts if phase N's gate fails.

| Phase | Scope | Gate |
|---|---|---|
| **0. Hygiene** (1–2 days) | Fix §0 bugs 1,3,4,5,6,8; reconcile pg_cron reality vs CLAUDE.md; droplet heartbeat alert | `npm run build` clean; cron inventory accurate |
| **1. Data foundation** | `md_candles` backfill from kr_/Coinbase; `universe_history`; `fund_snapshots_daily` cron (DeFiLlama free); `token_map`; `features_daily` | ≥ 3y daily + 1y hourly for ≥ 100 names incl. delisted; snapshot cron writing daily |
| **2. Backtest framework** | `desk-loop/bt/` package, DAO with as_of enforcement, `research_runs`, anti-overfit gate; re-run existing breakout rule as first test | Existing breakout rule reproduced; look-ahead unit test fails when as_of violated |
| **3. Regime engine** | Single implementation, probabilities, validation study | Forward-return distributions differ OOS across retained labels |
| **4. Tournament baseline** | Buy&hold, DCA, cash, trend, breakout, mean-reversion, grid (fee-aware) across 2021-26, per regime | Ranked table with robustness report; we know what beats what, and where |
| **5. Accumulation / dip engine** | Fitted weights; tranche ladder; capitulation re-entry with fundamentals invalidation | Dip entries beat base-rate recovery OOS, dead coins included in universe |
| **6. Distribution & exit engine** | Sell-into-strength tranches; trend-break to cash; spot reverse grid on BTC; let-winners-run range→trend handoff | Capital preserved vs hold across 2021-22 and every ≥30% alt drawdown since, net of whipsaw |
| **7. 5x study + scanner** | Historical 5× feature study; live scanner with calibrated confidence | Features show lift vs matched controls, or engine parked with the evidence |
| **8. Router + risk gate + BTC sweep** | `router_rules`; milestone table; routing-vs-single-strategy backtest; sweep % simulation + Monte Carlo | Routing beats best single strategy OOS; chosen sweep policy with P(5 BTC) curve |
| **8b. Grid optimizer (optional)** | Fee-tier-aware optimizer; Pionex `aiStrategy` as candidate; Webot vs self-run Kraken grid | Only built if phase 4 shows grid beats cash in RANGE at real fees; else parked |
| **9. Recommendation cards + dashboard + daily brief** | Tables, cron, `/desk` tab, Broker interface (`manual` + hardened `robinhood`) | First daily brief lands; first card approved by you by hand |
| **10. Paper trading** | 60–90 days of cards vs. outcomes in `kr_paper_positions`-style ledger | Live hit-rate within backtest confidence interval before any sizing increase |

Pionex Bot API integration is **not** in the first 10 phases. It enters only after you confirm Webot US API access and phase 8b says grids are viable.

---

## 16. Decisions needed from you

1. **Approve the build order** or reorder. My recommendation is exactly as listed: data + backtest rigor first, engines second, dashboard third.
2. **Venue:** confirm Kraken Pro as primary (alt book + BTC reserve), Coinbase Advanced as secondary. Robinhood goes legacy. Webot dropped.
3. **Capital scope today:** what is the growth-account starting balance and current BTC owned? Needed to seed `btc_reserve_state` and pick the milestone row. (Numbers only — no account details in chat.)
4. **Collector ownership:** who runs the `kr_*` collector? If it's a droplet you control, I want its repo path (or a copy in this repo) so it's a maintained dependency rather than a black box.
5. **DeFiLlama:** free tier confirmed. Re-evaluate after phase 6.

What I will NOT do without explicit instruction: delete any `comp_*`, `fund_*`, `desk_*`, or `kr_*` table; touch `fund/buy` beyond the security fixes in §0 #6; schedule anything that places orders.
