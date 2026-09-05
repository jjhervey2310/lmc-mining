#!/usr/bin/env python3
"""BREAKOUT RULE over the FULL window (2023 -> now) on the same Coinbase candles as backtest_house.py,
plus the aggressive variants Jacob asked for (2026-09-04): larger runner share, a funded pyramid add,
tighter/wider trails, RUNNING-stage exclusion. Same cost model and 2-per-week cap as the house test
for a like-for-like comparison; then the cap relaxed to 4/week."""
import json, datetime, statistics as st
from common import STATE, sb_upsert
from backtest_house import candles, universe, COST_SIDE, SIZE, MATERIALITY

LOOKBACK, VOL_MULT, MAX_EXT = 20, 1.5, 0.15
MAJORS = {"BTC", "ETH", "SOL"}

def signals(bars, btc):
    out = []
    for i in range(LOOKBACK + 8, len(bars)):
        c, v = bars[i]["c"], bars[i]["v"]
        w = bars[i - LOOKBACK:i]
        hi20 = max(b["c"] for b in w); avgv = st.mean(b["v"] for b in w) or 1
        r7 = c / bars[i - 7]["c"] - 1
        bi = btc_idx.get(bars[i]["t"])
        btc7 = (btc[bi]["c"] / btc[bi - 7]["c"] - 1) if bi is not None and bi >= 7 else 0
        if c > hi20 and v >= VOL_MULT * avgv and r7 > btc7 and (c / hi20 - 1) <= MAX_EXT:
            out.append(i)
    return out

def trade(sym, bars, i, trail_major, trail_other, take_frac, take_at, pyramid):
    trail = trail_major if sym in MAJORS else trail_other
    entry = bars[i]["c"] * (1 + COST_SIDE)
    low20 = min(b["l"] for b in bars[i - LOOKBACK:i])
    stop = max(low20, entry * (1 - trail))           # structural stop, never wider than the trail
    units = 1.0; high = bars[i]["c"]; banked = 0.0; took = False; added = False
    cost_basis = entry
    j = i + 1
    while j < len(bars):
        b = bars[j]
        if b["l"] <= stop:
            fill = min(stop, b["o"]) * (1 - COST_SIDE)
            return banked + units * (fill - cost_basis), j - i, took, added
        if b["c"] > high:
            high = b["c"]
            stop = max(stop, high * (1 - trail))
        if not took and b["c"] >= entry * (1 + take_at):
            banked += take_frac * (b["c"] * (1 - COST_SIDE) - cost_basis); units -= take_frac; took = True
        if pyramid and not added and not took and b["c"] >= entry * 1.15 and stop >= entry:
            # funded add: one more unit-half at market once the stop is at/above breakeven (risk is open profit)
            add_px = b["c"] * (1 + COST_SIDE); add_units = 0.5
            cost_basis = (cost_basis * units + add_px * add_units) / (units + add_units); units += add_units; added = True
        j += 1
    fill = bars[-1]["c"] * (1 - COST_SIDE)
    return banked + units * (fill - cost_basis), len(bars) - 1 - i, took, added

def run(data, btc, per_week, **kw):
    cands = []
    for sym, bars in data.items():
        for i in signals(bars, btc): cands.append((bars[i]["t"], sym, i))
    cands.sort(); wk_n, busy, trades = {}, {}, []
    for t, sym, i in cands:
        wk = datetime.date.fromtimestamp(t).isocalendar()[:2]
        if wk_n.get(wk, 0) >= per_week or busy.get(sym, -1) >= i: continue
        pnl, days, took, added = trade(sym, data[sym], i, **kw)
        busy[sym] = i + days; wk_n[wk] = wk_n.get(wk, 0) + 1
        trades.append({"sym": sym, "t": t, "exit_t": data[sym][min(i + days, len(data[sym]) - 1)]["t"], "ret": pnl, "days": days, "took": took, "added": added})
    return trades

def stats(tr):
    if not tr: return None
    r = [x["ret"] for x in tr]; w = [x for x in r if x > 0]; l = [x for x in r if x <= 0]
    eq = peak = mdd = 0.0
    for x in sorted(tr, key=lambda x: x["exit_t"]):
        eq += SIZE * x["ret"]; peak = max(peak, eq); mdd = min(mdd, eq - peak)
    return dict(n=len(r), win=len(w) / len(r) * 100, aw=st.mean(w) * 100 if w else 0, al=st.mean(l) * 100 if l else 0, exp=st.mean(r) * 100, total=eq, mdd=mdd, took=sum(x["took"] for x in tr), added=sum(x["added"] for x in tr))

