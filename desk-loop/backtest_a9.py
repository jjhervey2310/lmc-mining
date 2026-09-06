#!/usr/bin/env python3
"""A9 PARAMETER GRID (build request #9d, 2026-09-06). Same Coinbase daily candles, universe, 1.9% round trip
and $100/trade as backtest_breakout_full.py, so the cells compare like-for-like with the A4 table.
SLEEVE (breakout signal: close > 20d high, vol >= 1.5x, 7d RS > BTC, <= 15% above the high):
  trail 18% -> 25% once the position has been +50% (A9) vs 15% -> 25%; no take-profit vs 1/3 off at +50%;
  2/wk vs 4/wk; and the A9 BULL sizing rule (a +15% signal day = half size) applied as a weight.
ANCHOR: BTC and SOL, catastrophe trail T = 30/35/40% off the highest close since entry vs buy-and-hold
  (re-enter on a close > 20d high), extending the core-hold table past the 30% cell it stopped at.
Writes pa_memory 'backtest-results-a9'. Caveats identical to backtest-results (survivorship, short history)."""
import datetime, statistics as st
from common import STATE, sb_upsert
from backtest_house import candles, universe, COST_SIDE, SIZE
import backtest_breakout_full as bbf
from backtest_breakout_full import signals, stats, LOOKBACK
from backtest_core import run as core_run, hold_dd

def trade(bars, i, t1, t2, take_frac, take_at):
    entry = bars[i]["c"] * (1 + COST_SIDE)
    low20 = min(b["l"] for b in bars[i - LOOKBACK:i])
    stop = max(low20, entry * (1 - t1)); units = 1.0; high = bars[i]["c"]; banked = 0.0; took = False; wide = False
    j = i + 1
    while j < len(bars):
        b = bars[j]
        if b["l"] <= stop:
            fill = min(stop, b["o"]) * (1 - COST_SIDE)
            return (banked + units * (fill - entry)) / entry, j - i, took
        if b["c"] >= entry * 1.5: wide = True
        if b["c"] > high:
            high = b["c"]; stop = max(stop, high * (1 - (t2 if wide else t1)))
        if take_frac and not took and b["c"] >= entry * (1 + take_at):
            banked += take_frac * (b["c"] * (1 - COST_SIDE) - entry); units -= take_frac; took = True
        j += 1
    fill = bars[-1]["c"] * (1 - COST_SIDE)
    return (banked + units * (fill - entry)) / entry, len(bars) - 1 - i, took

def run(data, per_week, t1, t2, take_frac, take_at, half_on_spike):
    cands = []
    for sym, bars in data.items():
        for i in signals(bars, data["BTC"]): cands.append((bars[i]["t"], sym, i))
    cands.sort(); wk_n, busy, trades = {}, {}, []
    for t, sym, i in cands:
        wk = datetime.date.fromtimestamp(t).isocalendar()[:2]
        if wk_n.get(wk, 0) >= per_week or busy.get(sym, -1) >= i: continue
        bars = data[sym]; pnl, days, took = trade(bars, i, t1, t2, take_frac, take_at)
        w = 0.5 if half_on_spike and bars[i]["c"] / bars[i - 1]["c"] - 1 >= 0.15 else 1.0
        busy[sym] = i + days; wk_n[wk] = wk_n.get(wk, 0) + 1
        trades.append({"sym": sym, "t": t, "exit_t": bars[min(i + days, len(bars) - 1)]["t"], "ret": pnl * w, "days": days, "took": took, "added": False})
    return trades

