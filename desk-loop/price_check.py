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
        p = px.get(t["symbol"]); lvl = float(t.get("level") or 0)
        # MARKER ROWS carry no price line: A11's 'derisk_watch' rows (BTC #28 / SOL #29, level 0) are a
        # note to the desk, not a level. Without this guard hit() divided by zero and the sweep DIED
        # there — every trigger row the DB returned after it, NEAR's basket catastrophe stop included,
        # went unchecked from 2026-09-08 until 2026-09-10. triage.py already carried the same guard.
        if p is None or lvl <= 0: continue
        try:
            if not hit(t["kind"], p, lvl, t.get("band_pct")): continue
        except Exception as e:
            # One malformed row must never take the 15-minute watcher down with it (visible in journalctl).
            print(f"trigger #{t['id']} ({t['symbol']} {t['kind']} @ {t.get('level')}) skipped: {e}")
            continue
        la = t.get("last_alert_at")
        if la and (now - datetime.datetime.fromisoformat(la.replace("Z", "+00:00"))).total_seconds() < DEDUPE_HOURS * 3600:
            continue
        note = f"{t['symbol']} {t['kind']} @ {lvl} — price {p}. {t.get('spec') or ''}".strip()
        status = ntfy(f"⚡ {t['symbol']} {t['kind']} line reached", note, "high")
        sb_insert("desk_alert_log", [{"at": now.isoformat(), "symbol": t["symbol"], "kind": t["kind"], "level": lvl,
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
