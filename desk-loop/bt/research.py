"""Walk-forward, robustness, Monte Carlo, the anti-overfit gate, and the run manifest."""
import dataclasses, hashlib, json, random, statistics as st, time
from bt_costs import scaled
from .engine import run
from .metrics import summarize
from . import regime as regime_mod


def folds(start_t, end_t, fit_days, test_days, step_days=None):
    """Rolling (fit_start, fit_end, test_start, test_end) windows; test windows never overlap fit windows."""
    step = (step_days or test_days) * 86400
    out, a = [], start_t
    while a + (fit_days + test_days) * 86400 <= end_t:
        fe = a + fit_days * 86400
        out.append((a, fe, fe, min(fe + test_days * 86400, end_t)))
        a += step
    return out


def walk_forward(market, make_strategy, param_grid, costs, fit_days, test_days, select="sharpe", sizing=None, fee_stress=1.25, regime=None, gate_fn=None, universe=None):
    sizing = sizing or {}
    stressed = scaled(costs, fee_stress)                 # every per-side component x1.25 (Phase 4 §2); identical to the old fee-only stress when spread = slippage = 0
    """For each fold: run every param set on the fit window, pick the best by `select`, run it on the test window.
    Returns per-fold picks and the concatenated out-of-sample trades/metrics. Trial count is recorded (multiple testing).
    Phase 4 (§4): each pick also carries its own fold's OOS metrics and boundary-exit count (`reason == "eod"` at the
    fold end); `boundary` holds the dependency check. The chained curve is selection evidence, not a live portfolio."""
    times = sorted({b.t for s in market.symbols() for b in market.bars[s]})
    fs = folds(times[0], times[-1] + market.bar_seconds, fit_days, test_days)
    picks, oos_equity, oos_trades, trials = [], [], [], 0
    st_equity, st_trades = [], []            # the same OOS procedure under stressed fees (R-O): selection still on base costs
    f_equity, f_trades, fs_equity, fs_trades = [], [], [], []   # Phase 3: regime-filtered twin on the SAME picks and folds (design §8/§10)
    for (a, fe, ts, te) in fs:
        best = None
        for params in param_grid:
            trials += 1
            m = summarize(run(market, make_strategy(**params), costs, start_t=a, end_t=fe, universe=universe, **sizing))
            score = m.get(select) or -1e9
            if best is None or score > best[0]:
                best = (score, params)
        r = run(market, make_strategy(**best[1]), costs, start_t=ts, end_t=te, universe=universe, **sizing)
        fm = summarize(r); eod = [tr for tr in r["trades"] if tr.reason == "eod"]
        picks.append({"fit": (a, fe), "test": (ts, te), "params": best[1], "fit_score": best[0],
                      "oos": {k: fm.get(k) for k in ("total_return", "max_drawdown", "trades", "profit_factor")},
                      "start_cash": r["start_cash"], "final_cash": r["final_cash"], "eod_exits": len(eod), "eod_pnl": sum(tr.pnl for tr in eod)})
        oos_trades += r["trades"]
        # chain equity multiplicatively across folds
        scale = oos_equity[-1][1] / r["equity"][0][1] if oos_equity else 1.0
        oos_equity += [(t, e * scale) for t, e in r["equity"]]
        r2 = run(market, make_strategy(**best[1]), stressed, start_t=ts, end_t=te, universe=universe, **sizing)
        st_trades += r2["trades"]
        scale2 = st_equity[-1][1] / r2["equity"][0][1] if st_equity else 1.0
        st_equity += [(t, e * scale2) for t, e in r2["equity"]]
        if regime is not None:
            gated = (gate_fn or (lambda f: f))(make_strategy(**best[1]))
            r3 = run(market, gated, costs, start_t=ts, end_t=te, regime=regime, universe=universe, **sizing)
            f_trades += r3["trades"]; sc3 = f_equity[-1][1] / r3["equity"][0][1] if f_equity else 1.0
            f_equity += [(t, e * sc3) for t, e in r3["equity"]]
            r4 = run(market, (gate_fn or (lambda f: f))(make_strategy(**best[1])), stressed, start_t=ts, end_t=te, regime=regime, universe=universe, **sizing)
            fs_trades += r4["trades"]; sc4 = fs_equity[-1][1] / r4["equity"][0][1] if fs_equity else 1.0
            fs_equity += [(t, e * sc4) for t, e in r4["equity"]]
    oos = summarize({"equity": oos_equity, "trades": oos_trades}) if oos_equity else {"error": "no folds"}
    oos_stress = summarize({"equity": st_equity, "trades": st_trades}) if st_equity else {"error": "no folds"}
    out = {"folds": picks, "oos": oos, "oos_fee_stress": oos_stress, "fee_stress": fee_stress, "trials": trials, "test_windows": [(ts, te) for (_, _, ts, te) in fs],
           "boundary": boundary_dependency(picks)}
    if regime is not None:
        out["oos_filtered"] = summarize({"equity": f_equity, "trades": f_trades}) if f_equity else {"error": "no folds"}
        out["oos_filtered_fee_stress"] = summarize({"equity": fs_equity, "trades": fs_trades}) if fs_equity else {"error": "no folds"}
        out["regime"] = {"band": regime.band, "vol_pct": regime.vol_pct}
    return out


