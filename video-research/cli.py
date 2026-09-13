#!/usr/bin/env python3
"""The operator surface for the video-research pipeline (brief §21, §23).

One subcommand per thing that can be done, plus `status` for the only question that comes
up between runs: what finished, what did not, and what do I type next. Every subcommand is
safe to re-run — the modules underneath are upsert-keyed and checkpointed — and every one
ends by printing the command that resumes whatever it left unfinished, including on Ctrl-C.

TWO RULES THIS FILE ENFORCES ON ITS OWN OUTPUT

  1. A ratio is printed only where the denominator was established. Row counts we hold are
     exact and always shown; the ARCHIVE share is printed as a percentage only when every
     CONFIRMED listing paginated to the end, and otherwise prints the literal words
     "denominator unknown" plus the reason. A listing can stop for three reasons that look
     identical from outside — end of data, rate limit, or a caller cap — and only the first
     licenses a percentage. inventory.coverage_report() returns ratio=None in the other two
     cases and nothing here fills it in.
  2. Unreadable is not empty, and a number we do not have prints as an em dash, never as 0.
     Zero is a measurement. With no credentials, or with a read that fails, the section says
     "unreadable" and the command exits non-zero rather than reporting an empty archive.

Exit codes: 0 nothing outstanding · 1 ran, something failed or is still blocked ·
2 could not run (no credentials / unreadable) · 130 interrupted.

Nothing here fetches a price, places an order or touches a risk limit. The only writes are
the ones the modules underneath already make, all to vr_* tables.
"""
import argparse
import json
import sys

import captions
import inventory
import presenters  # noqa: F401 - imported so cli.py fails loudly if attribution breaks
import quality
import sources
import store

PROG = "python3 cli.py"
STAGE_STATES = ("done", "blocked", "unavailable", "pending")
PAGE = 1000

# What a human is supposed to do about each blocker kind. It lives next to the reader rather
# than in a docstring because this text is the entire point of the `blockers` command.
REMEDIES = {
    "bot_check": ("YouTube's anti-bot gate. Not bypassable, and the brief forbids trying "
                  "(no cookies, no impersonation). Wait out the cooldown and re-run "
                  f"`{PROG} captions --delay 40` from a residential IP, or have the owner "
                  f"supply transcripts and run `{PROG} import-transcripts --path <dir>` "
                  "(docs/ACCESS.md)."),
    "rate_limited": ("HTTP 429. Same remedy as bot_check: longer --delay, fewer videos per "
                     "batch, and a cooldown before the next attempt."),
    "no_captions": ("YouTube advertises no English captions for this video and the player "
                    "response was seen, so this is a fact about the video rather than about "
                    f"us. Only an authorized transcript fills it: `{PROG} import-transcripts "
                    "--path <dir>` (docs/ACCESS.md)."),
    "private": "Not public. Stays an explicit gap; do not infer content from the title.",
    "members_only": ("Behind channel membership. Out of scope — nothing here pays for or "
                     "logs into anything. Stays an explicit gap."),
    "deleted": "Gone from YouTube. Permanent gap; the inventory row is kept on purpose.",
    "region_blocked": ("Geo-restricted from this host. Another region may see it; nothing "
                       "here guesses at the contents."),
    "other": "Read the `detail` column — this kind is deliberately not auto-diagnosed.",
}


# --------------------------------------------------------------------------
# printing
# --------------------------------------------------------------------------
def _h(title):
    print()
    print(title)
    print("-" * len(title))


def _n(v):
    """A number we hold, or an em dash. Never 0 for 'we could not read it'."""
    return f"{v:,}" if isinstance(v, int) else "—"


def _emit(payload, as_json):
    if as_json:
        print(json.dumps(payload, indent=1, default=str))
    return payload


def _resume_block(commands, notes=()):
    if not commands and not notes:
        print("\nnothing outstanding.")
        return
    _h("RESUME")
    for c in commands:
        print(f"  {c}")
    for n in notes:
        print(f"  # {n}")


# --------------------------------------------------------------------------
# reads (each one guarded: a failure must surface as unreadable, not as zero)
# --------------------------------------------------------------------------
def _try(fn):
    try:
        return fn(), None
    except Exception as e:  # noqa: BLE001 - any read failure is a reportable state
        return None, f"{type(e).__name__}: {e}"[:200]


