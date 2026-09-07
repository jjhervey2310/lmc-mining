#!/usr/bin/env python3
"""RIGOROUS SLEEVE AUDIT (build request #10, review #2 spec, 2026-09-06). Writes pa_memory 'backtest-audit'.
Every item of the spec, in order:
 (a) 20-day high = the previous 20 COMPLETED days EXCLUDING the signal day; the volume average is defined on the
     same window; ENTRY at the NEXT bar's open (the close signal is only knowable after the close).
 (b) COSTS: 1.9% round trip (0.95%/side) + 1% slippage each side on alts (0 on BTC/ETH/SOL) + MISSED-LIMIT modelling:
     a stop-limit 5% under the stop is missed when the day opens more than 5% below the stop; the exit then fills at
     that day's close (market, late). Operating cost line = $10/mo API cap + $6/mo droplet, reported against P&L.
 (c) trade count, median return, avg win / avg loss, max drawdown, holding periods.
 (d) results EXCLUDING the top 1, 3 and 5 winners.
 (e) WALK-FORWARD: the trail/TP grid is chosen on 2023-2024 by expectancy and evaluated UNCHANGED on 2025-2026.
 (f) UNIVERSE = every Coinbase Exchange USD pair, online AND delisted, each tradable only while it has candles
     (delisted names stop at their delisting) — no survivorship. The RH-listed-today subset is reported beside it
     so the survivorship gap is visible. Robinhood's own historical listings are not published; Coinbase USD is the
     nearest tradable-universe proxy, stated as such.
 (g) PORTFOLIO SIMULATION with the desk's actual mechanics: $125/wk deposits (Mondays), 90% anchors 50/50 BTC/SOL
     at the next open, 10% reserve; sleeve entries $50 flat by the breakout rule, capped by the 15% sleeve cap,
     10% per name and the 5% uncommitted-cash floor (skip below $50); stops/trails as A9; proceeds to cash.
 (h) BENCHMARKS: the same deposits on the same dates into BTC/SOL anchor-only, and into BTC only.
 (i) REGIME split: BULL = BTC close above a RISING 200-day SMA (daily) at the signal, vs no filter.
 (j) ANCHOR trails tested separately for BTC and SOL: none / 30% / 20% off the highest close since entry, with max
     drawdown, recovery time (trough -> prior peak) and explicit re-entry on a close > 20-day high.
No live rule changes: the retrospective consumes this. Run with LMC_DESK_ROOT pointing at a state/cb candle cache."""
import json, os, sys, datetime, statistics as st
from pathlib import Path
from common import STATE, sb_upsert

CB = STATE / "cb"
COST = 0.0095                    # per side
SLIP_ALT = 0.01                  # per side, non-majors
MAJORS = {"BTC", "ETH", "SOL"}
LOOKBACK, VOL_MULT, MAX_EXT = 20, 1.5, 0.15
MISS_GAP = 0.05                  # stop-limit 5% under the stop is missed if the open gaps further
WEEKLY_DEPOSIT, ENTRY_USD = 125.0, 50.0
SLEEVE_CAP, NAME_CAP, CASH_FLOOR = 0.15, 0.10, 0.05
OPEX_MONTH = 16.0                # $10 API cap + $6 droplet
SPLIT = datetime.date(2025, 1, 1)
SKIP = {"USDT", "USDC", "DAI", "PYUSD", "GYEN", "BUSD", "UST", "MUSD", "PAX", "GUSD", "USDP", "TUSD", "EURC", "WBTC", "CBETH", "WETH", "WAMPL", "WLUNA", "PAXG", "CBBTC", "USDS", "USDE", "RLUSD"}

def load():
    data = {}
    for f in sorted(CB.glob("*.json")):
        s = f.stem
        if s in SKIP: continue
        try: bars = json.load(open(f))
        except Exception: continue
        if isinstance(bars, list) and len(bars) >= 60: data[s] = bars
    return data

