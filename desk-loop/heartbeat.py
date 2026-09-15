#!/usr/bin/env python3
"""08:00 Denver daily: flush overnight digest, heartbeat push, proof-of-life row."""
import datetime, json
from common import *
n = flush_queue()
tot, missing = book_value()
# Budget line reads desk_config.loop_budget_usd, the same number budget_status()/add_spend() enforce
# (it used to print the env's MONTHLY_CAP_USD, which said $30 while the desk's budget row said $10).
allowed_month, spent_month, _, spent_today, _ = budget_status()
budget = loop_budget_usd()
msg = (f"Loop alive. Book ${tot:.2f}. Spend this month ${spent_month:.2f}/${allowed_month:.2f} "
       f"(today ${spent_today:.2f}; budget ${budget:.2f}/mo). Overnight items flushed: {n}. Loop enabled: {loop_enabled()}.")

# Build request #11: new analyst uploads ride the 08:00 push as READING, never as a signal.
ap = STATE / "analyst_pending"
extra = ""
if ap.exists():
    try:
        pend = json.loads(ap.read_text())
        if pend.get("lines"):
            extra = "\n\nNew analyst content — pull transcript if wanted (NOT a signal; nominations to verify or rules to test):\n" + "\n".join(f"• {l}" for l in pend["lines"][:6])
    except Exception:
        pass
    ap.unlink(missing_ok=True)

# BUILD REQUEST #13: each anchor's distance to its 20-week MA rides EVERY heartbeat, so a quiet night
# is a reported quiet night. BTC and SOL carry no resting stop — silence was standing in for one, and
# that is how five nights passed with nothing watching 69% of the book. If the monitor has not run,
# this says so instead of saying nothing.
a11 = STATE / "a11_status.json"
if a11.exists():
    try:
        st = json.loads(a11.read_text())
        age_h = (datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(st["at"]).astimezone(datetime.timezone.utc)).total_seconds() / 3600
        extra += f"\n\nA11 anchors ({st.get('inputs_ok', '?')}/3 inputs, checked {age_h:.0f}h ago): {st['line']}."
        if st.get("fired"):
            extra += f" DE-RISK FIRED: {', '.join(st['fired'])} — order spec in loop-briefs."
    except Exception as e:
        extra += f"\n\nA11 anchors: status file unreadable ({e}) — anchors NOT confirmed watched."
else:
    extra += "\n\nA11 anchors: no status file — the monitor has not run. Anchors NOT confirmed watched."

ntfy("💓 Desk loop heartbeat", msg + extra, "low", force=True)
sb_upsert("pa_memory", [{"topic": "loop-heartbeat", "fact": f"{now_denver().isoformat()} — {msg}", "source": "desk-loop", "active": True,
                         "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
print(msg)
