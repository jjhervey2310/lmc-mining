"""Resumable archive inventory: enumerate every listing of a confirmed source (spec §5, §6).

THE DENOMINATOR RULE
--------------------
Coverage is a fraction, and the fraction is a lie unless we know the denominator. YouTube
listings paginate, and pagination can stop for three different reasons that look identical
from the outside: we reached the end, we were rate-limited, or the caller capped the crawl.
Only the first one licenses a percentage.

So this module never infers completeness. Every (source, listing) enumeration writes a
vr_inventory_runs row whose pagination_complete is true ONLY when all three hold:
  * yt-dlp exited 0 and we consumed its stdout to EOF,
  * no caller-supplied limit truncated the walk, and
  * stderr carried no bot-check / 429 signal.
Anything else stores pagination_complete=false plus a stopped_reason, and
coverage_report() returns ratio=None for that listing instead of a number. A missing
denominator produces an explicit None, never a plausible-looking percentage.

Two other invariants live here:
  * Dedupe is by video_id ALONE (acceptance test §22.1). A video in both a playlist and a
    channel tab is one vr_videos row; the playlist relationship is kept in
    vr_playlist_members, not by cloning the video.
  * A known video_type is never overwritten with 'unknown', and a field this listing did
    not measure is never written as null over a field another listing did measure.

Titles and URLs coming out of yt-dlp are UNTRUSTED DATA. They are stored and hashed; they
are never parsed for instructions and never used to infer availability or presenter.

Enumeration (--flat-playlist) is not bot-gated; the per-video player API is. This module
stays on the listing side on purpose, and still paces itself between listings.
"""
import argparse
import json
import os
import re
import subprocess
import tempfile
import time
import urllib.parse

import sources
import store

YTDLP = os.environ.get("VR_YTDLP", "yt-dlp")
# Title LAST: split(maxsplit=5) then a '|' inside a title cannot shift any other field.
PRINT_TEMPLATE = "%(id)s|%(duration)s|%(live_status)s|%(channel_id)s|%(url)s|%(title)s"
LISTING_TYPE = {"videos": "upload", "streams": "livestream", "shorts": "short",
                "playlist": "unknown"}
LIVE_TYPE = {"is_live": "livestream", "was_live": "livestream", "post_live": "livestream",
             "is_upcoming": "livestream"}
ID_RE = re.compile(r"^[A-Za-z0-9_-]{6,24}$")
BOT_RE = re.compile(r"not a bot|sign in to confirm", re.I)
RATE_RE = re.compile(r"\b429\b|too many requests", re.I)
LISTING_PAUSE = float(os.environ.get("VR_LISTING_PAUSE", "5"))
PAUSE_CAP = float(os.environ.get("VR_PAUSE_CAP", "900"))


def _na(v):
    """yt-dlp prints the literal 'NA' for a field it has no value for."""
    v = (v or "").strip()
    return None if v in ("", "NA", "None") else v


def _int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _video_type(listing, live_status, known=None):
    """Tab is authoritative; live_status only rescues the playlist case, where the listing
    says nothing. Never downgrade a stored type to 'unknown'."""
    t = LISTING_TYPE.get(listing, "unknown")
    if t == "unknown":
        t = LIVE_TYPE.get(live_status or "", "unknown")
    if t == "unknown" and known in ("upload", "livestream", "short"):
        return known
    return t


def _parse(line):
    parts = line.rstrip("\n").split("|", 5)
    if len(parts) < 6:
        return None
    vid, dur, live, chan, url, title = parts
    vid = _na(vid)
    if not vid or not ID_RE.match(vid):  # also keeps a junk id out of a PostgREST in.() filter
        return None
    return {"video_id": vid, "duration_s": _int(_na(dur)), "live_status": _na(live),
            "channel_id": _na(chan),
            "canonical_url": _na(url) or f"https://www.youtube.com/watch?v={vid}",
            "title": title.strip() or None}


