"""Historical call ledger — what was said, when a viewer could first act on it, how it scored.

(spec §11 call ledger, §12 news/wallet timeline; acceptance tests §22.8, §22.9, §22.12)

Four lies this module exists to make unrepresentable:

  1. THE PRE-PUBLICATION ENTRY. A backtest that fills at the moment a presenter spoke is
     trading on a recording nobody could see. receivable_at is the earliest a VIEWER could
     have acted, and for an upload that can never precede publication — enforced, not
     documented (receivable_time raises PrePublicationError rather than clamping, because
     a clamp would hide the edit that caused it).
  2. ONE TRADE SCORED AS FIVE WINS. A presenter who updates a call four times leaves five
     rows. score_summary counts update_groups, so that trade is one outcome (§22.9).
  3. THE TIDY TRACK RECORD. Losing, cancelled and unscorable calls stay in the table.
     Deleting or re-labelling them is forbidden (brief §3), so unscorable is reported on
     its own axis and is never folded into a win or a loss, and a win rate is withheld
     entirely whenever the denominator still contains open or unscored groups.
  4. SEQUENCE PRESENTED AS CAUSATION. link_news will not record that a presenter cited an
     event unless the citation text is actually present; without it the claim degrades to
     association_only (brief §12).

Everything reaching this module out of a video — titles, descriptions, transcript text,
excerpts — is UNTRUSTED DATA. It is stored and quoted, never interpreted as instruction.
Nothing here places an order, sizes a position or touches a risk limit.
"""
import argparse
import datetime
import json
import re
import urllib.parse

import store

LEDGER_VERSION = "vr-calls-1"
UTC = datetime.timezone.utc

CALL_TYPES = ("actionable", "conditional", "opinion", "hindsight", "unscorable")
OUTCOMES = ("win", "loss", "flat", "cancelled", "unscorable", "open")
DIRECTIONS = ("long", "short", "flat", "none")
RELATIONSHIPS = ("presenter_cites_event", "event_preceded_call_rationale_unstated",
                 "event_followed_call", "association_only", "no_documented_connection")

# Segment timing inside a stream is approximate: the VOD is trimmed at the front, the
# player clock drifts, and t_ms comes from a caption cue, not from a tape counter.
LIVE_UNCERTAINTY_S = 300
# No live_start_at means we do not know when the words were said in public at all. The band
# has to cover a whole day rather than pretend to the same 5 minutes.
STREAM_UNKNOWN_UNCERTAINTY_S = 86_400
# upload_date is DATE-only (captions._metadata lands it at midnight UTC), so the true
# publication is somewhere in the following 24h — always LATER, never earlier.
DAY_PRECISION_UNCERTAINTY_S = 86_400
MIN_CITATION_CHARS = 12


class PrePublicationError(ValueError):
    """A receivable time landed before the content was public. Never caught internally."""


class CohortDrift(ValueError):
    """A frozen cohort was re-frozen with different members. Re-selection after the fact is
    the whole failure mode freezing exists to stop."""


# --------------------------------------------------------------------------
# time
# --------------------------------------------------------------------------
def _dt(value):
    """Parse a stored timestamptz. A missing value stays None — never 'now', never a guess."""
    if value in (None, "", "null"):
        return None
    if isinstance(value, datetime.datetime):
        return value.astimezone(UTC) if value.tzinfo else value.replace(tzinfo=UTC)
    s = str(value).strip().replace(" ", "T")
    if s.endswith(("Z", "z")):
        s = s[:-1] + "+00:00"
    s = re.sub(r"([+-]\d{2})$", r"\1:00", s)          # postgres emits '+00', not '+00:00'
    s = re.sub(r"(\.\d{6})\d+", r"\1", s)             # trim ns to µs
    try:
        d = datetime.datetime.fromisoformat(s)
    except ValueError:
        return None
    return d.astimezone(UTC) if d.tzinfo else d.replace(tzinfo=UTC)


