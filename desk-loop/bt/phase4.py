"""Phase 4 strategy tournament — docs/desk/PHASE4-PREREGISTRATION.md v2, FROZEN. Everything a verdict depends on is a
constant in this file: candidates and grids (§5), the three cost sets (§2), sizing and its two sensitivities (§3),
walk-forward windows (§4), the delisting stress cells (§7.7), the advancement rule (§7). Nothing here is read from a
result, and nothing is written to research_runs by this module (§8: not before independent review)."""
import os, subprocess
from bt_costs import CostModel, scaled
from . import research, strategies, universe as universe_mod, regime as regime_mod
from .engine import run
from .metrics import summarize

FILL_RULE = "decision at completed daily close; fill next bar OPEN + taker cost + half-spread + slippage; stop before target on the same bar; gap -> open"
LIMITATION = ("History venue: Coinbase daily bars (data_hash in manifest). Execution venue: Kraken. A candidate's research acceptance on "
              "Coinbase bars never equals broker approval; Phase 10 requires reproduction on Kraken paper-market data.")

# §2 — cost sets. Engine fills are taker; maker is recorded for provenance only.
COST_CANONICAL = CostModel(0.0025, 0.0040, "kraken", "Kraken Pro starter tier taker 0.40% — ASSUMED until the live account tier is read before any paper trade (R-A); +0.05% half-spread +0.05% slippage = 0.50%/side",
                           spread=0.0005, slippage=0.0005, note="canonical; history Coinbase, execution Kraken")
COST_STRESS = scaled(COST_CANONICAL, 1.25)                                  # 0.625%/side: full-sample and OOS (R-O)
COST_SEVERE = CostModel(0.0095, 0.0095, "coinbase-daily", "legacy blended COST_SIDE 0.95% per side (backtest_house.py) — severe sensitivity, never a verdict input")
COSTS = {"canonical": COST_CANONICAL, "stress": COST_STRESS, "severe": COST_SEVERE}
FEE_STRESS = 1.25

# §3 — sizing
SIZING = {"max_positions": 10, "gross_cap": 1.0}
SIZING_SENSITIVITIES = (0.95, 0.90)
START_CASH = 10_000.0
SCALE_CASH = 100_000.0

# §4 — windows
FIT_DAYS, TEST_DAYS = 365, 90
SELECT = "sharpe"

# §5 — candidates (grid <= 4 points each). Roles: candidate | negative_control | benchmark.
CANDIDATES = {
    "sma_trend": {"role": "candidate", "grid": [{"fast": 20, "slow": 100}, {"fast": 50, "slow": 200}]},
    "momentum_top": {"role": "candidate", "grid": [{"lookback": 60, "n": 5}, {"lookback": 60, "n": 10}, {"lookback": 90, "n": 5}, {"lookback": 90, "n": 10}]},
    "mean_reversion": {"role": "candidate", "grid": [{"dip": 0.08, "n": 20}, {"dip": 0.08, "n": 30}, {"dip": 0.10, "n": 20}, {"dip": 0.10, "n": 30}]},
    "breakout20": {"role": "negative_control", "grid": [{}]},
}
BENCHMARKS = ("buy_and_hold_btc", "cash")
MIN_OOS_TRADES = 100

# §7.7 — delisting stress (R-K floor x R-J haircut). Cells always reported: canonical, mild, tail; the full 3x3 grid when exposure is material.
DELISTING_FLOOR_USD = 50_000
DELISTING_CELLS = {"canonical": {"mult": 10, "haircut": 0.50}, "mild": {"mult": 5, "haircut": 0.25}, "tail": {"mult": 20, "haircut": 1.00}}
DELISTING_GRID = [(m, h) for m in (5, 10, 20) for h in (0.25, 0.50, 1.00)]
DELISTING_MATERIALITY = 0.10


def delisting_cfg(mult, haircut):
    return {"mult": mult, "floor_usd": DELISTING_FLOOR_USD, "haircut": haircut}


def make_factory(name):
    """Strategy factory on the DYNAMIC universe (symbols=None => view.universe() plus held names)."""
    base = strategies.REGISTRY[name]
    return lambda **kw: base(**kw)


def _code_sha():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return None


def _short(m, keys=("total_return", "max_drawdown", "sharpe", "trades", "profit_factor", "win_rate", "avg_trade_ret")):
    return {k: m.get(k) for k in keys} if m and "error" not in m else m


def most_chosen(picks, grid):
    """Parameter set chosen in the most folds (ties: grid order). Used only for the full-sample robustness surface."""
    counts = {i: 0 for i in range(len(grid))}
    for p in picks:
        for i, g in enumerate(grid):
            if g == p["params"]:
                counts[i] += 1; break
    return grid[max(counts, key=lambda i: (counts[i], -i))] if grid else {}


