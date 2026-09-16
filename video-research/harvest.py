"""The loop that does not stop — unattended fetch, scan and daily sweep.

Why this exists: every collection run so far has been a foreground process in a terminal
window, and every one of them has died. One died two hours before the owner woke up, after
I had told him the night before that it was good to go. It was not good to go: it had no
restart, no supervision, and nothing that would have told either of us it had stopped. The
measured cost of that single death was 148 minutes of a 25-hour job.

So the throughput problem was never the fetch rate. The fetch rate is fine — 258 videos an
hour, measured over seven consecutive full hours. The problem is that 25 hours of runtime
spread across a process that dies every few hours and waits for a human to notice is not 25
hours of wall clock; it is however long it takes someone to check.

What this module is: a supervisor that turns runtime into wall clock.

  - One cycle = one captions batch, then a local scan of whatever it just fetched.
  - A cycle that throws does not end the loop. The next cycle starts anyway.
  - Blocking backs off and keeps going rather than exiting, because the gate is per-burst.
  - Every cycle writes a vr_runs row, so "is it alive" is a database question rather than
    a question about whether a terminal window is still open.
  - When there is nothing left to fetch, it switches to the daily sweep the owner asked
    for: re-inventory the sources, pick up anything new, scan it, sleep.

Disk discipline, asked for twice and meant both times: transcripts are text and small, but
this loop runs for days unattended, so it refuses to fetch below a free-space floor and
says so in the run record instead of filling the machine and stopping being useful.

This module supervises. It decides nothing about content: what a transcript means is still
a reading problem, and no amount of unattended looping turns a fetched caption into a
method record.
"""
import argparse
import os
import shutil
import sys
import time
import traceback

import captions
import inventory
import push_text
import scan
import store

HARVEST_VERSION = "harvest/1.0"

# Videos per cycle. Small enough that a crash costs little and the heartbeat stays frequent;
# large enough that the per-cycle overhead is noise against the fetch itself.
CYCLE_BATCH = int(os.environ.get("VR_HARVEST_BATCH", "60"))

# Refuse to fetch below this much free disk. Transcripts are small, but this loop is meant
# to run for days without anyone watching it, and a full disk is a worse failure than a
# pause: it breaks everything else on the machine too.
DISK_FLOOR_MB = int(os.environ.get("VR_HARVEST_FLOOR_MB", "3000"))

# How long to wait before re-checking, once the archive is fully fetched. This is the
# "daily sweep" cadence — new uploads only appear once a day at best.
SWEEP_INTERVAL_S = int(os.environ.get("VR_HARVEST_SWEEP_S", str(24 * 3600)))

# Pause between cycles while still catching up. Deliberately short: the pacer inside
# captions already spaces individual requests, and this is only the gap between batches.
CYCLE_PAUSE_S = int(os.environ.get("VR_HARVEST_PAUSE_S", "5"))

# Backoff when the gate bites, doubling per consecutive blocked cycle up to the cap. A
# blocked cycle is not a reason to exit — it is a reason to slow down.
BLOCK_BACKOFF_START_S = int(os.environ.get("VR_HARVEST_BACKOFF_S", "120"))
BLOCK_BACKOFF_CAP_S = int(os.environ.get("VR_HARVEST_BACKOFF_CAP_S", "3600"))

# Pause after an unexpected exception. Long enough that a permanent fault (bad credentials,
# no network) does not spin, short enough that a transient one costs little.
ERROR_PAUSE_S = int(os.environ.get("VR_HARVEST_ERROR_PAUSE_S", "60"))


def free_mb(path=None):
    return shutil.disk_usage(str(path or store.CACHE)).free // (1024 * 1024)


def _log(msg):
    print(f"{time.strftime('%Y-%m-%d %H:%M:%S')}  {msg}", flush=True)


def cycle(batch=None, delay=None, do_push=True):
    """One unit of work: fetch a batch, scan what landed, push the priority corpus.

    Returns a dict the loop uses to decide what to do next. Raises nothing it can help —
    a cycle that fails should cost a cycle, not the run.
    """
    batch = batch or CYCLE_BATCH
    out = {"fetched": 0, "blocked": 0, "failed": 0, "skipped": 0,
           "scanned": 0, "pushed": 0, "remaining": None, "stopped": None}

    pacer = captions.Pacer(base=delay)
    res = captions.ingest_batch(limit=batch, pacer=pacer)
    out.update({"fetched": res["processed"], "blocked": res["blocked"],
                "failed": res["failed"], "skipped": res["skipped"],
                "stopped": res["stopped"]})

    # Scan is local, free, and skips what it has already seen, so it runs every cycle and
    # the hit map never falls behind the transcripts.
    if res["processed"]:
        try:
            out["scanned"] = scan.run()["scanned"]
        except Exception as e:  # noqa: BLE001 - a scan failure must not stop fetching
            out["scan_error"] = str(e)[:200]
        if do_push:
            try:
                out["pushed"] = push_text.push(limit=200)["pushed"]
            except Exception as e:  # noqa: BLE001 - same
                out["push_error"] = str(e)[:200]

    try:
        out["remaining"] = len(captions.select_batch(batch, False))
    except Exception:  # noqa: BLE001 - an unreadable remainder is not a failed cycle
        out["remaining"] = None
    return out


