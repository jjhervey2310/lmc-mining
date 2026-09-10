#!/usr/bin/env python3
"""TRAIL / RATCHET WATCHER — v4 (constitution v4.1 + AMENDMENT A9, Code desk 2026-09-06 evening).
A9 (build request #9, from the 09-06 strategy review vs the stored backtests):
  ANCHOR trail = 30% CATASTROPHE trail from the highest completed close since entry, up only (the core-hold
     test showed every 10-25% anchor trail losing to buy-and-hold; 30% was the least bad). No x0.90 ratchet.
  SLEEVE: 18% trail from +18%, 25% past +50% (unchanged). NO take-profit flag below +50% (the breakout test
     ranked no-TP > 1/3-off > half-off; a 27%-win-rate book lives on its tail). Third at +50%, once.
  BREAKER is SLEEVE-ONLY: sleeve mark/cost ratio <= 0.80 x its high-water ratio -> halt new-entry briefs +
     one push per episode (common.sleeve_breaker). The whole-book 5% intraday halt is gone: an anchor
     drawdown is a deposit opportunity, not a reason to stop the sleeve.
AMENDMENT A11 (2026-09-08, ratified): anchor protection is CONDITION-TRIGGERED, not resting. BTC and SOL
  carry NO resting stop while the book is under $5,000 (common.ANCHOR_STANDING_TRAIL_USD); the desk places a
  ~30% trail when a de-risk signal fires (primary: a weekly close below the 20-week MA — the 'derisk_watch'
  rows in desk_triggers). The standing trail returns permanently at $5,000. The STOP PRESENCE screen below is
  narrowed to match: it still alerts on every non-anchor position with no stop row (A11 §4), and on the anchor
  once the book reaches the threshold. Anchor list + threshold live in common.py, nowhere else.
PRECEDENCE: the rulebook beats the formula.
  1. If desk_triggers carries a 'ratchet' / 'stall' / 'stop' row for a held symbol, THAT is the rule.
     Ratchets and stalls are DAILY-CLOSE based (last COMPLETED daily bar), never an intraday print.
     When a close crosses the line the watcher pushes the spec text VERBATIM and never invents a level.
  2. Formula outputs apply only where no explicit ratchet row exists; where one does, the formula's
     output goes to pa_memory 'loop-proposals' for Sunday — never to the phone.
  3. DEDUPE: no repeat push on the same line within 6h; materiality (2%) is measured against the LAST
     PROPOSAL, not the resting stop.
CONSTITUTION v4 / v4.1 (2026-09-05/06), what the formula now says:
  ANCHOR = BTC + SOL only (ETH out, v4). Stops stay at structure; the loop proposes a ratchet to
     0.90 x the highest COMPLETED daily close (the x0.90-of-new-high-close formula), only when that is
     >= 2% above the resting stop. No take-profit, no stall, no rotation on the anchor.
  SLEEVE = everything else held. The entry stop governs until the position is +18% from fill (v4: no
     early wrenches). From +18%: trail 18% off the highest completed close; once the position has been
     +50% from fill the leash widens to 25% (v4.1 §3, up only, 2% materiality). Take 1/3 at +25% (once).
     ROTATION CANDIDATE after the third: >10% below its 20d high OR 7d RS < BTC 5 days (A8 §5).
  RECLAIM CANDIDATE (v4, 09-06): a sleeve name stopped out in the last 5 days whose last completed
     close is back above the stop-out price -> flag (24h dedupe). The desk decides the re-entry.
  FLUSH PLAYBOOK (v4.1): BTC completed close <= 12% below its highest close of the prior 20 days ->
     FLUSH MODE (no new entries; one push per episode). In flush mode, the first completed close above
     the prior day's high (close used as the proxy when no high is cached) = RECLAIM SIGNAL -> attack
     order per the playbook. Flags only.
Alert-only. Never places or cancels an order."""
import json, datetime
from pathlib import Path
from common import *