def side_cost(sym): return COST + (0 if sym in MAJORS else SLIP_ALT)
def d(t): return datetime.date.fromtimestamp(t)

def btc_regime(btc):
    """BULL on day i when close > 200d SMA and the SMA is above its value 20 days earlier."""
    closes = [b["c"] for b in btc]; out = {}
    run = 0.0; sma = [None] * len(closes)
    for i, c in enumerate(closes):
        run += c
        if i >= 200: run -= closes[i - 200]
        if i >= 199: sma[i] = run / 200
    for i in range(len(closes)):
        out[btc[i]["t"]] = bool(sma[i] and sma[i - 20] and closes[i] > sma[i] and sma[i] > sma[i - 20]) if i >= 219 else False
    return out

def signals(bars, btc_by_t, btc):
    """(a): signal on completed bar i; window = bars[i-20:i] (today excluded). Entry is bar i+1's open."""
    out = []
    for i in range(LOOKBACK + 8, len(bars) - 1):
        w = bars[i - LOOKBACK:i]
        hi20 = max(b["c"] for b in w); avgv = st.mean(b["v"] for b in w) or 1
        c, v = bars[i]["c"], bars[i]["v"]
        bi = btc_by_t.get(bars[i]["t"])
        if bi is None or bi < 7: continue
        r7 = c / bars[i - 7]["c"] - 1; b7 = btc[bi]["c"] / btc[bi - 7]["c"] - 1
        if c > hi20 and v >= VOL_MULT * avgv and r7 > b7 and c / hi20 - 1 <= MAX_EXT:
            out.append((i, v / avgv))
    return out

def trade(sym, bars, i, t1, t2, tp_at, tp_frac):
    """Enter at bars[i+1].open. Stop = max(20d low of the signal window, entry x (1-t1)); trail on completed closes;
    leash widens to t2 once the close has been +50%; optional 1/3 off at +tp_at. Exits on the day's low with
    missed-limit modelling. Returns (fraction of entry, holding days, exit kind)."""
    sc = side_cost(sym)
    e = i + 1
    entry = bars[e]["o"] * (1 + sc)
    low20 = min(b["l"] for b in bars[i - LOOKBACK:i])
    stop = max(low20, entry * (1 - t1)); high = bars[e]["c"]; wide = False; units = 1.0; banked = 0.0; took = False
    for j in range(e + 1, len(bars)):
        b = bars[j]
        if b["l"] <= stop:
            if b["o"] <= stop:                                   # gap through the stop
                fill = b["o"] if b["o"] >= stop * (1 - MISS_GAP) else b["c"]   # limit missed -> market at the close
                kind = "gap" if b["o"] >= stop * (1 - MISS_GAP) else "missed-limit"
            else: fill, kind = stop, "stop"
            fill *= (1 - sc)
            return (banked + units * (fill - entry)) / entry, j - e, kind
        if b["c"] >= entry * 1.5: wide = True
        if b["c"] > high:
            high = b["c"]; stop = max(stop, high * (1 - (t2 if wide else t1)))
        if tp_frac and not took and b["c"] >= entry * (1 + tp_at):
            banked += tp_frac * (b["c"] * (1 - sc) - entry); units -= tp_frac; took = True
    fill = bars[-1]["c"] * (1 - sc)
    return (banked + units * (fill - entry)) / entry, len(bars) - 1 - e, "open"

def stats(tr):
    if not tr: return None
    r = [x["ret"] for x in tr]; w = [x for x in r if x > 0]; l = [x for x in r if x <= 0]
    eq = peak = mdd = 0.0
    for x in sorted(tr, key=lambda x: x["exit_t"]):
        eq += 100 * x["ret"]; peak = max(peak, eq); mdd = min(mdd, eq - peak)
    days = [x["days"] for x in tr]
    return dict(n=len(r), win=len(w) / len(r) * 100, med=st.median(r) * 100, aw=st.mean(w) * 100 if w else 0, al=st.mean(l) * 100 if l else 0,
                exp=st.mean(r) * 100, total=eq, mdd=mdd, hold_med=st.median(days), hold_mean=st.mean(days),
                missed=sum(x["kind"] == "missed-limit" for x in tr), gaps=sum(x["kind"] == "gap" for x in tr))

