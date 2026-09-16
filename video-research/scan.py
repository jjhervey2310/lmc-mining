"""Mechanical scan over every transcript — complete coverage, no cost, no comprehension.

This is the tier that answers "did you look at all of them" with yes. It runs locally,
where the full caption text lives, so it is not bounded by the priority corpus and not
bounded by a budget: every video that has a transcript gets scanned.

What a hit is: a pattern matched at a timestamp. "Somebody says something stop-shaped 41
minutes into this video." That is a pointer worth reading, and it is all it is.

What a hit is NOT: evidence that a rule was stated. The pattern `stop` matches "stop loss
at 62,000" and it matches "we could stop here for a coffee". Promoting a hit into a method
record requires a deliberate read, which is why hits live in their own table and never
touch vr_methods. The scan narrows 3,900 hours to the minutes worth reading; it does not
decide what they mean.

Two properties worth keeping:

  1. Every hit carries t_start_ms, so it is citable back to the exact moment. A finding
     nobody can check in the video is not a finding.
  2. A scanned video with zero hits writes a vr_scan_runs row anyway. "Looked, found
     nothing" and "never looked" are different facts and the schema keeps them apart.
"""
import argparse
import json
import re
import sys

import store

SCANNER_VERSION = "scan/1.0"
SNIPPET_CAP = 160        # triage context only; the local cache stays the full record
CONTEXT_CHARS = 60       # characters either side of the match inside the snippet


# --------------------------------------------------------------------------
# patterns
# --------------------------------------------------------------------------
# Grouped by what the owner asked to learn: where a stop is stated, what leverage is used,
# whether size is ever given, where entries and exits are named, and when they say to stay
# out. Patterns are deliberately broad — a false positive costs one line of reading, a
# false negative loses the finding entirely.
PATTERNS = {
    "stop_invalidation": [
        r"\bstop[\s-]?loss(?:es)?\b",
        r"\bmy stop\b", r"\bstop is\b", r"\bstop at\b", r"\bstops? (?:go(?:es)?|sits?) \b",
        r"\binvalidat\w+",
        r"\bi'?m wrong (?:if|when|below|above)\b",
        r"\bif (?:it|we|this|price) (?:break|close|lose|loses|breaks|closes)s?\b[^.]{0,40}\bi'?m out\b",
        r"\bcut (?:it|the trade|losses|my loss)\b",
        r"\bget out (?:if|below|above|when)\b",
    ],
    "leverage": [
        r"\b(\d{1,3})\s?x\b(?=[^.\n]{0,30}\b(?:leverage|lever|long|short|position|size)\b)",
        r"\bleverage[d]?\b", r"\bisolated (?:margin)?\b", r"\bcross (?:margin)\b",
        r"\bliquidat\w+", r"\bliq(?:\.|\s)?price\b", r"\bfunding (?:rate|cost)\b",
    ],
    "position_size": [
        r"\bposition siz\w+", r"\bsize (?:up|down|in|into)\b",
        r"\b(\d{1,3})\s?%\s?(?:of (?:my|your|the) )?(?:portfolio|port|account|bag|stack)\b",
        r"\brisk(?:ing)? (\d{1,2})\s?%",
        r"\ballocat\w+ (\d{1,3})\s?%",
    ],
    "entry": [
        r"\bentry (?:is|at|zone|around)\b", r"\bi'?m (?:buying|bidding|longing)\b",
        r"\bwe(?:'re| are) buying\b", r"\bbid(?:ding)? at\b",
        r"\bi'?m (?:short|shorting)\b", r"\bopen(?:ed|ing)? a (?:long|short)\b",
    ],
    "exit_target": [
        r"\btake profit\b", r"\btp (?:at|is|around)\b", r"\btarget (?:is|at|of)\b",
        r"\btaking profit\b", r"\bclos(?:e|ing) (?:my|the) (?:long|short|position)\b",
    ],
    "avoid_trading": [
        r"\bdon'?t trade\b", r"\bdo not trade\b", r"\bstay (?:out|flat)\b",
        r"\bno[\s-]trade\b", r"\bsit (?:on (?:your|my) hands|this one out)\b",
        r"\bwait for confirmation\b", r"\bnot a (?:trade|setup)\b",
    ],
    # Tone markers. ASR strips delivery entirely: a deadpan joke and a real call read
    # identically as text. These cannot recover tone, but they do measure how much of what
    # a presenter says is hedged versus asserted — and a call surrounded by disclaimers is
    # a different object from one stated flat. Owner's steer 2026-09-16: they joke around,
    # so treat conviction as something to evidence rather than assume.
    "hedge": [
        r"\bnot financial advice\b", r"\bdo your own research\b", r"\bdyor\b",
        r"\bi could be wrong\b", r"\bmight be wrong\b", r"\bjust my opinion\b",
        r"\bi'?m joking\b", r"\bjust kidding\b", r"\bobviously (?:a )?joke\b",
        r"\bdon'?t (?:quote|hold) me\b", r"\bno idea\b",
    ],
    "conviction": [
        r"\bhigh conviction\b", r"\bi'?m confident\b", r"\bthis is the trade\b",
        r"\bi'?m all in\b", r"\bmy biggest position\b", r"\bwithout a doubt\b",
        r"\bguarantee[d]?\b",
    ],
    "regime": [
        r"\bbull market\b", r"\bbear market\b", r"\brange[\s-]bound\b",
        r"\baltseason\b", r"\brisk[\s-]off\b", r"\brisk[\s-]on\b",
    ],
}

