#!/usr/bin/env python3
"""Run one strategy through the Phase 2 framework and write a manifest to research_runs.
Costs and provenance are REQUIRED flags (bt_costs.add_cost_args). Example:
  python3 bt_run.py --strategy breakout20 --params '{}' --snapshot state/md_2026-10.json \
      --maker-fee 0.004 --taker-fee 0.008 --slippage 0.001 --venue kraken --tier 'base, assumed' --fit-days 365 --test-days 90
"""
import argparse, json, os, subprocess, sys
from bt_costs import add_cost_args, from_args
from bt import load, research, strategies, store
from bt.engine import run
from bt.metrics import summarize

FILL_RULE = "decision at completed daily close; fill next bar OPEN + taker cost + slippage; stop before target on the same bar; gap → open"

p = argparse.ArgumentParser()
p.add_argument("--strategy", required=True, choices=sorted(strategies.REGISTRY))
p.add_argument("--params", default="{}", help="JSON kwargs for the strategy factory")
p.add_argument("--grid", default=None, help="JSON list of param dicts for walk-forward selection")
p.add_argument("--snapshot", help="JSON snapshot path (from --export); default pulls md_candles live and snapshots to state/")
p.add_argument("--export", help="pull md_candles + universe and write this snapshot path, then exit")
p.add_argument("--symbols", default=None, help="comma list; default all")
p.add_argument("--fit-days", type=int, default=365)
p.add_argument("--test-days", type=int, default=90)
p.add_argument("--start-cash", type=float, default=10_000)
p.add_argument("--max-positions", type=int, default=10)
p.add_argument("--gross-cap", type=float, default=1.0)
p.add_argument("--no-store", action="store_true")
add_cost_args(p)
a = p.parse_args()

if a.export:
    syms = a.symbols.split(",") if a.symbols else None
    load.snapshot(load.load_md_candles(syms), load.load_universe(), a.export); print("snapshot", a.export); sys.exit(0)

costs = from_args(a)
if not a.snapshot:
    os.makedirs("state", exist_ok=True); a.snapshot = f"state/md_{__import__('datetime').date.today()}.json"
    load.snapshot(load.load_md_candles(a.symbols.split(",") if a.symbols else None), load.load_universe(), a.snapshot)
market = load.load_snapshot(a.snapshot)
params = json.loads(a.params)
make = lambda **kw: strategies.REGISTRY[a.strategy](**{**params, **kw})
sizing = {"max_positions": a.max_positions, "gross_cap": a.gross_cap}
full = run(market, make(), costs, start_cash=a.start_cash, **sizing)
metrics = summarize(full)
grid = json.loads(a.grid) if a.grid else [params]
wf = research.walk_forward(market, make, grid, costs, a.fit_days, a.test_days, sizing=sizing)
rob = research.robustness(market, make, params, costs, sizing=sizing)
mc = research.monte_carlo(full)
g = research.gate(wf["oos"], rob, wf["trials"])
try:
    sha = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], text=True).strip()
except Exception:
    sha = None
man = research.manifest(a.strategy, params, market, costs, FILL_RULE, wf["folds"], {"monte_carlo": 7}, {"in_sample": metrics, "oos": wf["oos"], "monte_carlo": mc}, rob, g, code_sha=sha, data_vintage=os.path.basename(a.snapshot), sizing=full["sizing"])
print(json.dumps({**{k: man[k] for k in ("run_id", "verdict", "trial_count", "sizing")}, "no_fills": full["no_fills"], "no_fill_reasons": full["no_fill_reasons"]}, indent=1))
print(json.dumps({"in_sample": {k: metrics[k] for k in ("total_return", "max_drawdown", "sharpe", "trades")}, "oos": {k: wf["oos"].get(k) for k in ("total_return", "max_drawdown", "sharpe", "trades")}, "gate": g["checks"]}, indent=1, default=str))
if not a.no_store:
    store.save_run(man); print("stored research_runs", man["run_id"])