ANCHOR = ANCHOR_SYMS             # v4: ETH removed from the anchor by Jacob 09-05. One list, in common.py.
ANCHOR_TRAIL = 0.30              # A9: 30% catastrophe trail off the highest completed close since entry, up only
SLEEVE_TRAIL, SLEEVE_TRAIL_WIDE = 0.18, 0.25   # v4.1 §3: 18% until the position has been +50%, then 25%
TRAIL_ENGAGE_PCT = 18.0          # v4: sleeve trail only once +18% from fill; before that the entry stop governs
WIDE_AT_PCT = 50.0
MATERIAL_PCT = 2.0
TAKE_PCT = 50.0                  # A9: take 1/3 at +50% (was +25% under A8 — the test said the early third costs expectancy)
DEDUPE_H = 6
RECLAIM_DAYS = 5
FLUSH_DROP = 0.12                # v4.1 flush trigger: close >= 12% below the 20-day-high close
MAJORS = ANCHOR                  # kept for older imports

def _cid(sym):
    cid = CG.get(sym)
    try:
        cp = STATE / "cg_ids.json"
        if cp.exists(): cid = json.loads(cp.read_text()).get(sym) or cid
    except Exception:
        pass
    return cid

def daily_bars(sym):
    """Daily bars for a symbol from the caches the scans keep (CoinGecko hist, else Coinbase cb).
    The LAST element is the live/partial bar; completed bars are bars[:-1]."""
    cid = _cid(sym)
    f = STATE / "hist" / f"{cid}.json" if cid else None
    if f and f.exists():
        return json.loads(f.read_text())
    f2 = STATE / "cb" / f"{sym}.json"
    if f2.exists():
        return [{"t": b["t"], "c": b["c"], "h": b.get("h")} for b in json.loads(f2.read_text())] + [{"t": 0, "c": None}]
    return None

def last_completed_close(sym):
    """Last COMPLETED daily close (CoinGecko's final point is the live price at fetch time, so the
    completed close is the one before it). (None, None) if no cache."""
    bars = daily_bars(sym)
    if not bars or len(bars) < 2: return None, None
    b = bars[-2]
    if b.get("c") is None: return None, None
    return float(b["c"]), datetime.datetime.fromtimestamp(b["t"], datetime.timezone.utc).strftime("%Y-%m-%d")

def recent(iso, hours=DEDUPE_H):
    if not iso: return False
    try:
        t = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00"))
        return (datetime.datetime.now(datetime.timezone.utc) - t).total_seconds() < hours * 3600
    except Exception:
        return False

def fmt(x): return f"${x:.6g}"

def since_entry_ok(bars, ts):
    return bool(bars and ts and any(b.get("c") and b.get("t", 0) >= ts for b in bars[:-1]))