def published_precision(video):
    """'second' | 'day' | 'none'.

    captions.py measures this and files it in the METADATA_ONLY stage detail, so an explicit
    key on the video row (or load_video's lookup) is authoritative. The midnight-UTC fallback
    is a heuristic and is deliberately biased toward 'day': mistaking a real midnight publish
    for day precision only WIDENS the uncertainty band, while the reverse would narrow it and
    hand a backtest a fill it never earned.
    """
    explicit = (video or {}).get("published_precision")
    if explicit in ("second", "day", "none"):
        return explicit
    p = _dt((video or {}).get("published_at"))
    if p is None:
        return "none"
    return "day" if (p.hour, p.minute, p.second, p.microsecond) == (0, 0, 0, 0) else "second"


def _offset(t_ms):
    """Offset into the video, as a timedelta. Kept as its own seam so the pre-publication
    guard below can be proven to fire rather than assumed unreachable."""
    return datetime.timedelta(milliseconds=float(t_ms or 0))


def receivable_time(video, t_ms):
    """(iso_time, basis, uncertainty_seconds) — the earliest a viewer could ACT (spec §11).

    THE RULE (§22.8): content cannot be received before it is public. When the video was
    recorded is irrelevant; only publication and, for a stream, the live broadcast make a
    segment reachable.

      upload / short   published_at + t_ms. Day-level publication widens the band by a day.
      livestream       live_start_at + t_ms when the start is known (±LIVE_UNCERTAINTY_S,
                       because within-stream segment timing is approximate). A live viewer
                       legitimately receives a segment before the VOD is published, so this
                       branch is NOT floored at published_at — it is floored at live_start_at.
      livestream, no start   fall back to published_at + t_ms with a LARGE band and
                       basis='stream_start_unknown'. An honest wide answer, not a precise wrong one.
      nothing anchored  (None, 'unknown_no_public_time', None). A call with no public time
                       is unscorable; it is not given one.

    t_ms=None means the position inside the video was never established: the offset is taken
    as 0 and the band is widened to the video's duration instead of inventing a position.
    """
    video = video or {}
    if t_ms is not None and (not isinstance(t_ms, (int, float)) or t_ms < 0):
        raise ValueError(f"t_ms must be a non-negative offset, got {t_ms!r}")
    offset = _offset(t_ms)
    duration_s = video.get("duration_s") or 0
    unknown_offset = t_ms is None

    published = _dt(video.get("published_at"))
    live_start = _dt(video.get("live_start_at"))
    vtype = video.get("video_type") or "unknown"

    if vtype == "livestream" and live_start is not None:
        at = live_start + offset
        basis, band = "live_start_plus_offset", LIVE_UNCERTAINTY_S
        if at < live_start:                     # unreachable while offset >= 0; here to fail loudly
            raise PrePublicationError(f"{video.get('video_id')}: receivable before live start")
    elif vtype == "livestream":
        if published is None:
            return None, "unknown_no_public_time", None
        at = published + offset
        basis, band = "stream_start_unknown", max(STREAM_UNKNOWN_UNCERTAINTY_S, int(duration_s))
    else:
        if published is None:
            return None, "unknown_no_public_time", None
        at = published + offset
        precision = published_precision(video)
        if precision == "day":
            basis, band = "published_plus_offset_day_precision", DAY_PRECISION_UNCERTAINTY_S
        else:
            basis, band = "published_plus_offset", 0
        # THE INVARIANT (§22.8). Not an `assert`: python -O strips those, and this is the one
        # check standing between the ledger and a fill nobody could have taken.
        if at < published:
            raise PrePublicationError(
                f"{video.get('video_id')}: receivable {at.isoformat()} precedes publication "
                f"{published.isoformat()}")

    if unknown_offset:
        basis += "_offset_unknown"
        band = max(band, int(duration_s))
    return at.isoformat(), basis, int(band)


def conservative_entry_at(video, t_ms):
    """The time an EVALUATION must use as the earliest fill. Not the same as receivable_at.

    receivable_at answers §11's question — "earliest time the call could actually be
    received" — so for a day-precision upload it is midnight plus the offset. That is the
    honest earliest bound, but it is the OPTIMISTIC edge of the band: if the video actually
    went out at 14:00, midnight is fourteen hours early, and a backtest that entered at
    receivable_at would take a fill nobody could have taken. The invariant in
    receivable_time() cannot catch that, because midnight IS published_at as we stored it.

    So evaluation uses the LATE edge: receivable_at + the uncertainty band. Where publication
    is known to the second the band is 0 and the two answers coincide; where it is not, we
    pay the whole day rather than claim a precision we do not have.

    Returns (iso_time, basis, band_seconds), or (None, basis, None) when nothing is anchored.
    Any backtest of a video-derived call MUST take its entry from here, never from
    vr_calls.receivable_at (spec §11, §17, acceptance test §22.8).
    """
    at, basis, band = receivable_time(video, t_ms)
    if at is None:
        return None, basis, None
    late = _dt(at) + datetime.timedelta(seconds=int(band or 0))
    return late.isoformat(), basis + "_late_edge", int(band or 0)


