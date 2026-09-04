#!/usr/bin/env python3
"""BREAKOUT BACKTEST on the Robinhood universe — settle 'does this rule work HERE' with data.
Daily closes/volumes from CoinGecko (cached under state/hist/). Free. Pessimistic assumptions.

RULE UNDER TEST (A4-compatible):
  signal day t:  close_t > max(close[t-20 .. t-1])           (20-day range breakout)
             and vol_t   >= VOL_MULT * mean(vol[t-20 .. t-1])  (volume expansion ON the candle)
             and 7-day return > BTC's 7-day return             (relative strength)
  entry  : close_t (we only have daily bars; assume fill at the close, 0.5% slippage each way)
  exit   : trailing stop off the high-water mark — 12% majors, 18% others (A4 §5)
           plus HALF OFF at +25% from fill, remainder keeps trailing (A4 §6)
  filter : skip if close_t is > MAX_EXT above the 20-day high (that's RUNNING — A4 §2 no-entry)
BASELINES: BTC buy-and-hold over the window; 'EXTENDED analog' (buy anything +70%/30d, same exits).
Reports per-trade expectancy, win rate, avg win/loss, worst trade, total on $100/trade, and per-symbol.
"""
import json, time, sys, statistics as st, datetime
from pathlib import Path
from common import _req, STATE, sb_upsert, now_denver

DAYS       = int(sys.argv[1]) if len(sys.argv) > 1 else 120
LOOKBACK   = 20
VOL_MULT   = 1.5
MAX_EXT    = 0.15      # >15% above the 20d high = RUNNING, no entry
TRAIL      = {"BTC": 0.12, "ETH": 0.12, "SOL": 0.12}
TRAIL_DEF  = 0.18
HALF_AT    = 0.25
SLIP       = 0.005     # each way
MAJORS     = {"BTC", "ETH", "SOL"}
HIST       = STATE / "hist"; HIST.mkdir(parents=True, exist_ok=True)

def universe():
    return json.load(open(Path(__file__).parent / "universe.json"))

def id_map(symbols):
    """symbol -> coingecko id, from the top-500 by market cap (same approach as the radar)."""
    p = STATE / "cg_ids.json"
    if p.exists() and time.time() - p.stat().st_mtime < 7 * 86400:
        m = json.load(open(p))
        if all(s in m for s in symbols if s not in ("PUMP",)): return m
    m = {}
    for page in (1, 2):
        rows = _req(f"https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page={page}")
        for r in rows:
            s = (r.get("symbol") or "").upper()
            if s in symbols and s not in m: m[s] = r["id"]
        time.sleep(3)
    m.setdefault("PUMP", "pump-fun")
    json.dump(m, open(p, "w"))
    return m