def main():
    data = {}
    for s in universe():
        try: b = candles(s)
        except Exception: b = None
        if b and len(b) >= 60: data[s] = b
    btc = data["BTC"]; bbf.btc_idx = {b["t"]: k for k, b in enumerate(btc)}
    first = min(datetime.date.fromtimestamp(b[0]["t"]) for b in data.values())
    L = [f"A9 GRID — {len(data)} RH names, Coinbase daily, {first} -> {datetime.date.today()}, 1.9% round trip, $100/trade. Signal = breakout rule (the A9 entry).",
         "", f"{'sleeve variant':<52} {'n':>4} {'win%':>5} {'avgW%':>6} {'avgL%':>6} {'exp%':>6} {'total$':>7} {'maxDD$':>7} {'took':>5}"]
    variants = [
        ("A9: trail 18->25 past +50%, no TP, 2/wk", dict(per_week=2, t1=0.18, t2=0.25, take_frac=0.0, take_at=9.9, half_on_spike=False)),
        ("A9 + third at +50%, 2/wk", dict(per_week=2, t1=0.18, t2=0.25, take_frac=1/3, take_at=0.50, half_on_spike=False)),
        ("trail 15->25, no TP, 2/wk", dict(per_week=2, t1=0.15, t2=0.25, take_frac=0.0, take_at=9.9, half_on_spike=False)),
        ("trail 15->25 + third at +50%, 2/wk", dict(per_week=2, t1=0.15, t2=0.25, take_frac=1/3, take_at=0.50, half_on_spike=False)),
        ("A8 for reference: 18->25, third at +25%, 2/wk", dict(per_week=2, t1=0.18, t2=0.25, take_frac=1/3, take_at=0.25, half_on_spike=False)),
        ("A9 no TP, 2/wk, half size on a +15% signal day", dict(per_week=2, t1=0.18, t2=0.25, take_frac=0.0, take_at=9.9, half_on_spike=True)),
        ("A9 no TP, 4/wk", dict(per_week=4, t1=0.18, t2=0.25, take_frac=0.0, take_at=9.9, half_on_spike=False)),
        ("A9 + third at +50%, 4/wk", dict(per_week=4, t1=0.18, t2=0.25, take_frac=1/3, take_at=0.50, half_on_spike=False)),
        ("trail 15->25, no TP, 4/wk", dict(per_week=4, t1=0.15, t2=0.25, take_frac=0.0, take_at=9.9, half_on_spike=False)),
    ]
    base = None
    for name, kw in variants:
        tr = run(data, **kw); s = stats(tr); base = base or tr
        L.append(f"{name:<52} {s['n']:>4} {s['win']:>5.0f} {s['aw']:>6.1f} {s['al']:>6.1f} {s['exp']:>6.2f} {s['total']:>7.0f} {s['mdd']:>7.0f} {s['took']:>5}")
    by_year = {}
    for x in base: by_year.setdefault(datetime.date.fromtimestamp(x["t"]).year, []).append(x["ret"])
    L += ["", "A9-as-written BY YEAR: " + " | ".join(f"{y}: n={len(v)} exp {st.mean(v)*100:+.1f}% win {sum(1 for r in v if r>0)/len(v)*100:.0f}%" for y, v in sorted(by_year.items()))]
    L += ["", "ANCHOR — catastrophe trail vs hold (exit: close < (1-T) x highest close since entry; re-enter: close > 20d high)",
          f"{'sym':<5} {'hold%':>7} {'holdDD%':>8} | " + " | ".join(f"T={int(t*100)}%: ret%/DD%/trades" for t in (0.30, 0.35, 0.40))]
    for s in ("BTC", "SOL"):
        bars = data[s]; h, hd = hold_dd(bars); cells = []
        for T in (0.30, 0.35, 0.40):
            r, dd, n = core_run(bars, T); cells.append(f"{r*100:+.0f}/{dd*100:.0f}/{n}")
        L.append(f"{s:<5} {h*100:>+7.0f} {hd*100:>8.0f} | " + " | ".join(f"{c:>22}" for c in cells))
    L += ["", f"BTC buy-and-hold same window: {(btc[-1]['c']/btc[0]['c']-1)*100:+.0f}%",
          "READ: a sleeve cell only earns size above $50 flat if its exp% is positive in 3 of 4 years, not just the total. Anchor: the widest trail that still beats hold on DD is the A9 setting; if none beats hold, hold.",
          "CAVEATS: survivorship (today's RH list), short history for 2024-25 listings, 2/4-per-week filled first-come, daily bars (stops on the day's low). Cells within 1% expectancy are noise."]
    out = "\n".join(L); print(out)
    (STATE / "backtest_a9.txt").write_text(out)
    sb_upsert("pa_memory", [{"topic": "backtest-results-a9", "fact": out, "source": "desk-loop", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")

if __name__ == "__main__":
    main()