COMPILED = {cat: [(p, re.compile(p, re.I)) for p in pats] for cat, pats in PATTERNS.items()}

# A leading number inside the match, used to record "10x" as magnitude 10 and "risk 2%"
# as 2. Absent for patterns that carry no magnitude, which is most of them.
_NUM = re.compile(r"(\d{1,3})")


def _snippet(text, start, end):
    """Short, centred context. Capped so the table holds triage text, never a transcript."""
    lo = max(0, start - CONTEXT_CHARS)
    hi = min(len(text), end + CONTEXT_CHARS)
    out = text[lo:hi].strip()
    return out[:SNIPPET_CAP]


def scan_segments(segments):
    """[(category, pattern, t_start_ms, snippet, magnitude)] for one transcript.

    Pure: no I/O, no database. Every hit keeps the segment's own timestamp rather than a
    computed offset, so a citation lands where the words actually are.
    """
    hits = []
    for seg in segments:
        text = seg.get("text") or ""
        if not text:
            continue
        t = seg.get("t_start_ms")
        if t is None:
            continue
        for cat, pats in COMPILED.items():
            for raw, rx in pats:
                for m in rx.finditer(text):
                    mag = None
                    if m.groups() and m.group(1) and m.group(1).isdigit():
                        mag = int(m.group(1))
                    elif cat in ("leverage", "position_size"):
                        n = _NUM.search(m.group(0))
                        mag = int(n.group(1)) if n else None
                    hits.append((cat, raw, int(t), _snippet(text, m.start(), m.end()), mag))
    return hits


def summarise(hits):
    """{category: count} — the shape the dashboard and the triage list both want."""
    out = {}
    for cat, *_ in hits:
        out[cat] = out.get(cat, 0) + 1
    return out


# --------------------------------------------------------------------------
# local cache walk
# --------------------------------------------------------------------------
# Track preference, best first. A video usually has BOTH an "en" and an "en-orig" track
# holding the same machine transcription, so scanning every file double-counts every hit —
# measured on the first real run: a single "100x on Bitcoin" line produced two identical
# rows at the same timestamp. Video counts were never affected (they count distinct ids),
# but hit totals were inflated roughly twofold, which is exactly the kind of number that
# gets quoted later as if it meant something. One track per video, chosen deterministically.
TRACK_PREFERENCE = (("en", "creator"), ("en-orig", "creator"),
                    ("en", "auto"), ("en-orig", "auto"))


