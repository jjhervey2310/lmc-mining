#!/usr/bin/env python3
"""ANALYST WATCH (build request #11) — FREE. Detects new uploads from tracked analysts via YouTube's
public RSS feeds (keyless, no LLM, no search spend), writes one-line entries to pa_memory
'analyst-watch', and hands new items to the 08:00 heartbeat push.

WHY RSS AND NOT A SEARCH: #11 asked for "one search per wake" inside the $10/mo budget. A Haiku
search per wake is ~$0.03-0.05 => $4-6/mo on top of the loop's existing spend, on a book whose whole
allowance is $9.82/mo. The RSS feed gives the same four fields (date, source, title, URL) plus the
description, exactly, for $0. If a source ever needs real searching, add it to SEARCH_ONLY and wire
it into news_sweep, which is already budget-gated.

THE GUARD, restated in every row written: analyst opinion is NOT a signal. It enters the pipeline
only as (a) a named nomination to be VERIFIED against mechanism/flows, or (b) a proposed RULE to be
TESTED on the backtest grid. Nothing here authorises a trade."""
import json, re, datetime, urllib.request
from common import *

FEEDS = [
    ("Ben Cowen / Into The Cryptoverse", "UCRvqjQPSeaWn-uEx-w0XOIg",
     "cycle/risk framework: BTC dominance, diminishing returns, risk bands, 20w/200w MAs"),
    ("Ran Neuner / Crypto Banter", "UCybasP-2D2b5kTLAb_kvhWQ", "narrative + rotation calls"),
]
KEEP_DAYS = 21
MAX_NEW_PER_RUN = 6          # a live channel can post many shorts; keep the digest readable

def feed(cid):
    req = urllib.request.Request(f"https://www.youtube.com/feeds/videos.xml?channel_id={cid}",
                                 headers={"User-Agent": "lmc-desk-loop/1.0"})
    with urllib.request.urlopen(req, timeout=25) as r:
        return r.read().decode("utf-8", "replace")

def entries(xml):
    out = []
    for e in re.findall(r"<entry>(.*?)</entry>", xml, re.S):
        vid = re.search(r"<yt:videoId>(.*?)</yt:videoId>", e)
        title = re.search(r"<title>(.*?)</title>", e)
        pub = re.search(r"<published>(.*?)</published>", e)
        link = re.search(r'<link rel="alternate" href="(.*?)"', e)
        desc = re.search(r"<media:description>(.*?)</media:description>", e, re.S)
        if not (vid and title and pub): continue
        gist = re.sub(r"\s+", " ", (desc.group(1) if desc else "")).strip()
        gist = re.sub(r"https?://\S+", "", gist).strip()          # strip promo links
        out.append({"id": vid.group(1), "title": unescape(title.group(1)),
                    "published": pub.group(1), "url": link.group(1) if link else f"https://www.youtube.com/watch?v={vid.group(1)}",
                    "gist": gist[:180]})
    return out

def unescape(s):
    for a, b in (("&amp;", "&"), ("&lt;", "<"), ("&gt;", ">"), ("&quot;", '"'), ("&#39;", "'")):
        s = s.replace(a, b)
    return s

def main():
    if not loop_enabled():
        print("loop disabled"); return
    sp = STATE / "analyst_seen.json"
    seen = set(json.loads(sp.read_text())) if sp.exists() else set()
    first_run = not seen
    now = datetime.datetime.now(datetime.timezone.utc)
    fresh_cut = now - datetime.timedelta(days=KEEP_DAYS)
    new_lines, all_ids, errors = [], set(), []

    for source, cid, frame in FEEDS:
        try:
            items = entries(feed(cid))
        except Exception as e:
            errors.append(f"{source}: {type(e).__name__}")     # a failed fetch must never read as "nothing new"
            continue
        for it in items:
            all_ids.add(it["id"])
            try:
                pub = datetime.datetime.fromisoformat(it["published"].replace("Z", "+00:00"))
            except Exception:
                continue
            if it["id"] in seen or pub < fresh_cut: continue
            new_lines.append({"source": source, "frame": frame, **it, "day": it["published"][:10]})

    new_lines.sort(key=lambda x: x["published"], reverse=True)
    capped = new_lines[:MAX_NEW_PER_RUN]
    sp.write_text(json.dumps(sorted(seen | all_ids)))

    stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")
    if first_run:
        print(f"analyst-watch: first run, {len(all_ids)} existing items marked seen (no push)")
        capped = capped[:2]     # seed the topic with a couple so the shape is visible, don't push a backlog

    if not capped and not errors:
        (STATE / "last_analyst").write_text(f"{stamp} nothing new"); print("analyst-watch: nothing new"); return

    body = "\n".join(f"{x['day']} | {x['source']} | {x['title']}" + (f" — {x['gist']}" if x['gist'] else "") + f" | {x['url']}"
                     for x in capped)
    if errors:
        body += "\n" + "\n".join(f"!! FEED UNREACHABLE — {e} (this is a fetch failure, NOT 'no new content')" for e in errors)
    head = (f"── ANALYST WATCH {stamp} ──\n"
            "NOT SIGNALS. Analyst content enters the pipeline ONLY as (a) a named nomination to be VERIFIED "
            "(mechanism, flows, unlocks) or (b) a proposed RULE to be TESTED on the backtest grid. "
            "Nothing below authorises an entry, an exit or a size.\n" + body + "\n")

    prev = sb_get("pa_memory", "topic=eq.analyst-watch&select=fact")
    old = prev[0]["fact"] if prev else ""
    kept = []
    for sec in old.split("── ANALYST WATCH ")[1:]:
        if sec[:10] >= fresh_cut.strftime("%Y-%m-%d"): kept.append("── ANALYST WATCH " + sec)
    fact = (head + "\n" + "".join(kept))[:20000]
    sb_upsert("pa_memory", [{"topic": "analyst-watch", "fact": fact, "source": "desk-loop", "active": True,
                             "updated_at": now.isoformat()}], "topic")
    (STATE / "last_analyst").write_text(f"{stamp}\n{body}")
    # queue for the 08:00 heartbeat rather than pushing now — this is reading material, not a trigger
    (STATE / "analyst_pending").write_text(json.dumps({"at": stamp, "lines": [f"{x['source'].split(' / ')[0]}: {x['title'][:70]}" for x in capped]}))
    print(f"analyst-watch: {len(capped)} new, {len(errors)} feed errors")

if __name__ == "__main__":
    main()