def _stage_counts():
    """Per-stage totals, with a state breakdown only for stages that have rows.

    PostgREST has no GROUP BY, so every cell is its own exact count. Skipping the breakdown
    for empty stages keeps a status under a dozen round trips instead of forty.
    """
    out = {}
    for stage in store.STAGES:
        total = store.count("vr_video_stages", f"stage=eq.{stage}")
        if not total:
            continue
        row = {"total": total}
        for st in STAGE_STATES:
            n = store.count("vr_video_stages", f"stage=eq.{stage}&state=eq.{st}")
            if n:
                row[st] = n
        out[stage] = row
    return out


def _transcript_videos():
    """Distinct video_id in vr_transcripts.

    PostgREST has no count(distinct), and one video can carry both en and en-orig, so
    counting rows would report more videos than exist.
    """
    seen, off = set(), 0
    while off < 200_000:
        page = store.get("vr_transcripts", f"select=video_id&limit={PAGE}&offset={off}")
        seen.update(r["video_id"] for r in page)
        if len(page) < PAGE:
            break
        off += len(page)
    return seen


def _open_blockers():
    rows = store.get("vr_access_blockers",
                     "select=kind,detail,video_id,source_key,occurrences,"
                     "first_seen_at,last_seen_at&resolved=is.false"
                     f"&order=last_seen_at.desc&limit={PAGE}")
    by_kind = {}
    for r in rows:
        k = by_kind.setdefault(r["kind"], {"kind": r["kind"], "rows": 0, "occurrences": 0,
                                           "videos": set(), "last_seen_at": None,
                                           "sample_detail": None})
        k["rows"] += 1
        k["occurrences"] += r.get("occurrences") or 1
        if r.get("video_id"):
            k["videos"].add(r["video_id"])
        if r.get("last_seen_at") and (k["last_seen_at"] or "") < r["last_seen_at"]:
            k["last_seen_at"] = r["last_seen_at"]
        k["sample_detail"] = k["sample_detail"] or r.get("detail")
    out = []
    for k in sorted(by_kind.values(), key=lambda x: -x["occurrences"]):
        k["videos"] = sorted(k["videos"])[:5]
        k["remedy"] = REMEDIES.get(k["kind"], REMEDIES["other"])
        out.append(k)
    return {"kinds": out, "rows": len(rows), "truncated": len(rows) >= PAGE}


def _last_runs():
    """Most recent run per job. One page is plenty — jobs are few and runs are ordered."""
    rows = store.get("vr_runs", "select=id,job,started_at,finished_at,ok,processed,skipped,"
                                "failed,blocked,checkpoint,note,error"
                                "&order=started_at.desc&limit=120")
    latest = {}
    for r in rows:
        latest.setdefault(r["job"], r)
    return latest


def _denominator(cov):
    """(established?, why_not). Established only when every CONFIRMED listing ran to the end.

    One truncated listing and the video count is a floor, not a total, so no share of "the
    archive" may be divided by it.
    """
    srcs = (cov or {}).get("sources") or {}
    enumerated = {k: s for k, s in srcs.items() if s.get("enumerated")}
    if not enumerated:
        return False, "no source has been enumerated yet"
    bad = sorted(k for k, s in enumerated.items() if not s.get("all_listings_complete"))
    if bad:
        return False, "incomplete listings in: " + ", ".join(bad)
    return True, None


# --------------------------------------------------------------------------
# seed
# --------------------------------------------------------------------------
def cmd_seed(a):
    out = inventory.seed_registry()
    by_status = {}
    for s in sources.SOURCES:
        by_status.setdefault(s["scope_status"], []).append(s["source_key"])
    payload = {"command": "seed", "at": store.utcnow(), "scope": by_status, **out}
    if a.json:
        return _emit(payload, True), 0
    _h("SEED")
    print(f"  vr_sources    {out['sources']} row(s) upserted")
    print(f"  vr_presenters {out['presenters']} row(s) upserted")
    for status in sorted(by_status):
        print(f"  {status:<11} {', '.join(sorted(by_status[status]))}")
    # UNRESOLVED and RELATED rows are stored precisely so the owner can see what was asked
    # for and what was found. Only CONFIRMED is ever crawled.
    notes = [f"{k} is {st} and is never crawled; see its resolution_note in sources.py"
             for st in ("UNRESOLVED", "RELATED") for k in by_status.get(st, [])]
    _resume_block([f"{PROG} inventory"], notes)
    return payload, 0