# --------------------------------------------------------------------------
# reads
# --------------------------------------------------------------------------
def _q(value):
    return urllib.parse.quote(str(value), safe="")


def load_video(video_id):
    """vr_videos row plus the published_at precision captions.py actually measured.

    The precision lives in the METADATA_ONLY stage detail rather than a column; reading it
    beats re-deriving it from the timestamp, which is only ever a guess.
    """
    rows = store.get("vr_videos", "select=video_id,video_type,published_at,live_start_at,"
                                  f"duration_s,availability&video_id=eq.{_q(video_id)}&limit=1")
    if not rows:
        raise KeyError(f"no vr_videos row {video_id}")
    v = dict(rows[0])
    st = store.get("vr_video_stages", f"select=detail&video_id=eq.{_q(video_id)}"
                                      "&stage=eq.METADATA_ONLY&limit=1")
    m = re.search(r"precision=(second|day|none)", (st[0].get("detail") or "") if st else "")
    if m:
        v["published_precision"] = m.group(1)
    return v


def _rows(table, query, page=1000):
    """Page through PostgREST rather than trusting its default cap — a truncated read here
    would silently shrink a denominator."""
    out, offset = [], 0
    while True:
        chunk = store.get(table, f"{query}&limit={page}&offset={offset}")
        if not isinstance(chunk, list) or not chunk:
            return out
        out.extend(chunk)
        # Advance by what came back, not by what was asked for: a server-side max-rows cap
        # returns a SHORT page that is not the end of the table, and treating it as the end
        # silently shrinks the denominator a win rate is divided by.
        offset += len(chunk)


def _filter_query(filters):
    """{'asset': 'BTC', 'call_type': ['actionable','conditional'], 'published_at': ('gte', iso)}

    A 2-tuple whose first element is a PostgREST operator is read as (op, value); anything
    else iterable becomes an in.() set. Filters only narrow — they never change how a group
    is counted, so no filter can turn a loss into a smaller denominator.
    """
    parts = []
    for col, val in sorted((filters or {}).items()):
        if isinstance(val, (list, tuple)) and len(val) == 2 and isinstance(val[0], str) \
                and val[0] in ("eq", "neq", "gt", "gte", "lt", "lte", "like", "is"):
            parts.append(f"{col}={val[0]}.{_q(val[1])}")
        elif isinstance(val, (list, tuple, set)):
            parts.append(f"{col}=in.({','.join(_q(v) for v in sorted(val))})")
        elif val is None:
            parts.append(f"{col}=is.null")
        else:
            parts.append(f"{col}=eq.{_q(val)}")
    return "&".join(parts)


# --------------------------------------------------------------------------
# writes
# --------------------------------------------------------------------------
def call_id_for(video_id, t_ms, asset, direction):
    """Deterministic: re-extracting the same statement UPDATES the row instead of minting a
    second copy of the same claim (spec §5 idempotency)."""
    return store.stable_id(video_id, t_ms, asset, direction)


def group_id_for(video_or_thread, asset, direction, horizon):
    """All updates to ONE trade share this. Scoring counts groups, not rows (§22.9)."""
    return store.stable_id(video_or_thread, asset, direction, horizon)


def _existing_group(call_id):
    """The update_group already stored for this call, if any.

    A re-extraction re-derives the group from (video, asset, direction, horizon), which
    would silently detach a call that link_update had joined to a cross-video thread — and a
    detached update scores as a second trade (§22.9). The stored group wins.
    """
    rows = store.get("vr_calls", f"select=update_group&call_id=eq.{_q(call_id)}&limit=1")
    return rows[0].get("update_group") if rows else None


