"""Copy priority-corpus transcript text into the owner's own database (spec §13, narrowed).

Why this module exists, stated plainly so the boundary is not lost later:

captions.py keeps RETENTION="hash_only". Full caption text is written to the local private
cache and only provenance — hash, segment count, duration, cache path — reaches the
database. That remains true for the archive at large, and it is why the text of 8,000-odd
videos does not sit in a hosted table.

The owner decided on 2026-09-16 to make a bounded exception for the presenter corpus they
actually want studied: the Sniper Masterclass, Kyle Doops, Ran's Show, the Sniper Show and
the teaching playlists. For those, and only those, the text is copied into their OWN
private Supabase project so it can be read and analysed without shipping files around.

That is not publication and not redistribution. The destination is private to the owner,
nothing here is served to the public site, and the local cache stays the record of what was
fetched. Every row carries text_hash so a copy can always be proved identical to the fetch.

Two guards this module will not give up:

  1. A row is written only when the local text hashes to exactly what vr_transcripts
     recorded at fetch time. A mismatch is a defect — the cache and the database disagree
     about what was said — and is reported, never silently reconciled.
  2. The corpus is derived from the source registry, not a hardcoded id list. A video is
     eligible because a CONFIRMED source with presenter priority claims it. Widening the
     corpus means changing a priority, not editing this file.
"""
import argparse
import json
import os
import sys

import captions
import sources
import store

# A single transcript above this many characters is skipped rather than pushed. A long
# livestream can run to a megabyte of JSON, and the point of the bounded corpus is to stay
# inside a free tier. Skipped videos keep their local text and are reported by id, so the
# decision is visible rather than silent.
CHAR_CAP = int(os.environ.get("VR_TEXT_CHAR_CAP", "400000"))

# Upload chunk size in BYTES of JSON, not rows. store.upsert chunks at 400 rows, which is
# right for the small provenance rows it was written for and badly wrong here: a half-hour
# video carries ~900 segments, so 199 transcripts in one POST is tens of megabytes and the
# request times out before the server answers. Measured the hard way on the first real run.
BATCH_BYTES = int(os.environ.get("VR_TEXT_BATCH_BYTES", "1000000"))

TABLE = "vr_transcript_text"


# --------------------------------------------------------------------------
# corpus definition — derived from the registry
# --------------------------------------------------------------------------
# Two ways into the readable corpus, because two different things are being balanced.
#
# CURATED sources (a named person's show, a course, a tutorial playlist) go in whole. They
# are small and every video is on-topic.
#
# WHOLE ARCHIVES do not. Benjamin Cowen's channel is 3,133 videos; pushing all of it would
# blow the bounded-corpus decision this module exists to keep — roughly 125 MB of transcript
# text in the owner's database, most of it market commentary rather than method.
#
# But excluding him outright was also wrong, and it was silent: 498 of his transcripts were
# fetched and scanned while NONE could ever become readable, and the owner had explicitly
# named him "one of the best chart readers out there". The bound predates that instruction.
#
# So a whole archive is admitted SELECTIVELY: only its videos the scanner already flagged as
# rule-bearing. That keeps the corpus bounded by evidence rather than by source, and it is
# the same hit map that decides what is worth reading anyway.
CURATED_PRIORITY_MAX = int(os.environ.get("VR_CURATED_PRIORITY_MAX", "39"))
SELECTIVE_PRIORITY_MAX = int(os.environ.get("VR_SELECTIVE_PRIORITY_MAX", "40"))
# The categories that make a video worth reading closely, rather than merely on-topic.
SELECTIVE_CATEGORIES = ("stop_invalidation", "position_size", "avoid_trading",
                        "entry", "exit_target", "leverage")
# Hard ceiling on how many videos any one whole archive may contribute.
SELECTIVE_CAP = int(os.environ.get("VR_SELECTIVE_CAP", "600"))


def priority_sources():
    """CONFIRMED curated sources — a named person's show, a course, a tutorial playlist.

    Whole archives are deliberately NOT here; see selective_sources().
    """
    return [s for s in sources.confirmed()
            if s.get("priority", 100) <= CURATED_PRIORITY_MAX]


def selective_sources():
    """Whole archives admitted by evidence rather than wholesale."""
    return [s for s in sources.confirmed()
            if CURATED_PRIORITY_MAX < s.get("priority", 100) <= SELECTIVE_PRIORITY_MAX]


def rule_bearing(video_ids):
    """The subset the scanner flagged as carrying a rule worth reading."""
    if not video_ids:
        return set()
    out, ids = set(), sorted(video_ids)
    for i in range(0, len(ids), 200):
        chunk = ids[i:i + 200]
        rows = store.get_all(
            "vr_scan_hits",
            "select=video_id&category=in.(" + ",".join(SELECTIVE_CATEGORIES) + ")"
            "&video_id=in.(" + ",".join(chunk) + ")", order="video_id")
        out.update(r["video_id"] for r in rows)
    return out


def corpus_members(source):
    """Video ids claimed by one priority source, with the source_key that claimed them."""
    key = source["source_key"]
    if source["kind"] == "playlist":
        rows = store.get_all("vr_playlist_members",
                             f"select=video_id&playlist_id=eq.{source['playlist_id']}",
                             order="video_id")
    elif source.get("channel_id"):
        rows = store.get_all("vr_videos",
                             f"select=video_id&channel_id=eq.{source['channel_id']}",
                             order="video_id")
    else:
        return {}
    return {r["video_id"]: key for r in rows}


