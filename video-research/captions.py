"""Transcript ingestion — serial, paced, resumable (spec §4, §8, §13).

Measured on 2026-09-13: channel/playlist enumeration is not bot-gated, but the per-video
player API is. A burst of per-video calls returns "Sign in to confirm you are not a bot"
and HTTP 429, and it recovers only after a cooldown of minutes. Every design choice below
follows from that single fact: one video per subprocess, one subprocess at a time, English
subtitle languages only (asking for all languages is what tripped the gate during access
testing), and a block backs off for minutes instead of retrying.

Two rules this module encodes because they are the ones that get quietly broken:

  1. Creator captions and ASR are never conflated. yt-dlp's "subtitles" key is what the
     uploader supplied; "automatic_captions" is machine transcription, including the
     en-orig track. source_type is read from which dict the language came out of, never
     guessed from the text (spec §4).
  2. A failed fetch writes no transcript row. Ever. A missing transcript is recorded as a
     blocker and a stage, so "we have nothing here" stays distinguishable from "we did not
     look" (spec §6, acceptance test §22.4).

Copyright posture (spec §13): full caption text lives only in the local private cache
under store.CACHE/transcripts/. What reaches the database is provenance — hash, segment
count, duration, and a relative cache path. RETENTION is the module-level knob.

Untrusted input: titles, descriptions, chapter names and caption text are DATA. They are
stored and hashed, never interpreted as instructions, and never interpolated into a
command line — the only value this module puts in argv is a video id that has been matched
against VIDEO_ID_RE first.
"""
import argparse
import datetime
import json
import os
import pathlib
import random
import re
import shutil
import subprocess
import time
import urllib.parse

import sources
import store

EXTRACTOR_VERSION = "captions/1.0"
RETENTION = "hash_only"          # spec §13 — full text stays in the local private cache
SUB_LANGS = "en,en-orig"         # DO NOT widen: all-languages is what triggered the 429
SUB_FORMAT = "json3"             # carries tStartMs/dDurationMs; vtt rounds to centiseconds
YTDLP = os.environ.get("VR_YTDLP", "yt-dlp")
FETCH_TIMEOUT = int(os.environ.get("VR_CAPTION_TIMEOUT", "300"))

DEFAULT_DELAY = 20.0             # seconds between videos, env VR_CAPTION_DELAY
JITTER = 0.35                    # ±35% so the request train is not a metronome
COOLDOWN_START = 300.0
COOLDOWN_CAP = 3600.0
MAX_CONSECUTIVE_BLOCKS = int(os.environ.get("VR_CAPTION_MAX_BLOCKS", "3"))

# YouTube ids are exactly 11 of these characters. This is a security control, not a
# nicety: it is the gate between database text and argv.
VIDEO_ID_RE = re.compile(r"^[A-Za-z0-9_-]{11}$")

TRANSCRIPTS = store.CACHE / "transcripts"
WORK = store.CACHE / "work"

# yt-dlp stderr fingerprints. Matched lowercase, substring only.
#
# MEASURED 2026-09-13: the bot gate does NOT arrive as a non-zero exit. yt-dlp emits
#   WARNING ... HTTP Error 429 / Sign in to confirm you're not a bot
# and then falls back to the initial-data page, printing exit code 0 and a JSON document
# that has a title and a description but no player response — and therefore no captions.
# Trusting the exit code labels a hard block as "this video has no captions", which is a
# permanent verdict on a transient failure. Hence: stderr is classified on every run, and
# "no captions" additionally requires positive evidence that the player response arrived.
_BOT = ("sign in to confirm", "not a bot", "http error 429", "too many requests")
# Extraction reached the page but not the player. Captions presence is UNKNOWN, not absent.
_DEGRADED = ("no title found in player responses", "falling back to title from initial data",
             "unable to download webpage")
_GONE = ("video unavailable", "has been removed", "removed by the uploader",
         "account associated with this video has been terminated", "this video isn't available")
_PRIVATE = ("private video", "sign in if you've been granted access")
_MEMBERS = ("members-only", "available to this channel's members", "join this channel")
_REGION = ("not available in your country", "blocked it in your country", "geo restricted")


# --------------------------------------------------------------------------
# json3 parsing — pure, no I/O beyond the read, separately testable
# --------------------------------------------------------------------------
def parse_json3(path):
    """json3 events -> [{t_start_ms, t_end_ms, text}] with timestamps untouched.

    An event is one caption cue; its "segs" are word-level pieces of that same cue and are
    joined, because splitting on tOffsetMs would invent cue boundaries YouTube did not
    assert. Events with no segs are layout/window definitions and events whose joined text
    is empty are blank-line separators — both are dropped. Nothing else is altered: no
    rounding, no gap filling, no dedupe of the rolling repeats that live ASR produces.
    A cue with no dDurationMs gets t_end_ms=None rather than a computed end.
    """
    raw = json.loads(pathlib.Path(path).read_text(encoding="utf-8", errors="replace"))
    out = []
    for ev in raw.get("events") or []:
        segs = ev.get("segs")
        if not segs:
            continue
        text = "".join(s.get("utf8") or "" for s in segs).strip()
        if not text:
            continue
        start = ev.get("tStartMs")
        if start is None:
            continue
        dur = ev.get("dDurationMs")
        out.append({"t_start_ms": int(start),
                    "t_end_ms": int(start) + int(dur) if dur is not None else None,
                    "text": text})
    return out