CORE_CHECKS = ("oos_positive", "survives_fees_x1.25", "survives_fees_x1.25_oos")
NON_CORE_CHECKS = ("symbols>=min", "not_single_year", "not_top3_dependent", "param_surface_smooth")


def overlay_eligible(gate_result):
    """Design §10 / R-Q: a filtered variant may be evaluated only if the UNFILTERED candidate passes every core check
    and misses at most one non-core check. A strategy that loses money unfiltered is never run filtered."""
    c = (gate_result or {}).get("checks", {})
    if not all(c.get(k) is True for k in CORE_CHECKS):
        return False, "fails a core check unfiltered (oos_positive / fee stress)"
    misses = [k for k in NON_CORE_CHECKS if c.get(k) is False]
    return (len(misses) <= 1), (f"non-core misses: {misses}" if misses else "passes")


def overlay_verdict(oos, oos_filtered, min_trades=100, min_trade_ratio=0.5):
    """Design §10 (a)–(e): filtered beats unfiltered only if ALL hold. Returns {"wins": bool, "checks": {...}}."""
    if not oos or not oos_filtered or "error" in oos or "error" in oos_filtered:
        return {"wins": False, "checks": {"evidence": "missing"}}
    pf = lambda m: m.get("profit_factor") if m.get("profit_factor") not in (None, float("inf")) else (float("inf") if m.get("profit_factor") == float("inf") else -1)
    checks = {
        "higher_oos_return": oos_filtered["total_return"] > oos["total_return"],
        "smaller_oos_drawdown": oos_filtered["max_drawdown"] > oos["max_drawdown"],
        "trade_ratio>=0.5": oos_filtered["trades"] >= min_trade_ratio * oos["trades"],
        "trades>=100": oos_filtered["trades"] >= min_trades,
        "exposure_independent_improvement": ((oos_filtered.get("avg_trade_ret") or -1) > (oos.get("avg_trade_ret") or -1)) or (pf(oos_filtered) > pf(oos)),
    }
    return {"wins": all(checks.values()), "checks": checks, "note": None if checks["exposure_independent_improvement"] else "filter wins only by sitting in cash: not evidence"}


def regime_sensitivity(market, make_strategy, params, costs, fit_days, test_days, sizing=None, gate_fn=None, pairs=None):
    """Design §4: the five non-canonical pairs, descriptive only; never used to choose anything."""
    out = {}
    for band, vol_pct in (pairs or regime_mod.PAIRS):
        if (band, vol_pct) == (regime_mod.CANONICAL["band"], regime_mod.CANONICAL["vol_pct"]):
            continue
        series = regime_mod.compute_series(market, band, vol_pct)
        wf = walk_forward(market, make_strategy, [params], costs, fit_days, test_days, sizing=sizing, regime=series, gate_fn=gate_fn)
        out[f"band={band},vol_pct={vol_pct}"] = {k: wf["oos_filtered"].get(k) for k in ("total_return", "max_drawdown", "trades", "profit_factor")} if "error" not in wf["oos_filtered"] else wf["oos_filtered"]
    return out