def sweep():
    """Re-enumerate the sources so new uploads enter the queue. The daily part.

    inventory.refresh() returns one result per (source, listing), so the number that
    matters — how many new videos the sweep actually added — is a sum across them, not a
    field on the return. Reporting 0 because the shape was not what a caller assumed is
    how a sweep that quietly stopped working looks exactly like one that found nothing.
    """
    results = inventory.refresh()
    new_videos = sum(r.get("persisted", 0) or 0 for r in results)
    blocked = sum(1 for r in results if r.get("blocker_kind"))
    errored = sum(1 for r in results if r.get("error"))
    return {"listings": len(results), "new_videos": new_videos,
            "blocked": blocked, "errored": errored}


def loop(batch=None, delay=None, max_cycles=None, sleep=time.sleep, now=time.monotonic):
    """Run until told to stop. sleep and now are injectable so tests do not burn clock."""
    cycles = 0
    backoff = BLOCK_BACKOFF_START_S
    last_sweep = None
    _log(f"{HARVEST_VERSION} starting — batch {batch or CYCLE_BATCH}, "
         f"disk floor {DISK_FLOOR_MB:,} MB")

    while max_cycles is None or cycles < max_cycles:
        cycles += 1

        avail = free_mb()
        if avail < DISK_FLOOR_MB:
            # Pause, do not exit. Space may come back, and a loop that quit on a full disk
            # would need a human to restart it — which is the failure this module exists
            # to remove.
            _log(f"cycle {cycles}: only {avail:,} MB free, floor is {DISK_FLOOR_MB:,} — "
                 "pausing, not exiting")
            with store.Run("harvest", note=f"disk floor: {avail} MB free") as run:
                run.failed = 1
            sleep(SWEEP_INTERVAL_S // 24)          # an hour at the default cadence
            continue

        try:
            with store.Run("harvest", note=f"{HARVEST_VERSION} cycle {cycles}") as run:
                out = cycle(batch, delay)
                run.processed, run.skipped = out["fetched"], out["skipped"]
                run.failed, run.blocked = out["failed"], out["blocked"]
                run.save({"cycle": cycles, "remaining": out["remaining"],
                          "scanned": out["scanned"], "pushed": out["pushed"],
                          "free_mb": avail, "at": store.utcnow()})
        except Exception as e:  # noqa: BLE001 - the whole point is that nothing ends the loop
            _log(f"cycle {cycles} raised {type(e).__name__}: {e}")
            traceback.print_exc()
            sleep(ERROR_PAUSE_S)
            continue

        _log(f"cycle {cycles}: fetched {out['fetched']} blocked {out['blocked']} "
             f"failed {out['failed']} scanned {out['scanned']} pushed {out['pushed']} "
             f"remaining {out['remaining']}")

        if out["blocked"]:
            _log(f"blocked — backing off {backoff}s")
            sleep(backoff)
            backoff = min(backoff * 2, BLOCK_BACKOFF_CAP_S)
            continue
        backoff = BLOCK_BACKOFF_START_S

        if out["remaining"]:
            sleep(CYCLE_PAUSE_S)
            continue

        # Caught up. From here the job is the daily sweep the owner asked for: look for
        # new uploads, queue them, and go back to sleep.
        if last_sweep is None or (now() - last_sweep) >= SWEEP_INTERVAL_S:
            _log("caught up — running the daily sweep")
            try:
                with store.Run("harvest-sweep", note=HARVEST_VERSION) as run:
                    sw = sweep()
                    run.processed, run.blocked = sw["new_videos"], sw["blocked"]
                    run.failed = sw["errored"]
                    run.save({"listings": sw["listings"], "at": store.utcnow()})
                _log(f"sweep: {sw['new_videos']} new video(s) across "
                     f"{sw['listings']} listing(s), {sw['blocked']} blocked")
                last_sweep = now()
            except Exception as e:  # noqa: BLE001
                _log(f"sweep raised {type(e).__name__}: {e}")
        else:
            _log("caught up — nothing new; sleeping until the next sweep")
        sleep(min(SWEEP_INTERVAL_S // 24, 3600))
    return cycles


def main(argv=None):
    ap = argparse.ArgumentParser(
        prog="harvest",
        description="Unattended fetch + scan + daily sweep. Designed to be supervised.")
    ap.add_argument("--batch", type=int, help=f"videos per cycle (default {CYCLE_BATCH})")
    ap.add_argument("--delay", type=float, help="seconds between requests; overrides the pacer default")
    ap.add_argument("--cycles", type=int, help="stop after N cycles; default is never")
    ap.add_argument("--once", action="store_true", help="a single cycle, then exit")
    a = ap.parse_args(argv)
    if a.once:
        out = cycle(a.batch, a.delay)
        for k in sorted(out):
            print(f"  {k:<12} {out[k]}")
        return 0
    loop(a.batch, a.delay, a.cycles)
    return 0


if __name__ == "__main__":
    sys.exit(main())