def _missing_scoring_inputs(row):
    """What a scorer would have to invent. Named, not silently defaulted (spec §8)."""
    gaps = []
    if not (row.get("entry_zone") or row.get("entry_condition")):
        gaps.append("entry")
    if not row.get("invalidation"):
        gaps.append("invalidation")
    if not row.get("target"):
        gaps.append("target")
    if not row.get("horizon"):
        gaps.append("horizon")
    if not row.get("receivable_at"):
        gaps.append("receivable_at")
    return gaps


def record_call(video_id, t_ms, asset, direction, call_type, video=None, presenter_key=None,
                product=None, entry_condition=None, entry_zone=None, invalidation=None,
                target=None, horizon=None, stated_confidence=None, conditional=None,
                still_available_after=None, outcome=None, outcome_note=None,
                update_group=None, thread=None, missing_info=None):
    """Upsert one call into vr_calls. Idempotent on call_id (spec §11).

    `video` may be a dict (offline / already loaded); otherwise the row is read from
    vr_videos so receivable_at is derived from stored publication facts, not from the caller.
    """
    if call_type not in CALL_TYPES:
        raise ValueError(f"call_type must be one of {CALL_TYPES}, got {call_type!r}")
    if outcome is not None and outcome not in OUTCOMES:
        raise ValueError(f"outcome must be one of {OUTCOMES}, got {outcome!r}")
    if direction is not None and direction not in DIRECTIONS:
        raise ValueError(f"direction must be one of {DIRECTIONS}, got {direction!r}")

    v = video if video is not None else load_video(video_id)
    receivable_at, basis, uncertainty = receivable_time(v, t_ms)
    call_id = call_id_for(video_id, t_ms, asset, direction)
    if update_group is None and thread is None:
        update_group = _existing_group(call_id)

    row = {
        "call_id": call_id,
        "video_id": video_id,
        "presenter_key": presenter_key or "unknown",   # spec §9: a guess is not a name
        "t_ms": t_ms,
        "published_at": _iso_or_none(v.get("published_at")),
        "receivable_at": receivable_at,
        "receivable_basis": basis,
        "receivable_uncertainty_s": uncertainty,
        "asset": asset,
        "product": product,
        "direction": direction,
        "call_type": call_type,
        "conditional": bool(call_type == "conditional" if conditional is None else conditional),
        "entry_condition": entry_condition,
        "entry_zone": entry_zone,
        "invalidation": invalidation,
        "target": target,
        "horizon": horizon,
        "stated_confidence": stated_confidence,
        "still_available_after": still_available_after,
        "update_group": update_group or group_id_for(thread or video_id, asset, direction, horizon),
        "outcome": outcome,
        "outcome_note": outcome_note,
    }
    gaps = sorted(set(list(missing_info or []) + _missing_scoring_inputs(row)))
    row["missing_info"] = gaps

    # A win or a loss asserts that an entry filled and an exit resolved. Without a stored
    # entry and a stored exit rule that assertion is unverifiable, so it is refused rather
    # than recorded and later quoted as a track record (brief §3). still_available_after
    # =False says the entry was gone by the time a viewer could act: whatever that trade
    # did afterwards, nobody could take it, so it is not our win and not our loss (§22.8).
    if outcome in ("win", "loss"):
        blocking = [g for g in gaps if g in ("entry", "receivable_at")] + \
                   ([] if (invalidation or target) else ["invalidation_or_target"]) + \
                   (["entry_unreachable_after_publication"]
                    if still_available_after is False else [])
        if blocking:
            raise ValueError(f"outcome={outcome} refused for {row['call_id']}: "
                             f"blocked by {sorted(set(blocking))} — score it 'unscorable' "
                             "instead")
    store.upsert("vr_calls", [row], "call_id")
    return row


def _iso_or_none(value):
    d = _dt(value)
    return d.isoformat() if d else None