def robustness(market, make_strategy, params, costs, perturb=0.2, sizing=None, universe=None):
    sizing = sizing or {}
    """Fee stress, parameter neighbourhood, top-winner exclusion — the shape of the metric surface."""
    base = summarize(run(market, make_strategy(**params), costs, universe=universe, **sizing))
    out = {"base": base, "fees_x1.25": None, "fees_x1.5": None, "neighbours": []}
    for k, mult in (("fees_x1.25", 1.25), ("fees_x1.5", 1.5)):
        out[k] = summarize(run(market, make_strategy(**params), scaled(costs, mult), universe=universe, **sizing))
    for key, val in params.items():
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            for f in (1 - perturb, 1 + perturb):
                p2 = dict(params); p2[key] = type(val)(val * f) if isinstance(val, int) else val * f
                try:
                    out["neighbours"].append({"param": key, "value": p2[key], "metrics": summarize(run(market, make_strategy(**p2), costs, universe=universe, **sizing))})
                except Exception as e:
                    out["neighbours"].append({"param": key, "value": p2[key], "error": str(e)})
    return out


def monte_carlo(result, n=500, block=20, seed=7):
    """Block bootstrap of the strategy's daily returns: distribution of terminal multiple and max drawdown."""
    vals = [e for _, e in result["equity"]]
    rets = [vals[i] / vals[i - 1] - 1 for i in range(1, len(vals)) if vals[i - 1] > 0]
    if len(rets) < block * 2:
        return {"error": "too few returns"}
    rng = random.Random(seed)
    terms, mdds = [], []
    for _ in range(n):
        seq, eq, peak, mdd = [], 1.0, 1.0, 0.0
        while len(seq) < len(rets):
            i = rng.randrange(0, len(rets) - block); seq += rets[i:i + block]
        for r in seq[:len(rets)]:
            eq *= 1 + r; peak = max(peak, eq); mdd = min(mdd, eq / peak - 1)
        terms.append(eq); mdds.append(mdd)
    terms.sort(); mdds.sort()
    q = lambda xs, p: xs[int(p * (len(xs) - 1))]
    return {"n": n, "block": block, "seed": seed, "terminal_p05": q(terms, .05), "terminal_p50": q(terms, .5), "terminal_p95": q(terms, .95), "mdd_p05": q(mdds, .05), "mdd_p50": q(mdds, .5)}


def gate(oos, rob, trials, min_symbols=3, oos_stress=None):
    """Anti-overfit rules (architecture §11). Any failing rule rejects; missing evidence is inconclusive.
    Fee stress must survive BOTH the full-sample robustness run and the OOS walk-forward under stressed fees (R-O);
    a missing OOS stress result fails the check, it never passes by omission."""
    checks = {}
    if not oos or "error" in oos:
        return {"verdict": "inconclusive", "checks": {"oos": "missing"}}
    checks["oos_positive"] = oos["total_return"] > 0
    checks["symbols>=min"] = oos.get("symbols_with_profit", 0) >= min_symbols
    yrs = [v for v in oos.get("pnl_by_year", {}).values()]
    checks["not_single_year"] = len(yrs) >= 2 and sum(1 for v in yrs if v > 0) >= 2 if yrs else False
    total_pnl = sum(yrs) if yrs else 0
    full_ok = bool(rob and rob.get("fees_x1.25") and rob["fees_x1.25"]["total_return"] > 0)
    oos_ok = bool(oos_stress and "error" not in oos_stress and oos_stress["total_return"] > 0)
    checks["survives_fees_x1.25"] = full_ok and oos_ok
    checks["survives_fees_x1.25_oos"] = oos_ok
    ex3 = oos.get("pnl_ex_top", {}).get(3)
    checks["not_top3_dependent"] = (ex3 is not None and total_pnl > 0 and ex3 > 0.5 * total_pnl)
    nb = [x["metrics"]["total_return"] for x in (rob or {}).get("neighbours", []) if "metrics" in x]
    checks["param_surface_smooth"] = (len(nb) == 0) or (sum(1 for r in nb if r > 0) >= len(nb) / 2)
    checks["trials_recorded"] = trials is not None
    failed = [k for k, v in checks.items() if v is False]
    return {"verdict": "rejected" if failed else "accepted", "checks": checks, "failed": failed, "trials": trials}