def fmt_stats(name, s):
    if not s: return f"{name:<46} (no trades)"
    return f"{name:<46} n={s['n']:>4} win {s['win']:>4.0f}% med {s['med']:>+6.1f}% avgW {s['aw']:>+5.1f}% avgL {s['al']:>+5.1f}% exp {s['exp']:>+6.2f}% total ${s['total']:>+7.0f} maxDD ${s['mdd']:>6.0f} hold med {s['hold_med']:>3.0f}d / mean {s['hold_mean']:>4.0f}d missed-limit {s['missed']} gaps {s['gaps']}"

def run_rule(data, btc, btc_by_t, regime, t1, t2, tp_at, tp_frac, universe=None, bull_only=False, start=None, end=None):
    """Every signal taken (one open trade per name at a time). No weekly cap — A9 replaced it with slots; the
    portfolio simulation below is where money limits entries."""
    trades = []
    for sym, bars in data.items():
        if universe is not None and sym not in universe: continue
        busy = -1
        for i, volx in signals(bars, btc_by_t, btc):
            if i <= busy: continue
            day = d(bars[i]["t"])
            if start and day < start: continue
            if end and day >= end: continue
            if bull_only and not regime.get(bars[i]["t"], False): continue
            ret, days, kind = trade(sym, bars, i, t1, t2, tp_at, tp_frac)
            busy = i + 1 + days
            trades.append({"sym": sym, "t": bars[i]["t"], "exit_t": bars[min(i + 1 + days, len(bars) - 1)]["t"], "ret": ret, "days": days, "kind": kind})
    return trades

def exclude_top(tr, k):
    return sorted(tr, key=lambda x: -x["ret"])[k:]