btc_idx = {}
def main():
    global btc_idx
    data = {}
    for s in universe():
        try: b = candles(s)
        except Exception: b = None
        if b and len(b) >= 60: data[s] = b
    btc = data["BTC"]; btc_idx = {b["t"]: k for k, b in enumerate(btc)}
    first = min(datetime.date.fromtimestamp(b[0]["t"]) for b in data.values())
    L = [f"BREAKOUT RULE, FULL WINDOW — {len(data)} RH names, Coinbase daily candles, {first} -> {datetime.date.today()}, 1.9% round trip, $100/trade",
         "entry: close > 20d high AND vol >= 1.5x 20d avg AND 7d RS > BTC AND <= 15% above the high (RUNNING excluded). stop: max(20d low, trail). no stall rule.",
         "", f"{'variant':<44} {'n':>4} {'win%':>5} {'avgW%':>6} {'avgL%':>6} {'exp%':>6} {'total$':>7} {'maxDD$':>7} {'took':>5} {'adds':>5}"]
    variants = [
        ("A4 as written: trail 12/18, half off +25%, 2/wk", dict(per_week=2, trail_major=0.12, trail_other=0.18, take_frac=0.5, take_at=0.25, pyramid=False)),
        ("runner share: trail 12/18, 1/3 off +25%, 2/wk", dict(per_week=2, trail_major=0.12, trail_other=0.18, take_frac=1/3, take_at=0.25, pyramid=False)),
        ("no take-profit: trail 12/18 only, 2/wk", dict(per_week=2, trail_major=0.12, trail_other=0.18, take_frac=0.0, take_at=9.9, pyramid=False)),
        ("wider trail 15/25, 1/3 off +25%, 2/wk", dict(per_week=2, trail_major=0.15, trail_other=0.25, take_frac=1/3, take_at=0.25, pyramid=False)),
        ("tighter trail 10/15, 1/3 off +25%, 2/wk", dict(per_week=2, trail_major=0.10, trail_other=0.15, take_frac=1/3, take_at=0.25, pyramid=False)),
        ("pyramid add at +15% w/ stop>=BE, 1/3 off +25%, 2/wk", dict(per_week=2, trail_major=0.12, trail_other=0.18, take_frac=1/3, take_at=0.25, pyramid=True)),
        ("A4 as written but 4/wk", dict(per_week=4, trail_major=0.12, trail_other=0.18, take_frac=0.5, take_at=0.25, pyramid=False)),
        ("runner share 1/3 off, 4/wk", dict(per_week=4, trail_major=0.12, trail_other=0.18, take_frac=1/3, take_at=0.25, pyramid=False)),
        ("runner share 1/3 off + pyramid, 4/wk", dict(per_week=4, trail_major=0.12, trail_other=0.18, take_frac=1/3, take_at=0.25, pyramid=True)),
    ]
    results = {}
    for name, kw in variants:
        tr = run(data, btc, **kw); s = stats(tr); results[name] = (tr, s)
        L.append(f"{name:<44} {s['n']:>4} {s['win']:>5.0f} {s['aw']:>6.1f} {s['al']:>6.1f} {s['exp']:>6.2f} {s['total']:>7.0f} {s['mdd']:>7.0f} {s['took']:>5} {s['added']:>5}")
    base_tr = results[variants[0][0]][0]
    by_year = {}
    for x in base_tr: by_year.setdefault(datetime.date.fromtimestamp(x["t"]).year, []).append(x["ret"])
    L += ["", "A4-as-written BY YEAR: " + " | ".join(f"{y}: n={len(v)} exp {st.mean(v)*100:+.1f}% win {sum(1 for r in v if r>0)/len(v)*100:.0f}%" for y, v in sorted(by_year.items()))]
    L.append(f"BTC buy-and-hold same window: {(btc[-1]['c']/btc[0]['c']-1)*100:+.0f}%  |  house rules (build #5A) same window, best cell: -0.91%/trade")
    L += ["", "CAVEATS: same survivorship + short-history limits as backtest-results; 2-per-week filled first-come; daily bars. Variants that differ by <1% expectancy are noise."]
    out = "\n".join(L); print(out)
    (STATE / "backtest_breakout_full.txt").write_text(out)
    sb_upsert("pa_memory", [{"topic": "backtest-breakout-full", "fact": out, "source": "desk-loop", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")

if __name__ == "__main__":
    main()