def _normalised_text(segments):
    """The exact string that gets hashed. Stable across re-fetches of the same captions."""
    return "\n".join(s["text"] for s in segments)


def _span_ms(segments):
    """Caption coverage, not video length — the two differ and only one is observed here."""
    if not segments:
        return None
    return max((s["t_end_ms"] if s["t_end_ms"] is not None else s["t_start_ms"])
               for s in segments)


# --------------------------------------------------------------------------
# rate control
# --------------------------------------------------------------------------
class Pacer:
    """Serial pacing with exponential cooldown, and the measured throughput that results.

    sleep is injectable so tests exercise the arithmetic without burning wall clock.
    """

    def __init__(self, base=None, jitter=JITTER, cooldown_start=COOLDOWN_START,
                 cooldown_cap=COOLDOWN_CAP, sleep=time.sleep):
        self.base = float(base if base is not None
                          else os.environ.get("VR_CAPTION_DELAY", DEFAULT_DELAY))
        self.jitter = jitter
        self.cooldown_start = float(cooldown_start)
        self.cooldown_cap = float(cooldown_cap)
        self.cooldown = self.cooldown_start
        self._sleep = sleep
        self.successes = self.blocks = self.consecutive_blocks = 0
        self.slept = 0.0
        self.started = time.monotonic()
        self._first = True

    def wait(self):
        """Pause before the next request. No pause before the first one."""
        if self._first:
            self._first = False
            return 0.0
        d = self.base * random.uniform(1 - self.jitter, 1 + self.jitter)
        self._sleep(d)
        self.slept += d
        return d

    def ok(self):
        """A clean fetch clears the penalty — the gate is per-burst, not per-session."""
        self.successes += 1
        self.consecutive_blocks = 0
        self.cooldown = self.cooldown_start

    def note_block(self):
        self.blocks += 1
        self.consecutive_blocks += 1
        return self.consecutive_blocks

    def cooldown_sleep(self):
        """Serve the current cooldown, then double it. Caller decides whether to bother."""
        d = self.cooldown
        self._sleep(d)
        self.slept += d
        self.cooldown = min(self.cooldown * 2, self.cooldown_cap)
        return d

    def stats(self):
        elapsed = time.monotonic() - self.started
        # No successes means no denominator, so no rate is reported (spec: unknown
        # denominators forbid derived numbers).
        per = elapsed / self.successes if self.successes else None
        return {"successes": self.successes, "blocks": self.blocks,
                "elapsed_s": round(elapsed, 1), "slept_s": round(self.slept, 1),
                "seconds_per_video": round(per, 1) if per else None,
                "videos_per_hour": round(3600.0 / per, 1) if per else None}


# --------------------------------------------------------------------------
# fetch
# --------------------------------------------------------------------------
def _iso(epoch):
    return datetime.datetime.fromtimestamp(int(epoch), datetime.timezone.utc).isoformat()


def _digest(stderr, limit=400):
    """The ERROR/WARNING lines, deduped, URLs trimmed — a blocker row is read by a human.

    A raw tail is the wrong thing to store: yt-dlp ends its bot-check warning with two
    wiki links, so the tail is documentation and the diagnosis scrolls off the front.
    """
    fingerprints = _BOT + _DEGRADED + _GONE + _PRIVATE + _MEMBERS + _REGION
    seen, keep = set(), []
    for line in (stderr or "").splitlines():
        line = re.sub(r"\s*(See\s+)?https?://\S+", "", line).strip(" .")
        if not line.startswith(("ERROR", "WARNING")) or line in seen:
            continue
        seen.add(line)
        low = line.lower()
        # Diagnostic lines first: yt-dlp's boilerplate is longer than the cap, so a
        # source-ordered digest would truncate the one line that says what went wrong.
        keep.append((0 if any(f in low for f in fingerprints) else 1, line))
    return " | ".join(l for _, l in sorted(keep, key=lambda k: k[0]))[:limit] \
        or (stderr or "").strip()[:limit]


def _gate(stderr):
    """(blocked?, blocker_kind) from stderr alone, exit code ignored on purpose."""
    s = (stderr or "").lower()
    if any(p in s for p in _BOT):
        return True, "bot_check"
    if any(p in s for p in _DEGRADED):
        return True, "other"       # player response missing, cause unstated
    return False, None