# --------------------------------------------------------------------------
# enumeration (no DB — runnable offline, which is how it gets tested)
# --------------------------------------------------------------------------
def enumerate_listing(source, listing, url, limit=None, outcome=None):
    """Yield one parsed entry dict per listing item, in listing order (1-based 'position').

    A generator cannot hand a return value to a for-loop, so pass `outcome` (a dict) in and
    it is filled as the walk proceeds and finalised when the generator is exhausted:
    items_seen, malformed, pagination_complete, stopped_reason, blocker_kind, error.
    """
    out = outcome if outcome is not None else {}
    out.update({"source_key": source["source_key"], "listing": listing, "url": url,
                "items_seen": 0, "malformed": 0, "pagination_complete": False,
                "stopped_reason": None, "blocker_kind": None, "error": None,
                "returncode": None})
    cmd = [YTDLP, "--ignore-config", "--flat-playlist", "--no-warnings", "--no-colors",
           "--print", PRINT_TEMPLATE]
    if limit:
        cmd += ["--playlist-end", str(int(limit))]
    cmd.append(url)
    # stderr to a temp file, not a pipe: a chatty stderr must not deadlock us while we
    # stream stdout, and we need the whole of it to judge pagination_complete.
    errf = tempfile.TemporaryFile("w+")
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=errf, text=True)
    seen, drained = 0, False
    try:
        for line in proc.stdout:
            if not line.strip():
                continue
            e = _parse(line)
            if e is None:
                out["malformed"] += 1
                continue
            seen += 1
            e["position"] = seen
            out["items_seen"] = seen
            yield e
        drained = True
    finally:
        if not drained:
            proc.kill()
        try:
            proc.stdout.close()
        except Exception:
            pass
        rc = proc.wait()
        errf.seek(0)
        stderr = errf.read()
        errf.close()
        bot, rated = BOT_RE.search(stderr), RATE_RE.search(stderr)
        truncated = bool(limit) and seen >= int(limit)
        out["returncode"] = rc
        out["blocker_kind"] = "bot_check" if bot else ("rate_limited" if rated else None)
        # The whole point of this module: three independent reasons a walk can be partial.
        out["pagination_complete"] = bool(rc == 0 and drained and not truncated
                                          and not bot and not rated)
        out["stopped_reason"] = ("rate_limited" if (bot or rated) else
                                 "error" if (rc != 0 or not drained) else
                                 "cap" if truncated else "end_of_listing")
        if rc != 0 or bot or rated:
            out["error"] = (stderr.strip()[-900:] or f"exit {rc}")


# --------------------------------------------------------------------------
# persistence
# --------------------------------------------------------------------------
def _existing(ids):
    """video_id -> stored video_type, for ids already in vr_videos. Batched: the filter
    goes in a URL. Doubles as the first_seen_at guard — an id in here keeps its own."""
    known = {}
    for i in range(0, len(ids), 200):
        chunk = [v for v in ids[i:i + 200] if ID_RE.match(v)]
        if not chunk:
            continue
        q = "select=video_id,video_type&video_id=in.(" + urllib.parse.quote(",".join(chunk), safe=",") + ")"
        for r in store.get("vr_videos", q):
            known[r["video_id"]] = r.get("video_type")
    return known


def _upsert_videos(rows):
    """Drop unmeasured (None) fields, then bucket by key signature.

    Two reasons, one mechanism: PostgREST needs uniform keys within a batch, and a null we
    never measured must never overwrite a value a different listing did measure (the
    playlist walk knows no channel_name; the channel walk does)."""
    buckets = {}
    for r in rows:
        r = {k: v for k, v in r.items() if v is not None}
        buckets.setdefault(tuple(sorted(r)), []).append(r)
    for b in buckets.values():
        store.upsert("vr_videos", b, "video_id")
    return len(rows)