# --------------------------------------------------------------------------
# inventory
# --------------------------------------------------------------------------
def cmd_inventory(a):
    keys = [k.strip() for group in (a.sources or []) for k in group.split(",") if k.strip()]
    results = inventory.refresh(keys or None, limit=a.limit)
    incomplete = [r for r in results if not r.get("pagination_complete")]
    payload = {"command": "inventory", "at": store.utcnow(), "listings": results,
               "incomplete": len(incomplete)}
    if a.json:
        return _emit(payload, True), (1 if incomplete else 0)
    _h("INVENTORY")
    for r in results:
        flag = "complete" if r.get("pagination_complete") else \
            f"INCOMPLETE ({r.get('stopped_reason')})"
        print(f"  {r.get('source_key', '?'):<28} {r.get('listing', '?'):<9} "
              f"seen {_n(r.get('items_seen')):>7}  new {_n(r.get('new_items')):>6}  {flag}")
        if r.get("error"):
            print(f"      error: {r['error'][:160]}")
    if a.limit:
        print(f"\n  --limit {a.limit} was applied, so every listing above is recorded "
              "incomplete by construction: a capped walk has no denominator.")
    cmds = [f"{PROG} inventory --sources {r['source_key']}"
            f"    # {r.get('listing')} stopped: {r.get('stopped_reason')}"
            for r in incomplete if r.get("source_key")]
    _resume_block(cmds)
    return payload, (1 if incomplete else 0)


# --------------------------------------------------------------------------
# captions
# --------------------------------------------------------------------------
def cmd_captions(a):
    pacer = captions.Pacer(base=a.delay)   # base=None falls back to VR_CAPTION_DELAY
    out = captions.ingest_batch(limit=a.limit, force=a.force, pacer=pacer)
    remaining, rem_err = _try(lambda: len(captions.select_batch(a.limit, a.force)))
    payload = {"command": "captions", "at": store.utcnow(), "limit": a.limit,
               "delay_s": pacer.base, "remaining_in_next_batch": remaining,
               "remaining_error": rem_err, **out}
    unfinished = out["stopped"] != "completed" or out["blocked"] or bool(remaining)
    if a.json:
        return _emit(payload, True), (1 if unfinished else 0)
    _h("CAPTIONS")
    print(f"  stopped   {out['stopped']}")
    print(f"  processed {out['processed']}   skipped {out['skipped']}   "
          f"failed {out['failed']}   blocked {out['blocked']}")
    t = out["throughput"]
    # seconds_per_video is None when nothing succeeded — no successes, no denominator.
    rate = (f"{t['seconds_per_video']}s/video ({t['videos_per_hour']}/h)"
            if t.get("seconds_per_video") else "no successful fetch: no rate to report")
    print(f"  pacing    delay {pacer.base}s, slept {t['slept_s']}s of {t['elapsed_s']}s — {rate}")
    if rem_err:
        print(f"  remaining unreadable: {rem_err}")
    elif remaining:
        print(f"  remaining at least {remaining} eligible video(s) for the next batch")
    cmds = []
    if out["blocked"]:
        cmds.append(f"{PROG} captions --limit {a.limit} --delay {max(int(pacer.base * 2), 40)}"
                    "    # blocked: slow down, or move to a non-gated IP")
    elif unfinished:
        cmds.append(f"{PROG} captions --limit {a.limit}")
    _resume_block(cmds, ["docs/ACCESS.md — authorized transcripts cover what the gate will not"]
                  if out["blocked"] else [])
    return payload, (1 if unfinished else 0)


