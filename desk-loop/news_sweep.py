#!/usr/bin/env python3
"""UNIVERSE NEWS SWEEP (build request #5B). Daily: top-10 RH-tradable names by market cap; Sunday: top-40.
One headless Claude run per batch of 10 names (Haiku + WebSearch), extracting ONLY mechanism-grade items:
fee switch / burn / buyback / inflation votes, unlocks >5% of float, listings/delistings, exploits.
Appends a dated digest to pa_memory 'universe-news' (14-day window) and pushes anything mechanism-grade.
Gated by the same book-scaled budget as the deep wake; cost is written to the spend ledger."""
import json, subprocess, datetime, sys
from common import *

BATCH = 10

def top_names(n):
    latest = sb_get("fund_radar", "select=scan_date&order=scan_date.desc&limit=1")
    if not latest: return []
    rows = sb_get("fund_radar", f"scan_date=eq.{latest[0]['scan_date']}&select=symbol,name,market_cap&order=market_cap.desc&limit={n}")
    return [(r["symbol"], r.get("name") or r["symbol"]) for r in rows if r["symbol"] not in ("USDC", "USDT", "USDG", "PAXG")]

def sweep(batch):
    names = ", ".join(f"{s} ({n})" for s, n in batch)
    prompt = f"""You are the news sweep of a small crypto trading desk. Today is {now_denver().strftime('%Y-%m-%d')}.
For EACH of these tokens do ONE web search for news from the last 7 days: {names}.
Extract ONLY these four kinds of item, nothing else:
  (1) MECHANISM changes — fee switch, burn, buyback, inflation/emission votes, revenue-share to holders;
  (2) UNLOCKS dated within 30 days that are >5% of circulating float (give date and % if stated);
  (3) exchange LISTINGS or DELISTINGS on a major venue;
  (4) EXPLOITS / hacks / halts.
Output format, one line per item, newest first, no prose, no items = say NONE for that token:
  SYMBOL | KIND | date | one-line fact | source domain
Mark a line MECHANISM-GRADE at the end if it changes what the token is worth to a holder (a real fee switch, a confirmed buyback program, a >5% unlock, an exploit). Price moves, partnerships and opinion pieces are NOT items — skip them. Be brief; this is a scan, not a report."""
    out = STATE / "news_out.json"
    with open(out, "w") as f:
        subprocess.run(["claude", "-p", prompt, "--output-format", "json", "--max-turns", str(len(batch) + 2),
                        "--allowedTools", "WebSearch", "--model", "claude-haiku-4-5-20251001"], stdout=f, stderr=open(STATE / "news_err.log", "a"), timeout=900)
    o = json.load(open(out)); cost = float(o.get("total_cost_usd") or 0)
    add_spend(cost); add_day_spend(cost)
    return (o.get("result") or "").strip(), cost

def main():
    if not loop_enabled():
        print("loop disabled"); return
    a, b, c, d, ok = budget_status()
    if not ok and "--force" not in sys.argv:   # --force = one manual proof run past the daily burst cap
        print(f"budget gate: ${b:.2f} of ${a:.2f} — skipping news sweep"); return
    n = 40 if now_denver().weekday() == 6 else 10
    names = top_names(n)
    if not names:
        print("no radar rows"); return
    texts, total = [], 0.0
    for i in range(0, len(names), BATCH):
        t, cost = sweep(names[i:i + BATCH]); total += cost; texts.append(t)
        if not budget_status()[4]: texts.append("[budget gate hit — remaining batches skipped]"); break
    body = "\n".join(x for x in texts if x)
    stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")
    head = f"── NEWS SWEEP {stamp} — top {len(names)} by cap, cost ${total:.3f} ──\n{body}\n"
    prev = sb_get("pa_memory", "topic=eq.universe-news&select=fact")
    old = prev[0]["fact"] if prev else ""
    # keep 14 days: drop sections older than the cutoff
    cutoff = (now_denver() - datetime.timedelta(days=14)).strftime("%Y-%m-%d")
    kept = []
    for sec in old.split("── NEWS SWEEP ")[1:]:
        if sec[:10] >= cutoff: kept.append("── NEWS SWEEP " + sec)
    fact = (head + "\n" + "".join(kept))[:24000]
    sb_upsert("pa_memory", [{"topic": "universe-news", "fact": fact, "source": "desk-loop", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
    grade = [l for l in body.splitlines() if "MECHANISM-GRADE" in l.upper()]
    if grade:
        ntfy(f"📰 Mechanism-grade news ({len(grade)})", "\n".join(grade)[:900], "high")
    print(f"news sweep: {len(names)} names, cost ${total:.3f}, {len(grade)} mechanism-grade")

if __name__ == "__main__":
    main()
