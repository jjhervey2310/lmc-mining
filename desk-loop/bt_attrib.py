#!/usr/bin/env python3
"""NOT RESEARCH EVIDENCE — sizing attribution only (review R-I, 2026-10-02).

One-off diagnostic decomposition of the house breakout rule on ONE frozen snapshot. Four cells, identical data,
universe symbols, fees, signal logic and stop rules; only chronology/fill engine and the sizing mechanism differ:
  1  legacy logic  + legacy fixed-dollar sizing   (desk-loop/backtest_breakout_full.py, ported verbatim)
  2  honest engine + legacy fixed-dollar sizing   (bt.engine run(fixed_usd=SIZE))
  3  honest engine + slot sizing, gross_cap 1.00  (the Phase 4 baseline)
  4  honest engine + slot sizing, gross_cap 0.95  (sensitivity only)
#1 vs #2 = correctness impact (chronology, look-ahead, fills, listings); #2 vs #3 = allocator impact.
Common rule for all cells: the legacy variant "no take-profit: trail 12/18 only, 2/wk" — the engine has no partial
sells, so the half-off-at-+25% variant cannot be made identical across cells and is out of scope here.
Writes a text report only. NEVER writes research_runs (store.py is not imported).
"""
import argparse, datetime as dt, json, statistics as st, sys
from bt_costs import CostModel, stamp
from bt import load, strategies
from bt.data import Market
from bt.engine import run

SIZE, COST_SIDE = 100.0, 0.0095            # exactly backtest_house.py: $100/trade, 1.9% round trip
LOOKBACK, VOL_MULT, MAX_EXT = 20, 1.5, 0.15
MAJORS = {"BTC", "ETH", "SOL"}
LEGACY = dict(per_week=2, trail_major=0.12, trail_other=0.18)
BANNER = "NOT RESEARCH EVIDENCE — sizing attribution only"


# ---- legacy logic, ported verbatim from backtest_breakout_full.py (take_frac=0, pyramid=False; dict bars) ----
def legacy_signals(bars, btc, btc_idx):
    out = []
    for i in range(LOOKBACK + 8, len(bars) - 1):   # needs a next bar to fill on
        c, v = bars[i]["c"], bars[i]["v"]
        w = bars[i - LOOKBACK:i]
        hi20 = max(b["c"] for b in w); avgv = st.mean(b["v"] for b in w) or 1
        r7 = c / bars[i - 7]["c"] - 1
        bi = btc_idx.get(bars[i]["t"])
        btc7 = (btc[bi]["c"] / btc[bi - 7]["c"] - 1) if bi is not None and bi >= 7 else 0
        if c > hi20 and v >= VOL_MULT * avgv and r7 > btc7 and (c / hi20 - 1) <= MAX_EXT:
            out.append(i)
    return out


def legacy_trade(sym, bars, i, trail_major, trail_other):
    trail = trail_major if sym in MAJORS else trail_other
    e = i + 1
    entry = bars[e]["o"] * (1 + COST_SIDE)
    low20 = min(b["l"] for b in bars[i - LOOKBACK:i])
    stop = max(low20, entry * (1 - trail))
    high = bars[e]["c"]
    j = e
    while j < len(bars):
        b = bars[j]
        if b["l"] <= stop:
            fill = min(stop, b["o"]) * (1 - COST_SIDE)
            return (fill - entry) / entry, j - i
        if b["c"] > high:
            high = b["c"]; stop = max(stop, high * (1 - trail))
        j += 1
    fill = bars[-1]["c"] * (1 - COST_SIDE)
    return (fill - entry) / entry, len(bars) - 1 - i


def legacy_run(data, btc, per_week, **kw):
    btc_idx = {b["t"]: k for k, b in enumerate(btc)}
    cands = []
    for sym, bars in data.items():
        for i in legacy_signals(bars, btc, btc_idx): cands.append((bars[i]["t"], sym, i))
    cands.sort(); wk_n, busy, trades = {}, {}, []
    for t, sym, i in cands:
        wk = dt.datetime.fromtimestamp(t, dt.timezone.utc).isocalendar()[:2]   # legacy used local time; UTC here (container TZ)
        if wk_n.get(wk, 0) >= per_week or busy.get(sym, -1) >= i: continue
        pnl, days = legacy_trade(sym, data[sym], i, **kw)
        busy[sym] = i + days; wk_n[wk] = wk_n.get(wk, 0) + 1
        bs = data[sym]
        trades.append({"sym": sym, "t": bs[i + 1]["t"], "exit_t": bs[min(i + days, len(bs) - 1)]["t"], "ret": pnl})
    return trades


def legacy_cell(market: Market, start_cash):
    bar = market.bar_seconds
    data = {s: [{"t": b.t, "o": b.o, "h": b.h, "l": b.l, "c": b.c, "v": b.v} for b in bs] for s, bs in market.bars.items() if len(bs) >= 60}
    trades = legacy_run(data, data["BTC"], **LEGACY)
    times = sorted({b.t + bar for bs in market.bars.values() for b in bs})
    eq, cash, by_exit = [], [], sorted(trades, key=lambda x: x["exit_t"])
    for t in times:
        realised = sum(SIZE * x["ret"] for x in by_exit if x["exit_t"] + bar <= t)
        open_n = sum(1 for x in trades if x["t"] <= t - bar < x["exit_t"])
        e = start_cash + realised                      # legacy marks realised P&L only (no open-position mark)
        eq.append((t, e)); cash.append((t, e - open_n * SIZE))
    rets = [x["ret"] for x in trades]
    return {"equity": eq, "cash_curve": cash, "rets": rets, "pnls": [SIZE * r for r in rets], "no_fill_reasons": "n/a — legacy has no cash or slot constraint", "sizing": {"rule": "legacy fixed-usd", "usd": SIZE}}


