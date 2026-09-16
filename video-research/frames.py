"""Choose which video moments are worth a picture, and record the ones captured.

The transcript says "and then my stop loss will be" and stops there, because the level is
on the chart, not in the words. This module decides where a frame would close that gap.

Selection, not exhaustion. 3,900 hours at one frame a second is 14 million images and no
budget survives it; one frame per lesson is too thin to learn a method from. So frames are
pulled where the scanner already found a moment worth reading — a stop, an entry, a target,
a size, a leverage multiple — deduped to a minimum spacing so a presenter repeating himself
across four consecutive cues costs one picture rather than four, and capped per video so a
single talkative stream cannot eat the whole storage budget.

Copyright posture, same as the transcripts: the downloaded video is a working file, deleted
after extraction. What is kept is a small set of stills used for analysis, in the owner's
own private storage, never republished. A frame is evidence for a claim about a method, and
it stays attached to the timestamp it came from so the claim can be checked.
"""
import argparse
import json
import os
import pathlib
import shutil
import subprocess
import sys

import store

FRAMES_VERSION = "frames/1.0"

# Categories worth a picture. A regime remark or a disclaimer rarely points at the chart;
# a stop, an entry, a target, a size or a leverage multiple almost always does.
VISUAL_CATEGORIES = ("stop_invalidation", "entry", "exit_target", "position_size", "leverage")

# Minimum gap between captured frames in one video. ASR emits a cue every 2-3 seconds and a
# presenter labouring a point trips the same pattern repeatedly, so without this the same
# screen is photographed a dozen times.
MIN_SPACING_MS = int(os.environ.get("VR_FRAME_SPACING_MS", "30000"))

# Per-video ceiling. Keeps a 4-hour stream from consuming the budget a 12-minute lesson
# needs, and keeps any single video's evidence proportionate to the others.
MAX_PER_VIDEO = int(os.environ.get("VR_FRAME_MAX_PER_VIDEO", "15"))

# Offset applied to the capture point. The level is usually already drawn when it gets
# mentioned, and ASR timestamps tend to land at the START of the cue containing the phrase,
# so capturing a couple of seconds later lands mid-sentence with the chart settled.
CAPTURE_OFFSET_MS = int(os.environ.get("VR_FRAME_OFFSET_MS", "2000"))


def choose(hits, spacing_ms=None, max_per_video=None):
    """[(video_id, t_ms, category)] — the moments worth a picture, in time order.

    Pure: takes scan hits, returns capture points. Deduping happens on the final capture
    time rather than the raw hit time, so two hits three seconds apart do not become two
    frames of the same screen.
    """
    spacing = MIN_SPACING_MS if spacing_ms is None else spacing_ms
    cap = MAX_PER_VIDEO if max_per_video is None else max_per_video
    by_video = {}
    for h in hits:
        if h.get("category") not in VISUAL_CATEGORIES:
            continue
        by_video.setdefault(h["video_id"], []).append(h)
    out = []
    for vid in sorted(by_video):
        kept = []
        for h in sorted(by_video[vid], key=lambda r: int(r["t_start_ms"])):
            t = int(h["t_start_ms"]) + CAPTURE_OFFSET_MS
            if kept and t - kept[-1][1] < spacing:
                continue
            kept.append((vid, t, h["category"]))
            if len(kept) >= cap:
                break
        out.extend(kept)
    return out


def sample_interval(video_id, duration_ms, every_ms, cap=None):
    """Evenly spaced capture points across a video, independent of what was said.

    Needed because hit-driven selection is blind to teaching content: a lesson explaining
    what a trendline IS never says "stop" or "entry", so it scored zero visual hits while
    being the single most informative video read so far. What is on screen is the lesson;
    the words are commentary on it. Measured on the Sniper TA course — 9 of 16 lessons
    would have been captured not at all.
    """
    limit_n = cap if cap is not None else MAX_PER_VIDEO
    step = max(int(every_ms), 1000)
    points, t = [], step          # skip t=0: intros and title cards carry no chart
    while t < duration_ms and len(points) < limit_n:
        points.append((video_id, t, "interval"))
        t += step
    return points


def pending(video_ids=None, limit=None, every_ms=None):
    """Capture points for videos that have scan hits and no frames yet."""
    have = {(r["video_id"], int(r["t_ms"]))
            for r in store.get("vr_frames", "select=video_id,t_ms&limit=20000")}
    q = ("select=video_id,t_start_ms,category&category=in.("
         + ",".join(VISUAL_CATEGORIES) + ")&limit=20000")
    if video_ids:
        q += "&video_id=in.(" + ",".join(video_ids) + ")"
    hits = store.get("vr_scan_hits", q)
    points = choose(hits)

    if every_ms:
        # Interval sampling TOPS UP the hit-driven points rather than replacing them: a
        # spoken stop level is still the most valuable moment in any video that has one.
        want = set(video_ids or {p[0] for p in points})
        durations = {}
        for r in store.get("vr_videos", "select=video_id,duration_s&video_id=in.("
                           + ",".join(sorted(want)) + ")&limit=5000"):
            durations[r["video_id"]] = int(r.get("duration_s") or 0) * 1000
        for vid in sorted(want):
            if not durations.get(vid):
                continue
            taken = sorted(t for v, t, _c in points if v == vid)
            room = MAX_PER_VIDEO - len(taken)
            if room <= 0:
                continue
            for p in sample_interval(vid, durations[vid], every_ms, cap=room):
                if all(abs(p[1] - t) >= MIN_SPACING_MS for t in taken):
                    points.append(p)
                    taken.append(p[1])

    points = [p for p in points if (p[0], p[1]) not in have]
    points.sort(key=lambda p: (p[0], p[1]))
    return points[:limit] if limit else points


