#!/usr/bin/env python3
"""BUILD REQUEST #13 (trading desk, 2026-09-08) — A11 ANCHOR MONITORING. Safety-critical.

A11 left BTC and SOL with NO resting stops by design, and its own text retired the old instruction
to watch fixed anchor stop levels. That retirement shipped; the replacement never did, so from
2026-09-09 the anchors had neither a stop nor a regime check — roughly 69% of the book watched by
nothing. This is the replacement.

Every run:
  • BTC and SOL weekly closes vs their 20-week moving average, built from COMPLETED weeks only
    (the running week is excluded — a Tuesday dip is not a weekly close).
  • BTC dominance trend.
  • ETF net flows, 2-week sum.

If a de-risk condition has fired, push immediately at high priority with the exact order to place,
and write the brief to pa_memory topic 'loop-briefs'. Every run also leaves state/a11_status.json,
which the 08:00 heartbeat reads, so each anchor's distance to its 20-week MA is reported even when
nothing has fired: silence must never be mistaken for safety.

THREE RULES THIS FILE KEEPS:
  1. An input we could not read is UNKNOWN, never "fine". Every run states how many of the three
     inputs it actually had. ONLY the rule A11 names — a completed weekly close below the 20-week MA
     — fires a push. ETF flows and dominance are reported as context on every run and carry NO
     threshold, because no backtested threshold for them exists and inventing one here would make it
     look like a tested rule. If the desk wants them to fire, the desk sets the level.
  2. It runs on its OWN timer, not inside wake.sh, because wake.sh exits early when the AI spend cap
     trips. A monitor that stops watching the book when the token budget runs out is not a monitor.
  3. It pushes at most once per ISO week per symbol per condition, so a fired state cannot turn into
     an hourly alarm that trains him to ignore it — but a NEW condition pushes immediately.

stdlib only, same as the rest of the loop.
"""
import datetime, json, statistics
from common import (STATE, sb_get, sb_upsert, ntfy, prices, loop_enabled, now_denver, _req)

ANCHORS = ["BTC", "SOL"]
TRAIL_PCT = 30          # A11's catastrophe trail
MA_WEEKS = 20


def weekly_closes(symbol):
    """Completed weekly closes (UTC, week ending Sunday) from cg_history's daily series.
    Returns [(week_end_date, close)] oldest first, or [] when the series is missing."""
    rows = sb_get("cg_history", f"symbol=eq.{symbol}&select=prices,updated_at")
    if not rows or not rows[0].get("prices"):
        return []
    by_week = {}
    for point in rows[0]["prices"]:
        try:
            ts, px = point[0], float(point[1])
        except (TypeError, ValueError, IndexError):
            continue
        d = datetime.datetime.fromtimestamp(ts / 1000, datetime.timezone.utc).date()
        week_end = d + datetime.timedelta(days=(6 - d.weekday()))   # Sunday of that week
        # The last daily print inside a week IS that week's close.
        if week_end not in by_week or d >= by_week[week_end][0]:
            by_week[week_end] = (d, px)
    today = datetime.datetime.now(datetime.timezone.utc).date()
    this_week_end = today + datetime.timedelta(days=(6 - today.weekday()))
    return sorted((w, v[1]) for w, v in by_week.items() if w < this_week_end)


def ma_state(symbol):
    wk = weekly_closes(symbol)
    if len(wk) < MA_WEEKS + 1:
        return {"symbol": symbol, "ok": False, "reason": f"only {len(wk)} completed weekly closes, need {MA_WEEKS + 1}"}
    closes = [c for _, c in wk]
    ma = statistics.fmean(closes[-MA_WEEKS:])
    prev_ma = statistics.fmean(closes[-MA_WEEKS - 1:-1])
    last_w, last_c = wk[-1]
    return {
        "symbol": symbol, "ok": True, "week_end": last_w.isoformat(),
        "close": round(last_c, 6), "ma20w": round(ma, 6),
        "dist_pct": round((last_c - ma) / ma * 100, 2),
        "ma_rising": ma >= prev_ma,
        "below": last_c < ma,
    }