def run_candidate(market, name, uni, regime_series=None, fit_days=FIT_DAYS, test_days=TEST_DAYS, sizing=None, start_cash=START_CASH, data_vintage=None, mc_n=500):
    """The whole per-candidate report of §8. Verdict inputs: the continuous OOS run under canonical costs and sizing."""
    spec = CANDIDATES[name]; grid = spec["grid"]; sizing = dict(sizing or SIZING)
    make = make_factory(name)
    wf = research.walk_forward(market, make, grid, COST_CANONICAL, fit_days, test_days, select=SELECT, sizing=sizing, fee_stress=FEE_STRESS, universe=uni)
    picks = wf["folds"]
    cont = research.continuous_oos(market, make, picks, COST_CANONICAL, sizing, uni, start_cash=start_cash)
    if cont is None:
        return {"strategy": name, "role": spec["role"], "error": "no folds", "verdict": "inconclusive"}
    cont_m = summarize(cont)
    cost_sens = {}
    for label, c in (("stress", COST_STRESS), ("severe", COST_SEVERE)):
        cost_sens[label] = _short(summarize(research.continuous_oos(market, make, picks, c, sizing, uni, start_cash=start_cash)))
    sizing_sens = {}
    for gc in SIZING_SENSITIVITIES:
        r = research.continuous_oos(market, make, picks, COST_CANONICAL, {**sizing, "gross_cap": gc}, uni, start_cash=start_cash)
        sizing_sens[f"gross_cap={gc}"] = {**_short(summarize(r)), "no_fill_reasons": r["no_fill_reasons"]}
    scale = research.scale_invariance(market, make, picks, COST_CANONICAL, sizing, uni, cash_a=start_cash, cash_b=SCALE_CASH)
    thirds = research.chronological_thirds(cont["equity"])
    exposure = research.delisting_exposure(cont["trades"], market.listings, DELISTING_MATERIALITY)
    cells = {}
    for label, cell in DELISTING_CELLS.items():
        r = research.continuous_oos(market, make, picks, COST_CANONICAL, sizing, uni, start_cash=start_cash, delisting=delisting_cfg(**cell))
        cells[label] = {**_short(summarize(r)), **cell, "floor_usd": DELISTING_FLOOR_USD, "delisting_exits": sum(1 for tr in r["trades"] if tr.reason.startswith("delisted"))}
    grid_cells = None
    if exposure["material"]:
        grid_cells = {}
        for m, h in DELISTING_GRID:
            r = research.continuous_oos(market, make, picks, COST_CANONICAL, sizing, uni, start_cash=start_cash, delisting=delisting_cfg(m, h))
            grid_cells[f"mult={m},haircut={h}"] = _short(summarize(r), ("total_return", "max_drawdown", "trades"))
    delisting = {**exposure, "cells": cells, "grid": grid_cells}
    regime_block = research.regime_attribution(cont, regime_series) if regime_series is not None else None
    params = most_chosen(picks, grid)
    rob = research.robustness(market, make, params, COST_CANONICAL, sizing=sizing, universe=uni)
    mc = research.monte_carlo(cont, n=mc_n)
    trials = wf["trials"] if spec["role"] == "candidate" else None       # the negative control never enters trial accounting (§5)
    gate = research.gate(cont_m, rob, trials, oos_stress=summarize(research.continuous_oos(market, make, picks, COST_STRESS, sizing, uni, start_cash=start_cash)))
    adv = research.advancement(gate, cont_m, cost_sens["stress"], scale, thirds, delisting, wf["boundary"], MIN_OOS_TRADES)
    if spec["role"] != "candidate":
        adv = {**adv, "verdict": "control: not evaluated", "research_accepted": False, "note": "negative control — its numbers never enter selection, thresholds or trial accounting (§5, §9)"}
    man = research.manifest(name, params, market, COST_CANONICAL, FILL_RULE, picks, {"monte_carlo": 7}, {"continuous_oos": cont_m, "chained_oos_selection_evidence": wf["oos"], "chained_oos_fee_stress": wf["oos_fee_stress"], "monte_carlo": mc},
                            rob, gate, code_sha=_code_sha(), data_vintage=data_vintage, sizing=cont["sizing"],
                            regime={"applied": False, "per_state": regime_block, **({k: regime_series.manifest(market)[k] for k in ("band", "vol_pct", "pct_time", "transitions_count", "first_label_t")} if regime_series is not None else {})},
                            extra={"phase": 4, "role": spec["role"], "grid": grid, "trial_count": trials, "limitation": LIMITATION,
                                   "costs_all": {k: c.as_record() for k, c in COSTS.items()}, "cost_sensitivities": cost_sens, "sizing_sensitivities": sizing_sens,
                                   "scale_invariance": scale, "chronological_thirds": thirds, "boundary": wf["boundary"], "delisting": delisting,
                                   "universe_membership_hash": uni.membership_hash(), "param_switches": cont["param_switches"], "no_fill_reasons": cont["no_fill_reasons"],
                                   "pnl_by_year": cont_m.get("pnl_by_year"), "pnl_by_symbol": cont_m.get("pnl_by_symbol"), "advancement": adv})
    man["verdict"] = adv["verdict"]
    return man