def record(rows):
    """Write captured frames. Called by the capture driver after upload."""
    if not rows:
        return 0
    store.upsert("vr_frames", rows, "video_id,t_ms")
    return len(rows)


BUCKET = "vr-frames"
YTDLP = os.environ.get("VR_YTDLP", "yt-dlp")
SWIFT = os.environ.get("VR_SWIFT", "swift")
WORK = store.CACHE / "frames-work"
# Refuse to start a download below this much free disk. One 1080p hour is roughly a
# gigabyte, and a laptop that fills up mid-run is a worse outcome than a capture that
# did not happen.
MIN_FREE_MB = int(os.environ.get("VR_FRAME_MIN_FREE_MB", "5000"))
# 1080p is the readability floor, measured: at a smaller window the price axis stops being
# legible and a frame that cannot give a level is not evidence of anything.
VIDEO_FORMAT = os.environ.get(
    "VR_FRAME_FORMAT", "bestvideo[height<=1080][ext=mp4]/best[height<=1080]")


def capture(video_id, points, keep_video=False):
    """Download, extract, upload, and report rows. The video file is a working copy.

    Deleted after extraction unless keep_video is set. What survives is a handful of stills
    in the owner's private bucket — the reason for the download, not a copy of the work.
    """
    if not points:
        return {"video_id": video_id, "captured": 0, "planned": 0, "stderr": ""}
    free_mb = shutil.disk_usage(str(store.CACHE)).free // (1024 * 1024)
    if free_mb < MIN_FREE_MB:
        raise RuntimeError(
            f"only {free_mb:,} MB free, need {MIN_FREE_MB:,} — refusing to download. "
            "A capture run holds one video at a time; this machine is too full for even one.")

    WORK.mkdir(parents=True, exist_ok=True)
    vdir = WORK / video_id
    vdir.mkdir(exist_ok=True)
    video = vdir / f"{video_id}.mp4"
    rows = []
    stderr = ""
    try:
        if not video.exists():
            subprocess.run(
                [YTDLP, "-f", VIDEO_FORMAT, "--no-playlist", "-o", str(video),
                 f"https://www.youtube.com/watch?v={video_id}"],
                check=True, capture_output=True, timeout=1800)

        stamps = ",".join(str(t) for _v, t, _c in points)
        here = pathlib.Path(__file__).resolve().parent
        proc = subprocess.run(
            [SWIFT, str(here / "extract_frames.swift"), str(video), str(vdir), stamps],
            capture_output=True, text=True, timeout=900)
        stderr = proc.stderr[-400:]

        category = {t: c for _v, t, c in points}
        for line in proc.stdout.splitlines():
            parts = line.split("\t")
            if len(parts) != 5:
                continue
            ms, path, w, h, nbytes = parts
            blob = pathlib.Path(path).read_bytes()
            key = f"{video_id}/{ms}.jpg"
            store.upload(BUCKET, key, blob)
            rows.append({"video_id": video_id, "t_ms": int(ms),
                         "category": category.get(int(ms), "unknown"),
                         "storage_path": key, "width": int(w), "height": int(h),
                         "bytes": int(nbytes), "captured_at": store.utcnow()})
        record(rows)
    finally:
        # ALWAYS, including on a failed download, a Swift crash or an upload error. The
        # earlier version only cleaned up on the success path, which meant every failure
        # left a multi-hundred-megabyte mp4 behind on the owner's laptop — a batch of ten
        # bad videos would have quietly cost gigabytes with nothing to show for it.
        if not keep_video:
            shutil.rmtree(vdir, ignore_errors=True)
    return {"video_id": video_id, "captured": len(rows),
            "planned": len(points), "stderr": stderr}


def sweep_work_dir():
    """Delete any working files a previous crash left behind. Safe to call any time."""
    if not WORK.exists():
        return 0
    n = sum(1 for _ in WORK.iterdir())
    shutil.rmtree(WORK, ignore_errors=True)
    return n


def plan(video_ids=None, limit=None, as_json=False, every_ms=None):
    points = pending(video_ids, limit, every_ms)
    by_video = {}
    for vid, t, cat in points:
        by_video.setdefault(vid, []).append({"t_ms": t, "category": cat})
    if as_json:
        return {"version": FRAMES_VERSION, "videos": by_video,
                "frames": len(points), "video_count": len(by_video)}
    return by_video, len(points)


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="frames", description="Plan which video moments are worth capturing.")
    ap.add_argument("--videos", help="comma-separated video ids; default every scanned video")
    ap.add_argument("--limit", type=int, help="cap total frames planned")
    ap.add_argument("--every", type=int, metavar="SEC",
                    help="also sample every N seconds — needed for teaching content, which "
                         "draws without ever saying stop or entry")
    ap.add_argument("--json", action="store_true", help="emit the plan for the capture driver")
    a = ap.parse_args(argv)
    vids = [v.strip() for v in (a.videos or "").split(",") if v.strip()] or None
    if a.json:
        print(json.dumps(plan(vids, a.limit, as_json=True,
                              every_ms=(a.every or 0) * 1000 or None), indent=2))
        return 0
    by_video, total = plan(vids, a.limit, every_ms=(a.every or 0) * 1000 or None)
    print(f"{total} frame(s) across {len(by_video)} video(s)")
    for vid in sorted(by_video)[:20]:
        cats = ", ".join(sorted({p["category"] for p in by_video[vid]}))
        print(f"  {vid}  {len(by_video[vid]):>3} frame(s)   {cats}")
    if len(by_video) > 20:
        print(f"  ... and {len(by_video) - 20} more video(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
