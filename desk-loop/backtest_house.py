#!/usr/bin/env python3
"""HOUSE-RULES BACKTEST, Jan 2023 -> now (build request #5A). Daily candles from Coinbase Exchange
(keyless, full history; CoinGecko's free tier stops at 365 days). Cached under state/cb/.
Simulates the trading desk's rules EXACTLY as specified in #5A, with a parameter grid.
Writes pa_memory 'backtest-results'. Sunday retro consumes this; no live-trading changes."""
import json, time, sys, datetime, statistics as st, urllib.request, urllib.error
from pathlib import Path
from common import STATE, sb_upsert

START = "2023-01-01"
CB = STATE / "cb"; CB.mkdir(parents=True, exist_ok=True)
COST_SIDE = 0.0095          # 1.9% round trip
RATCHET_TRIGGER = 0.18      # close +18% above entry -> stop to entry x 1.0095
MATERIALITY = 0.02
STALL_DAYS = 10
MAX_PER_WEEK = 2
SIZE = 100.0

def universe():
    return json.load(open(Path(__file__).parent / "universe.json"))

def cb_get(url):
    for a in range(4):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "lmc-desk/1.0"}), timeout=30) as r:
                return json.loads(r.read().decode())
        except urllib.error.HTTPError as e:
            if e.code in (429, 500, 502, 503) and a < 3: time.sleep(3 * (a + 1)); continue
            if e.code == 404: return None
            raise
        except Exception:
            if a < 3: time.sleep(2); continue
            raise

def candles(sym):
    f = CB / f"{sym}.json"
    if f.exists() and time.time() - f.stat().st_mtime < 20 * 3600:
        return json.load(open(f))
    out = []
    start = datetime.datetime.fromisoformat(START).replace(tzinfo=datetime.timezone.utc)
    end_all = datetime.datetime.now(datetime.timezone.utc)
    cur = start
    while cur < end_all:
        nxt = min(cur + datetime.timedelta(days=299), end_all)
        j = cb_get(f"https://api.exchange.coinbase.com/products/{sym}-USD/candles?granularity=86400&start={cur.strftime('%Y-%m-%dT%H:%M:%SZ')}&end={nxt.strftime('%Y-%m-%dT%H:%M:%SZ')}")
        if j is None: return None
        out += [{"t": r[0], "l": r[1], "h": r[2], "o": r[3], "c": r[4], "v": r[5]} for r in j]
        cur = nxt; time.sleep(0.25)
    out = sorted({b["t"]: b for b in out}.values(), key=lambda b: b["t"])
    json.dump(out, open(f, "w"))
    return out

def signals(sym, bars):
    """Entry candidates per #5A: d1 < +15%, d30 < +70%, d7 > +5% with rising volume proxy."""
    sig = []
    for i in range(31, len(bars)):
        c = bars[i]["c"]; c1 = bars[i-1]["c"]; c7 = bars[i-7]["c"]; c30 = bars[i-30]["c"]
        if not (c1 and c7 and c30): continue
        d1, d7, d30 = c/c1-1, c/c7-1, c/c30-1
        vol7 = st.mean(b["v"] for b in bars[i-7:i]) or 0
        if d1 < 0.15 and d30 < 0.70 and d7 > 0.05 and bars[i]["v"] > vol7:
            sig.append(i)
    return sig

def simulate_trade(bars, i, stop_pct, trail):
    entry = bars[i]["c"] * (1 + COST_SIDE)
    low20 = min(b["l"] for b in bars[max(0, i-20):i]) if i > 0 else bars[i]["l"]
    stop = max(entry * (1 - stop_pct), low20)          # structure proxy unless it sits below the % cap
    entry_day_low = bars[i]["l"]
    hi_close = bars[i]["c"]; ratcheted = False
    j = i + 1
    while j < len(bars):
        b = bars[j]
        # exits are checked on the day's range: gap below stop fills at the open
        if b["l"] <= stop:
            fill = min(stop, b["o"]) * (1 - COST_SIDE)
            return (fill - entry) / entry, j - i, "stop" if not ratcheted else "trail"
        if j - i <= STALL_DAYS and b["c"] < entry_day_low:
            fill = bars[j+1]["c"] * (1 - COST_SIDE) if j + 1 < len(bars) else b["c"] * (1 - COST_SIDE)
            return (fill - entry) / entry, j - i + 1, "stall"
        if b["c"] > hi_close:
            hi_close = b["c"]
            if not ratcheted and hi_close >= entry * (1 + RATCHET_TRIGGER):
                stop = max(stop, entry * 1.0095); ratcheted = True
            elif ratcheted:
                cand = hi_close * trail
                if cand >= stop * (1 + MATERIALITY): stop = cand
        j += 1
    fill = bars[-1]["c"] * (1 - COST_SIDE)
    return (fill - entry) / entry, len(bars) - 1 - i, "open"