def corpus_index():
    """{video_id: corpus_key} across every readable source.

    First claim wins, and sources are visited in priority order, so a video in both the
    Masterclass and the Sniper Show is labelled with the higher-priority one. Curated
    sources contribute every member; a whole archive contributes only its rule-bearing
    videos, capped, and only ones no curated source already claimed.
    """
    index = {}
    for s in sorted(priority_sources(), key=lambda s: (s.get("priority", 100),
                                                       s["source_key"])):
        for vid, key in corpus_members(s).items():
            index.setdefault(vid, key)
    for s in sorted(selective_sources(), key=lambda s: (s.get("priority", 100),
                                                        s["source_key"])):
        members = {v: k for v, k in corpus_members(s).items() if v not in index}
        for vid in sorted(rule_bearing(set(members)))[:SELECTIVE_CAP]:
            index.setdefault(vid, members[vid])
    return index


# --------------------------------------------------------------------------
# local cache reading — pure enough to test without a database
# --------------------------------------------------------------------------
def read_local(local_ref):
    """Segments from a cache file. Returns None when the file is not on this machine.

    local_ref is relative to store.CACHE by construction (captions.py stores it that way so
    a machine layout never leaks into a shared table), so a missing file means the fetch
    happened somewhere else — a normal state, not an error.
    """
    path = store.CACHE / local_ref
    if not path.exists():
        return None
    doc = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    return doc.get("segments") or []


def verify(segments, expected_hash):
    """(ok, reason). The hash guard: pushed text must be the fetched text, exactly."""
    if not segments:
        return False, "empty transcript"
    text = "\n".join(s.get("text", "") for s in segments)
    if len(text) > CHAR_CAP:
        return False, f"over cap: {len(text):,} chars > {CHAR_CAP:,}"
    actual = store.sha256(text)
    if actual != expected_hash:
        return False, (f"hash mismatch: cache {actual[:12]} vs recorded "
                       f"{str(expected_hash)[:12]} — cache and database disagree")
    return True, ""


# --------------------------------------------------------------------------
# push
# --------------------------------------------------------------------------
def select(limit=200, force=False):
    """Priority-corpus transcripts that have local text and are not pushed yet."""
    index = corpus_index()
    if not index:
        return [], index
    have = set()
    if not force:
        for r in store.get_all(TABLE, "select=video_id,lang,source_type",
                               order="video_id,lang,source_type"):
            have.add((r["video_id"], r["lang"], r["source_type"]))
    out = []
    # Ordered and paged: this walk decides what becomes readable, and a truncated one
    # starves whatever sorts late. That is precisely what happened to Kyle Doops.
    for r in store.get_all("vr_transcripts",
                           "select=video_id,lang,source_type,text_hash,local_ref",
                           order="video_id,lang,source_type"):
        key = (r["video_id"], r["lang"], r["source_type"])
        if r["video_id"] not in index or key in have:
            continue
        out.append(r)
        if len(out) >= limit:
            break
    return out, index


def size_chunks(rows, max_bytes=None):
    """Split rows so each request stays under max_bytes of JSON.

    Row count is the wrong unit for transcript rows — they vary from a few KB to most of a
    megabyte — so batching by count either wastes round trips or times out. A single row
    larger than the cap still goes alone rather than being dropped.
    """
    cap = max_bytes or BATCH_BYTES
    out, current, size = [], [], 0
    for r in rows:
        n = len(json.dumps(r, separators=(",", ":")))
        if current and size + n > cap:
            out.append(current)
            current, size = [], 0
        current.append(r)
        size += n
    if current:
        out.append(current)
    return out


def push(limit=200, force=False, dry_run=False):
    rows, index = select(limit, force)
    pushed, skipped, absent, bad = [], [], [], []
    batch = []
    for r in rows:
        segments = read_local(r.get("local_ref") or "")
        if segments is None:
            absent.append(r["video_id"])
            continue
        ok, reason = verify(segments, r.get("text_hash"))
        if not ok:
            (bad if "mismatch" in reason else skipped).append((r["video_id"], reason))
            continue
        batch.append({"video_id": r["video_id"], "lang": r["lang"],
                      "source_type": r["source_type"], "segments": segments,
                      "char_count": sum(len(s.get("text", "")) for s in segments),
                      "text_hash": r["text_hash"],
                      "corpus": index[r["video_id"]], "pushed_at": store.utcnow()})
        pushed.append(r["video_id"])
    if batch and not dry_run:
        for chunk in size_chunks(batch, BATCH_BYTES):
            store.upsert(TABLE, chunk, "video_id,lang,source_type")
    return {"eligible": len(rows), "pushed": len(pushed), "skipped": skipped,
            "absent_locally": len(absent), "hash_mismatches": bad,
            "corpus_size": len(index), "dry_run": dry_run}


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="push-text",
        description="Copy priority-corpus transcript text into the owner's own database.")
    ap.add_argument("--limit", type=int, default=200, help="transcripts this batch")
    ap.add_argument("--force", action="store_true", help="re-push rows already present")
    ap.add_argument("--dry-run", action="store_true", help="report, write nothing")
    a = ap.parse_args(argv)
    out = push(a.limit, a.force, a.dry_run)
    print(f"corpus        {out['corpus_size']:,} video(s) across "
          f"{len(priority_sources())} priority source(s)")
    print(f"eligible      {out['eligible']}")
    print(f"pushed        {out['pushed']}{'  (dry run — nothing written)' if a.dry_run else ''}")
    print(f"absent local  {out['absent_locally']}   (fetched on another machine)")
    for vid, reason in out["skipped"]:
        print(f"  skip   {vid}  {reason}")
    for vid, reason in out["hash_mismatches"]:
        print(f"  DEFECT {vid}  {reason}")
    # A hash mismatch is the one outcome that must not be shrugged off by a caller.
    return 1 if out["hash_mismatches"] else 0


if __name__ == "__main__":
    sys.exit(main())