def _saw_player_response(info):
    """Did the player response actually arrive?

    duration comes from videoDetails, which only exists in the player response. Without it
    we are not entitled to say the video has no captions — we only know we did not see any.
    """
    return info.get("duration") is not None or bool(info.get("formats"))


def _classify(stderr):
    """Map yt-dlp failure text to (status, blocker_kind, availability)."""
    s = (stderr or "").lower()
    if any(p in s for p in _BOT):
        return "blocked", "bot_check", None
    if any(p in s for p in _PRIVATE):
        return "unavailable", "private", "private"
    if any(p in s for p in _MEMBERS):
        return "unavailable", "members_only", "members_only"
    if any(p in s for p in _REGION):
        return "unavailable", "region_blocked", None
    if any(p in s for p in _GONE):
        return "unavailable", "deleted", "deleted"
    return "error", "other", None


def _argv(video_id, workdir):
    # --no-simulate is load-bearing: --dump-single-json implies simulate, and a simulating
    # run returns from process_info before it ever writes a subtitle file.
    return [YTDLP,
            "--skip-download", "--no-simulate", "--dump-single-json",
            "--write-subs", "--write-auto-subs",
            "--sub-langs", SUB_LANGS, "--sub-format", SUB_FORMAT,
            # --no-warnings is deliberately ABSENT: the bot gate is a warning, and
            # suppressing it would make a block indistinguishable from an empty result.
            "--no-playlist", "--no-progress", "--no-part",
            "--ignore-no-formats-error",   # a gated/live video must not cost us its captions
            "--retries", "1", "--extractor-retries", "0", "--socket-timeout", "30",
            "-P", f"home:{workdir}", "-o", "%(id)s.%(ext)s",
            "--", f"https://www.youtube.com/watch?v={video_id}"]


def _metadata(video_id, info):
    """The vr_videos columns this module owns, plus the precision note for published_at."""
    dur = info.get("duration")
    was_live = bool(info.get("was_live")) or info.get("live_status") in ("was_live", "post_live")
    release, stamp = info.get("release_timestamp"), info.get("timestamp")

    # spec §11: published_at is the earliest PUBLIC availability. For a premiere or a
    # stream the upload happens before the public release, so release_timestamp wins when
    # it exists. upload_date is DATE-only, so it lands at midnight UTC and the precision is
    # recorded rather than implied.
    if release or stamp:
        published, precision = _iso(release or stamp), "second"
    elif info.get("upload_date"):
        d = info["upload_date"]
        published, precision = f"{d[0:4]}-{d[4:6]}-{d[6:8]}T00:00:00+00:00", "day"
    else:
        published, precision = None, "none"

    row = {
        "video_id": video_id,
        "channel_id": info.get("channel_id"),
        "channel_name": info.get("channel") or info.get("uploader"),
        "channel_handle": info.get("uploader_id"),
        "canonical_url": info.get("webpage_url") or f"https://www.youtube.com/watch?v={video_id}",
        "title": info.get("title"),
        "description": info.get("description"),
        "published_at": published,
        # live_end_at stays null on purpose: yt-dlp exposes no stream end, and
        # start + duration is a guess (the VOD is trimmed at both ends).
        "live_start_at": _iso(release) if (was_live and release) else None,
        "duration_s": int(dur) if isinstance(dur, (int, float)) else None,
        "availability": info.get("availability") or "unknown",
        "chapters": info.get("chapters"),
        "last_checked_at": store.utcnow(),
    }
    return row, precision


# What content_hash covers. Volatile bookkeeping (last_checked_at, retry_count) is out by
# construction, and the 'player|' label marks the field set — inventory's 'flat|' hash is
# computed over three fields and the two are not comparable.
CONTENT_HASH_FIELDS = ("video_id", "channel_id", "title", "description", "published_at",
                       "live_start_at", "duration_s", "availability", "chapters",
                       "caption_langs", "caption_source")


def _caption_shape(info):
    """(creator_langs, auto_langs) restricted to the languages we actually asked for.

    automatic_captions also advertises ~200 machine-TRANSLATED tracks. A translation of an
    ASR track is not independent evidence of anything, so it is neither fetched nor listed.
    """
    want = tuple(SUB_LANGS.split(","))
    subs = info.get("subtitles") or {}
    auto = info.get("automatic_captions") or {}
    return ([l for l in want if l in subs], [l for l in want if l in auto])


