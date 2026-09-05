#!/usr/bin/env python3
"""RATCHET / TRAIL WATCHER — v2 (build request #3-TD, 2026-09-04).
PRECEDENCE: the rulebook beats the formula.
  1. If desk_triggers carries a 'ratchet' / 'stall' / 'stop' row for a held symbol, THAT is the rule.
     Ratchets and stalls are DAILY-CLOSE based: evaluated against the last COMPLETED daily close
     (CoinGecko daily bar cached under state/hist by the breakout scan), never an intraday print.
     When a close crosses the line the watcher pushes the spec text VERBATIM and never invents a level.
  2. The A4 formula (12%/18% trail off the high-water mark, half off at +25%) applies only where
     no explicit ratchet row exists for the symbol. Where one does, the formula's output goes to
     pa_memory 'loop-proposals' for Sunday — never to the phone.
  3. DEDUPE: no repeat push on the same line within 6h (desk_triggers.last_alert_at, mirrored in state
     for formula proposals) and formula materiality is measured against the LAST PROPOSAL, not the
     resting stop — the v1 bug that pushed ARB 36 times on 09-04.
Alert-only. Never places or cancels an order."""
import json, datetime
from pathlib import Path
from common import *

MAJORS = {"BTC", "ETH", "SOL"}
TRAIL_MAJOR, TRAIL_OTHER = 0.25, 0.18   # A7: majors carry a 25% CATASTROPHE trail (close-based), satellite 18%
MATERIAL_PCT = 2.0
HALF_OFF_PCT = 25.0
DEDUPE_H = 6

def last_completed_close(sym):
    """Last COMPLETED daily close from the cached daily bars (CoinGecko's final point is the live
    price at fetch time, so the completed close is the one before it). None if no cache."""
    # Cache-only id lookup: the 15-minute watcher must never wait on CoinGecko's id endpoint.
    cid = CG.get(sym)
    try:
        cp = STATE / "cg_ids.json"
        if cp.exists(): cid = json.loads(cp.read_text()).get(sym) or cid
    except Exception:
        pass
    if not cid: return None, None
    f = STATE / "hist" / f"{cid}.json"
    if not f.exists(): return None, None
    bars = json.loads(f.read_text())
    if len(bars) < 2: return None, None
    b = bars[-2]
    return float(b["c"]), datetime.datetime.fromtimestamp(b["t"], datetime.timezone.utc).strftime("%Y-%m-%d")

def recent(iso, hours=DEDUPE_H):
    if not iso: return False
    try:
        t = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() < hours * 3600
    except Exception:
        return False

