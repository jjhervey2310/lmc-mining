"""Supabase REST layer for video-research. stdlib only, same shape as desk-loop/common.py.

Everything here is idempotent by construction: writes go through upsert on a declared
conflict key, so re-running a batch after an interruption updates rows instead of
duplicating them (spec §5 "restarting must not reprocess everything or duplicate records",
acceptance test §22.2).
"""
import datetime
import hashlib
import json
import os
import pathlib
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = pathlib.Path(os.environ.get("VR_ROOT", pathlib.Path(__file__).resolve().parent))
STATE = ROOT / "state"
STATE.mkdir(parents=True, exist_ok=True)
CACHE = pathlib.Path(os.environ.get("VR_CACHE", STATE / "cache"))
CACHE.mkdir(parents=True, exist_ok=True)


def load_env():
    """Read .env from the package dir, then the repo root. Never overwrite a real value."""
    for p in (ROOT / ".env", ROOT.parent / ".env.local", ROOT.parent / ".env"):
        if not p.exists():
            continue
        for line in p.read_text().splitlines():
            line = line.split("#", 1)[0].strip()
            if "=" in line:
                k, v = line.split("=", 1)
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if v and not os.environ.get(k):
                    os.environ[k] = v


load_env()
SB = (os.environ.get("SUPABASE_URL") or os.environ.get("NEXT_PUBLIC_SUPABASE_URL") or "").rstrip("/")
SBK = (os.environ.get("SUPABASE_SERVICE_KEY")
       or os.environ.get("SUPABASE_SERVICE_ROLE_KEY") or "")


class NoStore(RuntimeError):
    """Raised when Supabase credentials are absent. Callers may fall back to the file store."""


def configured() -> bool:
    return bool(SB and SBK)


def _headers(extra=None):
    h = {"apikey": SBK, "Authorization": f"Bearer {SBK}",
         "User-Agent": "lmc-video-research/1.0"}
    h.update(extra or {})
    return h


