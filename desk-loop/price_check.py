#!/usr/bin/env python3
"""Every 15 min: compare live prices to active desk_triggers, log to desk_alert_log, push via ntfy."""
import sys, datetime, subprocess
from common import *

DEDUPE_HOURS = 6
def hit(kind, price, level, band):
    b = (band or 0.5) / 100.0
    if kind in ("stop", "stall", "bid", "deep_rung"):  # levels below market — alert when price comes down into the band
        return price <= level * (1 + b)
    if kind in ("ratchet", "breakout", "target"):     # levels above — alert when price rises into the band
        return price >= level * (1 - b)
    return abs(price - level) / level <= b

def main():
    if not loop_enabled():
        print("loop disabled"); return
    trig = sb_get("desk_triggers", "active=eq.true&select=id,symbol,kind,level,band_pct,spec,last_alert_at")
    px = prices(sorted({t["symbol"] for t in trig}))
    now = datetime.datetime.now(datetime.timezone.utc)
    fired = []
    for t in trig:
        p = px.get(t["symbol"])
        if p is None: continue
        if not hit(t["kind"], p, float(t["level"]), t.get("band_pct")): continue
        la = t.get("last_alert_at")
        if la and (now - datetime.datetime.fromisoformat(la.replace("Z", "+00:00"))).total_seconds() < DEDUPE_HOURS * 3600:
            continue
        note = f"{t['symbol']} {t['kind']} @ {t['level']} — price {p}. {t.get('spec') or ''}".strip()
        status = ntfy(f"⚡ {t['symbol']} {t['kind']} line reached", note, "high")
        sb_insert("desk_alert_log", [{"at": now.isoformat(), "symbol": t["symbol"], "kind": t["kind"], "level": t["level"],
                                      "price": p, "sent": status == "sent", "queued": status == "queued", "note": note[:400]}])
        sb_patch("desk_triggers", f"id=eq.{t['id']}", {"last_alert_at": now.isoformat()})
        fired.append(note)
    drawdown_halted()
    (STATE / "last_price_check").write_text(now.isoformat())
    if fired:
        # A real level was reached — spend on a deep wake now rather than waiting for the schedule.
        subprocess.run(["systemctl", "start", "lmc-wake-deep.service"], check=False)
    print(f"checked {len(trig)} triggers, {len(fired)} fired")

if __name__ == "__main__":
    main()
