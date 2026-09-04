#!/usr/bin/env python3
"""SYNTHETIC TRAILING STOP (house-strategy A4 §5-6).
Robinhood has no native trailing stop on crypto, so the watcher maintains one:
  - tracks a high-water mark per held position from entry onward
  - proposed stop = high_water * (1 - trail%)   [12% majors, 18% everything else]
  - stops RATCHET UP ONLY, never down
  - pushes a tap-ready "cancel old stop -> place new stop" only when the new
    level is >= 2% above the current one (no buzzing over noise)
  - flags the A4 §6 half-off at +25% from fill, once per position
Runs every 15 min, offset from price_check; prices come from the shared cache.
Alert-only: it never places or cancels an order."""
import json, datetime
from common import *

MAJORS = {"BTC", "ETH", "SOL"}
TRAIL_MAJOR = 0.12
TRAIL_OTHER = 0.18
RATCHET_MIN_PCT = 2.0      # only propose when >= 2% above the resting stop
HALF_OFF_PCT = 25.0        # A4 §6

def main():
    if not loop_enabled():
        print("loop disabled"); return
    holdings = [h for h in sb_get("live_holdings", "select=symbol,qty,avg_cost") if h["symbol"] != "USD" and float(h["qty"] or 0) > 0]
    if not holdings:
        print("no positions"); return
    trigs = sb_get("desk_triggers", "active=eq.true&kind=eq.stop&select=id,symbol,level")
    stops = {t["symbol"]: (t["id"], float(t["level"])) for t in trigs}
    syms = [h["symbol"] for h in holdings]
    px = prices(syms)

    hp = STATE / "hwm.json"
    hwm = json.loads(hp.read_text()) if hp.exists() else {}
    fp = STATE / "half_off.json"
    half = json.loads(fp.read_text()) if fp.exists() else {}
    now = datetime.datetime.now(datetime.timezone.utc)
    stamp = now_denver().strftime("%H:%M MT")
    actions = []

    for h in holdings:
        sym = h["symbol"]; p = px.get(sym)
        if not p: continue
        cost = float(h["avg_cost"] or 0) or p
        prev = float(hwm.get(sym, 0)) or max(cost, p)
        high = max(prev, p)
        hwm[sym] = high
        trail = TRAIL_MAJOR if sym in MAJORS else TRAIL_OTHER
        proposed = round(high * (1 - trail), 6 if p < 1 else 2)

        cur = stops.get(sym)
        if cur is None:
            actions.append(f"⚠ {sym}: NO RESTING STOP found in desk_triggers — A3 §3 breach. Place one now at ≤ ${proposed}.")
            ntfy(f"⚠ {sym} has no stop", f"Holding {h['qty']} {sym} @ ${p}. A3 requires a resting stop. Proposed ${proposed} ({int(trail*100)}% trail off high ${high}).", "high")
            continue
        _, cur_level = cur
        if proposed > cur_level and (proposed - cur_level) / cur_level * 100 >= RATCHET_MIN_PCT:
            msg = (f"{sym} ${p} | high ${high} | stop ${cur_level} -> ${proposed} "
                   f"({int(trail*100)}% trail, +{(proposed-cur_level)/cur_level*100:.1f}%)")
            actions.append("RATCHET " + msg)
            ntfy(f"📈 Ratchet {sym} stop -> ${proposed}",
                 f"Cancel stop ${cur_level}, place stop ${proposed} on {h['qty']} {sym}. Price ${p}, high ${high}. Ratchets only raise — never lower.", "high")
            sb_insert("desk_alert_log", [{"at": now.isoformat(), "symbol": sym, "kind": "ratchet",
                                         "level": proposed, "price": p, "sent": True, "queued": False,
                                         "note": f"trail {int(trail*100)}% off high {high}; was {cur_level}"}])
        # A4 §6 — half off at +25% from fill, flagged once
        if cost and (p - cost) / cost * 100 >= HALF_OFF_PCT and not half.get(sym):
            half[sym] = now.isoformat()
            gain = (p - cost) / cost * 100
            actions.append(f"HALF-OFF {sym}: +{gain:.1f}% from ${cost} — A4 §6 says bank half, trail the rest")
            ntfy(f"💰 {sym} +{gain:.0f}% — take half",
                 f"A4 §6: sell half of {h['qty']} {sym} at ~${p} (fill ${cost}). Remainder keeps its trailing stop.", "high")
            sb_insert("desk_alert_log", [{"at": now.isoformat(), "symbol": sym, "kind": "half_off",
                                         "level": cost * 1.25, "price": p, "sent": True, "queued": False,
                                         "note": f"+{gain:.1f}% from fill {cost}"}])

    hp.write_text(json.dumps(hwm)); fp.write_text(json.dumps(half))
    (STATE / "last_trail").write_text(f"{stamp}\n" + ("\n".join(actions) or "no ratchets due"))
    print(f"trail {stamp}: " + ("; ".join(actions) if actions else f"{len(holdings)} positions, no ratchets due"))

if __name__ == "__main__":
    main()