def flush_check(st, last_prop, now_iso, log, actions):
    """v4.1 FLUSH PLAYBOOK on BTC completed closes. State: st['flush'] = {since, hi20, trigger_close}."""
    bars = daily_bars("BTC")
    if not bars or len(bars) < 23: return
    closes = [b["c"] for b in bars[:-1] if b.get("c")]
    if len(closes) < 22: return
    c, prev = closes[-1], closes[-2]
    hi20 = max(closes[-21:-1])                       # highest close of the prior 20 days, excluding today
    day = datetime.datetime.fromtimestamp(bars[-2]["t"], datetime.timezone.utc).strftime("%Y-%m-%d")
    fl = st.get("flush")
    if not fl:
        if c <= hi20 * (1 - FLUSH_DROP) and last_prop.get("flush_day") != day:
            st["flush"] = {"since": day, "hi20": hi20, "trigger_close": c}; last_prop["flush_day"] = day
            ntfy("🌊 FLUSH TRIGGER — BTC", f"BTC close {day} {fmt(c)} is {(1-c/hi20)*100:.1f}% below its 20d-high close {fmt(hi20)} (v4.1 trigger 12%). PLAYBOOK: no new entries while it falls; stops/trails do their work; deep rungs arm only if the regime test passes. The attack waits for the RECLAIM SIGNAL (first close above the prior day's high).", "high")
            log("BTC", "flush", hi20 * (1 - FLUSH_DROP), c, f"flush mode entered; close {c} vs hi20 {hi20}", True)
            actions.append(f"FLUSH MODE (BTC {c:.0f} vs hi20 {hi20:.0f})")
        return
    if day <= fl["since"]: return
    prior_high = bars[-3].get("h") or prev            # true high if the cache carries it, else the close (stated)
    if c > prior_high:
        proxy = "" if bars[-3].get("h") else " (prior HIGH not cached — prior CLOSE used as the proxy; confirm on the chart)"
        ntfy("⚔️ RECLAIM SIGNAL — flush attack", f"BTC close {day} {fmt(c)} is above the prior day's high {fmt(prior_high)}{proxy}. Flush since {fl['since']} (trigger {fmt(fl['trigger_close'])}). v4.1 ATTACK ORDER: (1) anchors to the 55% floor at basket weights, (2) sleeve re-entries at full size ($50 min) in names whose mechanism survived, (3) rebuild reserve to 10% before any new name. No leverage. Stops/trails on every fill.", "high")
        log("BTC", "reclaim_signal", prior_high, c, f"flush {fl['since']} -> reclaim close {c} > prior high {prior_high}", True)
        actions.append(f"RECLAIM SIGNAL (flush over, BTC {c:.0f})")
        st["flush"] = None

def reclaim_candidates(held, last_prop, now_iso, log, actions):
    """v4 RECLAIM RULE: sleeve stop-outs of the last 5 days whose completed close is back above the stop-out price."""
    since = (datetime.datetime.now(datetime.timezone.utc) - datetime.timedelta(days=RECLAIM_DAYS)).isoformat()
    try:
        sells = sb_get("live_trades", f"side=eq.sell&traded_at=gte.{since}&select=symbol,avg_price,traded_at,note")
        stops = sb_get("desk_triggers", "kind=eq.stop&select=symbol,level")
    except Exception:
        return
    stop_lv = {}
    for t in stops: stop_lv.setdefault(t["symbol"], []).append(float(t["level"]))
    seen = set()
    for s in sorted(sells, key=lambda r: r["traded_at"], reverse=True):
        sym = s["symbol"]
        if sym in held or sym in ANCHOR or sym in seen: continue
        seen.add(sym)
        price = float(s["avg_price"] or 0)
        if not price: continue
        note = (s.get("note") or "").lower()
        was_stop = "stop" in note or any(abs(l - price) / l <= 0.03 for l in stop_lv.get(sym, []))
        if not was_stop: continue                      # a take-profit third or a rotation exit is not a stop-out
        close, day = last_completed_close(sym)
        if close is None or close <= price: continue
        if recent(last_prop.get(f"reclaim:{sym}"), 24): continue
        last_prop[f"reclaim:{sym}"] = now_iso
        ntfy(f"🔁 RECLAIM CANDIDATE {sym}", f"Stopped out {s['traded_at'][:10]} @ {fmt(price)}; close {day} {fmt(close)} is back above it (+{(close/price-1)*100:.1f}%). v4 reclaim rule: the exit is deemed noise -> re-enter at ruled size ($50 min at this book; half in the macro window unless overridden) at the next session, stop at the original invalidation or -20%, trail from the new entry. Needs a slot + cash floor. Desk decides; counts as a weekly entry.", "high")
        log(sym, "reclaim", price, close, f"close {day} {close} > stop-out {price} within {RECLAIM_DAYS}d", True)
        actions.append(f"RECLAIM? {sym} close {close:.6g} > stop-out {price:.6g}")

