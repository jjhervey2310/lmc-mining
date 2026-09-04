#!/usr/bin/env python3
"""DAILY BREAKOUT SCAN — the loop's hunting ground, replacing EARLY (A4 §1, backtest 2026-09-03:
79 trades, 51% win, +7.5%/trade expectancy, avg win +24.5% vs avg loss -10.0% on our universe).
Signal (same as backtest.py): close > 20d high, volume >= 1.5x 20d avg, 7d RS > BTC, <=15% above the high.
Writes state/breakouts.json (triage escalates on a fresh one) and pa_memory 'breakout-signals'.
Free: daily bars cached under state/hist (refreshed once a day, 2.5s spacing to respect the free tier)."""
import json, time, datetime, statistics as st
from common import *
from backtest import universe, id_map, history, LOOKBACK, VOL_MULT, MAX_EXT

def main():
    syms = universe(); ids = id_map(set(syms))
    btc = history("bitcoin", 60)
    hits, near = [], []
    for s in syms:
        cid = ids.get(s)
        if not cid: continue
        try: bars = history(cid, 60)
        except Exception: continue
        if len(bars) < LOOKBACK + 8: continue
        i = len(bars) - 1
        c, v = bars[i]["c"], bars[i]["v"]
        w = bars[i - LOOKBACK:i]
        hi20 = max(b["c"] for b in w); avgv = st.mean(b["v"] for b in w) or 1
        r7 = c / bars[i - 7]["c"] - 1; btc7 = btc[-1]["c"] / btc[-8]["c"] - 1
        ext = c / hi20 - 1; volx = v / avgv
        row = {"symbol": s, "price": c, "hi20": round(hi20, 6), "ext_pct": round(ext * 100, 1),
               "vol_x": round(volx, 2), "rs7_vs_btc": round((r7 - btc7) * 100, 1)}
        if c > hi20 and volx >= VOL_MULT and r7 > btc7 and ext <= MAX_EXT:
            hits.append(row)
        elif -0.03 <= ext <= 0 and r7 > btc7:
            near.append(row)   # within 3% below the 20d high with RS — tomorrow's candidates
    hits.sort(key=lambda r: -r["vol_x"]); near.sort(key=lambda r: r["ext_pct"], reverse=True)
    prev_p = STATE / "breakouts.json"
    prev = json.loads(prev_p.read_text()) if prev_p.exists() else {"hits": []}
    prev_syms = {h["symbol"] for h in prev.get("hits", [])}
    fresh = [h for h in hits if h["symbol"] not in prev_syms]
    stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")
    prev_p.write_text(json.dumps({"at": stamp, "hits": hits, "near": near[:8], "fresh": [h["symbol"] for h in fresh]}))
    lines = [f"BREAKOUT SCAN {stamp} — rule: close>20d high, vol>=1.5x, RS7>BTC, <=15% extended (A4/A5 entry signal)"]
    lines.append("QUALIFYING TODAY: " + (", ".join(f"{h['symbol']} ${h['price']:.4g} (+{h['ext_pct']}% over 20d high, vol {h['vol_x']}x, RS {h['rs7_vs_btc']:+.1f})" for h in hits) or "none"))
    lines.append("FRESH (not on yesterday's list): " + (", ".join(h["symbol"] for h in fresh) or "none"))
    lines.append("NEAR (within 3% of the 20d high with RS, watch for the close): " + (", ".join(f"{h['symbol']} ({h['ext_pct']}%)" for h in near[:8]) or "none"))
    lines.append("REMINDERS: entry is a daily CLOSE, size per A1, stop below the pre-breakout base, trail 12%/18%, half at +25% (A4). Hard-barred names stay barred unless the desk adopts the learning-sleeve proposal in code-desk.")
    out = "\n".join(lines); print(out)
    sb_upsert("pa_memory", [{"topic": "breakout-signals", "fact": out, "source": "desk-loop", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
    if fresh:
        ntfy("🚀 Fresh breakout(s): " + ", ".join(h["symbol"] for h in fresh),
             "\n".join(f"{h['symbol']} ${h['price']:.4g} vol {h['vol_x']}x RS {h['rs7_vs_btc']:+.1f}" for h in fresh) + "\nDeep wake will review sizing + stop.", "high")
        import subprocess; subprocess.run(["systemctl", "start", "lmc-wake-deep.service"], check=False)

if __name__ == "__main__":
    main()
