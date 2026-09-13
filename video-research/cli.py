#!/usr/bin/env python3
"""video-research — the operator surface (spec §21, §23).

Every subcommand is safe to re-run: the writes underneath are upserts on declared conflict
keys, so an interrupted batch resumes instead of duplicating. Each one ends by printing the
command that continues whatever it did not finish, because "how do I carry on from here"
is the question you actually have at 2am.

Two rules this file is responsible for at the display layer:

  1. A percentage is printed ONLY where the denominator was established. Where a listing
     did not paginate to the end, the count is printed followed by the literal words
     "denominator unknown". inventory.coverage_report() returns None for the ratio in that
     case and this file never fills it in.
  2. A number we do not have prints as "—", never as 0. Zero is a measurement.

Run with no credentials and the store-backed commands say so and exit non-zero rather than
pretending. `quality` still runs its static checks.
"""
import argparse
import json
import os
import sys

import store

DASH = "—"


def _n(v):
    return DASH if v is None else f"{v:,}" if isinstance(v, int) else str(v)


def _need_store():
    if not store.configured():
        print("No Supabase credentials.\n"
              "  Put SUPABASE_URL and SUPABASE_SERVICE_KEY in video-research/.env\n"
              "  (the droplet at /root/lmc-desk/.env already has them).", file=sys.stderr)
        return False
    return True


def _resume(cmd):
    print(f"\n  resume with:  python3 cli.py {cmd}")


# --------------------------------------------------------------------------
def cmd_seed(args):
    import inventory
    if not _need_store():
        return 2
    n_s, n_p = inventory.seed_registry()
    print(f"seeded {n_s} sources, {n_p} presenters")
    import sources
    for s in sources.SOURCES:
        mark = {"CONFIRMED": "crawled", "UNRESOLVED": "NOT crawled - identity unconfirmed",
                "RELATED": "NOT crawled - listed for scope confirmation",
                "EXCLUDED": "excluded"}[s["scope_status"]]
        print(f"  {s['source_key']:28s} {s['scope_status']:11s} {mark}")
    _resume("inventory")
    return 0


def cmd_inventory(args):
    import inventory
    if not _need_store():
        return 2
    keys = args.sources.split(",") if args.sources else None
    res = inventory.refresh(source_keys=keys, limit=args.limit, resume=not args.restart)
    done = res.get("listings_done", res) if isinstance(res, dict) else res
    print(json.dumps(done, indent=2, default=str)[:4000])
    _resume("status")
    return 0


def cmd_captions(args):
    import captions
    if not _need_store():
        return 2
    pacer = captions.Pacer(base=args.delay) if args.delay else None
    res = captions.ingest_batch(limit=args.limit, force=args.force, pacer=pacer)
    ok = res.get("ok", 0) if isinstance(res, dict) else 0
    blocked = res.get("blocked", 0) if isinstance(res, dict) else 0
    print(json.dumps(res, indent=2, default=str)[:4000])
    if blocked:
        print(f"\n  {blocked} video(s) hit YouTube's bot check. The batch stopped on a "
              f"checkpoint rather than hammering.\n"
              f"  This is expected from a datacenter IP — see docs/ACCESS.md. Run from a "
              f"residential IP, or supply authorized transcripts:\n"
              f"      python3 cli.py import-transcripts --path <dir>")
    print(f"\n  transcripts this run: {ok}")
    _resume(f"captions --limit {args.limit}")
    return 0


def cmd_import(args):
    import captions
    if not args.dry_run and not _need_store():
        return 2
    res = captions.import_authorized(args.path, dry_run=args.dry_run)
    print(json.dumps(res, indent=2, default=str)[:6000])
    if args.dry_run:
        print("\n  dry run: nothing was written. Drop --dry-run to ingest.")
    return 0