def _video_row(e, source, listing, known, now):
    channel = source["kind"] == "channel"
    return {
        "video_id": e["video_id"],
        "channel_id": e["channel_id"] or (source.get("channel_id") if channel else None),
        "channel_name": source.get("display_name") if channel else None,
        "channel_handle": source.get("handle") if channel else None,
        "canonical_url": e["canonical_url"],
        "title": e["title"],
        "duration_s": e["duration_s"],
        "video_type": _video_type(listing, e["live_status"], known.get(e["video_id"])),
        # Hash is labelled with the field set that produced it: a later, richer metadata
        # pass hashes different fields, and comparing across field sets means nothing.
        "content_hash": store.sha256("flat|{video_id}|{title}|{duration_s}".format(**e)),
        "last_checked_at": now,
        # first_seen_at only for ids we have never stored; existing rows keep theirs.
        "first_seen_at": None if e["video_id"] in known else now,
        # availability stays untouched: a flat listing cannot tell us, and inferring it
        # from a title string would be trusting untrusted text.
    }


def _persist(entries, source, listing, now):
    """Write one listing's entries. Returns (seen, new). Order matters: vr_videos first,
    because members and stages carry FKs to it."""
    if not entries:
        return 0, 0
    known = _existing([e["video_id"] for e in entries])
    new = [e for e in entries if e["video_id"] not in known]
    _upsert_videos([_video_row(e, source, listing, known, now) for e in entries])
    if source["kind"] == "playlist":
        store.upsert("vr_playlist_members", [{
            "playlist_id": source["playlist_id"], "video_id": e["video_id"],
            "position": e["position"], "source_key": source["source_key"],
            "seen_at": now} for e in entries], "playlist_id,video_id")
    # Bulk equivalent of store.set_stage() per video — 5k videos x 2 stages is 10k HTTP
    # calls one at a time, and the upsert key is identical either way.
    detail = "{}:{} (flat_playlist)".format(source["source_key"], listing)
    store.upsert("vr_video_stages", [{
        "video_id": e["video_id"], "stage": stage, "state": "done",
        "detail": detail, "updated_at": now}
        for e in entries for stage in ("DISCOVERED", "METADATA_ONLY")], "video_id,stage")
    return len(entries), len(new)


def run_listing(source, listing, url, limit=None, batch=400):
    """Enumerate one listing and persist it, logging a vr_inventory_runs row either way."""
    started = store.utcnow()
    outcome, seen, new, buf = {}, 0, 0, []
    try:
        for e in enumerate_listing(source, listing, url, limit=limit, outcome=outcome):
            buf.append(e)
            if len(buf) >= batch:
                s, n = _persist(buf, source, listing, started)
                seen, new, buf = seen + s, new + n, []
        s, n = _persist(buf, source, listing, started)
        seen, new = seen + s, new + n
    finally:
        if outcome.get("blocker_kind"):
            store.record_blocker(outcome["blocker_kind"], detail=outcome.get("error"),
                                 source_key=source["source_key"])
        store.insert("vr_inventory_runs", [{
            "source_key": source["source_key"], "listing": listing,
            "started_at": started, "finished_at": store.utcnow(),
            "items_seen": outcome.get("items_seen", 0), "new_items": new,
            "pagination_complete": bool(outcome.get("pagination_complete")),
            "stopped_reason": outcome.get("stopped_reason"),
            "cutoff_at": started,  # the snapshot this listing represents
            "error": outcome.get("error")}])
    outcome["persisted"] = seen
    outcome["new_items"] = new
    return outcome