def engine_cell(market, costs, start_cash, **kw):
    r = run(market, strategies.breakout_legacy(**LEGACY), costs, start_cash=start_cash, **kw)
    return {"equity": r["equity"], "cash_curve": r["cash_curve"], "rets": [t.ret for t in r["trades"]], "pnls": [t.pnl for t in r["trades"]], "no_fill_reasons": r["no_fill_reasons"], "sizing": r["sizing"]}


def metrics(c):
    vals = [e for _, e in c["equity"]]
    peak, mdd = vals[0], 0.0
    for v in vals:
        peak = max(peak, v); mdd = min(mdd, v / peak - 1)
    wins = [p for p in c["pnls"] if p > 0]; losses = [-p for p in c["pnls"] if p <= 0]
    gp, gl = sum(wins), sum(losses)
    expo = [(e - k) / e for (_, e), (_, k) in zip(c["equity"], c["cash_curve"]) if e > 0]
    return {
        "trades": len(c["rets"]), "total_return": vals[-1] / vals[0] - 1, "avg_trade_return": st.mean(c["rets"]) if c["rets"] else None,
        "max_dd": mdd, "win_rate": len(wins) / len(c["rets"]) if c["rets"] else None,
        "profit_factor": gp / gl if gl > 0 else (float("inf") if gp > 0 else None),
        "no_fill_reasons": c["no_fill_reasons"], "exposure_pct": st.mean(expo) if expo else 0.0, "avg_cash_pct": 1 - st.mean(expo) if expo else 1.0,
    }


def fmt(m):
    f = lambda x, p=2, pct=False: "—" if x is None else (f"{x*100:.{p}f}%" if pct else (f"{x:.{p}f}" if isinstance(x, float) else str(x)))
    return f"{m['trades']:>6} {f(m['total_return'],1,True):>9} {f(m['avg_trade_return'],2,True):>9} {f(m['max_dd'],1,True):>8} {f(m['win_rate'],0,True):>6} {f(m['profit_factor']):>6} {f(m['exposure_pct'],1,True):>9} {f(m['avg_cash_pct'],1,True):>9}  {json.dumps(m['no_fill_reasons'])}"


def report(market, start_cash=10_000.0, snapshot_name="?"):
    costs = CostModel(COST_SIDE, COST_SIDE, venue="coinbase-daily", tier="legacy blended COST_SIDE per side (backtest_house.py)")
    cells = [
        ("1 legacy logic + legacy $100 fixed", legacy_cell(market, start_cash)),
        ("2 honest engine + legacy $100 fixed", engine_cell(market, costs, start_cash, fixed_usd=SIZE)),
        ("3 honest engine + slot, gross_cap 1.00", engine_cell(market, costs, start_cash, gross_cap=1.0)),
        ("4 honest engine + slot, gross_cap 0.95 (sensitivity)", engine_cell(market, costs, start_cash, gross_cap=0.95)),
    ]
    L = [BANNER, f"snapshot {snapshot_name} data_hash {market.fingerprint()} universe_hash {market.universe_fingerprint()} symbols {len(market.symbols())} start_cash {start_cash:.0f} max_positions 10",
         "rule: legacy 'no take-profit: trail 12/18 only, 2/wk' for ALL cells (engine has no partial sells; half-off variant out of scope)",
         "legacy cell marks realised P&L only and ignores listings (as it did); honest cells mark to market, respect listing windows and all-or-none fills",
         stamp(costs, "legacy: next open + cost, stop intrabar incl. entry bar | honest: identical fill rule inside bt.engine", universe="the frozen snapshot's symbols; listing windows enforced in honest cells only").rstrip(),
         "", f"{'cell':<52} {'trades':>6} {'total':>9} {'avg/trd':>9} {'maxDD':>8} {'win':>6} {'PF':>6} {'exposure':>9} {'avg cash':>9}  no_fill_reasons"]
    ms = {}
    for name, c in cells:
        ms[name] = metrics(c); L.append(f"{name:<52} {fmt(ms[name])}")
    L += ["", "read: #1 vs #2 = correctness impact; #2 vs #3 = allocator impact; #4 is a cash-buffer sensitivity, not part of the core reproduction", BANNER]
    return "\n".join(L), ms


if __name__ == "__main__":
    p = argparse.ArgumentParser(description=BANNER)
    p.add_argument("--snapshot", required=True, help="frozen JSON snapshot (bt_run.py --export); listings required")
    p.add_argument("--start-cash", type=float, default=10_000)
    p.add_argument("--out", default=None, help="write the report here as well as stdout")
    a = p.parse_args()
    m = load.load_snapshot(a.snapshot)
    text, _ = report(m, a.start_cash, a.snapshot)
    print(text)
    if a.out:
        open(a.out, "w").write(text + "\n")
