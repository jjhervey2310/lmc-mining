#!/usr/bin/env python3
"""CORE-HOLD test: does a wide trailing stop on the majors beat buy-and-hold, and is it 'safe' (drawdown)?
Rule: long BTC/ETH/SOL; exit when close < (1 - T) x highest close since entry; re-enter on close > 20d high.
Same Coinbase candles, 1.9% round trip. Reports total return, max drawdown, trades, vs buy-and-hold."""
import datetime
from common import STATE, sb_upsert
from backtest_house import candles, COST_SIDE

def run(bars, T):
    eq = 1.0; inpos = True; entry = bars[0]["c"] * (1 + COST_SIDE); high = bars[0]["c"]; trades = 0; peak = 1.0; mdd = 0.0
    for i in range(20, len(bars)):
        b = bars[i]
        if inpos:
            high = max(high, b["c"])
            mark = eq * (b["c"] * (1 - COST_SIDE)) / entry
            peak = max(peak, mark); mdd = min(mdd, mark / peak - 1)
            if b["c"] < high * (1 - T):
                eq = mark; inpos = False; trades += 1
        else:
            hi20 = max(x["c"] for x in bars[i - 20:i])
            if b["c"] > hi20:
                inpos = True; entry = b["c"] * (1 + COST_SIDE); high = b["c"]
    if inpos: eq = eq * (bars[-1]["c"] * (1 - COST_SIDE)) / entry
    return eq - 1, mdd, trades

def hold_dd(bars):
    peak = mdd = 0.0; p0 = bars[0]["c"]; pk = p0
    for b in bars:
        pk = max(pk, b["c"]); mdd = min(mdd, b["c"] / pk - 1)
    return bars[-1]["c"] / p0 - 1, mdd

def main():
    L = ["CORE-HOLD TEST — majors, Coinbase daily, 2023 -> now, 1.9% round trip. exit: close < (1-T) x high since entry; re-enter: close > 20d high",
         f"{'sym':<5} {'hold%':>7} {'holdDD%':>8} | " + " | ".join(f"T={int(t*100)}%: ret%/DD%/trades" for t in (0.15, 0.20, 0.25, 0.30))]
    for s in ("BTC", "ETH", "SOL"):
        bars = candles(s); h, hd = hold_dd(bars)
        cells = []
        for T in (0.15, 0.20, 0.25, 0.30):
            r, dd, n = run(bars, T); cells.append(f"{r*100:+.0f}/{dd*100:.0f}/{n}")
        L.append(f"{s:<5} {h*100:>+7.0f} {hd*100:>8.0f} | " + " | ".join(f"{c:>22}" for c in cells))
    out = "\n".join(L); print(out)
    (STATE / "backtest_core.txt").write_text(out)
    sb_upsert("pa_memory", [{"topic": "backtest-core-hold", "fact": out, "source": "desk-loop", "active": True, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")

if __name__ == "__main__":
    main()