def history(cid, days):
    f = HIST / f"{cid}.json"
    if f.exists() and time.time() - f.stat().st_mtime < 20 * 3600:
        return json.load(open(f))
    j = _req(f"https://api.coingecko.com/api/v3/coins/{cid}/market_chart?vs_currency=usd&days={days}&interval=daily", retries=4)
    px = [(int(t // 1000), v) for t, v in j.get("prices", [])]
    vol = [v for _, v in j.get("total_volumes", [])]
    n = min(len(px), len(vol))
    out = [{"t": px[i][0], "c": px[i][1], "v": vol[i]} for i in range(n)]
    json.dump(out, open(f, "w"))
    time.sleep(2.5)   # stay under the free-tier limit
    return out

def simulate(sym, bars, btc, mode):
    """mode 'breakout' = the rule under test; 'extended' = +70%/30d analog. Returns list of trade dicts."""
    trail = TRAIL.get(sym, TRAIL_DEF)
    trades, i = [], LOOKBACK + 30
    while i < len(bars):
        c = bars[i]["c"]; v = bars[i]["v"]
        window = bars[i - LOOKBACK:i]
        hi20 = max(b["c"] for b in window); avgv = st.mean(b["v"] for b in window) or 1
        r7 = c / bars[i - 7]["c"] - 1 if i >= 7 else 0
        btc7 = btc[i]["c"] / btc[i - 7]["c"] - 1 if i >= 7 and i < len(btc) else 0
        if mode == "breakout":
            sig = c > hi20 and v >= VOL_MULT * avgv and r7 > btc7 and (c / hi20 - 1) <= MAX_EXT
        else:
            r30 = c / bars[i - 30]["c"] - 1
            sig = r30 >= 0.70 and (i == LOOKBACK + 30 or bars[i - 1]["c"] / bars[i - 31]["c"] - 1 < 0.70)
        if not sig:
            i += 1; continue
        entry = c * (1 + SLIP); high = c; units = 1.0; half_done = False; pnl_banked = 0.0
        j = i + 1; exit_px = None; reason = "eod"
        while j < len(bars):
            p = bars[j]["c"]; high = max(high, p)
            if not half_done and p >= entry * (1 + HALF_AT):
                pnl_banked += 0.5 * (p * (1 - SLIP) - entry); units = 0.5; half_done = True
            stop = high * (1 - trail)
            if p <= stop:
                exit_px = min(p, stop) * (1 - SLIP); reason = "trail"; break
            j += 1
        if exit_px is None:
            exit_px = bars[-1]["c"] * (1 - SLIP); j = len(bars) - 1
        pnl = pnl_banked + units * (exit_px - entry)
        trades.append({"sym": sym, "entry_day": bars[i]["t"], "days": j - i, "ret": pnl / entry,
                       "reason": reason, "half": half_done,
                       "mfe": high / entry - 1})
        i = j + 1    # one position per name at a time
    return trades

def summarize(name, trades, btc_ret):
    if not trades:
        return f"{name}: no trades"
    r = [t["ret"] for t in trades]; wins = [x for x in r if x > 0]; losses = [x for x in r if x <= 0]
    exp = st.mean(r)
    total_100 = sum(100 * x for x in r)
    lines = [f"── {name} ──",
             f"trades {len(r)} | win-rate {len(wins)/len(r)*100:.0f}% | expectancy {exp*100:+.2f}%/trade",
             f"avg win {st.mean(wins)*100:+.1f}%  avg loss {st.mean(losses)*100 if losses else 0:+.1f}%  "
             f"best {max(r)*100:+.1f}%  worst {min(r)*100:+.1f}%  median hold {st.median(t['days'] for t in trades):.0f}d",
             f"$100 per trade -> {total_100:+.0f} total | half-off hit on {sum(t['half'] for t in trades)} trades | "
             f"exited by trail {sum(t['reason']=='trail' for t in trades)}",
             f"BTC buy-and-hold same window: {btc_ret*100:+.1f}%"]
    by = {}
    for t in trades: by.setdefault(t["sym"], []).append(t["ret"])
    top = sorted(by.items(), key=lambda kv: -sum(kv[1]))[:6]
    bot = sorted(by.items(), key=lambda kv: sum(kv[1]))[:4]
    lines.append("best names: " + ", ".join(f"{s} {sum(v)*100:+.0f}% ({len(v)})" for s, v in top))
    lines.append("worst names: " + ", ".join(f"{s} {sum(v)*100:+.0f}% ({len(v)})" for s, v in bot))
    return "\n".join(lines)

def main():
    syms = universe(); ids = id_map(set(syms))
    btc = history("bitcoin", DAYS)
    have, missing, allb, alle = 0, [], [], []
    for s in syms:
        cid = ids.get(s)
        if not cid: missing.append(s); continue
        try:
            bars = history(cid, DAYS)
        except Exception as e:
            missing.append(f"{s}({type(e).__name__})"); continue
        if len(bars) < LOOKBACK + 40: missing.append(f"{s}(short)"); continue
        have += 1
        allb += simulate(s, bars, btc, "breakout")
        alle += simulate(s, bars, btc, "extended")
    btc_ret = btc[-1]["c"] / btc[LOOKBACK + 30]["c"] - 1
    hdr = (f"BREAKOUT BACKTEST — Robinhood universe, {DAYS} days to {datetime.date.today()}, {have} names with data"
           f" ({len(missing)} skipped: {', '.join(missing[:12])}{'…' if len(missing) > 12 else ''})\n"
           f"rule: 20d-high close + vol>={VOL_MULT}x + RS>BTC(7d) + not >{int(MAX_EXT*100)}% extended | "
           f"exit: trail 12%/18% + half at +25% | slippage {SLIP*100:.1f}% each way\n")
    out = hdr + "\n" + summarize("BREAKOUT RULE (A4)", allb, btc_ret) + "\n\n" + summarize("EXTENDED ANALOG (+70%/30d, same exits)", alle, btc_ret)
    print(out)
    (STATE / "backtest_last.txt").write_text(out)
    sb_upsert("pa_memory", [{"topic": "breakout-backtest", "fact": out, "source": "desk-loop", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")

if __name__ == "__main__":
    main()