def local_transcripts():
    """One preferred transcript per video: (video_id, lang, source_type, path).

    Creator captions outrank ASR because a human checked them; "en" outranks "en-orig"
    only to break the remaining tie deterministically, not because it is better.
    """
    root = store.CACHE / "transcripts"
    if not root.exists():
        return []
    found = {}
    for p in sorted(root.glob("*.json")):
        parts = p.stem.split(".")
        if len(parts) != 3:
            continue
        vid, lang, stype = parts
        found.setdefault(vid, {})[(lang, stype)] = p
    out = []
    for vid in sorted(found):
        for key in TRACK_PREFERENCE:
            if key in found[vid]:
                out.append((vid, key[0], key[1], found[vid][key]))
                break
    return out


def run(limit=None, force=False, dry_run=False):
    done = set()
    if not force:
        for r in store.get("vr_scan_runs",
                           "select=video_id,lang,source_type,scanner_version&limit=20000"):
            if r.get("scanner_version") == SCANNER_VERSION:
                done.add((r["video_id"], r["lang"], r["source_type"]))

    scanned = skipped = total_hits = 0
    by_category = {}
    hit_rows, run_rows = [], []
    for vid, lang, stype, path in local_transcripts():
        if (vid, lang, stype) in done:
            skipped += 1
            continue
        if limit is not None and scanned >= limit:
            break
        try:
            segments = json.loads(path.read_text(encoding="utf-8", errors="replace")).get(
                "segments") or []
        except (ValueError, OSError):
            continue
        hits = scan_segments(segments)
        scanned += 1
        total_hits += len(hits)
        for cat, n in summarise(hits).items():
            by_category[cat] = by_category.get(cat, 0) + n
        for cat, pat, t, snip, mag in hits:
            hit_rows.append({"video_id": vid, "lang": lang, "source_type": stype,
                             "t_start_ms": t, "category": cat, "pattern": pat,
                             "snippet": snip, "magnitude": mag})
        # Written whether or not there were hits: "looked, found nothing" is a fact.
        run_rows.append({"video_id": vid, "lang": lang, "source_type": stype,
                         "scanner_version": SCANNER_VERSION, "segments": len(segments),
                         "hits": len(hits), "scanned_at": store.utcnow()})

    if not dry_run:
        # Clear this video's previous hits before writing the new ones. vr_scan_hits is
        # insert-only (a video yields many rows, so there is no natural conflict key), which
        # means a re-scan appends instead of replacing. Measured: a --force pass after the
        # track-dedupe fix left 5,379 rows where 1,828 was correct — the corrected numbers
        # stacked on top of the wrong ones they were meant to replace.
        for vid in sorted({r["video_id"] for r in run_rows}):
            store.delete("vr_scan_hits", f"video_id=eq.{vid}")
        for i in range(0, len(hit_rows), 500):
            store.insert("vr_scan_hits", hit_rows[i:i + 500])
        for i in range(0, len(run_rows), 500):
            store.upsert("vr_scan_runs", run_rows[i:i + 500], "video_id,lang,source_type")
    return {"scanned": scanned, "already_done": skipped, "hits": total_hits,
            "by_category": by_category, "dry_run": dry_run}


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="scan", description="Pattern-scan every local transcript. Costs nothing.")
    ap.add_argument("--limit", type=int, metavar="N", help="transcripts this batch")
    ap.add_argument("--force", action="store_true", help="re-scan already-scanned videos")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    a = ap.parse_args(argv)
    out = run(a.limit, a.force, a.dry_run)
    print(f"scanned      {out['scanned']}   already done {out['already_done']}")
    print(f"hits         {out['hits']:,}{'  (dry run — nothing written)' if a.dry_run else ''}")
    for cat in sorted(out["by_category"], key=lambda c: -out["by_category"][c]):
        print(f"  {cat:<20} {out['by_category'][cat]:>7,}")
    print("\nA hit is a timestamped pointer to a moment, not a claim that a rule was "
          "stated.\nReading one is what turns it into a method record.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