def fetch_one(video_id, pacer=None, keep_raw=False):
    """One video, one subprocess. Touches no database — the caller persists.

    Returns {"video_id", "status", "info", "meta", "precision", "transcripts",
             "blocker", "detail", "elapsed_s"} where status is one of
    ok | no_captions | blocked | unavailable | error.
    """
    if not VIDEO_ID_RE.match(video_id or ""):
        raise ValueError(f"refusing to shell out with a non-id: {video_id!r}")
    if pacer is not None:
        pacer.wait()

    workdir = WORK / video_id
    if workdir.exists():
        shutil.rmtree(workdir, ignore_errors=True)
    workdir.mkdir(parents=True, exist_ok=True)
    res = {"video_id": video_id, "status": "error", "info": None, "meta": None,
           "precision": None, "transcripts": [], "blocker": None, "detail": None}
    t0 = time.monotonic()
    try:
        p = subprocess.run(_argv(video_id, workdir), capture_output=True, text=True,
                           timeout=FETCH_TIMEOUT)
    except subprocess.TimeoutExpired:
        shutil.rmtree(workdir, ignore_errors=True)
        res.update(status="error", blocker="other", detail=f"yt-dlp timeout after {FETCH_TIMEOUT}s")
        res["elapsed_s"] = round(time.monotonic() - t0, 1)
        return res

    if p.returncode != 0 or not p.stdout.strip():
        status, kind, avail = _classify(p.stderr)
        res.update(status=status, blocker=kind, detail=_digest(p.stderr))
        if avail:
            res["meta"] = {"video_id": video_id, "availability": avail,
                           "canonical_url": f"https://www.youtube.com/watch?v={video_id}",
                           "last_checked_at": store.utcnow()}
        shutil.rmtree(workdir, ignore_errors=True)
        res["elapsed_s"] = round(time.monotonic() - t0, 1)
        return res

    info = json.loads(p.stdout)
    creator_langs, auto_langs = _caption_shape(info)
    meta, precision = _metadata(video_id, info)

    fetched = []
    for path in sorted(workdir.glob(f"{video_id}.*.{SUB_FORMAT}")):
        lang = path.name[len(video_id) + 1:-(len(SUB_FORMAT) + 1)]
        # The ONLY source of source_type. yt-dlp prefers a creator track over the ASR one
        # when both exist for a language, so the file alone cannot tell them apart.
        source_type = "creator" if lang in (info.get("subtitles") or {}) else "auto"
        segments = parse_json3(path)
        if not segments:
            continue
        text = _normalised_text(segments)
        local = TRANSCRIPTS / f"{video_id}.{lang}.{source_type}.json"
        local.parent.mkdir(parents=True, exist_ok=True)
        local.write_text(json.dumps({
            "video_id": video_id, "lang": lang, "source_type": source_type,
            "format": SUB_FORMAT, "fetched_at": store.utcnow(),
            "extractor_version": EXTRACTOR_VERSION, "segments": segments}), encoding="utf-8")
        fetched.append({"video_id": video_id, "lang": lang, "source_type": source_type,
                        "fetched_at": store.utcnow(), "format": SUB_FORMAT,
                        "segment_count": len(segments), "duration_ms": _span_ms(segments),
                        "text_hash": store.sha256(text), "retention": RETENTION,
                        # Relative to store.CACHE by construction: the box the cache lives
                        # on is private, so an absolute path would leak a machine layout
                        # into a shared table for no gain.
                        "local_ref": f"{TRANSCRIPTS.name}/{local.name}"})

    if not keep_raw:
        shutil.rmtree(workdir, ignore_errors=True)

    meta["caption_langs"] = sorted({t["lang"] for t in fetched})
    meta["caption_source"] = ({(True, True): "both", (True, False): "creator",
                               (False, True): "auto"}.get((bool(creator_langs), bool(auto_langs)),
                                                          "none"))
    # Hashed over a named field set, and deliberately without last_checked_at: hashing the
    # whole row put a fresh timestamp inside the digest, so it changed on every fetch and
    # could never answer the one question it exists for — did the metadata change?
    meta["content_hash"] = store.sha256("player|" + json.dumps(
        {k: meta.get(k) for k in CONTENT_HASH_FIELDS}, sort_keys=True, default=str))
    res["elapsed_s"] = round(time.monotonic() - t0, 1)
    if fetched:
        # Captions in hand outrank any warning in the log — we got what we came for.
        return dict(res, status="ok", info=info, meta=meta, precision=precision,
                    transcripts=fetched)

    gated, kind = _gate(p.stderr)
    saw = _saw_player_response(info)
    if gated or not saw:
        # Nothing durable is written: a block must not leave partial metadata or a
        # permanent "no captions" verdict behind.
        why = "gated" if gated else "no player response (no duration, no formats)"
        return dict(res, status="blocked", blocker=kind or "other",
                    detail=f"caption presence unknown — {why} | " + _digest(p.stderr, 300))
    return dict(res, status="no_captions", info=info, meta=meta, precision=precision,
                blocker="no_captions",
                detail=f"player response seen; advertised creator={creator_langs} "
                       f"auto={auto_langs}; none parsed")