def _req(url, method="GET", body=None, headers=None, timeout=45, retries=4):
    h = dict(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    if data is not None:
        h["Content-Type"] = "application/json"
    last = None
    for attempt in range(retries):
        try:
            r = urllib.request.Request(url, data=data, method=method, headers=h)
            with urllib.request.urlopen(r, timeout=timeout) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw.strip().startswith(("{", "[")) else raw
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(5 * (attempt + 1))
                continue
            try:
                detail = e.read().decode()[:400]
            except Exception:
                detail = ""
            raise RuntimeError(f"{method} {url.split('?')[0]} -> {e.code} {detail}") from e
        except Exception as e:  # noqa: BLE001 - network layer, retry then surface
            last = e
            if attempt < retries - 1:
                time.sleep(3 * (attempt + 1))
                continue
            raise
    raise last


def _require():
    if not configured():
        raise NoStore("SUPABASE_URL / SUPABASE_SERVICE_KEY not set")


def get(table, query=""):
    _require()
    return _req(f"{SB}/rest/v1/{table}?{query}", headers=_headers())


def insert(table, rows):
    _require()
    if not rows:
        return None
    return _req(f"{SB}/rest/v1/{table}", "POST", rows,
                _headers({"Prefer": "return=minimal"}))


def upsert(table, rows, on_conflict):
    """Batched upsert. Chunked so one oversized batch cannot fail a whole run."""
    _require()
    if not rows:
        return 0
    if isinstance(rows, dict):
        rows = [rows]
    n = 0
    for i in range(0, len(rows), 400):
        chunk = rows[i:i + 400]
        _req(f"{SB}/rest/v1/{table}?on_conflict={urllib.parse.quote(on_conflict)}",
             "POST", chunk,
             _headers({"Prefer": "resolution=merge-duplicates,return=minimal"}))
        n += len(chunk)
    return n


def patch(table, query, body):
    _require()
    return _req(f"{SB}/rest/v1/{table}?{query}", "PATCH", body,
                _headers({"Prefer": "return=minimal"}))


def count(table, query=""):
    """Exact row count without pulling rows."""
    _require()
    url = f"{SB}/rest/v1/{table}?{query}"
    r = urllib.request.Request(url, method="GET",
                               headers=_headers({"Prefer": "count=exact",
                                                 "Range-Unit": "items", "Range": "0-0"}))
    with urllib.request.urlopen(r, timeout=45) as resp:
        cr = resp.headers.get("Content-Range", "")
    return int(cr.split("/")[-1]) if "/" in cr and cr.split("/")[-1].isdigit() else 0


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def utcnow() -> str:
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def sha256(text: str) -> str:
    return hashlib.sha256((text or "").encode("utf-8", "replace")).hexdigest()


def stable_id(*parts) -> str:
    """Deterministic short id. Same inputs -> same id, so a re-run updates in place."""
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()[:16]


# --------------------------------------------------------------------------
# stage tracking (spec §5)
# --------------------------------------------------------------------------
STAGES = ("DISCOVERED", "METADATA_ONLY", "TRANSCRIPT_AVAILABLE", "TRANSCRIPT_REVIEWED",
          "VISUAL_REVIEW_REQUIRED", "VISUAL_REVIEWED", "RULES_EXTRACTED",
          "QUALITY_CHECKED", "BLOCKED", "UNAVAILABLE")


def set_stage(video_id, stage, state="done", detail=None):
    if stage not in STAGES:
        raise ValueError(f"unknown stage {stage}")
    return upsert("vr_video_stages", [{
        "video_id": video_id, "stage": stage, "state": state,
        "detail": detail, "updated_at": utcnow()}], "video_id,stage")


def record_blocker(kind, detail=None, video_id=None, source_key=None):
    """An access failure is a first-class record, never a silent skip (spec §6)."""
    rows = get("vr_access_blockers",
               "select=id,occurrences&kind=eq." + urllib.parse.quote(kind) +
               (f"&video_id=eq.{video_id}" if video_id else "&video_id=is.null") +
               "&resolved=is.false&limit=1")
    if rows:
        return patch("vr_access_blockers", f"id=eq.{rows[0]['id']}",
                     {"occurrences": rows[0]["occurrences"] + 1,
                      "last_seen_at": utcnow(), "detail": detail})
    return insert("vr_access_blockers", [{
        "kind": kind, "detail": detail, "video_id": video_id, "source_key": source_key}])


# --------------------------------------------------------------------------
# run log / checkpoints (spec §21)
# --------------------------------------------------------------------------
class Run:
    """Bounded, restartable job record. Use as a context manager."""

    def __init__(self, job, note=None):
        self.job, self.note = job, note
        self.id = None
        self.processed = self.skipped = self.failed = self.blocked = 0
        self.checkpoint = None

    def __enter__(self):
        if configured():
            try:
                r = _req(f"{SB}/rest/v1/vr_runs", "POST",
                         [{"job": self.job, "note": self.note}],
                         _headers({"Prefer": "return=representation"}))
                self.id = r[0]["id"] if r else None
            except Exception:
                self.id = None
        return self

    def save(self, checkpoint=None):
        self.checkpoint = checkpoint if checkpoint is not None else self.checkpoint
        if self.id is None:
            return
        try:
            patch("vr_runs", f"id=eq.{self.id}", {
                "processed": self.processed, "skipped": self.skipped,
                "failed": self.failed, "blocked": self.blocked,
                "checkpoint": self.checkpoint})
        except Exception:
            pass

    def __exit__(self, exc_type, exc, tb):
        if self.id is not None:
            try:
                patch("vr_runs", f"id=eq.{self.id}", {
                    "finished_at": utcnow(), "ok": exc is None,
                    "processed": self.processed, "skipped": self.skipped,
                    "failed": self.failed, "blocked": self.blocked,
                    "checkpoint": self.checkpoint,
                    "error": None if exc is None else f"{exc_type.__name__}: {exc}"[:500]})
            except Exception:
                pass
        return False


def last_checkpoint(job):
    """Resume token from the most recent run of this job."""
    try:
        rows = get("vr_runs", f"select=checkpoint&job=eq.{urllib.parse.quote(job)}"
                              "&checkpoint=not.is.null&order=started_at.desc&limit=1")
        return rows[0]["checkpoint"] if rows else None
    except Exception:
        return None
