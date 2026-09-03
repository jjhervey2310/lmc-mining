#!/usr/bin/env python3
"""Assemble the hourly wake context (JSON to stdout): desk memory, book, radar, fee/flow data."""
import json, re, urllib.request
from common import *

def topic(t):
    r = sb_get("pa_memory", f"topic=eq.{t}&select=fact,updated_at"); return r[0] if r else None

def defillama_fees():
    try:
        j = _req("https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true")
        top = sorted(j.get("protocols", []), key=lambda p: -(p.get("total24h") or 0))[:15]
        return [{"name": p["name"], "fees24h": p.get("total24h"), "chg7d": p.get("change_7d")} for p in top]
    except Exception as e:
        return {"error": str(e)}

def main():
    dash = topic("dashboard"); pole = ""
    if dash:
        m = re.search(r"★[^\n]*", dash["fact"]); pole = m.group(0) if m else ""
    ctx = {
        "now_denver": now_denver().isoformat(),
        "loop_enabled": loop_enabled(), "spend_ok": spend_ok(), "drawdown_halted": drawdown_halted(),
        "pole_line": pole,
        "topics": {t: topic(t) for t in ("house-strategy", "dashboard", "catalyst-calendar", "agent-log", "loop-briefs")},
        "holdings": sb_get("live_holdings", "select=symbol,qty,avg_cost,synced_at"),
        "triggers": sb_get("desk_triggers", "active=eq.true&select=symbol,kind,level,band_pct,spec"),
        "radar_top": sb_get("fund_radar", "select=symbol,stage,turnover,d1,d7,d30,score,scan_date&order=scan_date.desc,score.desc&limit=15"),
        "alerts_recent": sb_get("desk_alert_log", "select=at,symbol,kind,level,price,note&order=at.desc&limit=10"),
        "defillama_fees_top": defillama_fees(),
    }
    tot, missing = book_value(); ctx["book_value"] = tot; ctx["unpriced"] = missing
    print(json.dumps(ctx, default=str))

if __name__ == "__main__":
    main()