def portfolio(data, btc, sol, btc_by_t, regime, anchor_trail, sleeve_on, btc_only=False, t1=0.18, t2=0.25, bull_only=False):
    """(g)/(h): daily simulation. Deposits every Monday; anchors bought at that day's open; sleeve entries at the open
    after a signal, $50 flat, subject to caps and the cash floor; anchor catastrophe trail optional."""
    days = sorted({b["t"] for b in btc})
    bt = {b["t"]: b for b in btc}; sl = {b["t"]: b for b in sol}
    idx = {sym: {b["t"]: k for k, b in enumerate(bars)} for sym, bars in data.items()}
    sigs = {}
    if sleeve_on:
        for sym, bars in data.items():
            if sym in MAJORS: continue
            for i, volx in signals(bars, btc_by_t, btc):
                if bull_only and not regime.get(bars[i]["t"], False): continue
                sigs.setdefault(bars[i + 1]["t"], []).append((volx, sym, i))
    cash = 0.0; deposits = 0.0
    anchors = {"BTC": {"qty": 0.0, "high": 0.0, "out": False}, "SOL": {"qty": 0.0, "high": 0.0, "out": False}}
    sleeve = {}; closed = []; curve = []; peak = 0.0; mdd = 0.0; pnl_trough = 0.0; trough_day = None; peak_day = None; rec_days = None
    for t in days:
        day = d(t); b = bt[t]; s = sl.get(t)
        if day.weekday() == 0:
            cash += WEEKLY_DEPOSIT; deposits += WEEKLY_DEPOSIT
            spend = WEEKLY_DEPOSIT * (0.9 if sleeve_on else 1.0)          # 90% of THE DEPOSIT to anchors, 10% to the reserve (A9 §5)
            legs = [("BTC", spend)] if btc_only else [("BTC", spend / 2), ("SOL", spend / 2)]
            for sym, usd in legs:
                bar = b if sym == "BTC" else s
                if not bar: continue
                if anchors[sym]["out"]:                                     # trailed out: the leg waits in parked cash for the re-entry close
                    anchors[sym]["parked"] = anchors[sym].get("parked", 0.0) + usd; continue
                px = bar["o"] * (1 + COST); anchors[sym]["qty"] += usd / px; cash -= usd
                anchors[sym]["high"] = max(anchors[sym]["high"], bar["c"])
        # anchor catastrophe trail on completed closes; re-enter (all idle cash earmarked for it) on close > 20d high
        for sym in (["BTC"] if btc_only else ["BTC", "SOL"]):
            bar = b if sym == "BTC" else s
            if not bar: continue
            a = anchors[sym]
            if a["out"]:
                src = btc if sym == "BTC" else sol; k = (btc_by_t if sym == "BTC" else {x["t"]: n for n, x in enumerate(sol)}).get(t)
                if k and k >= 20 and bar["c"] > max(x["c"] for x in src[k - 20:k]):
                    a["out"] = False; usd = a.get("parked", 0.0); a["parked"] = 0.0
                    px = bar["c"] * (1 + COST); a["qty"] = usd / px; cash -= usd; a["high"] = bar["c"]
            elif a["qty"] > 0:
                a["high"] = max(a["high"], bar["c"])
                if anchor_trail and bar["c"] < a["high"] * (1 - anchor_trail):
                    proceeds = a["qty"] * bar["c"] * (1 - COST); cash += proceeds; a["parked"] = proceeds; a["qty"] = 0.0; a["out"] = True
        # sleeve exits (on the day's range) then entries at the open
        for sym in list(sleeve):
            pos = sleeve[sym]; bars = data[sym]; k = idx[sym].get(t)
            if k is None:
                if bars[-1]["t"] < t:                                # delisted while held: forced out at the last close
                    fill = bars[-1]["c"] * (1 - side_cost(sym)); cash += pos["units"] * fill
                    closed.append({"sym": sym, "ret": (fill - pos["entry"]) / pos["entry"], "kind": "delisted"}); del sleeve[sym]
                continue
            bar = bars[k]
            if bar["l"] <= pos["stop"]:
                if bar["o"] <= pos["stop"]: fill = bar["o"] if bar["o"] >= pos["stop"] * (1 - MISS_GAP) else bar["c"]
                else: fill = pos["stop"]
                fill *= (1 - side_cost(sym)); cash += pos["units"] * fill
                closed.append({"sym": sym, "ret": (fill - pos["entry"]) / pos["entry"], "kind": "stop"}); del sleeve[sym]; continue
            if bar["c"] >= pos["entry"] * 1.5: pos["wide"] = True
            if bar["c"] > pos["high"]:
                pos["high"] = bar["c"]; pos["stop"] = max(pos["stop"], pos["high"] * (1 - (t2 if pos["wide"] else t1)))
        if sleeve_on and t in sigs:
            book = cash + sum(anchors[x]["qty"] * (bt[t]["c"] if x == "BTC" else (s["c"] if s else 0)) for x in anchors) + sum(p["units"] * data[x][idx[x][t]]["c"] for x, p in sleeve.items() if t in idx[x])
            sleeve_val = sum(p["units"] * data[x][idx[x][t]]["c"] for x, p in sleeve.items() if t in idx[x])
            parked = sum(a.get("parked", 0.0) for a in anchors.values())    # anchor money waiting for its re-entry is NOT sleeve powder
            for volx, sym, i in sorted(sigs[t], reverse=True):
                if sym in sleeve: continue
                room = min(SLEEVE_CAP * book - sleeve_val, NAME_CAP * book, (cash - parked) - CASH_FLOOR * book)
                if room < ENTRY_USD: break
                bars = data[sym]; e = i + 1
                if bars[e]["t"] != t: continue
                sc = side_cost(sym); entry = bars[e]["o"] * (1 + sc)
                low20 = min(x["l"] for x in bars[i - LOOKBACK:i])
                sleeve[sym] = {"units": ENTRY_USD / entry, "entry": entry, "stop": max(low20, entry * (1 - t1)), "high": bars[e]["c"], "wide": False}
                cash -= ENTRY_USD; sleeve_val += ENTRY_USD
        equity = cash + sum(anchors[x]["qty"] * (b["c"] if x == "BTC" else (s["c"] if s else 0)) for x in anchors) + sum(p["units"] * data[x][idx[x][t]]["c"] for x, p in sleeve.items() if t in idx[x])
        pnl = equity - deposits
        if pnl > peak: peak = pnl; peak_day = day
        if peak_day and pnl - peak < mdd: mdd = pnl - peak; trough_day = day; rec_days = None
        if trough_day and rec_days is None and pnl >= peak: rec_days = (day - trough_day).days
        curve.append((day, equity, deposits))
    equity = curve[-1][1]
    open_pnl = sum(p["units"] * (data[x][-1]["c"] - p["entry"]) for x, p in sleeve.items())
    return dict(equity=equity, deposits=deposits, pnl=equity - deposits, ret=(equity / deposits - 1) * 100 if deposits else 0,
                mdd=mdd, trough=trough_day, recovery=rec_days, closed=closed, sleeve_pnl=sum(ENTRY_USD * c["ret"] for c in closed) + open_pnl, n=len(closed) + len(sleeve))