def link_update(prev_call_id, new_call_id):
    """Chain an update onto an earlier call: prev.superseded_by = new, shared update_group.

    Updates arrive out of order, so the chain is walked to its tail before linking — a
    second link onto an already-superseded call would fork the group and the fork would
    score as two trades (§22.9). Idempotent.
    """
    if prev_call_id == new_call_id:
        raise ValueError("a call cannot supersede itself")
    tail, seen = prev_call_id, set()
    while True:
        if tail in seen:
            raise ValueError(f"cycle in update chain at {tail}")
        seen.add(tail)
        rows = store.get("vr_calls", "select=call_id,superseded_by,update_group"
                                     f"&call_id=eq.{_q(tail)}&limit=1")
        if not rows:
            raise KeyError(f"no vr_calls row {tail}")
        nxt = rows[0].get("superseded_by")
        if not nxt or nxt == new_call_id:
            break
        tail = nxt
    # Walk FORWARD from the new call before linking. Two things are only visible from this
    # side: a new_call_id that does not exist (the patch below would write a dangling
    # superseded_by), and a new call that already leads back to the tail — closing the loop
    # leaves the group with no terminal call at all, and score_summary can then never
    # resolve it again (§22.9).
    node, walked = new_call_id, set()
    while node and node not in walked:
        walked.add(node)
        if node == tail:
            raise ValueError(f"{new_call_id} already precedes {tail} in this chain")
        nrows = store.get("vr_calls", "select=call_id,superseded_by"
                                      f"&call_id=eq.{_q(node)}&limit=1")
        if not nrows:
            raise KeyError(f"no vr_calls row {node}")
        node = nrows[0].get("superseded_by")

    group = rows[0].get("update_group")
    store.patch("vr_calls", f"call_id=eq.{_q(tail)}", {"superseded_by": new_call_id})
    if group:
        store.patch("vr_calls", f"call_id=eq.{_q(new_call_id)}", {"update_group": group})
    return {"superseded": tail, "supersedes_with": new_call_id, "update_group": group}


# --------------------------------------------------------------------------
# scoring (spec §11, §22.9)
# --------------------------------------------------------------------------
SCORE_COLS = ("call_id,video_id,presenter_key,asset,direction,call_type,update_group,"
              "superseded_by,outcome,published_at,receivable_at,receivable_basis,missing_info")


def score_summary(filters=None, rows=None):
    """Counts by call_type and outcome, with the actionable denominator counted ONCE per trade.

    Rules encoded here, all of them from the brief:
      * an update_group is ONE outcome, however many times the presenter revised it (§22.9).
        The group's outcome is the terminal call — the one nothing supersedes.
      * 'unscorable' is reported on its own axis. It is never a win and never a loss.
      * cancelled and losing groups are counted and kept. Deleting or relabelling them is
        forbidden (brief §3); this function has no delete path by design.
      * a win rate is emitted ONLY when every group has a settled outcome. Open, unscored,
        unscorable or unlinked-fork groups leave the denominator unknown, and an unknown
        denominator forbids a percentage — the note says which, rather than rounding it away.
    """
    if rows is None:
        q = _filter_query(filters)
        rows = _rows("vr_calls", f"select={SCORE_COLS}" + (f"&{q}" if q else ""))

    by_type, by_outcome_rows = {}, {}
    for r in rows:
        by_type[r.get("call_type") or "unset"] = by_type.get(r.get("call_type") or "unset", 0) + 1
        k = r.get("outcome") or "unscored"
        by_outcome_rows[k] = by_outcome_rows.get(k, 0) + 1

    groups = {}
    for r in rows:
        if r.get("call_type") != "actionable":
            continue
        # A call with no group is its own group: one trade, not zero (never merged with others).
        groups.setdefault(r.get("update_group") or f"call:{r['call_id']}", []).append(r)

    tally = {k: 0 for k in ("win", "loss", "flat", "cancelled", "open", "unscored", "unscorable")}
    unresolved = []
    for gid, members in groups.items():
        terminal = [m for m in members if not m.get("superseded_by")]
        if len(terminal) != 1:
            # Either every member is superseded (a cycle) or several are live (an unlinked
            # fork). Both mean the trade's final state is unknown; it is not guessed.
            unresolved.append(gid)
            continue
        tally[terminal[0].get("outcome") or "unscored"] += 1

    settled = tally["win"] + tally["loss"] + tally["flat"]
    blockers = [k for k in ("open", "unscored", "unscorable") if tally[k]]
    if unresolved:
        blockers.append(f"unresolved_groups({len(unresolved)})")
    if blockers:
        win_rate, note = None, ("denominator incomplete: " + ", ".join(blockers) +
                                " — percentage withheld")
    elif settled == 0:
        win_rate, note = None, "no settled groups: nothing to divide by"
    else:
        win_rate = round(tally["win"] / settled, 4)
        note = (f"win/(win+loss+flat) over {settled} update_groups; "
                f"{tally['cancelled']} cancelled group(s) excluded from the ratio as never "
                "entered, and retained in the counts")

    return {
        "ledger_version": LEDGER_VERSION,
        "filters": filters or {},
        "rows": len(rows),
        "by_call_type": by_type,
        "by_outcome_rows": by_outcome_rows,          # raw rows: updates counted many times
        "actionable": {
            "rows": sum(1 for r in rows if r.get("call_type") == "actionable"),
            "groups": len(groups),                   # THE denominator (§22.9)
            "by_outcome": tally,
            "unscorable": tally["unscorable"],       # separate axis, never folded in
            "unresolved_groups": unresolved,
        },
        "win_rate": win_rate,
        "win_rate_note": note,
        "at": store.utcnow(),
    }


