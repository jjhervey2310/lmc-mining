#!/usr/bin/env python3
"""DAILY BREAKOUT SCAN — the loop's hunting ground, replacing EARLY (A4 §1, backtest 2026-09-03:
79 trades, 51% win, +7.5%/trade expectancy, avg win +24.5% vs avg loss -10.0% on our universe).
Signal (same as backtest.py): close > 20d high, volume >= 1.5x 20d avg, 7d RS > BTC, <=15% above the high.
Writes state/breakouts.json (triage escalates on a fresh one) and pa_memory 'breakout-signals'.
Free: daily bars cached under state/hist (refreshed once a day, 2.5s spacing to respect the free tier)."""
import json, time, datetime, statistics as st
from common import *
from backtest import universe, id_map, history, LOOKBACK, VOL_MULT, MAX_EXT

CHASE_DAY, CHASE_30D = 0.15, 0.70

def regime():
    """A9 (c): the chase bars are regime-conditional. BULL = BTC's last completed close above its 200-day
    average AND the 50-day above the 200-day, from the Coinbase daily cache the backtests keep (state/cb/BTC.json).
    desk_config key 'regime' (BULL / NEUTRAL / BEAR) overrides when the desk has run the 3-leg test."""
    ov = (config("regime", "") or "").upper()
    if ov in ("BULL", "NEUTRAL", "BEAR"): return ov, "desk_config override"
    try:
        bars = json.loads((STATE / "cb" / "BTC.json").read_text())
        closes = [b["c"] for b in bars][-201:]
        if len(closes) >= 200:
            c = closes[-1]; s200 = sum(closes[-200:]) / 200; s50 = sum(closes[-50:]) / 50
            return ("BULL" if c > s200 and s50 > s200 else "BEAR" if c < s200 and s50 < s200 else "NEUTRAL"), f"BTC {c:.0f} vs 50d {s50:.0f} / 200d {s200:.0f}"
    except Exception:
        pass
    return "NEUTRAL", "no 200d history cached — bars applied in full"

def main():
    syms = universe(); ids = id_map(set(syms))
    btc = history("bitcoin", 60)
    reg, reg_why = regime()
    hits, near, barred = [], [], []
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
        d1 = c / bars[i - 1]["c"] - 1; d30 = c / bars[i - 30]["c"] - 1
        row.update({"d1_pct": round(d1 * 100, 1), "d30_pct": round(d30 * 100, 1)})
        if c > hi20 and volx >= VOL_MULT and r7 > btc7 and ext <= MAX_EXT:
            # A9 (c): in BULL the +70%/30d bar is dropped and a +15% day HALVES size instead of barring;
            # in NEUTRAL/BEAR both chase bars stand (the extended-analog edge only showed in a bull tape).
            if reg == "BULL":
                row["size"] = "HALF (+15% day)" if d1 >= CHASE_DAY else "FULL"; hits.append(row)
            elif d1 >= CHASE_DAY or d30 >= CHASE_30D:
                row["size"] = "BARRED (" + ", ".join(w for w, ok in ((f"+{d1*100:.0f}% day", d1 >= CHASE_DAY), (f"+{d30*100:.0f}%/30d", d30 >= CHASE_30D)) if ok) + ")"; barred.append(row)
            else:
                row["size"] = "FULL"; hits.append(row)
        elif -0.03 <= ext <= 0 and r7 > btc7:
            near.append(row)   # within 3% below the 20d high with RS — tomorrow's candidates
    hits.sort(key=lambda r: -r["vol_x"]); near.sort(key=lambda r: r["ext_pct"], reverse=True)
    prev_p = STATE / "breakouts.json"
    prev = json.loads(prev_p.read_text()) if prev_p.exists() else {"hits": []}
    prev_syms = {h["symbol"] for h in prev.get("hits", [])}
    fresh = [h for h in hits if h["symbol"] not in prev_syms]
    stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")
    prev_p.write_text(json.dumps({"at": stamp, "hits": hits, "near": near[:8], "fresh": [h["symbol"] for h in fresh]}))
    lines = [f"BREAKOUT SCAN {stamp} — rule: close>20d high, vol>=1.5x, RS7>BTC, <=15% extended (A9: the tested entry signal, the only one allowed)",
             f"REGIME: {reg} ({reg_why}). Chase bars: " + ("BULL -> +70%/30d bar OFF, +15% day = HALF size" if reg == "BULL" else "+15% day and +70%/30d both BAR entry")]
    lines.append("QUALIFYING TODAY: " + (", ".join(f"{h['symbol']} ${h['price']:.4g} (+{h['ext_pct']}% over 20d high, vol {h['vol_x']}x, RS {h['rs7_vs_btc']:+.1f}, d1 {h['d1_pct']:+.1f}%, d30 {h['d30_pct']:+.0f}%) size {h['size']}" for h in hits) or "none"))
    if barred: lines.append("SIGNAL BUT BARRED (chase law, non-BULL regime): " + ", ".join(f"{h['symbol']} {h['size']}" for h in barred))
    lines.append("FRESH (not on yesterday's list): " + (", ".join(h["symbol"] for h in fresh) or "none"))
    lines.append("NEAR (within 3% of the 20d high with RS, watch for the close): " + (", ".join(f"{h['symbol']} ({h['ext_pct']}%)" for h in near[:8]) or "none"))
    lines.append("REMINDERS (v4.1 + A9): entry is a daily CLOSE into an open sleeve slot ($50 flat at this book; half while the macro modifier runs or on a +15% day in BULL), stop = max(20d low, -20%) placed at fill; the 18% trail engages at +18% from fill and widens to 25% past +50%; NO take-profit below +50%, a third at +50%. Anchor (BTC/SOL) carries only a 30% catastrophe trail. Breaker is sleeve-only. Held names never qualify; RUNNING-stage stays barred.")
    out = "\n".join(lines); print(out)
    sb_upsert("pa_memory", [{"topic": "breakout-signals", "fact": out, "source": "desk-loop", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
    if fresh:
        ntfy("🚀 Fresh breakout(s): " + ", ".join(h["symbol"] for h in fresh),
             "\n".join(f"{h['symbol']} ${h['price']:.4g} vol {h['vol_x']}x RS {h['rs7_vs_btc']:+.1f}" for h in fresh) + "\nDeep wake will review sizing + stop.", "high")
        import subprocess; subprocess.run(["systemctl", "start", "lmc-wake-deep.service"], check=False)

if __name__ == "__main__":
    main()