# --------------------------------------------------------------------------
# persistence
# --------------------------------------------------------------------------
def _ensure_video(video_id, meta=None):
    """Minimal row so the stage/transcript foreign keys hold even for a dead video.

    Unmeasured (None) fields are dropped rather than written, the same rule inventory.py
    enforces from the other side. It matters most for channel_id: a partly degraded player
    response would null the column that coverage counts by and that selection joins on,
    quietly shrinking a numerator with data we never actually measured.
    """
    row = {k: v for k, v in (meta or {}).items() if v is not None}
    row.setdefault("video_id", video_id)
    row.setdefault("canonical_url", f"https://www.youtube.com/watch?v={video_id}")
    row.setdefault("last_checked_at", store.utcnow())
    store.upsert("vr_videos", [row], "video_id")


def persist(res):
    """Write one fetch result. Returns the durable state word for the run log."""
    vid, status = res["video_id"], res["status"]

    if status == "blocked":
        # Transient by measurement: the gate lifts after a cooldown. Nothing about the
        # video is known to have changed, so only the attempt is recorded.
        store.record_blocker(res.get("blocker") or "bot_check", res.get("detail"), video_id=vid)
        store.set_stage(vid, "TRANSCRIPT_AVAILABLE", "blocked", res.get("detail"))
        return "blocked"

    if status == "unavailable":
        _ensure_video(vid, res.get("meta"))
        store.record_blocker(res.get("blocker") or "other", res.get("detail"), video_id=vid)
        store.set_stage(vid, "UNAVAILABLE", "unavailable", res.get("detail"))
        store.set_stage(vid, "TRANSCRIPT_AVAILABLE", "unavailable", "video unavailable")
        return "unavailable"

    if status == "error":
        store.record_blocker(res.get("blocker") or "other", res.get("detail"), video_id=vid)
        try:
            store.patch("vr_videos", f"video_id=eq.{vid}",
                        {"last_error": (res.get("detail") or "")[:500],
                         "last_checked_at": store.utcnow()})
        except Exception:  # noqa: BLE001 - the blocker row is the record that matters
            pass
        return "error"

    _ensure_video(vid, res["meta"])
    store.set_stage(vid, "METADATA_ONLY", "done",
                    f"published_at precision={res['precision']}"
                    + (" (upload_date only; midnight UTC)" if res["precision"] == "day" else ""))

    if status == "no_captions":
        store.record_blocker("no_captions", res.get("detail"), video_id=vid)
        store.set_stage(vid, "TRANSCRIPT_AVAILABLE", "unavailable", res.get("detail"))
        return "no_captions"

    # Only reached with parsed segments in hand (acceptance test §22.4).
    store.upsert("vr_transcripts", res["transcripts"], "video_id,lang,source_type")
    detail = ", ".join(f"{t['lang']}/{t['source_type']}:{t['segment_count']}"
                       for t in res["transcripts"])
    store.set_stage(vid, "TRANSCRIPT_AVAILABLE", "done", detail)
    return "ok"


def _has_transcript(video_id):
    return store.count("vr_transcripts", f"video_id=eq.{urllib.parse.quote(video_id)}") > 0


# --------------------------------------------------------------------------
# authorized transcript import (docs/ACCESS.md)
# --------------------------------------------------------------------------
# The supported way to cover what this IP cannot fetch. The brief forbids bypassing the bot
# gate, so the only alternative to fetching is being given the text. One JSON object per
# video:
#   {"video_id": "5TIPLsQVSHI", "lang": "en", "source_type": "creator"|"auto",
#    "segments": [{"t_start_ms": 0, "t_end_ms": 3200, "text": "..."}, ...]}
IMPORT_FORMAT = "authorized_json"     # never 'json3': this row did not come from YouTube
IMPORT_LANG = "en"
LANG_RE = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,19}$")   # lands in a PK and a filename


class BadTranscript(ValueError):
    """The file is not the documented shape. Nothing is written when this is raised: a
    half-read import is a fabricated transcript, which is the one thing forbidden outright."""


def _authorized_segments(doc):
    """Validate hard and coerce nothing.

    A float t_start_ms almost always means seconds were converted wrong, and rounding it
    would move an excerpt to a timestamp the owner never asserted. Refusing the file costs
    one message; a silently shifted timeline is undetectable downstream.
    """
    segs = doc.get("segments")
    if not isinstance(segs, list) or not segs:
        raise BadTranscript("segments must be a non-empty list")
    out = []
    for i, s in enumerate(segs):
        if not isinstance(s, dict):
            raise BadTranscript(f"segments[{i}] is not an object")
        t, end, text = s.get("t_start_ms"), s.get("t_end_ms"), s.get("text")
        if isinstance(t, bool) or not isinstance(t, int) or t < 0:
            raise BadTranscript(f"segments[{i}].t_start_ms must be a non-negative integer of ms")
        if end is not None and (isinstance(end, bool) or not isinstance(end, int) or end < t):
            raise BadTranscript(f"segments[{i}].t_end_ms must be an integer >= t_start_ms")
        if not isinstance(text, str) or not text.strip():
            raise BadTranscript(f"segments[{i}].text must be a non-empty string")
        out.append({"t_start_ms": t, "t_end_ms": end, "text": text.strip()})
    return out