# --------------------------------------------------------------------------
# import-transcripts
# --------------------------------------------------------------------------
def cmd_import(a):
    out = captions.import_authorized(a.path, dry_run=a.dry_run)
    payload = {"command": "import-transcripts", "at": store.utcnow(), **out}
    if a.json:
        return _emit(payload, True), (1 if out["rejected"] else 0)
    _h("IMPORT TRANSCRIPTS" + ("  (dry run — nothing written)" if a.dry_run else ""))
    print(f"  path  {out['path']}   files {out['files']}")
    for r in out["imported"]:
        declared = r["declared_source_type"]
        why = "" if declared == "creator" else \
            f"  (declared={declared!r} -> auto: only an explicit 'creator' earns that label)"
        print(f"  ok     {r['video_id']}  {r['lang']}/{r['source_type']}  "
              f"{r['segments']} segments  {r['text_hash'][:12]}{why}")
        if r["out_of_order"]:
            print(f"         warning: {r['out_of_order']} segment(s) go backwards in time — "
                  "left exactly as supplied, so excerpts cited off this file inherit it")
    for r in out["rejected"]:
        print(f"  REJECT {r['path']}\n         {r['reason']}")
    print(f"\n  imported {len(out['imported'])}   rejected {len(out['rejected'])}   "
          f"declared creator {out['creator_declared']}")
    if a.dry_run:
        print("  dry run: nothing was written. Drop --dry-run to ingest.")
    cmds = [f"{PROG} import-transcripts --path {a.path}    # after fixing the rejected file(s)"] \
        if out["rejected"] else []
    if out["imported"] and not a.dry_run:
        cmds.append(f"{PROG} status")
    _resume_block(cmds)
    return payload, (1 if out["rejected"] else 0)


# --------------------------------------------------------------------------
# status
# --------------------------------------------------------------------------
def status_payload():
    cov, cov_err = _try(inventory.coverage_report)
    videos, videos_err = _try(lambda: store.count("vr_videos"))
    tx, tx_err = _try(_transcript_videos)
    stages, stages_err = _try(_stage_counts)
    blockers, blockers_err = _try(_open_blockers)
    runs, runs_err = _try(_last_runs)
    established, why = _denominator(cov) if cov else (False, f"coverage unreadable: {cov_err}")
    share = round(len(tx) / videos, 4) if (established and videos and tx is not None) else None
    return {
        "command": "status", "at": store.utcnow(),
        "store_configured": store.configured(),
        "coverage": cov, "coverage_error": cov_err,
        "videos_recorded": videos, "videos_error": videos_err,
        "videos_with_transcript": len(tx) if tx is not None else None,
        "transcripts_error": tx_err,
        # The one number allowed to be withheld, and always with the reason it was.
        "archive_share": share,
        "archive_share_note": None if share is not None else
        ("denominator unknown — " + (why or "transcript count unreadable")),
        "stages": stages, "stages_error": stages_err,
        "blockers": blockers, "blockers_error": blockers_err,
        "runs": runs, "runs_error": runs_err,
        "errors": [e for e in (cov_err, videos_err, tx_err, stages_err,
                               blockers_err, runs_err) if e],
    }


def _print_coverage(st):
    _h("INVENTORY COVERAGE")
    if st["coverage_error"]:
        print(f"  unreadable: {st['coverage_error']}")
        return
    srcs = (st["coverage"] or {}).get("sources") or {}
    for s in sources.SOURCES:
        e = srcs.get(s["source_key"])
        if not e:
            continue
        print(f"  {s['source_key']:<28} {e['scope_status']}")
        if not e.get("enumerated"):
            print(f"      {e.get('note', 'not enumerated')}")
            continue
        for listing, l in sorted(e.get("listings", {}).items()):
            if not l.get("ran"):
                print(f"      {listing:<9} never enumerated — denominator unknown")
                continue
            head = (f"      {listing:<9} seen {_n(l['items_seen']):>7}  "
                    f"stored {_n(l['stored']):>7}  ")
            if l.get("ratio") is None:
                print(head + f"denominator unknown — {l.get('ratio_note')}")
            elif l["ratio"] > 1:
                # We hold more rows than the listing enumerated, so the two numbers are not
                # counting the same set. Printing 104% would read as "better than complete".
                print(head + "rows held exceed items enumerated — the two counts do not "
                             "cover the same set, so no percentage is shown")
            else:
                print(head + f"{l['ratio'] * 100:.1f}%  complete")
        if e.get("items_seen_total") is None:
            print(f"      total     {e.get('items_seen_total_note', 'denominator unknown')}")