# --------------------------------------------------------------------------
# registry + driver
# --------------------------------------------------------------------------
def seed_registry():
    """Store every source, including the ones we refuse to crawl. UNRESOLVED and RELATED
    rows exist so the owner can see what was asked for and what was found — refresh()
    reads sources.confirmed() and never touches them."""
    store.upsert("vr_sources", [{
        "source_key": s["source_key"], "kind": s["kind"],
        "channel_id": s.get("channel_id"), "playlist_id": s.get("playlist_id"),
        "handle": s.get("handle"), "display_name": s.get("display_name"),
        "canonical_url": s.get("canonical_url") or "",
        "scope_status": s["scope_status"], "resolution_note": s.get("resolution_note"),
        "priority": s.get("priority", 100)} for s in sources.SOURCES], "source_key")
    store.upsert("vr_presenters", [{
        "presenter_key": p["presenter_key"], "display_name": p["display_name"],
        "affiliation": p.get("affiliation"), "notes": p.get("notes")}
        for p in sources.PRESENTERS], "presenter_key")
    return {"sources": len(sources.SOURCES), "presenters": len(sources.PRESENTERS)}


def _resume_done(run_id):
    """Listings already finished by the last run — but only if that run did NOT finish ok.
    A completed run must re-check its listings, or new uploads would never be seen."""
    try:
        rows = store.get("vr_runs", "select=id,ok,checkpoint&job=eq.inventory"
                                    "&order=started_at.desc&limit=3")
    except Exception:
        return set()
    for r in rows:
        if r["id"] == run_id:
            continue
        if r.get("ok"):
            return set()
        return {tuple(x) for x in (r.get("checkpoint") or {}).get("done", [])}
    return set()


def refresh(source_keys=None, limit=None, resume=True):
    """Enumerate every CONFIRMED source, checkpointing after each listing."""
    seed_registry()  # FKs: vr_playlist_members.source_key needs the row to exist first
    todo = [s for s in sources.confirmed()
            if not source_keys or s["source_key"] in source_keys]
    todo.sort(key=lambda s: (s.get("priority", 100), s["source_key"]))
    results, pause = [], LISTING_PAUSE
    with store.Run("inventory", note=f"{len(todo)} source(s)") as run:
        done = _resume_done(run.id) if resume else set()
        for s in todo:
            for listing, url in sources.listing_urls(s):
                key = (s["source_key"], listing)
                if key in done:
                    run.skipped += 1
                    continue
                try:
                    out = run_listing(s, listing, url, limit=limit)
                except Exception as e:  # noqa: BLE001 - one bad listing must not end the run
                    run.failed += 1
                    out = {"source_key": s["source_key"], "listing": listing,
                           "error": f"{type(e).__name__}: {e}"[:400],
                           "pagination_complete": False, "stopped_reason": "error"}
                else:
                    run.processed += out.get("persisted", 0)
                    if out.get("blocker_kind"):
                        run.blocked += 1
                results.append(out)
                done.add(key)
                run.save({"done": sorted(list(x) for x in done), "at": store.utcnow()})
                # Back off hard after a bot check; the recovery is a cooldown, not a retry.
                pause = min(pause * 2, PAUSE_CAP) if out.get("blocker_kind") else LISTING_PAUSE
                time.sleep(pause)
    return results


# --------------------------------------------------------------------------
# coverage (spec §22.15)
# --------------------------------------------------------------------------
def _latest_run(source_key, listing):
    rows = store.get("vr_inventory_runs",
                     "select=started_at,finished_at,items_seen,new_items,"
                     "pagination_complete,stopped_reason,cutoff_at,error"
                     f"&source_key=eq.{urllib.parse.quote(source_key)}"
                     f"&listing=eq.{urllib.parse.quote(listing)}"
                     "&order=started_at.desc&limit=1")
    return rows[0] if rows else None


def _stored(source, listing):
    """Numerator: rows we actually hold that belong to this listing."""
    if listing == "playlist":
        return (store.count("vr_playlist_members",
                            f"playlist_id=eq.{source['playlist_id']}"),
                "vr_playlist_members rows for this playlist")
    return (store.count("vr_videos", f"channel_id=eq.{source['channel_id']}"
                                     f"&video_type=eq.{LISTING_TYPE[listing]}"),
            f"vr_videos with this channel_id and video_type={LISTING_TYPE[listing]}")