def _authorized_doc(path):
    doc = pathlib.Path(path).read_text(encoding="utf-8", errors="replace")
    try:
        doc = json.loads(doc)
    except json.JSONDecodeError as e:
        raise BadTranscript(f"not valid JSON: {e}") from e
    if not isinstance(doc, dict):
        raise BadTranscript("top level must be one object with video_id and segments")
    vid, lang = doc.get("video_id"), doc.get("lang") or IMPORT_LANG
    if not isinstance(vid, str) or not VIDEO_ID_RE.match(vid):
        raise BadTranscript(f"video_id {vid!r} is not an 11-character YouTube id")
    if not isinstance(lang, str) or not LANG_RE.match(lang):
        raise BadTranscript(f"lang {lang!r} is not a plain language tag")
    declared = doc.get("source_type")
    # spec §4: 'creator' is a claim about who produced the text, and only the owner is in a
    # position to make it. Silence is not a claim, so silence means ASR.
    return {"video_id": vid, "lang": lang, "declared": declared,
            "source_type": "creator" if declared == "creator" else "auto",
            "note": doc.get("note") if isinstance(doc.get("note"), str) else None,
            "segments": _authorized_segments(doc)}


def ingest_authorized_transcript(path, dry_run=False):
    """Ingest one owner-supplied timestamped transcript. Returns the provenance it wrote.

    source_type='creator' is written ONLY when the file declares it. We did not watch the
    video and nothing in the bytes proves who typed them, so an undeclared file is 'auto'.
    That is the cheap direction to be wrong in: calling a human transcript ASR only widens
    uncertainty we already carry, while the reverse launders a machine guess into a source.

    dry_run validates the file and touches neither the cache nor the database, so the owner
    can check a batch of files before handing any of them over.
    """
    d = _authorized_doc(path)
    segments, vid, lang, stype = d["segments"], d["video_id"], d["lang"], d["source_type"]
    res = {"path": str(path), "video_id": vid, "lang": lang, "source_type": stype,
           "declared_source_type": d["declared"], "segments": len(segments),
           "duration_ms": _span_ms(segments),
           "text_hash": store.sha256(_normalised_text(segments)),
           # Reported, not repaired: reordering would silently re-time every excerpt cited
           # off this file.
           "out_of_order": sum(1 for a, b in zip(segments, segments[1:])
                               if b["t_start_ms"] < a["t_start_ms"]),
           "written": False, "local_ref": None}
    if dry_run:
        return res

    local = TRANSCRIPTS / f"{vid}.{lang}.{stype}.json"
    local.parent.mkdir(parents=True, exist_ok=True)
    local.write_text(json.dumps({
        "video_id": vid, "lang": lang, "source_type": stype, "format": IMPORT_FORMAT,
        "fetched_at": store.utcnow(), "extractor_version": EXTRACTOR_VERSION,
        "provenance": "authorized_import", "declared_source_type": d["declared"],
        "source_path": str(pathlib.Path(path).resolve()), "note": d["note"],
        "segments": segments}), encoding="utf-8")
    # FK target. The video may never have been enumerated — often that is why it was supplied.
    _ensure_video(vid)
    store.upsert("vr_transcripts", [{
        "video_id": vid, "lang": lang, "source_type": stype,
        "fetched_at": store.utcnow(), "format": IMPORT_FORMAT,
        "segment_count": len(segments), "duration_ms": res["duration_ms"],
        "text_hash": res["text_hash"], "retention": RETENTION,
        "local_ref": f"{TRANSCRIPTS.name}/{local.name}"}], "video_id,lang,source_type")
    # caption_langs / caption_source stay untouched: they record what YouTube advertises,
    # and an imported file is evidence about the owner, not about YouTube.
    store.set_stage(vid, "TRANSCRIPT_AVAILABLE", "done",
                    f"authorized import {lang}/{stype}: {len(segments)} segments, "
                    f"declared={d['declared']!r}, format={IMPORT_FORMAT}")
    res.update(written=True, local_ref=f"{TRANSCRIPTS.name}/{local.name}")
    return res