# --------------------------------------------------------------------------
# news / wallet timeline (spec §12)
# --------------------------------------------------------------------------
def link_news(call_id, relationship, primary_source=None, event_at=None, published_at=None,
              received_at=None, statement_t_ms=None, wallet_observation=None,
              price_when_actionable=None, spread_bps=None, note=None, excerpt=None,
              video_id=None):
    """Attach a news/wallet observation to a call under an explicit relationship.

    THE GUARD (brief §12): 'presenter_cites_event' is a claim about what the presenter SAID.
    It requires the citation itself — a quoted excerpt or a note carrying it — plus a named
    primary source. Without both, the row is written as 'association_only' with the downgrade
    recorded in the note. Sequence is not causation, so the relationship is never inferred
    from timestamps; the caller must choose one and the choice is stored verbatim.
    """
    if relationship not in RELATIONSHIPS:
        raise ValueError(f"relationship must be one of {RELATIONSHIPS}, got {relationship!r}")
    citation = (excerpt or "").strip()
    body = (note or "").strip()
    downgraded_from = None

    if relationship == "presenter_cites_event":
        evidence = citation or body
        if len(evidence) < MIN_CITATION_CHARS or not (primary_source or "").strip():
            downgraded_from, relationship = "presenter_cites_event", "association_only"

    parts = []
    if citation:
        parts.append(f'cites: "{citation}"')          # untrusted quote, stored as data
    if body:
        parts.append(body)
    if downgraded_from:
        parts.append(f"DOWNGRADED from {downgraded_from}: no citation text and/or no named "
                     "primary source; sequence alone is not causation (spec §12)")

    row = {
        "id": int(store.stable_id(call_id, primary_source, event_at, statement_t_ms,
                                  relationship)[:15], 16),
        "call_id": call_id,
        "video_id": video_id,
        "primary_source": primary_source,
        "event_at": _iso_or_none(event_at),
        "published_at": _iso_or_none(published_at),
        "received_at": _iso_or_none(received_at),
        "statement_t_ms": statement_t_ms,
        "wallet_observation": wallet_observation,
        "price_when_actionable": price_when_actionable,
        "spread_bps": spread_bps,
        "relationship": relationship,
        "note": "; ".join(parts) or None,
    }
    store.upsert("vr_news_links", [row], "id")
    return dict(row, downgraded_from=downgraded_from)