def _print_transcripts(st):
    _h("TRANSCRIPT COVERAGE")
    print(f"  videos recorded          {_n(st['videos_recorded'])}"
          + (f"   unreadable: {st['videos_error']}" if st["videos_error"] else ""))
    print(f"  videos with a transcript {_n(st['videos_with_transcript'])}"
          + (f"   unreadable: {st['transcripts_error']}" if st["transcripts_error"] else ""))
    if st["archive_share"] is None:
        print(f"  share of the archive     {st['archive_share_note']}")
    else:
        print(f"  share of the archive     {st['archive_share'] * 100:.2f}%"
              "   (every CONFIRMED listing paginated to the end)")
    print("  visuals inspected        only what a human put in vr_chart_observations — "
          "nothing in this package looks at a frame")


def _print_stages(st):
    _h("STAGES")
    if st["stages_error"]:
        print(f"  unreadable: {st['stages_error']}")
        return
    if not st["stages"]:
        print("  no vr_video_stages rows yet")
        return
    for stage, row in st["stages"].items():
        breakdown = "  ".join(f"{k} {_n(v)}" for k, v in row.items() if k != "total")
        print(f"  {stage:<24} {_n(row['total']):>8}   {breakdown}")


def _print_blockers(st, verbose=False):
    _h("OPEN BLOCKERS")
    if st["blockers_error"]:
        print(f"  unreadable: {st['blockers_error']}")
        return
    b = st["blockers"] or {"kinds": []}
    if not b["kinds"]:
        print("  none open")
        return
    for k in b["kinds"]:
        print(f"  {k['kind']:<16} {k['rows']:>5} row(s)  {k['occurrences']:>6} occurrence(s)"
              f"   last {str(k['last_seen_at'])[:19]}")
        if k["videos"]:
            print(f"      videos: {', '.join(k['videos'])}"
                  + (" ..." if k["rows"] > len(k["videos"]) else ""))
        if verbose and k.get("sample_detail"):
            print(f"      detail: {k['sample_detail'][:220]}")
        print(f"      remedy: {k['remedy']}")
    if b.get("truncated"):
        print(f"  (listing capped at {PAGE} rows — the counts above are a floor)")


def _print_runs(st):
    _h("LAST RUNS")
    if st["runs_error"]:
        print(f"  unreadable: {st['runs_error']}")
        return
    if not st["runs"]:
        print("  no vr_runs rows yet")
        return
    for job, r in st["runs"].items():
        state = "running" if not r.get("finished_at") else ("ok" if r.get("ok") else "FAILED")
        cp = r.get("checkpoint") or {}
        tail = cp.get("stopped") or (f"at {cp['position']}/{cp['of']}" if cp.get("of") else "")
        print(f"  {job:<18} {str(r['started_at'])[:19]}  {state:<8} "
              f"processed {r['processed']} skipped {r['skipped']} "
              f"failed {r['failed']} blocked {r['blocked']}  {tail}")
        if r.get("error"):
            print(f"      error: {r['error'][:160]}")


def _status_resume(st):
    if not st["store_configured"]:
        _resume_block([], ["set SUPABASE_URL and SUPABASE_SERVICE_KEY in video-research/.env "
                           "— every section above is unreadable, not empty"])
        return
    cmds, notes = [], []
    srcs = (st["coverage"] or {}).get("sources") or {}
    for key, e in sorted(srcs.items()):
        if e.get("scope_status") == "UNRESOLVED":
            notes.append(f"owner input needed: resolve {key} in sources.py (see its "
                         f"resolution_note), then `{PROG} inventory --sources {key}`")
        elif e.get("enumerated") and not e.get("all_listings_complete"):
            cmds.append(f"{PROG} inventory --sources {key}    # a listing stopped short")
    if not srcs and not st["coverage_error"]:
        cmds.append(f"{PROG} seed && {PROG} inventory    # nothing enumerated yet")

    run = (st["runs"] or {}).get("captions")
    stopped = ((run or {}).get("checkpoint") or {}).get("stopped")
    gap = (st["videos_recorded"] or 0) - (st["videos_with_transcript"] or 0)
    if stopped and stopped != "completed":
        cmds.append(f"{PROG} captions --limit 25 --delay 40    # last run stopped: {stopped}")
    elif gap > 0:
        cmds.append(f"{PROG} captions --limit 25    # {gap:,} recorded video(s) have no transcript")

    kinds = {k["kind"] for k in ((st["blockers"] or {}).get("kinds") or [])}
    if kinds & {"bot_check", "rate_limited"}:
        notes.append("the bot gate is open: either move `captions` to a residential IP or "
                     f"supply transcripts and run `{PROG} import-transcripts --path <dir>` "
                     "(docs/ACCESS.md)")
    if "no_captions" in kinds:
        notes.append("some videos genuinely advertise no captions — only an authorized "
                     "transcript can close those")
    cmds.append(f"{PROG} quality    # re-run the §22 acceptance checks")
    _resume_block(cmds, notes)