def dominance():
    """BTC dominance now, plus a trend built from our own daily record. CoinGecko's /global endpoint
    serves the current reading only, so the trend is honest about how much history it has."""
    p = STATE / "dominance.jsonl"
    today = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    now_pct = None
    try:
        g = _req("https://api.coingecko.com/api/v3/global", retries=2)
        now_pct = float(g["data"]["market_cap_percentage"]["btc"])
    except Exception as e:
        return {"ok": False, "reason": f"coingecko /global unreachable: {e}"}
    hist = []
    if p.exists():
        for line in p.read_text().splitlines():
            try:
                hist.append(json.loads(line))
            except Exception:
                pass
    if not hist or hist[-1].get("date") != today:
        with open(p, "a") as f:
            f.write(json.dumps({"date": today, "btc_pct": round(now_pct, 3)}) + "\n")
        hist.append({"date": today, "btc_pct": round(now_pct, 3)})
    cutoff = (datetime.datetime.now(datetime.timezone.utc).date() - datetime.timedelta(days=14)).isoformat()
    window = [h for h in hist if h.get("date", "") >= cutoff]
    if len(window) < 7:
        return {"ok": True, "now": round(now_pct, 2), "trend": None,
                "note": f"trend building — {len(window)}/7 days recorded"}
    change = now_pct - window[0]["btc_pct"]
    return {"ok": True, "now": round(now_pct, 2), "trend": round(change, 2),
            "note": f"{'rising' if change > 0 else 'falling'} {abs(change):.2f} pts over {len(window)} days"}