def manifest(strategy, params, market, costs, fill_rule, folds_info, seeds, metrics, rob, gate_result, code_sha=None, data_vintage=None, notes=None, sizing=None, regime=None, extra=None):
    # sizing is part of the config hash: a 90% deployment strategy is economically different from a 100% one (R-H).
    sizing = sizing or {"rule": "slot", "gross_cap": 1.0, "max_positions": 10}
    cfg = {"strategy": strategy, "params": params, "costs": costs.as_record(), "fill_rule": fill_rule, "sizing": sizing, "regime": regime}
    config_hash = hashlib.sha256(json.dumps(cfg, sort_keys=True, default=str).encode()).hexdigest()[:16]
    run_id = f"{strategy}-{config_hash}-{market.fingerprint()}-{int(time.time())}"
    return {
        "run_id": run_id, "strategy": strategy, "params": params, "config_hash": config_hash, "code_sha": code_sha,
        "data_hash": market.fingerprint(), "universe_hash": market.universe_fingerprint(), "data_vintage": data_vintage,
        "costs": costs.as_record(), "fill_rule": fill_rule, "sizing": sizing, "regime": regime, "folds": folds_info, "seeds": seeds,
        "trial_count": (gate_result or {}).get("trials"), "metrics": metrics, "robustness": rob, "gate": gate_result,
        "verdict": (gate_result or {}).get("verdict", "inconclusive"), "notes": notes, **(extra or {}),
    }


# ---------------------------------------------------------------------------------------------------------------
# Phase 4 (docs/desk/PHASE4-PREREGISTRATION.md v2): boundary accounting, continuous OOS, scale, thirds, delisting,
# per-regime reporting, advancement. Nothing here selects parameters; selection stays inside walk_forward's fit windows.

BOUNDARY_THRESHOLD = 0.20


def boundary_dependency(picks, threshold=BOUNDARY_THRESHOLD):
    """§4: exits caused solely by a fold boundary are the `eod` closes at INTERIOR fold ends (the final fold's end is the
    sample end, which the continuous run liquidates too, so it cannot be a boundary dependency; both counts are reported).
    Chained OOS return = product of per-fold (final / start); the ex-boundary return removes each interior fold's eod P&L
    from that fold's final equity before chaining. More than `threshold` of |chained| or a sign flip => inconclusive
    until the continuous run is reviewed."""
    if not picks:
        return {"eod_exits_all": 0, "eod_exits_interior": 0, "chained_return": None, "ex_boundary_return": None, "inconclusive": False}
    chained = ex = 1.0
    for i, p in enumerate(picks):
        sc = p.get("start_cash") or 1.0
        chained *= p["final_cash"] / sc
        ex *= (p["final_cash"] - (p["eod_pnl"] if i < len(picks) - 1 else 0.0)) / sc
    chained -= 1; ex -= 1
    delta = ex - chained
    exceeds = abs(delta) > threshold * abs(chained) if chained != 0 else delta != 0
    flips = (ex > 0) != (chained > 0)
    return {"eod_exits_all": sum(p["eod_exits"] for p in picks), "eod_exits_interior": sum(p["eod_exits"] for p in picks[:-1]),
            "chained_return": chained, "ex_boundary_return": ex, "delta": delta, "threshold": threshold,
            "exceeds_threshold": exceeds, "flips_sign": flips, "inconclusive": exceeds or flips}