def import_authorized(path, dry_run=False):
    """Ingest one file or a directory tree of them. A bad file is rejected and recorded;
    the rest of the batch still lands, and nothing partial is ever written."""
    p = pathlib.Path(path)
    if not p.exists():
        raise FileNotFoundError(f"no such path: {p}")
    files = sorted(p.rglob("*.json")) if p.is_dir() else [p]
    imported, rejected = [], []

    def one(f, run):
        try:
            imported.append(ingest_authorized_transcript(f, dry_run=dry_run))
        except BadTranscript as e:
            rejected.append({"path": str(f), "reason": str(e)})
            if run is None:
                return
            run.failed += 1
            # No video_id on the blocker row: vr_access_blockers.video_id is a foreign key,
            # and a file we could not parse has no id we are entitled to trust.
            store.record_blocker("other", f"authorized import rejected: {f.name}: {e}"[:400])
            return
        if run is not None:
            run.processed += 1
            run.save({"last_path": str(f), "imported": len(imported),
                      "rejected": len(rejected), "at": store.utcnow()})

    if dry_run:
        for f in files:
            one(f, None)
    else:
        with store.Run("import-transcripts", f"{len(files)} file(s) from {p}") as run:
            for f in files:
                one(f, run)
    return {"path": str(p), "files": len(files), "dry_run": dry_run,
            "imported": imported, "rejected": rejected,
            "creator_declared": sum(1 for r in imported if r["source_type"] == "creator"),
            "videos": sorted({r["video_id"] for r in imported})}


# --------------------------------------------------------------------------
# selection (spec §7 priority order)
# --------------------------------------------------------------------------
# Risk/exit vocabulary ONLY. Spec §7 forbids biasing selection toward titles that imply a
# winning trade, so there is deliberately no "profit", "gains", "100x", "called it" or
# "banked" here — those words would select a sample of remembered successes and every
# downstream rate computed off it would be survivorship, not evidence.
RISK_VOCAB = ("stop loss", "stop-loss", "risk management", "invalidation", "invalidated",
              "when not to", "do not trade", "don't trade", "avoid", "exit", "take profit",
              "position siz", "liquidat", "leverage", "drawdown", "cut losses",
              "mistake", "rules", "risk")

# Title shapes that suggest a dated call. This selects candidates to READ; it is not a
# claim that any of these videos contains a call.
DATED_VOCAB = ("today", "tonight", "this week", "right now", "update", "2023", "2024",
               "2025", "2026", "january", "february", "march", "april", "may", "june",
               "july", "august", "september", "october", "november", "december")

_SELECT = ("select=video_id,title,published_at,availability,channel_id,"
           "vr_transcripts(video_id),vr_video_stages(stage,state)")


def _ilike_or(column, terms):
    expr = "or=(" + ",".join(f'{column}.ilike."*{t}*"' for t in terms) + ")"
    return urllib.parse.quote(expr, safe='(),.*"=')


def _tiers():
    """Ordered PostgREST queries. Earlier tiers are read first (spec §7)."""
    pl = sources.by_key("sniper-crypto-trading-show")["playlist_id"]
    sniper = sources.by_key("official-sniper-trading")["channel_id"]
    cowen = sources.by_key("benjamin-cowen")["channel_id"]
    banter = sources.by_key("crypto-banter")["channel_id"]
    order = "order=published_at.desc.nullslast"
    return [
        ("1-sniper-playlist",
         f"{_SELECT},vr_playlist_members!inner(playlist_id)"
         f"&vr_playlist_members.playlist_id=eq.{pl}&{order}"),
        ("1-sniper-channel", f"{_SELECT}&channel_id=eq.{sniper}&{order}"),
        ("2-risk-vocabulary", f"{_SELECT}&{_ilike_or('title', RISK_VOCAB)}&{order}"),
        ("3-dated-calls", f"{_SELECT}&{_ilike_or('title', DATED_VOCAB)}&{order}"),
        ("4-benjamin-cowen", f"{_SELECT}&channel_id=eq.{cowen}&{order}"),
        ("5-crypto-banter", f"{_SELECT}&channel_id=eq.{banter}&{order}"),
    ]


def _eligible(row, force):
    """Skip only on settled facts: we have it, it has none, or it is gone."""
    if row.get("availability") in ("private", "deleted", "members_only"):
        return False
    if not force and row.get("vr_transcripts"):
        return False
    for st in row.get("vr_video_stages") or []:
        if st.get("state") != "unavailable":
            continue
        # A gone video stays gone. 'no captions', though, is a verdict about one look:
        # YouTube backfills ASR, so --force is entitled to look again.
        if st.get("stage") == "UNAVAILABLE" or not force:
            return False
    return True


def select_batch(limit=25, force=False):
    """Next video ids to fetch, highest priority first, deduped across tiers."""
    seen, out = set(), []
    # Over-fetch because the "already done / permanently unavailable" filter runs here:
    # PostgREST has no anti-join, and a client-side filter is cheaper than a second schema.
    page = min(max(limit * 5, limit), 500)
    for label, query in _tiers():
        if len(out) >= limit:
            break
        try:
            rows = store.get("vr_videos", f"{query}&limit={page}")
        except Exception as e:  # noqa: BLE001 - one bad tier must not sink the batch
            store.record_blocker("other", f"select_batch tier {label}: {e}"[:400])
            continue
        for r in rows:
            vid = r["video_id"]
            if vid in seen or not _eligible(r, force):
                continue
            seen.add(vid)
            out.append(vid)
            if len(out) >= limit:
                break
    return out


