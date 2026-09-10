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
ntfy("💓 Desk loop heartbeat", msg + extra, "low", force=True)
sb_upsert("pa_memory", [{"topic": "loop-heartbeat", "fact": f"{now_denver().isoformat()} — {msg}", "source": "desk-loop", "active": True,
                         "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
print(msg)