def frozen_schedule(picks):
    """[(test_start, test_end, params)] — the parameters chosen in each fit window, applied over its test window."""
    return [(p["test"][0], p["test"][1], p["params"]) for p in picks]


def continuous_oos(market, make_strategy, picks, costs, sizing=None, universe=None, regime=None, start_cash=10_000.0, delisting=None):
    """§4 verdict curve: ONE simulation across the whole OOS span. The parameter set of fold k applies to every decision
    time t with test_start_k <= t < test_end_k (a fresh strategy instance is created at the switch; positions carry,
    nothing is force-closed; the strategy's own exit rule decides). The only `eod` exits are at the sample end."""
    sizing = sizing or {}
    sched = frozen_schedule(picks)
    if not sched:
        return None
    state = {"k": -1, "fn": None, "switches": []}

    def switcher(view, pf):
        k = state["k"]
        while k + 1 < len(sched) and view.t >= sched[k + 1][0]:
            k += 1
        if k != state["k"]:
            state["k"], state["fn"] = k, make_strategy(**sched[k][2]); state["switches"].append((view.t, sched[k][2]))
        return state["fn"](view, pf) if state["fn"] is not None else []

    r = run(market, switcher, costs, start_cash=start_cash, start_t=sched[0][0], end_t=sched[-1][1], universe=universe, regime=regime, delisting=delisting, **sizing)
    r["schedule"] = sched; r["param_switches"] = state["switches"]
    r["eod_exits"] = sum(1 for tr in r["trades"] if tr.reason == "eod")
    return r


def normalised(equity):
    e0 = equity[0][1]
    return [(t, e / e0) for t, e in equity]


def scale_invariance(market, make_strategy, picks, costs, sizing=None, universe=None, cash_a=10_000.0, cash_b=100_000.0, tol=1e-6):
    """§3: normalised equity curves from cash_a and cash_b must agree to `tol` at every point."""
    ra = continuous_oos(market, make_strategy, picks, costs, sizing, universe, start_cash=cash_a)
    rb = continuous_oos(market, make_strategy, picks, costs, sizing, universe, start_cash=cash_b)
    if ra is None or rb is None or len(ra["equity"]) != len(rb["equity"]):
        return {"pass": False, "max_abs_diff": None, "cash": (cash_a, cash_b), "reason": "curves differ in length or are missing"}
    na, nb = normalised(ra["equity"]), normalised(rb["equity"])
    diff = max(abs(a[1] - b[1]) for a, b in zip(na, nb))
    return {"pass": diff <= tol and len(ra["trades"]) == len(rb["trades"]), "max_abs_diff": diff, "tol": tol, "cash": (cash_a, cash_b), "trades": (len(ra["trades"]), len(rb["trades"]))}


