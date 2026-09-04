#!/usr/bin/env python3
"""Measures whether the radar's stage labels actually predict the NEXT day's move.
Writes a running scorecard to pa_memory 'stage-study'. Free (uses stored scans only).
Point: settle 'do we bar the wrong things?' with evidence over weeks, not with one green day."""
import json, statistics as st
from common import *

def main():
    rows = sb_get("fund_radar", "select=scan_date,symbol,stage,score,d1&order=scan_date.asc&limit=5000")
    by_day = {}
    for r in rows:
        by_day.setdefault(r["scan_date"], {})[r["symbol"]] = r
    days = sorted(by_day)
    if len(days) < 2:
        print("need >=2 scan days"); return
    buckets = {}
    for prev, nxt in zip(days, days[1:]):
        for sym, r in by_day[prev].items():
            fwd = by_day[nxt].get(sym)
            if not fwd or fwd.get("d1") is None: continue
            buckets.setdefault(r["stage"], []).append(float(fwd["d1"]))
    lines = [f"RADAR STAGE STUDY — does yesterday's label predict today's move?",
             f"Window: {days[0]} to {days[-1]} ({len(days)} scan days, {sum(len(v) for v in buckets.values())} observations)",
             ""]
    for stage in ("EARLY", "RUNNING", "EXTENDED", "quiet"):
        v = buckets.get(stage) or []
        if not v: continue
        wins = sum(1 for x in v if x > 0)
        lines.append(f"{stage:<9} n={len(v):<5} mean next-day {st.mean(v):+.2f}%  median {st.median(v):+.2f}%  "
                     f"win-rate {wins/len(v)*100:.0f}%  best {max(v):+.1f}%  worst {min(v):+.1f}%")
    lines += ["", "READ: if EXTENDED's mean beats EARLY's over a meaningful window AND its worst-case is survivable,",
              "the chase law is costing more than it saves and A1 should widen. If EXTENDED's worst case is severe,",
              "the law is doing its job. Do not conclude from fewer than ~20 scan days or from a single-direction tape."]
    out = "\n".join(lines)
    print(out)
    sb_upsert("pa_memory", [{"topic": "stage-study", "fact": out, "source": "desk-loop", "active": True,
                             "updated_at": __import__("datetime").datetime.now(__import__("datetime").timezone.utc).isoformat()}], "topic")

if __name__ == "__main__":
    main()