def main():
    if not loop_enabled():
        print("loop disabled"); return
    holdings = [h for h in sb_get("live_holdings", "select=symbol,qty,avg_cost") if h["symbol"] != "USD" and float(h["qty"] or 0) > 0]
    if not holdings:
        print("no positions"); return
    trigs = sb_get("desk_triggers", "active=eq.true&select=id,symbol,kind,level,spec,last_alert_at")
    by_sym = {}
    for t in trigs: by_sym.setdefault(t["symbol"], []).append(t)
    px = prices([h["symbol"] for h in holdings])
    now = datetime.datetime.now(datetime.timezone.utc); now_iso = now.isoformat()
    stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")

    sp = STATE / "trail_state.json"
    st = json.loads(sp.read_text()) if sp.exists() else {}
    hwm, half, last_prop = st.setdefault("hwm", {}), st.setdefault("half", {}), st.setdefault("last_prop", {})
    actions, proposals = [], []

    def log(sym, kind, level, price, note, sent):
        sb_insert("desk_alert_log", [{"at": now_iso, "symbol": sym, "kind": kind, "level": level, "price": price,
                                     "sent": sent, "queued": False, "note": note[:240]}])

    for h in holdings:
        sym = h["symbol"]; p = px.get(sym)
        if not p: continue
        cost = float(h["avg_cost"] or 0) or p
        rows = by_sym.get(sym, [])
        ratchets = [t for t in rows if t["kind"] == "ratchet"]
        stalls = [t for t in rows if t["kind"] == "stall"]
        stops = [t for t in rows if t["kind"] == "stop"]
        close, close_day = last_completed_close(sym)

        # (1) RULEBOOK — close-based ratchet / stall lines, verbatim, 6h dedupe on the row
        for t in ratchets + stalls:
            lvl = float(t["level"]); crossed = False
            if close is not None:
                crossed = close > lvl if t["kind"] == "ratchet" else close < lvl
            if crossed and not recent(t.get("last_alert_at")):
                title = f"{'📈 RATCHET DUE' if t['kind']=='ratchet' else '⛔ STALL LINE HIT'} {sym} — close {close_day} ${close:.6g} {'>' if t['kind']=='ratchet' else '<'} ${lvl:.6g}"
                ntfy(title, f"Rulebook line (desk_triggers #{t['id']}): {t['spec'] or '(no spec text)'}\nLive ${p:.6g}. Execute the spec as written.", "high")
                sb_patch("desk_triggers", f"id=eq.{t['id']}", {"last_alert_at": now_iso})
                log(sym, t["kind"], lvl, p, f"close {close_day} {close} crossed; spec pushed", True)
                actions.append(title)

        # (2) STOP PRESENCE — A3 §3
        if not stops:
            key = f"nostop:{sym}"
            if not recent(last_prop.get(key)):
                ntfy(f"⚠ {sym} has NO resting stop", f"Holding {h['qty']} {sym} @ ${p:.6g}. A3 §3 requires a stop at fill. Place one now.", "high")
                last_prop[key] = now_iso; log(sym, "nostop", None, p, "A3 breach: no stop row", True)
                actions.append(f"NO STOP {sym}")

        # (3) A4 FORMULA — trail off the high-water mark; phone only if no rulebook ratchet exists
        high = max(float(hwm.get(sym, 0)) or max(cost, p), p); hwm[sym] = high
        trail = TRAIL_MAJOR if sym in MAJORS else TRAIL_OTHER
        proposed = round(high * (1 - trail), 6 if p < 1 else 2)
        cur_stop = float(stops[0]["level"]) if stops else None
        prev_prop = float(last_prop.get(f"lvl:{sym}", 0) or 0)
        improves_stop = cur_stop is not None and proposed > cur_stop and (proposed - cur_stop) / cur_stop * 100 >= MATERIAL_PCT
        material_vs_last = prev_prop == 0 or abs(proposed - prev_prop) / prev_prop * 100 >= MATERIAL_PCT
        if improves_stop and material_vs_last and not recent(last_prop.get(f"at:{sym}")):
            line = f"{sym}: A4 trail {int(trail*100)}% off high ${high:.6g} -> proposed stop ${proposed} (resting ${cur_stop}, +{(proposed-cur_stop)/cur_stop*100:.1f}%), live ${p:.6g}"
            last_prop[f"lvl:{sym}"] = proposed; last_prop[f"at:{sym}"] = now_iso
            if ratchets:
                proposals.append(line + "  [NOT pushed — rulebook ratchet exists for this symbol; Sunday review]")
                log(sym, "proposal", proposed, p, "A4 trail -> loop-proposals (rulebook ratchet exists)", False)
            else:
                ntfy(f"📈 Ratchet {sym} stop -> ${proposed}", f"Cancel stop ${cur_stop}, place stop ${proposed} on {h['qty']} {sym}. A4 trail {int(trail*100)}% off high ${high:.6g}. Ratchets only raise.", "high")
                log(sym, "ratchet", proposed, p, f"A4 trail {int(trail*100)}% off high {high}; was {cur_stop}", True)
                actions.append("A4 RATCHET " + line)

        # (4) HALF OFF at +25% — A4 §6, once per position (Jacob-ratified)
        gain = (p - cost) / cost * 100 if cost else 0
        if sym not in MAJORS and gain >= HALF_OFF_PCT and not half.get(sym):   # A7: no take-profit on core
            half[sym] = now_iso
            ntfy(f"💰 {sym} +{gain:.0f}% — take half (A4 §6)", f"Sell half of {h['qty']} {sym} at ~${p:.6g} (fill ${cost:.6g}). Remainder keeps its stop/trail.", "high")
            log(sym, "half_off", cost * 1.25, p, f"+{gain:.1f}% from fill {cost}", True)
            actions.append(f"HALF-OFF {sym} +{gain:.1f}%")

    sp.write_text(json.dumps(st))
    if proposals:
        prev = sb_get("pa_memory", "topic=eq.loop-proposals&select=fact")
        old = prev[0]["fact"] if prev else "LOOP PROPOSALS — formula outputs that differ from the rulebook. Reviewed Sunday; never pushed to the phone.\n"
        fact = (f"── {stamp} ──\n" + "\n".join(proposals) + "\n\n" + old)[:12000]
        sb_upsert("pa_memory", [{"topic": "loop-proposals", "fact": fact, "source": "desk-loop", "active": True, "updated_at": now_iso}], "topic")
    (STATE / "last_trail").write_text(f"{stamp}\n" + ("\n".join(actions + proposals) or "nothing due"))
    print(f"trail {stamp}: " + ("; ".join(actions) if actions else f"{len(holdings)} positions, nothing due") + (f" | {len(proposals)} to loop-proposals" if proposals else ""))

if __name__ == "__main__":
    main()
