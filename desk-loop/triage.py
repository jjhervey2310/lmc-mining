#!/usr/bin/env python3
"""FREE triage — pure code, no model. Runs often and cheaply; escalates to a paid
deep wake only when something mechanical is actually true. (Jacob's rule: spend
scales with the book, so the watching layer must cost nothing.)"""
import datetime, subprocess, json
from common import *

NEAR_STOP_PCT   = 6.0    # position within 6% of its stop
NEAR_LINE_PCT   = 2.0    # armed line within 2% of being hit
BOOK_MOVE_PCT   = 3.0    # book moved >3% since the last banked snapshot
RADAR_SCORE_MIN = 55.0

def main():
    if not loop_enabled():
        print("loop disabled"); return
    reasons = []
    holdings = sb_get("live_holdings", "select=symbol,qty,avg_cost")
    trigs = sb_get("desk_triggers", "active=eq.true&select=symbol,kind,level,spec")
    syms = sorted({h["symbol"] for h in holdings if h["symbol"] != "USD"} | {t["symbol"] for t in trigs})
    px = prices(syms)

    stops = {t["symbol"]: float(t["level"]) for t in trigs if t["kind"] == "stop"}
    for sym, stop in stops.items():
        p = px.get(sym)
        if p and stop > 0 and (p - stop) / stop * 100 <= NEAR_STOP_PCT:
            reasons.append(f"{sym} {((p-stop)/stop*100):.1f}% above its stop {stop}")

    for t in trigs:
        p = px.get(t["symbol"]); lvl = float(t["level"])
        if not p or lvl <= 0: continue
        if abs(p - lvl) / lvl * 100 <= NEAR_LINE_PCT:
            reasons.append(f"{t['symbol']} {t['kind']} line {lvl} within {abs(p-lvl)/lvl*100:.1f}%")

    snaps = sb_get("fund_snapshots", "select=snapshot_date,total&order=snapshot_date.desc&limit=1")
    if snaps:
        base = float(snaps[0]["total"]); tot, missing = book_value()
        # Deposits after the snapshot are not market moves (09-04: a $70 deposit read as "book +14%").
        dep = sum(float(f["amount"]) for f in sb_get("fund_flows", f"flow_date=gt.{snaps[0]['snapshot_date']}&select=amount"))
        adj = tot - dep
        if not missing and base > 0 and abs(adj - base) / base * 100 >= BOOK_MOVE_PCT:
            reasons.append(f"book {((adj-base)/base*100):+.1f}% vs {snaps[0]['snapshot_date']} (${tot:.2f}, ex ${dep:.0f} deposits)")

    radar = sb_get("fund_radar", "stage=eq.EARLY&select=symbol,score,scan_date&order=scan_date.desc,score.desc&limit=5")
    seen_p = STATE / "seen_early.json"
    seen = set(json.loads(seen_p.read_text())) if seen_p.exists() else set()
    fresh = [r for r in radar if float(r.get("score") or 0) >= RADAR_SCORE_MIN and r["symbol"] not in seen]
    if fresh:
        reasons.append("new EARLY: " + ", ".join(f"{r['symbol']} {r['score']}" for r in fresh))
        seen_p.write_text(json.dumps(sorted(seen | {r["symbol"] for r in fresh})))

    bp = STATE / "breakouts.json"
    if bp.exists():
        b = json.loads(bp.read_text())
        if b.get("fresh") and b.get("at", "")[:10] == now_denver().strftime("%Y-%m-%d"):
            reasons.append("fresh breakout: " + ", ".join(b["fresh"]))

    stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")
    verdict = "ESCALATE" if reasons else "QUIET"
    (STATE / "last_triage").write_text(f"{stamp} {verdict} (free)\n" + ("; ".join(reasons) or "nothing material"))
    print(f"triage {verdict}: {'; '.join(reasons) or 'nothing material'}")
    if reasons:
        subprocess.run(["systemctl", "start", "lmc-wake-deep.service"], check=False)

if __name__ == "__main__":
    main()
