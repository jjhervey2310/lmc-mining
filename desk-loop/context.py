#!/usr/bin/env python3
"""Assemble the hourly wake context (JSON to stdout): desk memory, book, radar, fee/flow data."""
import json, re, urllib.request
from common import *
from common import _req  # underscore names are skipped by import *

def topic(t, limit=2500):
    """Truncate long memory topics — the full text re-sent every wake was the main cost driver."""
    r = sb_get("pa_memory", f"topic=eq.{t}&select=fact,updated_at")
    if not r: return None
    row = dict(r[0]); f = row.get("fact") or ""
    if len(f) > limit: row["fact"] = f[:limit] + f"\n…[truncated, {len(f)} chars total]"
    return row

def defillama_fees():
    try:
        j = _req("https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true")
        top = sorted(j.get("protocols", []), key=lambda p: -(p.get("total24h") or 0))[:8]
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
        "topics": {"house-strategy": topic("house-strategy", 3000), "dashboard": topic("dashboard", 3000),
                   "catalyst-calendar": topic("catalyst-calendar", 1500), "agent-log": topic("agent-log", 1200),
                   "loop-briefs": topic("loop-briefs", 1200)},
        "holdings": sb_get("live_holdings", "select=symbol,qty,avg_cost,synced_at"),
        "triggers": sb_get("desk_triggers", "active=eq.true&select=symbol,kind,level,band_pct,spec"),
        "radar_top": sb_get("fund_radar", "select=symbol,stage,turnover,d1,d7,d30,score,scan_date&order=scan_date.desc,score.desc&limit=8"),
        "alerts_recent": sb_get("desk_alert_log", "select=at,symbol,kind,level,price,note&order=at.desc&limit=5"),
        "defillama_fees_top": defillama_fees(),
    }
    tot, missing = book_value(); ctx["book_value"] = tot; ctx["unpriced"] = missing
    print(json.dumps(ctx, default=str))

if __name__ == "__main__":
    main()