def chronological_thirds(equity):
    """§7.4: OOS return in each of three contiguous, equal-length (by bar count) segments of the verdict curve."""
    n = len(equity)
    if n < 6:
        return {"segments": [], "positive": 0, "pass": False}
    cuts = [0, n // 3, 2 * n // 3, n - 1]
    segs = []
    for i in range(3):
        a, b = equity[cuts[i]], equity[cuts[i + 1]]
        segs.append({"from": a[0], "to": b[0], "return": b[1] / a[1] - 1 if a[1] > 0 else None})
    pos = sum(1 for s in segs if s["return"] is not None and s["return"] > 0)
    return {"segments": segs, "positive": pos, "pass": pos >= 2}


def delisting_exposure(trades, listings, threshold=0.10):
    """§7.7 trigger: share of OOS trades and of gross absolute OOS P&L in names that carry a delisted date anywhere in
    the listings (later-delisted, whether or not the trade itself ended in the delisting). Material at >= threshold."""
    dl = {s for s, (a, d) in listings.items() if d is not None}
    n = len(trades); g = sum(abs(tr.pnl) for tr in trades)
    nd = sum(1 for tr in trades if tr.symbol in dl); gd = sum(abs(tr.pnl) for tr in trades if tr.symbol in dl)
    pnl_net_d = sum(tr.pnl for tr in trades if tr.symbol in dl)
    ts = nd / n if n else 0.0; ps = gd / g if g else 0.0
    return {"delisted_names_traded": sorted({tr.symbol for tr in trades if tr.symbol in dl}), "trades": nd, "trade_share": ts,
            "pnl_abs_share": ps, "pnl_net_in_delisted": pnl_net_d, "threshold": threshold, "material": ts >= threshold or ps >= threshold,
            "exits_by_delisting": sum(1 for tr in trades if tr.reason.startswith("delisted"))}


def regime_attribution(result, series):
    """§8 per-state reporting with the filter OFF: each OOS trade is bucketed by the label published at its entry
    decision (the fill at open t followed the decision at t); each bar's curve return by the label at the bar's open.
    Descriptive only; no verdict reads it (R-R)."""
    from .regime import STATES
    bar = series.bar_seconds
    out = {s: {"trades": 0, "wins": 0, "pnl": 0.0, "rets": [], "bars": 0, "curve": 1.0} for s in STATES}
    for tr in result["trades"]:
        d = out[series.at(tr.entry_t)[0]]
        d["trades"] += 1; d["wins"] += tr.pnl > 0; d["pnl"] += tr.pnl; d["rets"].append(tr.ret)
    eq = result["equity"]
    for i in range(1, len(eq)):
        t_open = eq[i][0] - bar
        d = out[series.at(t_open)[0]]
        d["bars"] += 1
        if eq[i - 1][1] > 0:
            d["curve"] *= eq[i][1] / eq[i - 1][1]
    return {s: {"trades": d["trades"], "win_rate": d["wins"] / d["trades"] if d["trades"] else None, "pnl": d["pnl"],
                "avg_trade_ret": st.mean(d["rets"]) if d["rets"] else None, "bars": d["bars"], "curve_return": d["curve"] - 1} for s, d in out.items()}


ADVANCEMENT_CONDITIONS = ("gate_accepted", "oos_trades>=100", "scale_invariant", "positive_in_2_of_3_thirds", "positive_under_fee_stress",
                          "not_year_symbol_top3_dependent", "survives_canonical_delisting", "no_boundary_dependency")


def advancement(gate_result, cont, cont_stress, scale, thirds, delisting, boundary, min_trades=100):
    """§7: all eight hold => research_accepted (Phase 5 eligible; Phase 10 additionally needs Kraken paper reproduction).
    Missing evidence or an unreviewed boundary dependency => inconclusive; any False => rejected."""
    checks = (gate_result or {}).get("checks", {})
    c = {}
    c["gate_accepted"] = (gate_result or {}).get("verdict") == "accepted"
    c["oos_trades>=100"] = bool(cont) and cont.get("trades", 0) >= min_trades
    c["scale_invariant"] = bool(scale and scale.get("pass"))
    c["positive_in_2_of_3_thirds"] = bool(thirds and thirds.get("pass"))
    c["positive_under_fee_stress"] = bool(cont_stress) and "error" not in cont_stress and cont_stress.get("total_return", 0) > 0
    c["not_year_symbol_top3_dependent"] = all(checks.get(k) is True for k in ("not_single_year", "symbols>=min", "not_top3_dependent"))
    if delisting and delisting.get("material"):
        cell = (delisting.get("cells") or {}).get("canonical")
        c["survives_canonical_delisting"] = bool(cell) and "error" not in cell and cell.get("total_return", 0) > 0
    else:
        c["survives_canonical_delisting"] = True                           # exposure below 10% of trades and P&L: the case is reported, not required
    c["no_boundary_dependency"] = bool(boundary) and not boundary.get("inconclusive")
    if boundary and boundary.get("inconclusive"):
        verdict = "inconclusive"
    elif not cont or "error" in cont:
        verdict = "inconclusive"
    else:
        verdict = "accepted" if all(c.values()) else "rejected"
    return {"verdict": verdict, "checks": c, "failed": [k for k, v in c.items() if v is False], "research_accepted": verdict == "accepted", "trade_approved": False}