def anchor_test(sym, bars, T):
    """(j): long from the first bar; exit on close < (1-T) x highest close since entry; re-enter on close > 20d high.
    Returns total return, max DD, recovery days (trough -> back to the prior peak), trades."""
    eq = 1.0; inpos = True; entry = bars[0]["c"] * (1 + COST); high = bars[0]["c"]; trades = 0
    peak = 1.0; mdd = 0.0; peak_i = 0; trough_i = None; rec = None; marks = []
    for i in range(20, len(bars)):
        b = bars[i]
        if inpos:
            high = max(high, b["c"]); mark = eq * b["c"] * (1 - COST) / entry
            if T and b["c"] < high * (1 - T): eq = mark; inpos = False; trades += 1
        else:
            mark = eq
            if b["c"] > max(x["c"] for x in bars[i - 20:i]): inpos = True; entry = b["c"] * (1 + COST); high = b["c"]; trades += 1
        marks.append(mark)
        if mark > peak: peak = mark; peak_i = i
        dd = mark / peak - 1
        if dd < mdd: mdd = dd; trough_i = i; rec = None
        if trough_i is not None and rec is None and mark >= peak: rec = i - trough_i
    if inpos: eq = eq * bars[-1]["c"] * (1 - COST) / entry
    return eq - 1, mdd, rec, trades

