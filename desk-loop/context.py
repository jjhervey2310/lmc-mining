#!/usr/bin/env python3
"""Assemble the hourly wake context (JSON to stdout): desk memory, book, radar, fee/flow data."""
import json, re, urllib.request
from common import *
from common import _req  # underscore names are skipped by import *

def topic(t, limit=2500, keep_tail=True):
    """Truncate long memory topics to control cost — but ALWAYS keep the tail.
    house-strategy keeps its AMENDMENT LOG at the foot: a head-only truncation
    silently hides every amendment from the wake that is supposed to obey them."""
    r = sb_get("pa_memory", f"topic=eq.{t}&select=fact,updated_at")
    if not r: return None
    row = dict(r[0]); f = row.get("fact") or ""
    if len(f) <= limit: return row
    if keep_tail:
        head = int(limit * 0.45); tail = limit - head
        row["fact"] = f[:head] + f"\n…[{len(f) - limit} chars elided from the middle]…\n" + f[-tail:]
    else:
        row["fact"] = f[:limit] + f"\n…[truncated, {len(f)} chars total]"
    return row

def amendments():
    """Every AMENDMENT block from house-strategy, verbatim and never elided.
    These are the operative rules; they must reach the wake whole."""
    r = sb_get("pa_memory", "topic=eq.house-strategy&select=fact")
    if not r: return None
    f = r[0].get("fact") or ""
    i = f.find("=== AMENDMENT")
    return f[i:][:6000] if i >= 0 else None

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
        "topics": {"house-strategy": topic("house-strategy", 6000, keep_tail=True),
                   "house-strategy-amendments": amendments(), "dashboard": topic("dashboard", 3000),
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