def cmd_status(a):
    st = status_payload()
    if a.json:
        return _emit(st, True), (2 if st["errors"] else 0)
    _h(f"VIDEO-RESEARCH STATUS  {st['at'][:19]}")
    print("  store: " + ("configured" if st["store_configured"] else
                         "NOT configured — put SUPABASE_URL and SUPABASE_SERVICE_KEY in "
                         "video-research/.env (the droplet's /root/lmc-desk/.env already "
                         "has them). Everything below is unreadable, not zero."))
    _print_coverage(st)
    _print_transcripts(st)
    _print_stages(st)
    _print_blockers(st)
    _print_runs(st)
    _status_resume(st)
    return st, (2 if st["errors"] else 0)


# --------------------------------------------------------------------------
# quality
# --------------------------------------------------------------------------
def cmd_quality(a):
    results = quality.run_checks(write=not a.no_write, only=set(a.check) if a.check else None)
    summary = quality.summarise(results)
    payload = {"command": "quality", "at": store.utcnow(), "summary": summary,
               "checks": [r.row() for r in results]}
    # Same convention as quality.py: a suite that could not run must not exit 0, or an unrun
    # board reads as a green one. Zero checks is the extreme case of that and exits 2.
    if not results:
        payload["error"] = "no checks ran"
        code = 2
        if a.json:
            return _emit(payload, True), code
        _h("QUALITY (brief §22)")
        print("  no checks ran — nothing was verified. This is NOT a pass.")
        _resume_block([f"{PROG} quality"])
        return payload, code
    code = 1 if summary["fail"] or summary["error"] else (2 if summary["skipped"] else 0)
    if a.json:
        return _emit(payload, True), code
    _h("QUALITY (brief §22)")
    w = max(len(r.key) for r in results)
    for r in results:
        mark = "" if r.state != "pass" or r.observed.get("case_exercised") else "  (not exercised)"
        print(f"  {r.state.upper():<8} {r.key:<{w}}  {(r.note or '')[:90]}{mark}")
    print("\n  " + "  ".join(f"{k} {v}" for k, v in summary.items() if v))
    notes = []
    if summary["skipped"]:
        notes.append("skipped means the check could not read its rows — it is NOT a pass")
    if summary["vacuous"]:
        notes.append("vacuous means the invariant held over an empty table: true, but no "
                     "evidence the case works")
    if summary["unexercised"]:
        notes.append("a pass that never reached the case under test is not evidence either")
    cmds = [f"{PROG} quality"] if (summary["fail"] or summary["error"]
                                   or summary["skipped"]) else []
    _resume_block(cmds, notes)
    return payload, code


# --------------------------------------------------------------------------
# blockers
# --------------------------------------------------------------------------
def cmd_blockers(a):
    b, err = _try(_open_blockers)
    unresolved = [s for s in sources.SOURCES if s["scope_status"] == "UNRESOLVED"]
    payload = {"command": "blockers", "at": store.utcnow(), "blockers": b, "error": err,
               "unresolved_sources": [s["source_key"] for s in unresolved]}
    kinds = {k["kind"] for k in ((b or {}).get("kinds") or [])}
    if a.json:
        return _emit(payload, True), (2 if err else (1 if kinds else 0))
    _print_blockers({"blockers": b, "blockers_error": err}, verbose=True)
    if unresolved:
        # Not a vr_access_blockers row, but the same kind of thing: work that cannot start
        # until a human supplies something.
        _h("SOURCES AWAITING OWNER INPUT")
        for s in unresolved:
            print(f"  {s['source_key']:<20} {s['display_name']}")
            print(f"      {s['resolution_note']}")
    cmds = []
    if kinds & {"bot_check", "rate_limited"}:
        cmds.append(f"{PROG} captions --limit 10 --delay 60    # after a cooldown, "
                    "ideally from a residential IP")
    if kinds & {"bot_check", "rate_limited", "no_captions"}:
        cmds.append(f"{PROG} import-transcripts --path <dir>    # docs/ACCESS.md has the format")
    _resume_block(cmds, [f"{s['source_key']}: supply the exact channel URL, set "
                         "scope_status='CONFIRMED' in sources.py, then run "
                         f"`{PROG} inventory --sources {s['source_key']}`" for s in unresolved])
    return payload, (2 if err else (1 if kinds else 0))


