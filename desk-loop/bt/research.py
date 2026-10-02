"""Walk-forward, robustness, Monte Carlo, the anti-overfit gate, and the run manifest."""
import dataclasses, hashlib, json, random, statistics as st, time
from .engine import run
from .metrics import summarize


def folds(start_t, end_t, fit_days, test_days, step_days=None):
    """Rolling (fit_start, fit_end, test_start, test_end) windows; test windows never overlap fit windows."""
    step = (step_days or test_days) * 86400
    out, a = [], start_t
    while a + (fit_days + test_days) * 86400 <= end_t:
        fe = a + fit_days * 86400
        out.append((a, fe, fe, min(fe + test_days * 86400, end_t)))
        a += step
    return out


def walk_forward(market, make_strategy, param_grid, costs, fit_days, test_days, select="sharpe"):
    """For each fold: run every param set on the fit window, pick the best by `select`, run it on the test window.
    Returns per-fold picks and the concatenated out-of-sample trades/metrics. Trial count is recorded (multiple testing)."""
    times = sorted({b.t for s in market.symbols() for b in market.bars[s]})
    fs = folds(times[0], times[-1] + market.bar_seconds, fit_days, test_days)
    picks, oos_equity, oos_trades, trials = [], [], [], 0
    for (a, fe, ts, te) in fs:
        best = None
        for params in param_grid:
            trials += 1
            m = summarize(run(market, make_strategy(**params), costs, start_t=a, end_t=fe))
            score = m.get(select) or -1e9
            if best is None or score > best[0]:
                best = (score, params)
        r = run(market, make_strategy(**best[1]), costs, start_t=ts, end_t=te)
        picks.append({"fit": (a, fe), "test": (ts, te), "params": best[1], "fit_score": best[0]})
        oos_trades += r["trades"]
        # chain equity multiplicatively across folds
        scale = oos_equity[-1][1] / r["equity"][0][1] if oos_equity else 1.0
        oos_equity += [(t, e * scale) for t, e in r["equity"]]
    oos = summarize({"equity": oos_equity, "trades": oos_trades}) if oos_equity else {"error": "no folds"}
    return {"folds": picks, "oos": oos, "trials": trials}


def robustness(market, make_strategy, params, costs, perturb=0.2):
    """Fee stress, parameter neighbourhood, top-winner exclusion — the shape of the metric surface."""
    base = summarize(run(market, make_strategy(**params), costs))
    out = {"base": base, "fees_x1.25": None, "fees_x1.5": None, "neighbours": []}
    for k, mult in (("fees_x1.25", 1.25), ("fees_x1.5", 1.5)):
        c2 = dataclasses.replace(costs, maker_fee=min(0.099, costs.maker_fee * mult), taker_fee=min(0.099, costs.taker_fee * mult), tier=f"{costs.tier} x{mult}")
        out[k] = summarize(run(market, make_strategy(**params), c2))
    for key, val in params.items():
        if isinstance(val, (int, float)) and not isinstance(val, bool):
            for f in (1 - perturb, 1 + perturb):
                p2 = dict(params); p2[key] = type(val)(val * f) if isinstance(val, int) else val * f
                try:
                    out["neighbours"].append({"param": key, "value": p2[key], "metrics": summarize(run(market, make_strategy(**p2), costs))})
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


def gate(oos, rob, trials, min_symbols=3):
    """Anti-overfit rules (architecture §11). Any failing rule rejects; missing evidence is inconclusive."""
    checks = {}
    if not oos or "error" in oos:
        return {"verdict": "inconclusive", "checks": {"oos": "missing"}}
    checks["oos_positive"] = oos["total_return"] > 0
    checks["symbols>=min"] = oos.get("symbols_with_profit", 0) >= min_symbols
    yrs = [v for v in oos.get("pnl_by_year", {}).values()]
    checks["not_single_year"] = len(yrs) >= 2 and sum(1 for v in yrs if v > 0) >= 2 if yrs else False
    total_pnl = sum(yrs) if yrs else 0
    checks["survives_fees_x1.25"] = bool(rob and rob.get("fees_x1.25") and rob["fees_x1.25"]["total_return"] > 0)
    ex3 = oos.get("pnl_ex_top", {}).get(3)
    checks["not_top3_dependent"] = (ex3 is not None and total_pnl > 0 and ex3 > 0.5 * total_pnl)
    nb = [x["metrics"]["total_return"] for x in (rob or {}).get("neighbours", []) if "metrics" in x]
    checks["param_surface_smooth"] = (len(nb) == 0) or (sum(1 for r in nb if r > 0) >= len(nb) / 2)
    checks["trials_recorded"] = trials is not None
    failed = [k for k, v in checks.items() if v is False]
    return {"verdict": "rejected" if failed else "accepted", "checks": checks, "failed": failed, "trials": trials}


def manifest(strategy, params, market, costs, fill_rule, folds_info, seeds, metrics, rob, gate_result, code_sha=None, data_vintage=None, notes=None):
    cfg = {"strategy": strategy, "params": params, "costs": costs.as_record(), "fill_rule": fill_rule}
    config_hash = hashlib.sha256(json.dumps(cfg, sort_keys=True, default=str).encode()).hexdigest()[:16]
    run_id = f"{strategy}-{config_hash}-{market.fingerprint()}-{int(time.time())}"
    return {
        "run_id": run_id, "strategy": strategy, "params": params, "config_hash": config_hash, "code_sha": code_sha,
        "data_hash": market.fingerprint(), "universe_hash": market.universe_fingerprint(), "data_vintage": data_vintage,
        "costs": costs.as_record(), "fill_rule": fill_rule, "folds": folds_info, "seeds": seeds,
        "trial_count": (gate_result or {}).get("trials"), "metrics": metrics, "robustness": rob, "gate": gate_result,
        "verdict": (gate_result or {}).get("verdict", "inconclusive"), "notes": notes,
    }