def cmd_status(args):
    import inventory
    if not _need_store():
        return 2
    rep = inventory.coverage_report()
    print("SOURCES")
    for key, s in rep["sources"].items():
        print(f"  {key:28s} {s['scope_status']:11s} stored={_n(s.get('stored_videos'))}")
        if s["scope_status"] != "CONFIRMED":
            print(f"      {s.get('note', 'not enumerated')}")
            continue
        for listing, l in s.get("listings", {}).items():
            if l.get("ratio") is None:
                # THE rule: no denominator, no percentage.
                extra = l.get("ratio_note") or "denominator unknown"
                print(f"      {listing:9s} seen={_n(l.get('items_seen'))} "
                      f"stored={_n(l.get('stored'))}  denominator unknown  ({extra})")
            else:
                print(f"      {listing:9s} seen={_n(l['items_seen'])} "
                      f"stored={_n(l['stored'])}  {l['ratio'] * 100:.1f}%")

    print("\nSTAGES")
    for stage in store.STAGES:
        try:
            n = store.count("vr_video_stages", f"stage=eq.{stage}&state=eq.done")
        except Exception:
            n = None
        print(f"  {stage:24s} {_n(n)}")

    print("\nLAST RUNS")
    try:
        runs = store.get("vr_runs", "select=job,started_at,finished_at,ok,processed,failed,"
                                    "blocked&order=started_at.desc&limit=8")
        for r in runs or []:
            state = "running" if not r["finished_at"] else ("ok" if r["ok"] else "FAILED")
            print(f"  {r['job']:12s} {r['started_at'][:19]} {state:8s} "
                  f"processed={r['processed']} failed={r['failed']} blocked={r['blocked']}")
    except Exception as e:
        print(f"  (unreadable: {e})")

    print("\nOPEN BLOCKERS")
    try:
        bl = store.get("vr_access_blockers",
                       "select=kind,occurrences,last_seen_at&resolved=is.false"
                       "&order=occurrences.desc&limit=10")
        for b in bl or []:
            print(f"  {b['kind']:18s} x{b['occurrences']}  last {b['last_seen_at'][:19]}")
        if not bl:
            print("  none")
    except Exception as e:
        print(f"  (unreadable: {e})")
    _resume("blockers")
    return 0


def cmd_quality(args):
    import quality
    results = quality.run_checks(write=store.configured())
    width = max(len(r.key) for r in results)
    for r in results:
        mark = {"pass": "PASS", "fail": "FAIL", "vacuous": "VACUOUS",
                "skipped": "SKIPPED", "error": "ERROR"}[r.state]
        print(f"  {mark:8s} {r.key:{width}s}  {r.note or ''}")
    counts = {}
    for r in results:
        counts[r.state] = counts.get(r.state, 0) + 1
    print(f"\n  {counts}")
    if counts.get("skipped"):
        print("  skipped checks did NOT pass — they did not run. A skip is not evidence.")
    return 1 if counts.get("fail") or counts.get("error") else 0


def cmd_blockers(args):
    if not _need_store():
        return 2
    rows = store.get("vr_access_blockers",
                     "select=kind,detail,source_key,occurrences,first_seen_at,last_seen_at,"
                     "resolved&order=resolved.asc,occurrences.desc")
    for b in rows or []:
        flag = "resolved" if b["resolved"] else "OPEN"
        print(f"\n[{flag}] {b['kind']}  x{b['occurrences']}  source={b['source_key']}")
        print(f"  first {b['first_seen_at'][:19]}   last {b['last_seen_at'][:19]}")
        if b["detail"]:
            for line in str(b["detail"]).split(". "):
                if line.strip():
                    print(f"    {line.strip()}")
    if not rows:
        print("no blockers recorded")
    return 0


def main(argv=None):
    p = argparse.ArgumentParser(prog="cli.py", description=__doc__.split("\n")[0])
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("seed", help="seed the source + presenter registry").set_defaults(fn=cmd_seed)

    a = sub.add_parser("inventory", help="refresh the archive inventory")
    a.add_argument("--sources", help="comma-separated source_keys (default: all CONFIRMED)")
    a.add_argument("--limit", type=int, help="cap items per listing (marks it incomplete)")
    a.add_argument("--restart", action="store_true", help="ignore the resume checkpoint")
    a.set_defaults(fn=cmd_inventory)

    a = sub.add_parser("captions", help="ingest transcripts (rate-limited, checkpointed)")
    a.add_argument("--limit", type=int, default=25)
    a.add_argument("--delay", type=float, help=f"seconds between videos "
                                               f"(default {os.environ.get('VR_CAPTION_DELAY', 20)})")
    a.add_argument("--force", action="store_true", help="re-fetch videos already transcribed")
    a.set_defaults(fn=cmd_captions)

    a = sub.add_parser("import-transcripts", help="ingest owner-supplied authorized transcripts")
    a.add_argument("--path", required=True, help="a .json file or a directory of them")
    a.add_argument("--dry-run", action="store_true", help="validate only, write nothing")
    a.set_defaults(fn=cmd_import)

    sub.add_parser("status", help="coverage, stages, runs, blockers").set_defaults(fn=cmd_status)
    sub.add_parser("quality", help="run the §22 acceptance checks").set_defaults(fn=cmd_quality)
    sub.add_parser("blockers", help="open access blockers and their remedies").set_defaults(fn=cmd_blockers)

    args = p.parse_args(argv)
    return args.fn(args)


if __name__ == "__main__":
    sys.exit(main())