# --------------------------------------------------------------------------
# cohort freeze (spec §12, §22.12)
# --------------------------------------------------------------------------
def freeze_cohort(name, wallet_ids, frozen_at=None, controls=None, note=None,
                  supersede_reason=None):
    """Freeze a wallet cohort with a REAL timestamp, before any outcome is measured.

    WHY THIS EXISTS (brief §12, test §22.12): a cohort chosen after the returns are known is
    not a finding, it is a filter. Two disciplines make the difference checkable:

      * SELECTION PRECEDES EVALUATION. The freeze is stored with the wall-clock time it was
        actually taken. A frozen_at in the future is rejected; a back-dated one is stored and
        flagged rather than trusted. Re-freezing the same name with different members raises
        CohortDrift — silently swapping members is the exact failure being prevented — and a
        deliberate change must pass supersede_reason, which appends a NEW row and never edits
        or deletes the original.
      * LOSING AND RANDOM CONTROLS ARE PART OF THE COHORT. A set containing only wallets that
        already did well measures nothing but survivorship. `controls` must name the losing /
        randomly-drawn members; an empty control set stores the freeze with passed=false so
        the gap is visible in the quality report instead of being discovered later.

    The freeze lands in vr_quality_checks (check_key='cohort_freeze') and in an append-only
    local file, so the stored membership can be compared with whatever gets evaluated.
    """
    members = sorted({str(w).strip() for w in (wallet_ids or []) if str(w).strip()})
    if not members:
        raise ValueError("a cohort with no members cannot be frozen")
    ctrl = sorted({str(w).strip() for w in (controls or []) if str(w).strip()})
    members_hash = store.sha256("\n".join(members))

    recorded = datetime.datetime.now(UTC)
    claimed = _dt(frozen_at) or recorded
    if claimed > recorded + datetime.timedelta(seconds=60):
        raise ValueError(f"frozen_at {claimed.isoformat()} is in the future: a freeze is a "
                         "record of something that happened, not a plan")
    backdated = claimed < recorded - datetime.timedelta(seconds=300)

    prior = [r for r in _rows("vr_quality_checks",
                              "select=id,at,observed,passed&check_key=eq.cohort_freeze"
                              "&order=at.desc")
             if (r.get("observed") or {}).get("name") == name]
    if prior:
        last = prior[0]["observed"]
        if last.get("members_hash") == members_hash:
            return dict(last, already_frozen=True, quality_check_id=prior[0]["id"])
        if not supersede_reason:
            raise CohortDrift(
                f"cohort {name!r} was frozen at {last.get('frozen_at')} with "
                f"{last.get('n_members')} members (hash {last.get('members_hash', '')[:12]}); "
                "refusing to re-freeze different members without supersede_reason")

    observed = {
        "name": name, "members_hash": members_hash, "n_members": len(members),
        "wallet_ids": members, "controls": ctrl, "n_controls": len(ctrl),
        "frozen_at": claimed.isoformat(), "recorded_at": recorded.isoformat(),
        "backdated": backdated, "supersede_reason": supersede_reason,
        "supersedes_hash": (prior[0]["observed"].get("members_hash") if prior else None),
        "note": note, "ledger_version": LEDGER_VERSION,
    }
    # Append-only local copy: the DB row can be patched, a file that already exists is not
    # rewritten, so the two disagreeing is itself the signal.
    d = store.CACHE / "cohorts"
    d.mkdir(parents=True, exist_ok=True)
    f = d / f"{re.sub(r'[^A-Za-z0-9_.-]+', '-', name)}-{members_hash[:12]}.json"
    if not f.exists():
        f.write_text(json.dumps(observed, indent=2, sort_keys=True))
    observed["local_ref"] = str(f)

    store.insert("vr_quality_checks", [{
        "check_key": "cohort_freeze", "at": recorded.isoformat(),
        "passed": bool(ctrl) and not backdated,
        "observed": observed,
        "note": ("frozen with losing/random controls" if ctrl else
                 "NO CONTROLS DECLARED: selection is survivorship-exposed (spec §22.12)") +
                ("; BACK-DATED freeze timestamp" if backdated else "")}])
    return dict(observed, already_frozen=False)


# --------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="video-research historical call ledger")
    ap.add_argument("cmd", choices=["score", "receivable"])
    ap.add_argument("--video")
    ap.add_argument("--presenter")
    ap.add_argument("--asset")
    ap.add_argument("--t-ms", type=int)
    a = ap.parse_args()
    try:
        if a.cmd == "receivable":
            v = load_video(a.video)
            at, basis, band = receivable_time(v, a.t_ms)
            out = {"video_id": a.video, "t_ms": a.t_ms, "receivable_at": at,
                   "receivable_basis": basis, "receivable_uncertainty_s": band, "video": v}
        else:
            f = {k: v for k, v in (("video_id", a.video), ("presenter_key", a.presenter),
                                   ("asset", a.asset)) if v}
            out = score_summary(f)
    except store.NoStore as e:
        print(json.dumps({"error": "no_store", "detail": str(e)}, indent=2))
        raise SystemExit(2)
    print(json.dumps(out, indent=2, default=str))


if __name__ == "__main__":
    main()
