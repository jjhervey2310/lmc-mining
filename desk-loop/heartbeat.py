#!/usr/bin/env python3
"""08:00 Denver daily: flush overnight digest, heartbeat push, proof-of-life row."""
import datetime, json
from common import *
n = flush_queue()
spend = json.loads((STATE/"spend.json").read_text()) if (STATE/"spend.json").exists() else {"usd": 0}
tot, missing = book_value()
msg = f"Loop alive. Book ${tot:.2f}. Spend this month ${spend.get('usd',0):.2f}/{os.environ.get('MONTHLY_CAP_USD','30')}. Overnight items flushed: {n}. Loop enabled: {loop_enabled()}."
ntfy("💓 Desk loop heartbeat", msg, "low", force=True)
sb_upsert("pa_memory", [{"topic": "loop-heartbeat", "fact": f"{now_denver().isoformat()} — {msg}", "source": "desk-loop", "active": True,
                         "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
print(msg)