def coverage_report(source_keys=None):
    """Per-source and per-listing coverage. A listing whose pagination_complete is false
    reports ratio=None — the denominator is unknown and a percentage would invent it."""
    rep = {"at": store.utcnow(), "sources": {}}
    for s in sources.SOURCES:
        if source_keys and s["source_key"] not in source_keys:
            continue
        e = {"kind": s["kind"], "scope_status": s["scope_status"],
             "enumerated": s["scope_status"] == "CONFIRMED", "listings": {}}
        if s["scope_status"] != "CONFIRMED":
            e["note"] = "not enumerated: scope_status is not CONFIRMED"
            rep["sources"][s["source_key"]] = e
            continue
        for listing, _url in sources.listing_urls(s):
            r = _latest_run(s["source_key"], listing)
            if r is None:
                e["listings"][listing] = {
                    "ran": False, "pagination_complete": False, "items_seen": None,
                    "stored": None, "ratio": None,
                    "ratio_note": "never enumerated: denominator unknown"}
                continue
            stored, numerator = _stored(s, listing)
            complete, seen = bool(r["pagination_complete"]), r["items_seen"] or 0
            ratio, note = None, None
            if not complete:
                note = (f"pagination incomplete ({r.get('stopped_reason')}): "
                        "denominator unknown, percentage withheld")
            elif seen == 0:
                note = "listing enumerated as empty: no denominator to divide by"
            else:
                ratio = round(stored / seen, 4)
            e["listings"][listing] = {
                "ran": True, "last_run_at": r["started_at"], "cutoff_at": r["cutoff_at"],
                "items_seen": seen, "new_items": r["new_items"],
                "pagination_complete": complete, "stopped_reason": r["stopped_reason"],
                "error": r["error"], "stored": stored, "numerator": numerator,
                "ratio": ratio, "ratio_note": note}
        ls = list(e["listings"].values())
        e["all_listings_complete"] = bool(ls) and all(x["pagination_complete"] for x in ls)
        e["items_seen_total"] = sum(x["items_seen"] or 0 for x in ls) if e["all_listings_complete"] else None
        if not e["all_listings_complete"]:
            e["items_seen_total_note"] = "at least one listing is incomplete: no source-level total"
        if s["kind"] == "channel":
            e["stored_videos"] = store.count("vr_videos", f"channel_id=eq.{s['channel_id']}")
        else:
            e["stored_videos"] = store.count("vr_playlist_members",
                                             f"playlist_id=eq.{s['playlist_id']}")
        rep["sources"][s["source_key"]] = e
    return rep


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="video-research archive inventory")
    ap.add_argument("cmd", choices=["seed", "refresh", "coverage", "enumerate"])
    ap.add_argument("--source", action="append", dest="sources_")
    ap.add_argument("--listing", help="enumerate: one of videos|streams|shorts|playlist")
    ap.add_argument("--limit", type=int, help="cap items per listing (marks it incomplete)")
    ap.add_argument("--no-resume", action="store_true")
    a = ap.parse_args()
    try:
        if a.cmd == "seed":
            out = seed_registry()
        elif a.cmd == "refresh":
            out = refresh(a.sources_, limit=a.limit, resume=not a.no_resume)
        elif a.cmd == "coverage":
            out = coverage_report(a.sources_)
        else:  # enumerate: dry walk, no DB, for verifying the parse
            src = sources.by_key(a.sources_[0])
            urls = dict(sources.listing_urls(src))
            listing = a.listing or next(iter(urls))
            oc, items = {}, []
            for e in enumerate_listing(src, listing, urls[listing], limit=a.limit, outcome=oc):
                items.append(e)
            out = {"outcome": oc, "entries": items}
    except store.NoStore as e:
        print(json.dumps({"error": "no_store", "detail": str(e)}, indent=2))
        raise SystemExit(2)
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
