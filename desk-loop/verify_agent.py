#!/usr/bin/env python3
"""VERIFY AGENT (Jacob 2026-09-11: "there should be an agent researching all these questions so we
dont go into anything with questions").

The desk had 21 names on watch and 15 of their gates began with VERIFY — meaning nobody had checked
whether money actually reaches the token holder. That work was being deferred to a chat session that
may never open. This does it on a schedule instead.

WHAT IT DOES: takes the ONE name whose verification is most overdue, spends a single web search on the
one question that matters for it, and writes the answer back into desk_theses as plain English plus a
verdict. Cheapest useful unit of work: one name a day beats a sweep that never runs.

WHAT IT WILL NOT DO: it never grades, never sizes, never proposes an entry, and never edits a price.
It answers one question — does value reach the holder, and is it big enough to matter — and records
the answer with its sources. A thesis it cannot verify is marked UNPROVEN, never quietly upgraded."""
import json, subprocess, datetime, sys, re
from common import *

VERDICTS = ("VERIFIED-MATERIAL", "VERIFIED-IMMATERIAL", "NO-MECHANISM", "UNPROVEN")

def needs_work():
    rows = sb_get("desk_theses", "select=symbol,status,thesis,gate,updated_at&order=updated_at.asc")
    open_q = [r for r in rows
              if r.get("status") in ("POLE", "WATCH", "VERIFYING")
              and not re.search(r"VERIFIED 20\d\d-\d\d-\d\d", r.get("thesis") or "")]
    return open_q

def main():
    if not loop_enabled():
        print("loop disabled"); return
    a, spent, _, _, ok = budget_status()
    if not ok and "--force" not in sys.argv:
        print(f"budget gate: ${spent:.2f} of ${a:.2f} — skipping verification"); return
    queue = needs_work()
    if not queue:
        print("verify-agent: every queued name carries a dated verification"); return
    t = queue[0]; sym = t["symbol"]
    ask = f"""You are the verification analyst for a small crypto desk. ONE question about {sym}, nothing else:
DOES VALUE ACTUALLY REACH SOMEONE WHO HOLDS THE {sym} TOKEN, AND IS IT BIG ENOUGH TO MATTER?

Do ONE web search. Then answer in this exact shape, plain English a non-technical reader understands,
no jargon, no hedging filler:

MECHANISM: how (or whether) money reaches holders. Name the actual route — fee switch, buyback, burn,
staking share, or none. If there is no route, say NONE plainly.
IS IT LIVE OR PROPOSED? This is the question that matters most and the one most easily fudged. A
governance proposal, a roadmap item, an announced plan or a passed vote that has not yet started
moving money is NOT a mechanism — it is an intention. State LIVE (money is moving today, with a
figure) or PROPOSED (not yet). If it is PROPOSED the verdict CANNOT be VERIFIED-MATERIAL, however
good the plan reads. (2026-09-11: this agent called EIGEN's ELIP-12 a settled mechanism when it is a
May 2026 proposal, and the trading desk had to catch it.)
SIZE: the numbers. Revenue or buyback per month or year, and how that compares to the token's total
value. A mechanism that returns 0.5% a year is not the same as one returning 7%, and the difference
is the whole point.
AGAINST IT: supply working against the price — is total supply capped or uncapped, how much of it is
circulating, and what cliffs or vesting are still to come for investors and insiders. A token that
captures real revenue can still lose to its own emissions; say so when that is the case.
VERDICT: exactly one of VERIFIED-MATERIAL (money moving TODAY, big enough to matter — never for a proposal) / VERIFIED-IMMATERIAL
(route exists, amounts too small to move it) / NO-MECHANISM (nothing reaches holders) / UNPROVEN
(could not establish it from dated sources).
SOURCES: names and dates. Anything you cannot date is not evidence — say so.

Be willing to return NO-MECHANISM or UNPROVEN. A desk that cannot say "this one does not pay" is
useless. Do not pad a weak answer into a strong one."""
    out = STATE / "verify_out.json"
    with open(out, "w") as f:
        subprocess.run(["claude", "-p", ask, "--output-format", "json", "--max-turns", "3",
                        "--allowedTools", "WebSearch", "--model", "claude-sonnet-5"],
                       stdout=f, stderr=open(STATE / "verify_err.log", "a"),
                       stdin=subprocess.DEVNULL, timeout=900)
    o = json.load(open(out)); cost = float(o.get("total_cost_usd") or 0)
    add_spend(cost); add_day_spend(cost)
    text = (o.get("result") or "").strip()
    if not text:
        print(f"verify-agent: {sym} produced nothing (cost ${cost:.3f})"); return
    verdict = next((v for v in VERDICTS if v in text.upper()), "UNPROVEN")
    stamp = now_denver().strftime("%Y-%m-%d")
    prev = (t.get("thesis") or "")
    body = f"VERIFIED {stamp} — {verdict}.\n{text}\n\n--- earlier note ---\n{prev}"[:4000]
    sb_patch("desk_theses", f"symbol=eq.{sym}",
             {"thesis": body, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
    print(f"verify-agent: {sym} -> {verdict} (${cost:.3f}); {len(queue)-1} names still unverified")
    if verdict == "VERIFIED-MATERIAL":
        ntfy(f"✅ {sym} mechanism VERIFIED", text[:500], "default")
    elif verdict == "NO-MECHANISM":
        ntfy(f"❌ {sym} pays holders NOTHING", text[:500], "default")

if __name__ == "__main__":
    main()