def run(data, stop_pct, trail):
    # global 2-entries-per-ISO-week cap, first-come by date then symbol (selection bias acknowledged)
    cands = []
    for sym, bars in data.items():
        for i in signals(sym, bars): cands.append((bars[i]["t"], sym, i))
    cands.sort()
    per_week, busy, trades = {}, {}, []
    for t, sym, i in cands:
        d = datetime.date.fromtimestamp(t); wk = d.isocalendar()[:2]
        if per_week.get(wk, 0) >= MAX_PER_WEEK: continue
        if busy.get(sym, -1) >= i: continue
        ret, days, why = simulate_trade(data[sym], i, stop_pct, trail)
        busy[sym] = i + days; per_week[wk] = per_week.get(wk, 0) + 1
        trades.append({"sym": sym, "t": t, "exit_t": data[sym][min(i + days, len(data[sym]) - 1)]["t"], "ret": ret, "days": days, "why": why})
    return trades

def stats(trades):
    if not trades: return None
    r = [x["ret"] for x in trades]; w = [x for x in r if x > 0]; l = [x for x in r if x <= 0]
    eq, peak, mdd = 0.0, 0.0, 0.0
    for x in sorted(trades, key=lambda x: x["exit_t"]):
        eq += SIZE * x["ret"]; peak = max(peak, eq); mdd = min(mdd, eq - peak)
    return {"n": len(r), "win": len(w)/len(r)*100, "avg_win": st.mean(w)*100 if w else 0, "avg_loss": st.mean(l)*100 if l else 0,
            "exp": st.mean(r)*100, "total": eq, "mdd": mdd, "stall": sum(x["why"]=="stall" for x in trades), "trail": sum(x["why"]=="trail" for x in trades)}

def main():
    syms = universe(); data = {}; skipped = []
    for s in syms:
        try:
            b = candles(s)
        except Exception as e:
            skipped.append(f"{s}({type(e).__name__})"); continue
        if not b or len(b) < 60: skipped.append(s); continue
        data[s] = b
    first = min(datetime.date.fromtimestamp(b[0]["t"]) for b in data.values())
    lines = [f"HOUSE-RULES BACKTEST — Robinhood universe, {len(data)} names with Coinbase daily candles, {first} -> {datetime.date.today()} (skipped {len(skipped)}: {', '.join(skipped)})",
             "RULES (per build request #5A): entry when d1<+15% & d30<+70% & d7>+5% with volume above its 7d mean; stop = max(-S%, 20-day low); ratchet to entry x1.0095 after a close +18%; then trail T x new-high close, 2% materiality; stall = close below entry-day low within 10 days -> exit next close; max 2 entries/ISO-week (global); $100 equal size; 1.9% round-trip cost.",
             "", f"{'stop':>6} {'trail':>6} {'n':>5} {'win%':>6} {'avgW%':>7} {'avgL%':>7} {'exp%':>7} {'total$':>8} {'maxDD$':>8} {'stall':>6} {'trail':>6}"]
    grid = {}
    for S in (0.15, 0.20, 0.25):
        for T in (0.85, 0.90, 0.95):
            tr = run(data, S, T); s = stats(tr); grid[(S, T)] = (tr, s)
            if s: lines.append(f"{int(S*100):>5}% {T:>6.2f} {s['n']:>5} {s['win']:>6.0f} {s['avg_win']:>7.1f} {s['avg_loss']:>7.1f} {s['exp']:>7.2f} {s['total']:>8.0f} {s['mdd']:>8.0f} {s['stall']:>6} {s['trail']:>6}")
    base_tr, base = grid[(0.20, 0.90)]
    by_year = {}
    for x in base_tr: by_year.setdefault(datetime.date.fromtimestamp(x["t"]).year, []).append(x["ret"])
    lines += ["", "BASE CASE (stop -20%, trail 0.90) BY YEAR: " + " | ".join(f"{y}: n={len(v)} exp {st.mean(v)*100:+.1f}% win {sum(1 for r in v if r>0)/len(v)*100:.0f}%" for y, v in sorted(by_year.items()))]
    by_sym = {}
    for x in base_tr: by_sym.setdefault(x["sym"], []).append(x["ret"])
    top = sorted(by_sym.items(), key=lambda kv: -sum(kv[1]))[:6]; bot = sorted(by_sym.items(), key=lambda kv: sum(kv[1]))[:5]
    lines.append("best names: " + ", ".join(f"{s} {sum(v)*100:+.0f}% ({len(v)})" for s, v in top))
    lines.append("worst names: " + ", ".join(f"{s} {sum(v)*100:+.0f}% ({len(v)})" for s, v in bot))
    bt = datetime.date.fromtimestamp(data["BTC"][0]["t"]) if "BTC" in data else None
    if "BTC" in data: lines.append(f"BTC buy-and-hold over the same window: {(data['BTC'][-1]['c']/data['BTC'][0]['c']-1)*100:+.0f}%")
    lines += ["", "OVERFITTING, STATED HONESTLY: (1) survivorship — the universe is what Robinhood lists TODAY, so every name that got delisted or died is missing and the sample is biased toward survivors; (2) many names have <2 years of history (listed 2024-25), so 'Jan 2023' is only true for the majors; (3) the 2-per-week cap is filled first-come by date, which is not how a desk would choose; (4) one parameter grid on one universe — the stop/trail cell that looks best is partly noise; treat differences of a few % expectancy as indistinguishable; (5) daily closes only — intraday stop wicks are approximated by the day's low."]
    out = "\n".join(lines); print(out)
    (STATE / "backtest_house_last.txt").write_text(out)
    sb_upsert("pa_memory", [{"topic": "backtest-results", "fact": out, "source": "desk-loop", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")

if __name__ == "__main__":
    main()
