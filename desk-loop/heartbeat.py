#!/usr/bin/env python3
"""08:00 Denver daily: flush overnight digest, heartbeat push, proof-of-life row."""
import datetime, json
from common import *
n = flush_queue()
spend = json.loads((STATE/"spend.json").read_text()) if (STATE/"spend.json").exists() else {"usd": 0}
tot, missing = book_value()
allowed_m, spent_m, _, _, _ = budget_status()
INFRA_FIXED = float(os.environ.get("INFRA_FIXED_USD", "6.00"))      # DigitalOcean s-1vcpu-1gb, billed monthly
msg = (f"Loop alive. Book ${tot:.2f}. API spend MTD ${spent_m:.2f} of ${allowed_m:.2f} cap ({config('loop_cadence', '1x/day + escalations')}). "
       f"Infra: droplet ${INFRA_FIXED:.2f}/mo fixed -> month-to-date cost ${spent_m + INFRA_FIXED * now_denver().day / 30:.2f}. "
       f"Overnight items flushed: {n}. Loop enabled: {loop_enabled()}. Sleeve breaker: {'TRIPPED since ' + config('sleeve_breaker') if config('sleeve_breaker') else 'clear'}.")
ntfy("💓 Desk loop heartbeat", msg, "low", force=True)
sb_upsert("pa_memory", [{"topic": "loop-heartbeat", "fact": f"{now_denver().isoformat()} — {msg}", "source": "desk-loop", "active": True,
                         "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
print(msg)