def main():
    data = load()
    if "BTC" not in data or "SOL" not in data: print("need BTC and SOL candles"); return
    btc, sol = data["BTC"], data["SOL"]; btc_by_t = {b["t"]: k for k, b in enumerate(btc)}
    regime = btc_regime(btc)
    rh = set(json.load(open(Path(__file__).parent / "universe.json")))
    status = {}
    up = STATE.parent / "universe_cb.json"
    if up.exists(): status = json.load(open(up)).get("status", {})
    delisted = {s for s in data if status.get(s) == "delisted"}
    first = min(d(b[0]["t"]) for b in data.values()); last = max(d(b[-1]["t"]) for b in data.values())
    months = (last - first).days / 30.4
    L = [f"SLEEVE AUDIT (build request #10) — Coinbase Exchange USD pairs incl. DELISTED, daily candles {first} -> {last}. Universe {len(data)} names ({len(delisted)} delisted, {len([s for s in data if s in rh])} on Robinhood today). Costs: 1.9% round trip + 1%/side slippage on alts + missed-limit modelling (stop-limit 5% under the stop; a deeper gap fills at that day's close). Entry at the NEXT open after a completed-close signal; the 20-day window excludes the signal day.",
         f"Operating cost line: ${OPEX_MONTH:.0f}/mo (API cap $10 + droplet $6) = ${OPEX_MONTH * months:,.0f} over the {months:.0f}-month window — compare against every total$ below (which is on $100/trade, so scale: at $50/trade halve the totals).", ""]
    A9 = dict(t1=0.18, t2=0.25, tp_at=9.9, tp_frac=0.0)
    L.append("=== (a)(b)(c)(f) A9 RULE AS WRITTEN — every signal, one open trade per name, $100/trade ===")
    full = run_rule(data, btc, btc_by_t, regime, **A9)
    surv = run_rule(data, btc, btc_by_t, regime, universe=rh, **A9)
    L.append(fmt_stats("full universe incl. delisted", stats(full)))
    L.append(fmt_stats("RH-listed-today only (survivorship view)", stats(surv)))
    L.append(fmt_stats("delisted names only", stats([x for x in full if x["sym"] in delisted])))
    L.append("")
    L.append("=== (d) EXCLUDING THE TOP WINNERS (full universe) ===")
    for k in (1, 3, 5):
        s = stats(exclude_top(full, k)); L.append(fmt_stats(f"minus top {k}", s))
    top = sorted(full, key=lambda x: -x["ret"])[:5]
    L.append("top 5 trades: " + ", ".join(f"{x['sym']} {x['ret']*100:+.0f}% ({d(x['t'])})" for x in top))
    L.append("")
    L.append("=== (i) REGIME SPLIT — BULL = BTC close above a RISING 200d SMA at the signal ===")
    bull = run_rule(data, btc, btc_by_t, regime, bull_only=True, **A9)
    L.append(fmt_stats("BULL only", stats(bull)))
    L.append(fmt_stats("NOT bull (complement)", stats([x for x in full if not regime.get(x["t"], False)])))
    bull_days = sum(1 for t in regime.values() if t); L.append(f"BULL days: {bull_days} of {len(regime)} ({bull_days/len(regime)*100:.0f}%)")
    L.append("")
    L.append("=== (e) WALK-FORWARD — grid chosen on 2023-2024 by expectancy (n>=30), evaluated UNCHANGED on 2025-2026 ===")
    grid = [(t1, t2, tp) for t1 in (0.15, 0.18, 0.20) for t2 in (0.25, 0.30) for tp in ("none", "third@+50%")]
    rows = []
    for t1, t2, tp in grid:
        kw = dict(t1=t1, t2=t2, tp_at=0.5 if tp != "none" else 9.9, tp_frac=1/3 if tp != "none" else 0.0)
        a = stats(run_rule(data, btc, btc_by_t, regime, end=SPLIT, **kw)); b = stats(run_rule(data, btc, btc_by_t, regime, start=SPLIT, **kw))
        rows.append((t1, t2, tp, a, b))
        L.append(f"trail {int(t1*100)}->{int(t2*100)} TP {tp:<11} | IN 2023-24: n={a['n'] if a else 0:>3} exp {a['exp'] if a else 0:>+6.2f}% win {a['win'] if a else 0:>3.0f}% | OUT 2025-26: n={b['n'] if b else 0:>3} exp {b['exp'] if b else 0:>+6.2f}% win {b['win'] if b else 0:>3.0f}% maxDD ${b['mdd'] if b else 0:>6.0f}")
    best = max((r for r in rows if r[3] and r[3]["n"] >= 30), key=lambda r: r[3]["exp"], default=None)
    if best:
        t1, t2, tp, a, b = best
        L.append(f"CHOSEN IN-SAMPLE: trail {int(t1*100)}->{int(t2*100)} TP {tp} (exp {a['exp']:+.2f}%) -> OUT-OF-SAMPLE exp {b['exp'] if b else 0:+.2f}% on n={b['n'] if b else 0}. A9's own cell (18->25, no TP) out-of-sample: exp {next(r[4]['exp'] for r in rows if r[0]==0.18 and r[1]==0.25 and r[2]=='none') if next((r[4] for r in rows if r[0]==0.18 and r[1]==0.25 and r[2]=='none'), None) else 0:+.2f}%.")
    L.append("")
    L.append("=== (g)(h) PORTFOLIO SIMULATION — $125 every Monday, 90% anchors 50/50 BTC/SOL + 10% reserve, sleeve $50 flat by the A9 rule under the 15% / 10% / 5%-floor caps ===")
    sims = [
        ("A9 book: sleeve ON, anchor 30% trail", dict(anchor_trail=0.30, sleeve_on=True)),
        ("A9 book, sleeve ON, anchor NO trail", dict(anchor_trail=0.0, sleeve_on=True)),
        ("A9 book, sleeve ON (BULL signals only), anchor 30%", dict(anchor_trail=0.30, sleeve_on=True, bull_only=True)),
        ("BENCHMARK anchor-only BTC/SOL, no trail", dict(anchor_trail=0.0, sleeve_on=False)),
        ("BENCHMARK anchor-only BTC/SOL, 30% trail", dict(anchor_trail=0.30, sleeve_on=False)),
        ("BENCHMARK BTC-only, no trail", dict(anchor_trail=0.0, sleeve_on=False, btc_only=True)),
    ]
    for name, kw in sims:
        r = portfolio(data, btc, sol, btc_by_t, regime, **kw)
        L.append(f"{name:<52} deposits ${r['deposits']:>6,.0f} -> equity ${r['equity']:>8,.0f}  P&L ${r['pnl']:>+8,.0f} ({r['ret']:+.0f}%)  P&L maxDD ${r['mdd']:>7,.0f} (trough {r['trough']}, recovered in {r['recovery'] if r['recovery'] is not None else 'not yet'} d)" + (f"  sleeve trades {r['n']} contributing ${r['sleeve_pnl']:+,.0f}" if kw.get('sleeve_on') else ""))
    L.append(f"Operating cost over the same window: ${OPEX_MONTH * months:,.0f} — the sleeve's contribution must clear this to have paid for its own infrastructure.")
    L.append("")
    L.append("=== (j) ANCHOR TRAILS SEPARATELY — none / 30% / 20% off the highest close since entry, re-entry on a close > 20d high, from the first candle ===")
    for sym in ("BTC", "SOL"):
        cells = []
        for T in (0.0, 0.30, 0.20):
            r, dd, rec, n = anchor_test(sym, data[sym], T)
            cells.append(f"{'hold' if not T else f'{int(T*100)}% trail'}: {r*100:+.0f}% maxDD {dd*100:.0f}% recovery {f'{rec}d' if rec is not None else 'not yet'} trades {n}")
        L.append(f"{sym}: " + " | ".join(cells))
    L.append("")
    L.append("READ: (1) the no-survivorship number is the honest one — the RH-listed-today row overstates it by the gap shown. (2) A rule earns size only if its OUT-OF-SAMPLE expectancy is positive after costs AND the portfolio sim's sleeve contribution clears the operating cost line. (3) 'Recovered in' is trough-to-prior-peak on P&L (deposit-adjusted), not on raw equity. (4) Anchor trails: pick by drawdown+recovery, not return alone; if none beats hold on both, hold. No live rule changes from this file — retrospective decides.")
    out = "\n".join(L); print(out)
    (STATE / "backtest_audit.txt").write_text(out)
    if os.environ.get("AUDIT_NO_WRITE") != "1":
        sb_upsert("pa_memory", [{"topic": "backtest-audit", "fact": out[:24000], "source": "desk-loop backtest_audit.py", "active": True, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")

if __name__ == "__main__":
    main()