def etf_flows():
    """Net flow into the US spot BTC ETFs, US$m, from farside.co.uk's all-data table.
    Farside 403s a browser User-Agent from this box but serves the loop's own UA, so it is read here
    rather than declared unreachable. Parentheses are negative, '-' means the fund did not report.
    Returns the 2-week sum #13 asks for, with the 5-day sum and the last print for context. On any
    failure it returns ok=False with the reason: an unread input is UNKNOWN, never zero."""
    import re, html as _html
    try:
        page = _req("https://farside.co.uk/bitcoin-etf-flow-all-data/", retries=2, timeout=25)
    except Exception as e:
        return {"ok": False, "reason": f"farside unreachable: {e}"}

    def num(cell):
        c = cell.replace(",", "").strip()
        if c in ("", "-", "–"):
            return None
        neg = c.startswith("(") and c.endswith(")")
        c = c.strip("()")
        try:
            v = float(c)
        except ValueError:
            return None
        return -v if neg else v

    series = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", page, re.S):
        cells = [_html.unescape(re.sub(r"<[^>]+>", "", c)).strip() for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if len(cells) < 3:
            continue
        try:
            d = datetime.datetime.strptime(cells[0], "%d %b %Y").date()
        except ValueError:
            continue
        total = num(cells[-1])
        if total is not None:
            series.append((d, total))
    if not series:
        return {"ok": False, "reason": "farside answered but no dated rows parsed — table shape changed"}
    series.sort()
    last_date = series[-1][0]
    two_wk = sum(v for d, v in series if d > last_date - datetime.timedelta(days=14))
    five_d = sum(v for d, v in series if d > last_date - datetime.timedelta(days=7))
    return {"ok": True, "sum_2w_musd": round(two_wk, 1), "sum_5d_musd": round(five_d, 1),
            "last_date": last_date.isoformat(), "last_musd": round(series[-1][1], 1), "rows": len(series),
            "note": f"US spot BTC ETFs, net US$m, farside table through {last_date.isoformat()}"}


def etf_line(etf):
    if not etf.get("ok"):
        return f"UNREAD — {etf.get('reason')}"
    return (f"2-week net {etf['sum_2w_musd']:+,.1f}m (5-day {etf['sum_5d_musd']:+,.1f}m, "
            f"last print {etf['last_date']} {etf['last_musd']:+,.1f}m)")


def main():
    if not loop_enabled():
        print("loop disabled — A11 monitor still runs (safety), continuing")

    px = prices(ANCHORS)
    qty = {}
    try:
        for r in sb_get("live_holdings", "select=symbol,qty"):
            if r["symbol"] in ANCHORS:
                qty[r["symbol"]] = float(r["qty"])
    except Exception:
        pass

    dom = dominance()
    etf = etf_flows()
    inputs_ok = 1 + (1 if dom.get("ok") else 0) + (1 if etf.get("ok") else 0)   # MA is input #1

    status, fired = [], []
    for sym in ANCHORS:
        s = ma_state(sym)
        s["price_now"] = px.get(sym)
        status.append(s)
        if s.get("ok") and s["below"]:
            fired.append(s)

    # ── push, deduped to once per ISO week per symbol ──
    sp = STATE / "a11_state.json"
    seen = json.loads(sp.read_text()) if sp.exists() else {}
    iso_week = datetime.datetime.now(datetime.timezone.utc).strftime("%G-W%V")
    pushed = []
    for s in fired:
        key = f"{s['symbol']}:below_20wma"
        if seen.get(key) == iso_week:
            continue
        now_px = s.get("price_now")
        trail_level = round(now_px * (1 - TRAIL_PCT / 100.0), 2) if now_px else None
        units = qty.get(s["symbol"])
        spec = (f"place a {TRAIL_PCT}% trailing stop on {units if units is not None else 'ALL'} {s['symbol']}"
                + (f" — from ${now_px:,.2f} that rests at ${trail_level:,.2f}" if trail_level else ""))
        msg = (f"{s['symbol']} weekly close {s['close']:,.2f} (week ending {s['week_end']}) is BELOW its "
               f"{MA_WEEKS}-week MA {s['ma20w']:,.2f} — {s['dist_pct']}%.\n\nORDER: {spec}.\n\n"
               f"CONTEXT (not part of the trigger): BTC dominance {dom.get('now', '?')} "
               f"({dom.get('note', dom.get('reason', '?'))}). ETF flows {etf_line(etf)}.\n"
               f"Verdict uses {inputs_ok} of 3 inputs. The anchors carry no resting stop, so nothing "
               f"places this order but you.")
        st = ntfy(f"⛔ A11 DE-RISK FIRED — {s['symbol']}", msg, "urgent", force=True)
        seen[key] = iso_week
        pushed.append({"symbol": s["symbol"], "sent": st, "spec": spec})
    # Clear the marker when a symbol recovers, so the next break pushes again.
    for sym in ANCHORS:
        if not any(f["symbol"] == sym for f in fired):
            seen.pop(f"{sym}:below_20wma", None)
    sp.write_text(json.dumps(seen))

    line = " · ".join(
        f"{s['symbol']} {'BELOW' if s.get('below') else 'above'} 20wMA "
        f"{s['dist_pct']:+.1f}% (close {s['close']:,.2f} vs {s['ma20w']:,.2f})" if s.get("ok")
        else f"{s['symbol']} UNKNOWN — {s.get('reason')}"
        for s in status)
    payload = {"at": now_denver().isoformat(), "line": line, "status": status,
               "dominance": dom, "etf": etf, "inputs_ok": inputs_ok, "fired": [f["symbol"] for f in fired],
               "pushed": pushed}
    (STATE / "a11_status.json").write_text(json.dumps(payload, indent=1))

    # ── loop-briefs: the desk's own record, newest first, bounded ──
    brief = (f"[{now_denver().isoformat()}] A11 ANCHOR CHECK — {line}. "
             f"BTC dominance {dom.get('now', '?')} ({dom.get('note', dom.get('reason', '?'))}). "
             f"ETF flows {etf_line(etf)}. Inputs used {inputs_ok}/3. "
             + (f"FIRED: {', '.join(f['symbol'] for f in fired)}; pushed {pushed}." if fired else "Nothing fired."))
    try:
        old = sb_get("pa_memory", "topic=eq.loop-briefs&select=fact")
        prev = old[0]["fact"] if old else ""
        sb_upsert("pa_memory", [{"topic": "loop-briefs", "fact": (brief + "\n" + prev)[:20000],
                                 "source": "desk-loop/a11_monitor", "active": True,
                                 "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
    except Exception as e:
        print(f"loop-briefs write failed: {e}")

    print(brief)


if __name__ == "__main__":
    main()