# --------------------------------------------------------------------------
COMMANDS = {"seed": cmd_seed, "inventory": cmd_inventory, "captions": cmd_captions,
            "import-transcripts": cmd_import, "status": cmd_status, "quality": cmd_quality,
            "blockers": cmd_blockers}


def build_parser():
    common = argparse.ArgumentParser(add_help=False)
    common.add_argument("--json", action="store_true",
                        help="machine-readable output instead of the human report")
    ap = argparse.ArgumentParser(
        prog="cli.py", description=__doc__.split("\n\n")[0],
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="Every subcommand is safe to re-run and prints the command that resumes "
               "whatever it did not finish. Exit: 0 clean, 1 outstanding, 2 unreadable.")
    sub = ap.add_subparsers(dest="cmd", required=True)

    sub.add_parser("seed", parents=[common],
                   help="seed vr_sources + vr_presenters from sources.py (idempotent)")

    inv = sub.add_parser("inventory", parents=[common],
                         help="refresh the archive inventory; skips listings already finished")
    inv.add_argument("--sources", action="append", metavar="KEY",
                     help="source_key to refresh; repeatable or comma-separated")
    inv.add_argument("--limit", type=int, metavar="N",
                     help="cap items per listing — marks every listing incomplete, "
                          "because a capped walk has no denominator")

    cap = sub.add_parser("captions", parents=[common],
                         help="ingest transcripts, serially and paced (the player API is "
                              "bot-gated; see docs/ACCESS.md)")
    cap.add_argument("--limit", type=int, default=25, metavar="N", help="videos this batch")
    cap.add_argument("--delay", type=float, metavar="S",
                     help=f"seconds between videos (default {captions.DEFAULT_DELAY})")
    cap.add_argument("--force", action="store_true",
                     help="re-fetch videos that already have a transcript")

    imp = sub.add_parser("import-transcripts", parents=[common],
                         help="ingest owner-supplied timestamped transcripts (docs/ACCESS.md)")
    imp.add_argument("--path", required=True, metavar="PATH",
                     help="a .json file or a directory tree of them")
    imp.add_argument("--dry-run", action="store_true",
                     help="validate the files only; writes nothing, needs no credentials")

    sub.add_parser("status", parents=[common],
                   help="coverage, stage counts, blockers, last runs, and what to type next")

    q = sub.add_parser("quality", parents=[common], help="run the §22 acceptance checks")
    # choices, not a free string: a mistyped key used to select nothing and exit 0 clean.
    q.add_argument("--check", action="append", metavar="KEY", choices=quality.CHECK_KEYS,
                   help=f"run one check only; one of: {', '.join(quality.CHECK_KEYS)}")
    q.add_argument("--no-write", action="store_true",
                   help="do not record the results in vr_quality_checks")

    sub.add_parser("blockers", parents=[common],
                   help="open access blockers, their counts, and the remedy for each")
    return ap


def main(argv=None):
    a = build_parser().parse_args(argv)
    try:
        _payload, code = COMMANDS[a.cmd](a)
        return code
    except store.NoStore as e:
        # Credentials are the one failure with a single known fix, so it gets its own exit.
        print(f"cannot run `{a.cmd}`: {e}\n"
              "  Put SUPABASE_URL and SUPABASE_SERVICE_KEY in video-research/.env "
              "(the droplet's /root/lmc-desk/.env already has them), then re-run "
              f"`{PROG} {a.cmd}`.\n"
              f"  `{PROG} import-transcripts --path <dir> --dry-run` and "
              "`python3 tests/test_acceptance.py` need no credentials.", file=sys.stderr)
        return 2
    except FileNotFoundError as e:
        print(f"cannot run `{a.cmd}`: {e}", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        # Everything underneath checkpoints per item, so an interrupt costs one unit of work.
        print(f"\ninterrupted. Progress is checkpointed — resume with `{PROG} {a.cmd}`, "
              f"and see `{PROG} status`.", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())