def run_benchmarks(market, picks_span, start_cash=START_CASH):
    """§5 #5 on the same OOS span as the candidates' continuous run. buy_and_hold(BTC): one slot = the whole book."""
    a, b = picks_span
    out = {}
    r = run(market, strategies.buy_and_hold(["BTC"]), COST_CANONICAL, start_cash=start_cash, start_t=a, end_t=b, max_positions=1, gross_cap=1.0)
    out["buy_and_hold_btc"] = {**_short(summarize(r)), "sizing": r["sizing"]}
    r = run(market, strategies.cash(), COST_CANONICAL, start_cash=start_cash, start_t=a, end_t=b, **SIZING)
    out["cash"] = _short(summarize(r))
    return out


def run_table(market, names=None, fit_days=FIT_DAYS, test_days=TEST_DAYS, data_vintage=None, with_regime=True, mc_n=500, log=print):
    """The full pre-registered table once. Returns everything needed for the report; writes nothing anywhere."""
    uni = universe_mod.monthly_top_volume(market)
    log(f"universe: {uni.manifest()['months']} monthly rankings, {uni.manifest()['distinct_members']} distinct members, hash {uni.membership_hash()}")
    series = regime_mod.compute_series(market) if with_regime else None
    if series is not None:
        log(f"regime: {series.summary()}")
    out = {"phase": 4, "data_hash": market.fingerprint(), "universe_hash": market.universe_fingerprint(), "data_vintage": data_vintage, "limitation": LIMITATION,
           "universe": uni.manifest(), "regime": series.manifest(market) if series is not None else None, "costs": {k: c.as_record() for k, c in COSTS.items()},
           "sizing": SIZING, "sizing_sensitivities": SIZING_SENSITIVITIES, "windows": {"fit_days": fit_days, "test_days": test_days, "select": SELECT},
           "candidates": {}, "benchmarks": None, "trials_total": 0}
    span = None
    for name in (names or list(CANDIDATES)):
        log(f"candidate {name} ({CANDIDATES[name]['role']}) ...")
        man = run_candidate(market, name, uni, series, fit_days, test_days, data_vintage=data_vintage, mc_n=mc_n)
        out["candidates"][name] = man
        if CANDIDATES[name]["role"] == "candidate" and man.get("trial_count"):
            out["trials_total"] += man["trial_count"]
        if span is None and man.get("folds"):
            span = (man["folds"][0]["test"][0], man["folds"][-1]["test"][1])
        log(f"  verdict {man.get('verdict')}  oos {_short(man.get('metrics', {}).get('continuous_oos'))}")
    if span:
        out["benchmarks"] = run_benchmarks(market, span)
        out["oos_span"] = span
    return out


def render_table(table):
    """Markdown summary for the results doc; the JSON is the record."""
    f = lambda v, p=True: ("—" if v is None else (f"{v * 100:+.1f}%" if p else f"{v:.2f}")) if isinstance(v, (int, float)) else str(v)
    lines = [f"data_hash `{table['data_hash']}` · universe_hash `{table['universe_hash']}` · membership_hash `{table['universe']['membership_hash']}` · trials (candidates 1–3) {table['trials_total']}", "",
             "| strategy | role | verdict | OOS return (continuous) | max DD | trades | PF | ×1.25 | severe 0.95% | gc 0.95 | gc 0.90 | thirds + | boundary eod (interior) | delist share (trades / P&L) | canonical delist |",
             "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
    for name, m in table["candidates"].items():
        if "error" in m:
            lines.append(f"| {name} | {m.get('role')} | {m.get('verdict')} | {m['error']} |" + " |" * 11); continue
        c = m["metrics"]["continuous_oos"]; cs = m["cost_sensitivities"]; ss = m["sizing_sensitivities"]; d = m["delisting"]
        lines.append(f"| {name} | {m['role']} | {m['verdict']} | {f(c.get('total_return'))} | {f(c.get('max_drawdown'))} | {c.get('trades')} | {f(c.get('profit_factor'), False)} | "
                     f"{f(cs['stress'].get('total_return'))} | {f(cs['severe'].get('total_return'))} | {f(ss['gross_cap=0.95'].get('total_return'))} | {f(ss['gross_cap=0.9'].get('total_return'))} | "
                     f"{m['chronological_thirds']['positive']}/3 | {m['boundary']['eod_exits_interior']} | {f(d['trade_share'])} / {f(d['pnl_abs_share'])} | {f(d['cells']['canonical'].get('total_return'))} |")
    if table.get("benchmarks"):
        for k, v in table["benchmarks"].items():
            lines.append(f"| {k} | benchmark | — | {f(v.get('total_return'))} | {f(v.get('max_drawdown'))} | {v.get('trades')} | {f(v.get('profit_factor'), False)} |" + " —|" * 8)
    lines += ["", f"Limitation: {table['limitation']}"]
    return "\n".join(lines)