def main():
    if not loop_enabled():
        print("loop disabled"); return
    holdings = [h for h in sb_get("live_holdings", "select=symbol,qty,avg_cost") if h["symbol"] != "USD" and float(h["qty"] or 0) > 0]
    trigs = sb_get("desk_triggers", "active=eq.true&select=id,symbol,kind,level,spec,last_alert_at")
    by_sym = {}
    for t in trigs: by_sym.setdefault(t["symbol"], []).append(t)
    px = prices([h["symbol"] for h in holdings]) if holdings else {}
    now = datetime.datetime.now(datetime.timezone.utc); now_iso = now.isoformat()
    stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")

    sp = STATE / "trail_state.json"
    st = json.loads(sp.read_text()) if sp.exists() else {}
    hwm, half, last_prop = st.setdefault("hwm", {}), st.setdefault("half", {}), st.setdefault("last_prop", {})
    actions, proposals = [], []

    def log(sym, kind, level, price, note, sent):
        sb_insert("desk_alert_log", [{"at": now_iso, "symbol": sym, "kind": kind, "level": level, "price": price,
                                     "sent": sent, "queued": False, "note": note[:240]}])

    try:
        book_usd, _ = book_value()          # A11 §3 threshold test; prices are cached, so no extra fetch
    except Exception as e:
        print(f"book value unavailable ({e}); stop-presence screen falls back to requiring a stop everywhere")
        book_usd = None

    held = {h["symbol"] for h in holdings}
    # Entry timestamps + sells while held, from the trade log: the high-water mark counts only closes SINCE ENTRY
    # (a pre-entry high would put the formula stop above the market), and a sell while still held = the third is taken.
    entry_ts, sold_while_held = {}, {}
    try:
        since = (now - datetime.timedelta(days=120)).isoformat()
        for t in sb_get("live_trades", f"traded_at=gte.{since}&select=symbol,side,traded_at&order=traded_at.asc"):
            ts = datetime.datetime.fromisoformat(t["traded_at"].replace("Z", "+00:00")).timestamp()
            if t["side"] == "buy": entry_ts.setdefault(t["symbol"], ts)
            elif t["symbol"] in held and t["symbol"] in entry_ts: sold_while_held[t["symbol"]] = t["traded_at"]
    except Exception as e:
        print(f"trade log unavailable ({e}); high-water mark from state only")
    hwm_close = st.setdefault("hwm_close", {})          # v3 key: highest COMPLETED close since entry (v2's 'hwm' was intraday)
    for h in holdings:
        sym = h["symbol"]; p = px.get(sym)
        if not p: continue
        cost = float(h["avg_cost"] or 0) or p
        rows = by_sym.get(sym, [])
        ratchets = [t for t in rows if t["kind"] == "ratchet"]
        stalls = [t for t in rows if t["kind"] == "stall"]
        stops = [t for t in rows if t["kind"] == "stop"]
        close, close_day = last_completed_close(sym)
        anchor = sym in ANCHOR

        # (1) RULEBOOK — close-based ratchet / stall lines, verbatim, 6h dedupe on the row
        for t in ratchets + stalls:
            lvl = float(t["level"]); crossed = False
            if close is not None:
                crossed = close > lvl if t["kind"] == "ratchet" else close < lvl
            if crossed and not recent(t.get("last_alert_at")):
                title = f"{'📈 RATCHET DUE' if t['kind']=='ratchet' else '⛔ STALL LINE HIT'} {sym} — close {close_day} {fmt(close)} {'>' if t['kind']=='ratchet' else '<'} {fmt(lvl)}"
                ntfy(title, f"Rulebook line (desk_triggers #{t['id']}): {t['spec'] or '(no spec text)'}\nLive {fmt(p)}. Execute the spec as written.", "high")
                sb_patch("desk_triggers", f"id=eq.{t['id']}", {"last_alert_at": now_iso})
                log(sym, t["kind"], lvl, p, f"close {close_day} {close} crossed; spec pushed", True)
                actions.append(title)

        # (2) STOP PRESENCE — A3 §3 / v4 "stops on 100% of units always", NARROWED BY A11 (2026-09-08).
        #     common.resting_stop_required() owns the rule: the sleeve and the basket always need a stop row;
        #     the anchor is exempt by design only while the book is under ANCHOR_STANDING_TRAIL_USD.
        if not stops and resting_stop_required(sym, book_usd):
            key = f"nostop:{sym}"
            if not recent(last_prop.get(key)):
                why = (f"v4: stops on 100% of units. A11 §3: the book is at or above ${ANCHOR_STANDING_TRAIL_USD:,.0f}, "
                       "so the standing anchor trail is back — place it now."
                       if anchor else
                       "v4 / A11 §4: every non-anchor position carries a resting stop at all times. Place one now.")
                ntfy(f"⚠ {sym} has NO resting stop", f"Holding {h['qty']} {sym} @ {fmt(p)}. {why}", "high")
                last_prop[key] = now_iso
                log(sym, "nostop", None, p, "A11 §3 breach: anchor above the standing-trail threshold, no stop row"
                                           if anchor else "A11 §4 breach: no stop row on a non-anchor position", True)
                actions.append(f"NO STOP {sym}")

        # (3) FORMULA — high-water mark is the highest COMPLETED daily close SINCE ENTRY (never an intraday print)
        ref = close if close is not None else p
        high = max(float(hwm_close.get(sym, 0)), ref)
        bars_all = daily_bars(sym)
        if bars_all and entry_ts.get(sym):
            since_entry = [b["c"] for b in bars_all[:-1] if b.get("c") and b.get("t", 0) >= entry_ts[sym]]
            if since_entry: high = max(high, max(since_entry))
        high = max(high, cost) if not since_entry_ok(bars_all, entry_ts.get(sym)) else high
        hwm_close[sym] = high
        peak_gain = (high - cost) / cost * 100 if cost else 0
        close_gain = (ref - cost) / cost * 100 if cost else 0
        if anchor:
            trail, label, engaged = ANCHOR_TRAIL, "anchor 30% catastrophe trail (A9)", True
        else:
            trail = SLEEVE_TRAIL_WIDE if peak_gain >= WIDE_AT_PCT else SLEEVE_TRAIL
            label = f"sleeve {int(trail*100)}% trail" + (" (v4.1 wide leash, was +50%)" if trail == SLEEVE_TRAIL_WIDE else "")
            engaged = close_gain >= TRAIL_ENGAGE_PCT or peak_gain >= TRAIL_ENGAGE_PCT
        proposed = round(high * (1 - trail), 6 if p < 1 else 2)
        prev_prop = float(last_prop.get(f"lvl:{sym}", 0) or 0)
        proposed = max(proposed, prev_prop)              # up only
        cur_stop = float(stops[0]["level"]) if stops else None
        improves_stop = cur_stop is not None and proposed > cur_stop and (proposed - cur_stop) / cur_stop * 100 >= MATERIAL_PCT
        material_vs_last = prev_prop == 0 or abs(proposed - prev_prop) / prev_prop * 100 >= MATERIAL_PCT
        if engaged and improves_stop and material_vs_last and not recent(last_prop.get(f"at:{sym}")):
            line = f"{sym}: {label} off high close {fmt(high)} -> proposed stop {fmt(proposed)} (resting {fmt(cur_stop)}, +{(proposed-cur_stop)/cur_stop*100:.1f}%), live {fmt(p)}"
            last_prop[f"lvl:{sym}"] = proposed; last_prop[f"at:{sym}"] = now_iso
            if ratchets:
                proposals.append(line + "  [NOT pushed — rulebook ratchet exists for this symbol; Sunday review]")
                log(sym, "proposal", proposed, p, "formula -> loop-proposals (rulebook ratchet exists)", False)
            else:
                ntfy(f"📈 Ratchet {sym} stop -> {fmt(proposed)}", f"Cancel stop {fmt(cur_stop)}, place stop {fmt(proposed)} on {h['qty']} {sym}. {label}: highest completed close {fmt(high)} x {1-trail:.2f}. Ratchets only raise. Execute on the close, not a wick.", "high")
                log(sym, "ratchet", proposed, p, f"{label} off high close {high}; was {cur_stop}", True)
                actions.append("RATCHET " + line)
        elif not anchor and not engaged and cur_stop is not None:
            pass                                          # entry stop governs below +18% — no early wrenches (v4)

        # (4) TAKE A THIRD at +50% — A9 (was A8 +25%), sleeve only, once per position. A sell in the trade log while the
        #     position is still held means the desk already took it — never re-ask.
        if sym in sold_while_held and not half.get(sym): half[sym] = sold_while_held[sym]
        gain = (p - cost) / cost * 100 if cost else 0
        if not anchor and gain >= TAKE_PCT and not half.get(sym):
            half[sym] = now_iso
            ntfy(f"💰 {sym} +{gain:.0f}% — take a THIRD (A9, +{TAKE_PCT:.0f}% rule)", f"Sell 1/3 of {h['qty']} {sym} at ~{fmt(p)} (fill {fmt(cost)}). Remainder keeps its 25% trail; name becomes rotation-eligible.", "high")
            log(sym, "take_third", cost * (1 + TAKE_PCT / 100), p, f"+{gain:.1f}% from fill {cost}", True)
            actions.append(f"TAKE-THIRD {sym} +{gain:.1f}%")

        # (5) A8 §5 ROTATION CANDIDATE — only after the +25% third was taken
        if not anchor and half.get(sym):
            bars = daily_bars(sym); btcb = daily_bars("BTC")
            if bars and btcb and len(bars) >= 27 and len(btcb) >= 27:
                closes = [b["c"] for b in bars[:-1]]
                hi20 = max(closes[-20:]); below = closes[-1] < hi20 * 0.90
                def rs(bs, k): return bs[-1-k]["c"] / bs[-8-k]["c"] - 1
                weak = all(rs(bars[:-1], k) < rs(btcb[:-1], k) for k in range(5))
                if (below or weak) and not recent(last_prop.get(f"rot:{sym}"), 24):
                    why = "; ".join(w for w, ok in ((f"close {closes[-1]:.6g} is {(1-closes[-1]/hi20)*100:.0f}% below its 20d high", below), ("7d RS below BTC 5 days running", weak)) if ok)
                    ntfy(f"🔁 ROTATION CANDIDATE {sym}", f"{why}. Profit third already taken. A8 §5: desk decides — proceeds to anchor (to 55%) first, then an open slot, else cash. Live {fmt(p)}.", "default")
                    last_prop[f"rot:{sym}"] = now_iso; log(sym, "rotate", None, p, why, True); actions.append(f"ROTATE? {sym}: {why}")

    # (6) A9 SLEEVE BREAKER — sleeve-only, one push per episode; sets the halt the deep wake honours
    try:
        halted, info = sleeve_breaker(holdings, px)
        if halted and not last_prop.get("breaker_episode") == info.get("since"):
            last_prop["breaker_episode"] = info.get("since")
            ntfy("⛔ SLEEVE BREAKER (A9)", f"Sleeve mark/cost {info['ratio']:.3f} is {(1-info['ratio']/info['hwm'])*100:.0f}% below its high-water {info['hwm']:.3f}. No new sleeve entries until it recovers to within 10% or the desk clears state/sleeve_breaker.json. Anchor untouched — a major drawdown is a deposit opportunity, not a breaker.", "high")
            log("SLEEVE", "breaker", info["hwm"] * 0.8, info["ratio"], "A9 sleeve breaker tripped", True); actions.append("SLEEVE BREAKER")
    except Exception as e: print(f"sleeve breaker check failed: {e}")
    # (7) v4 RECLAIM candidates on recent sleeve stop-outs; (8) v4.1 FLUSH playbook on BTC closes
    try: reclaim_candidates(held, last_prop, now_iso, log, actions)
    except Exception as e: print(f"reclaim check failed: {e}")
    try: flush_check(st, last_prop, now_iso, log, actions)
    except Exception as e: print(f"flush check failed: {e}")

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