# --------------------------------------------------------------------------
# batch
# --------------------------------------------------------------------------
def ingest_batch(video_ids=None, limit=25, force=False, pacer=None):
    """Serial ingestion with a checkpoint after every video.

    Resume safety has two independent layers: the checkpoint records position, and every
    video is re-checked against vr_transcripts before it is fetched. A kill -9 therefore
    costs at most the video in flight (acceptance test §22.2).
    """
    if not store.configured():
        raise store.NoStore("captions ingestion needs SUPABASE_URL / SUPABASE_SERVICE_KEY")
    pacer = pacer or Pacer()
    stopped = "completed"
    with store.Run("captions", note=f"limit={limit} force={force} delay={pacer.base}s") as run:
        ids = [v for v in (video_ids or select_batch(limit, force))]
        for i, vid in enumerate(ids, 1):
            if not VIDEO_ID_RE.match(vid or ""):
                run.failed += 1
                store.record_blocker("other", f"malformed video id {vid!r}"[:200])
                continue
            if not force and _has_transcript(vid):
                run.skipped += 1
                run.save({"last_video_id": vid, "position": i, "of": len(ids),
                          "state": "skipped", "at": store.utcnow()})
                continue

            res = fetch_one(vid, pacer=pacer)
            state = persist(res)

            if state == "blocked":
                run.blocked += 1
                n = pacer.note_block()
                run.save({"last_video_id": vid, "position": i, "of": len(ids),
                          "state": state, "consecutive_blocks": n, "at": store.utcnow()})
                if n >= MAX_CONSECUTIVE_BLOCKS:
                    # Abort with a checkpoint instead of serving another cooldown we have
                    # no reason to think will help.
                    stopped = f"aborted after {n} consecutive blocks"
                    break
                pacer.cooldown_sleep()
                continue

            if state == "error":
                run.failed += 1
            else:
                pacer.ok()
                run.processed += 1     # ok | no_captions | unavailable all reached a verdict
            run.save({"last_video_id": vid, "position": i, "of": len(ids),
                      "state": state, "at": store.utcnow()})

        final = dict(run.checkpoint or {})
        final.update(stopped=stopped, throughput=pacer.stats(), at=store.utcnow())
        run.save(final)
    return {"stopped": stopped, "processed": run.processed, "skipped": run.skipped,
            "failed": run.failed, "blocked": run.blocked, "throughput": pacer.stats()}


# --------------------------------------------------------------------------
# cli
# --------------------------------------------------------------------------
def main(argv=None):
    ap = argparse.ArgumentParser(description="transcript ingestion")
    sub = ap.add_subparsers(dest="cmd", required=True)

    f = sub.add_parser("fetch", help="one video, no database writes")
    f.add_argument("video_id")
    f.add_argument("--keep-raw", action="store_true")

    p = sub.add_parser("parse", help="parse a json3 file and print stats")
    p.add_argument("path")

    s = sub.add_parser("select", help="show the next videos in priority order")
    s.add_argument("--limit", type=int, default=25)

    b = sub.add_parser("batch", help="fetch and persist")
    b.add_argument("--limit", type=int, default=25)
    b.add_argument("--force", action="store_true")
    b.add_argument("--ids", help="comma-separated video ids, bypassing select_batch")

    i = sub.add_parser("import", help="ingest authorized transcripts (docs/ACCESS.md)")
    i.add_argument("--path", required=True, help="a .json file or a directory of them")
    i.add_argument("--dry-run", action="store_true", help="validate only; no cache, no DB")

    a = ap.parse_args(argv)
    if a.cmd == "parse":
        segs = parse_json3(a.path)
        print(json.dumps({"segments": len(segs), "duration_ms": _span_ms(segs),
                          "text_hash": store.sha256(_normalised_text(segs)),
                          "first": segs[0] if segs else None,
                          "last": segs[-1] if segs else None}, indent=2))
    elif a.cmd == "fetch":
        r = fetch_one(a.video_id, keep_raw=a.keep_raw)
        print(json.dumps({k: v for k, v in r.items() if k != "info"}, indent=2, default=str))
    elif a.cmd == "select":
        print(json.dumps(select_batch(a.limit), indent=2))
    elif a.cmd == "batch":
        ids = [i.strip() for i in a.ids.split(",") if i.strip()] if a.ids else None
        print(json.dumps(ingest_batch(ids, a.limit, a.force), indent=2))
    elif a.cmd == "import":
        print(json.dumps(import_authorized(a.path, dry_run=a.dry_run), indent=2, default=str))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
