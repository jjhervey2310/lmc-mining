"""Runner for quality.py — `python3 tests/test_acceptance.py`. No pytest, no network.

Every §22 check is exercised in BOTH directions. A check that cannot fail is not a check,
so each fixture pair is a clean case and a dirty case, and the dirty case must come back
state='fail' with the offending rows named in observed.

Store-backed checks cannot run here: without Supabase credentials there are no rows to
judge. They are printed SKIPPED with the reason, and the assertion made about them is that
quality.py reports them as state='skipped' — never as a pass. An unrun check that prints
PASS is the exact failure mode this file exists to prevent.
"""
import pathlib
import sys
import tempfile
import traceback

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
import quality  # noqa: E402
import store  # noqa: E402

CASES = []


class Skipped(Exception):
    """Raised by a case that genuinely could not run. Printed, never counted as a pass."""


def case(name):
    def deco(fn):
        CASES.append((name, fn))
        return fn
    return deco


# --------------------------------------------------------------------------
# helpers
# --------------------------------------------------------------------------
def one(key, **kw):
    """Run exactly one check through the real runner with fixtures injected."""
    kw.setdefault("tables", {})
    rs = quality.run_checks(only={key}, write=False, **kw)
    assert len(rs) == 1, f"expected 1 result, got {len(rs)}"
    return rs[0]


def expect(r, state, exercised=None, note_has=None, observed_has=None):
    assert r.state == state, f"state={r.state} (want {state}); note={r.note}"
    if exercised is not None:
        got = bool(r.observed.get("case_exercised"))
        assert got == exercised, f"case_exercised={got} (want {exercised})"
    if note_has:
        assert note_has in (r.note or ""), f"note={r.note!r} lacks {note_has!r}"
    for path, want in (observed_has or {}).items():
        node = r.observed
        for p in path.split("."):
            node = node[p]
        assert node == want, f"observed.{path}={node!r} (want {want!r})"
    return r


def tmp_module(src):
    d = tempfile.mkdtemp(prefix="vrq-")
    p = pathlib.Path(d) / "probe_module.py"
    p.write_text(src)
    return p


UTC = "2026-01-0{}T00:00:00+00:00"
BANTER = "UCN9Nj4tjXbVTLYWN0EKly_Q"          # a confirmed channel, per sources.py


# ==========================================================================
# 22.1
# ==========================================================================
PL = [{"playlist_id": "PL1", "video_id": "v1"}, {"playlist_id": "PL1", "video_id": "v2"}]


@case("22.1  playlist+channel overlap dedupes to one video row")
def _():
    r = one("dedupe_playlist_channel", tables={
        "vr_playlist_members": PL,
        "vr_videos": [{"video_id": "v1", "channel_id": BANTER},
                      {"video_id": "v2", "channel_id": BANTER}]})
    expect(r, "pass", exercised=True,
           observed_has={"in_playlist_and_channel": 2, "duplicate_video_rows.count": 0})


@case("22.1  a playlist video with no vr_videos row FAILS")
def _():
    r = one("dedupe_playlist_channel", tables={
        "vr_playlist_members": PL,
        "vr_videos": [{"video_id": "v1", "channel_id": BANTER}]})
    expect(r, "fail", observed_has={"missing_video_row.sample": ["v2"]})


@case("22.1  two vr_videos rows for one id FAILS")
def _():
    r = one("dedupe_playlist_channel", tables={
        "vr_playlist_members": PL[:1],
        "vr_videos": [{"video_id": "v1", "channel_id": BANTER},
                      {"video_id": "v1", "channel_id": BANTER}]})
    expect(r, "fail", observed_has={"duplicate_video_rows.sample": ["v1"]})


@case("22.1  no overlap passes but is marked NOT exercised")
def _():
    r = one("dedupe_playlist_channel", tables={
        "vr_playlist_members": PL[:1],
        "vr_videos": [{"video_id": "v1", "channel_id": "UCsomewhereelse"}]})
    expect(r, "pass", exercised=False, note_has="not exercised")


@case("22.1  empty table is vacuous, not a pass")
def _():
    expect(one("dedupe_playlist_channel"), "vacuous", exercised=False,
           note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.2
# ==========================================================================
ROW = {"video_id": "v1", "stage": "DISCOVERED", "state": "done",
       "detail": None, "updated_at": UTC.format(1)}
PROBE_OK = {"table": "vr_video_stages", "on_conflict": "video_id,stage",
            "before": 7, "after": 7, "matched_rows": 1,
            "row_before": ROW, "row_after": dict(ROW)}


@case("22.2  identical re-upsert leaves count and content unchanged")
def _():
    expect(one("resume_no_duplication", probe=PROBE_OK), "pass",
           observed_has={"count_unchanged": True, "content_unchanged": True})


@case("22.2  a re-upsert that adds a row FAILS")
def _():
    expect(one("resume_no_duplication", probe=dict(PROBE_OK, after=8)), "fail",
           note_has="changed the table")


@case("22.2  a re-upsert that mutates the row FAILS")
def _():
    bad = dict(PROBE_OK, row_after=dict(ROW, state="pending"))
    expect(one("resume_no_duplication", probe=bad), "fail")


@case("22.2  a re-upsert leaving two matching rows FAILS")
def _():
    expect(one("resume_no_duplication", probe=dict(PROBE_OK, matched_rows=2)), "fail")


@case("22.2  nothing to re-upsert is vacuous")
def _():
    expect(one("resume_no_duplication", probe=lambda d: None), "vacuous",
           note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.3
# ==========================================================================
GONE_TABLES = {
    "vr_videos": [{"video_id": "v1", "availability": "private"},
                  {"video_id": "v2", "availability": "deleted"}],
    "vr_video_stages": [{"video_id": "v1", "stage": "UNAVAILABLE", "state": "unavailable"},
                        {"video_id": "v2", "stage": "UNAVAILABLE", "state": "unavailable"}],
    "vr_access_blockers": [{"video_id": "v1", "kind": "private"},
                           {"video_id": "v2", "kind": "deleted"}]}


@case("22.3  private/deleted videos keep row, stage and blocker")
def _():
    expect(one("unavailable_stays_gap", tables=GONE_TABLES), "pass", exercised=True)


@case("22.3  a missing UNAVAILABLE stage FAILS")
def _():
    t = dict(GONE_TABLES, vr_video_stages=GONE_TABLES["vr_video_stages"][:1])
    expect(one("unavailable_stays_gap", tables=t), "fail",
           observed_has={"missing_unavailable_stage.sample": ["v2"]})


@case("22.3  a missing access blocker FAILS")
def _():
    t = dict(GONE_TABLES, vr_access_blockers=GONE_TABLES["vr_access_blockers"][:1])
    expect(one("unavailable_stays_gap", tables=t), "fail",
           observed_has={"missing_access_blocker.sample": ["v2"]})


@case("22.3  a stage row whose video row was dropped FAILS")
def _():
    t = dict(GONE_TABLES)
    t["vr_video_stages"] = GONE_TABLES["vr_video_stages"] + [
        {"video_id": "vGONE", "stage": "UNAVAILABLE", "state": "unavailable"}]
    expect(one("unavailable_stays_gap", tables=t), "fail",
           observed_has={"stage_without_video_row.sample": ["vGONE"]})


@case("22.3  no unavailable videos is vacuous")
def _():
    expect(one("unavailable_stays_gap", tables={
        "vr_videos": [{"video_id": "v1", "availability": "public"}]}),
        "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.4
# ==========================================================================
M1 = [{"method_id": "m1", "classification": "PARTIALLY_SPECIFIED"}]
EX1 = [{"method_id": "m1", "video_id": "v1", "t_start_ms": 1000}]


@case("22.4  a method backed by a transcript passes")
def _():
    expect(one("no_transcript_no_summary", tables={
        "vr_methods": M1, "vr_method_excerpts": EX1,
        "vr_transcripts": [{"video_id": "v1"}]}), "pass")


@case("22.4  a method backed only by a chart observation passes")
def _():
    expect(one("no_transcript_no_summary", tables={
        "vr_methods": M1, "vr_method_excerpts": EX1,
        "vr_chart_observations": [{"video_id": "v1"}]}), "pass")


@case("22.4  a method whose video has neither FAILS")
def _():
    expect(one("no_transcript_no_summary", tables={
        "vr_methods": M1, "vr_method_excerpts": EX1}), "fail",
        observed_has={"method_without_transcript_or_chart.count": 1})


@case("22.4  a method with no video link at all FAILS")
def _():
    expect(one("no_transcript_no_summary", tables={
        "vr_methods": M1, "vr_transcripts": [{"video_id": "v1"}]}), "fail",
        observed_has={"method_without_video_link.sample": ["m1"]})


@case("22.4  no methods is vacuous")
def _():
    expect(one("no_transcript_no_summary"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.5
# ==========================================================================
@case("22.5  unresolved chart rule classified PARTIALLY_SPECIFIED passes")
def _():
    expect(one("chart_rule_incomplete", tables={"vr_methods": [
        {"method_id": "m1", "classification": "PARTIALLY_SPECIFIED",
         "chart_dependent": True, "visual_resolved": False}]}), "pass", exercised=True)


@case("22.5  unresolved chart rule claiming PRECISE_AND_TESTABLE FAILS")
def _():
    expect(one("chart_rule_incomplete", tables={"vr_methods": [
        {"method_id": "m1", "classification": "PRECISE_AND_TESTABLE",
         "chart_dependent": True, "visual_resolved": False}]}), "fail",
        observed_has={"testable_without_visual.sample": ["m1"]})


@case("22.5  a RESOLVED chart rule may be PRECISE_AND_TESTABLE")
def _():
    expect(one("chart_rule_incomplete", tables={"vr_methods": [
        {"method_id": "m1", "classification": "PRECISE_AND_TESTABLE",
         "chart_dependent": True, "visual_resolved": True}]}), "pass", exercised=False)


@case("22.5  no methods is vacuous")
def _():
    expect(one("chart_rule_incomplete"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.6
# ==========================================================================
@case("22.6  an ambiguous claim with a note passes")
def _():
    expect(one("numeric_uncertainty_kept", tables={"vr_numeric_claims": [
        {"id": 1, "ambiguous": True, "ambiguity_note": "'42' could be price or RSI",
         "raw_text": "forty two"}]}), "pass", exercised=True)


@case("22.6  an ambiguous claim with a blank note FAILS")
def _():
    expect(one("numeric_uncertainty_kept", tables={"vr_numeric_claims": [
        {"id": 1, "ambiguous": True, "ambiguity_note": "  ", "raw_text": "forty two"}]}),
        "fail", observed_has={"missing_note.sample": [1]})


@case("22.6  unambiguous claims need no note")
def _():
    expect(one("numeric_uncertainty_kept", tables={"vr_numeric_claims": [
        {"id": 1, "ambiguous": False, "ambiguity_note": None, "raw_text": "65000"}]}),
        "pass", exercised=False)


@case("22.6  no claims is vacuous")
def _():
    expect(one("numeric_uncertainty_kept"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.7
# ==========================================================================
def vp(**kw):
    base = {"video_id": "v1", "presenter_key": "sniper", "evidence": "channel UC8eh",
            "evidence_kind": "channel", "confidence": "probable"}
    return {"vr_video_presenters": [dict(base, **kw)]}


@case("22.7  an attribution with evidence passes")
def _():
    expect(one("presenter_attribution", tables=vp()), "pass")


@case("22.7  a blank evidence string FAILS")
def _():
    expect(one("presenter_attribution", tables=vp(evidence="   ")), "fail",
           observed_has={"missing_evidence.count": 1})


@case("22.7  kyle-doops from a bare 'Kyle' title FAILS")
def _():
    expect(one("presenter_attribution", tables=vp(
        presenter_key="kyle-doops", evidence_kind="title",
        evidence='title matched: "Kyle explains the altcoin cycle"')), "fail",
        observed_has={"kyle_by_name_match_alone.sample": ["v1"]})


@case("22.7  kyle-doops from a 'Doops' token is allowed")
def _():
    expect(one("presenter_attribution", tables=vp(
        presenter_key="kyle-doops", evidence_kind="title",
        evidence='title matched /\\bdoops\\b/: "Doops breaks down the setup"')), "pass")


@case("22.7  'confirmed' without transcript evidence FAILS")
def _():
    expect(one("presenter_attribution", tables=vp(
        presenter_key="kyle-doops", evidence_kind="title", confidence="confirmed",
        evidence='title matched /\\bdoops\\b/: "Doops live"')), "fail",
        observed_has={"kyle_confirmed_without_transcript.count": 1})


@case("22.7  a presenter_key outside the registry FAILS")
def _():
    expect(one("presenter_attribution", tables=vp(presenter_key="kyle-doop")), "fail",
           observed_has={"unregistered_presenter_key.sample": ["kyle-doop"]})


@case("22.7  no attributions is vacuous")
def _():
    expect(one("presenter_attribution"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.8
# ==========================================================================
@case("22.8  receivable after published passes")
def _():
    expect(one("no_prepublication_entry", tables={"vr_calls": [
        {"call_id": "c1", "published_at": UTC.format(1),
         "receivable_at": "2026-01-01T00:05:00+00:00"}]}), "pass")


@case("22.8  receivable BEFORE published FAILS")
def _():
    expect(one("no_prepublication_entry", tables={"vr_calls": [
        {"call_id": "c1", "published_at": UTC.format(2),
         "receivable_at": UTC.format(1)}]}), "fail",
        observed_has={"receivable_before_published.count": 1})


@case("22.8  an unparseable timestamp FAILS rather than silently comparing nothing")
def _():
    expect(one("no_prepublication_entry", tables={"vr_calls": [
        {"call_id": "c1", "published_at": UTC.format(1),
         "receivable_at": "sometime tuesday"}]}), "fail",
        observed_has={"unparseable_timestamp.sample": ["c1"]})


@case("22.8  a call with no receivable_at is counted, not judged")
def _():
    expect(one("no_prepublication_entry", tables={"vr_calls": [
        {"call_id": "c1", "published_at": UTC.format(1), "receivable_at": None}]}),
        "pass", observed_has={"without_receivable_at": 1})


@case("22.8  no calls is vacuous")
def _():
    expect(one("no_prepublication_entry"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.9
# ==========================================================================
@case("22.9  an update chain with one live call passes")
def _():
    expect(one("updates_not_double_counted", tables={"vr_calls": [
        {"call_id": "c1", "update_group": "g1", "superseded_by": "c2"},
        {"call_id": "c2", "update_group": "g1", "superseded_by": None}]}),
        "pass", exercised=True)


@case("22.9  two live calls in one update group FAILS")
def _():
    expect(one("updates_not_double_counted", tables={"vr_calls": [
        {"call_id": "c1", "update_group": "g1", "superseded_by": None},
        {"call_id": "c2", "update_group": "g1", "superseded_by": None}]}),
        "fail", observed_has={"groups_with_multiple_heads.count": 1})


@case("22.9  ungrouped calls pass but are marked NOT exercised")
def _():
    expect(one("updates_not_double_counted", tables={"vr_calls": [
        {"call_id": "c1", "update_group": None, "superseded_by": None}]}),
        "pass", exercised=False)


@case("22.9  no calls is vacuous")
def _():
    expect(one("updates_not_double_counted"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.10
# ==========================================================================
LOSSES = {"vr_calls": [{"call_id": "c1", "outcome": "loss", "superseded_by": None},
                       {"call_id": "c2", "outcome": "cancelled", "superseded_by": None},
                       {"call_id": "c3", "outcome": "win", "superseded_by": None}]}


@case("22.10  first observation records the no-delete baseline")
def _():
    expect(one("losing_calls_retained", tables=LOSSES), "pass",
           note_has="baseline", observed_has={"retained": 2})


@case("22.10  a drop in retained losing calls FAILS")
def _():
    expect(one("losing_calls_retained", tables=LOSSES,
               prior={"losing_calls_retained": {"retained": 5}}), "fail",
           note_has="fell from 5 to 2")


@case("22.10  a steady or growing count passes")
def _():
    expect(one("losing_calls_retained", tables=LOSSES,
               prior={"losing_calls_retained": {"retained": 2}}), "pass")


@case("22.10  superseded_by pointing at a vanished call FAILS")
def _():
    t = {"vr_calls": [{"call_id": "c1", "outcome": "loss", "superseded_by": "cGONE"}]}
    expect(one("losing_calls_retained", tables=t), "fail",
           observed_has={"dangling_superseded_by.sample": ["cGONE"]})


@case("22.10  no calls is vacuous")
def _():
    expect(one("losing_calls_retained"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.11
# ==========================================================================
@case("22.11  a researcher variant naming its parent passes")
def _():
    expect(one("researcher_variants_labelled", tables={"vr_methods": [
        {"method_id": "m1", "researcher_added": False, "is_variant_of": None},
        {"method_id": "m2", "researcher_added": True, "is_variant_of": "m1"}]}),
        "pass", exercised=True)


@case("22.11  a researcher method with no parent FAILS")
def _():
    expect(one("researcher_variants_labelled", tables={"vr_methods": [
        {"method_id": "m2", "researcher_added": True, "is_variant_of": None}]}),
        "fail", observed_has={"missing_is_variant_of.sample": ["m2"]})


@case("22.11  a parent that does not exist FAILS")
def _():
    expect(one("researcher_variants_labelled", tables={"vr_methods": [
        {"method_id": "m2", "researcher_added": True, "is_variant_of": "mGONE"}]}),
        "fail", observed_has={"is_variant_of_not_found.sample": ["m2"]})


@case("22.11  a method that is its own parent FAILS")
def _():
    expect(one("researcher_variants_labelled", tables={"vr_methods": [
        {"method_id": "m2", "researcher_added": True, "is_variant_of": "m2"}]}),
        "fail", observed_has={"is_variant_of_self.sample": ["m2"]})


@case("22.11  no methods is vacuous")
def _():
    expect(one("researcher_variants_labelled"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.12
# ==========================================================================
def wallet(**kw):
    n = {"id": 1, "call_id": "c1", "wallet_observation": "cohort of 12 whale wallets",
         "event_at": None, "received_at": UTC.format(1), "published_at": None}
    return {"vr_news_links": [dict(n, **kw)],
            "vr_calls": [{"call_id": "c1", "receivable_at": UTC.format(3),
                          "published_at": UTC.format(3)}]}


@case("22.12  a cohort frozen before the window passes")
def _():
    expect(one("wallet_cohort_frozen", tables=wallet()), "pass")


@case("22.12  a cohort with no freeze timestamp FAILS")
def _():
    expect(one("wallet_cohort_frozen", tables=wallet(received_at=None, event_at=None)),
           "fail", observed_has={"no_freeze_timestamp.sample": [1]})


@case("22.12  a cohort frozen after the window starts FAILS")
def _():
    expect(one("wallet_cohort_frozen", tables=wallet(received_at=UTC.format(5))),
           "fail", observed_has={"frozen_after_window_start.count": 1})


@case("22.12  a cohort whose window is unknown FAILS")
def _():
    t = wallet()
    t["vr_calls"] = []
    expect(one("wallet_cohort_frozen", tables=t), "fail",
           observed_has={"no_freeze_timestamp.count": 1})


@case("22.12  no wallet observations is vacuous")
def _():
    expect(one("wallet_cohort_frozen", tables={"vr_news_links": [
        {"id": 1, "call_id": "c1", "wallet_observation": None}]}),
        "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.13
# ==========================================================================
@case("22.13  hostile text is enveloped as data and no mutator is defined")
def _():
    expect(one("untrusted_text_inert"), "pass",
           observed_has={"order_or_risk_mutating_defs.count": 0})


@case("22.13  the hostile string survives inside the fence, it is not dropped")
def _():
    r = one("untrusted_text_inert")
    assert r.observed["hostile_occurrences"] >= 3, r.observed
    assert r.observed["fence_open_at"] < r.observed["fence_close_at"]


@case("22.13  a forged fence marker is scrubbed, not honoured")
def _():
    import extract
    p = extract.build_prompt(
        {"video_id": "vX", "title": quality.HOSTILE_FORGE, "description": ""},
        [{"t_start_ms": 0, "text": quality.HOSTILE_FORGE}])
    assert "[fence-removed]" in p, "the scrubber never fired"
    assert p.count("<<<") == 2, f"forged fence survived: {p.count('<<<')} markers"


@case("22.13  scan_defs DOES catch an order/risk mutator (detector can fail)")
def _():
    m = tmp_module("def place_order(x):\n    return x\n"
                   "def set_risk_limit(x):\n    return x\n"
                   "def coverage_report():\n    return 1\n")
    hits = quality.scan_defs([m])
    names = sorted(h["name"] for h in hits)
    assert names == ["place_order", "set_risk_limit"], names


@case("22.13  a comment or docstring naming a mutator is NOT a hit")
def _():
    m = tmp_module('"""This module must never place_order or set_risk_limit."""\n'
                   "# place_order / set_risk_limit are forbidden here\n"
                   "X = 1\n")
    assert quality.scan_defs([m]) == []


# ==========================================================================
# 22.14
# ==========================================================================
@case("22.14  the package imports no broker client and writes only vr_ tables")
def _():
    expect(one("no_auto_trade_path"), "pass",
           observed_has={"broker_imports.count": 0,
                         "writes_outside_vr_namespace.count": 0,
                         "forbidden_table_named_in_code.count": 0})


@case("22.14  every literal write target is in the vr_ namespace")
def _():
    r = one("no_auto_trade_path")
    off = [t for t in r.observed["literal_write_targets"] if not t.startswith("vr_")]
    assert not off, off
    assert len(r.observed["literal_write_targets"]) >= 10, r.observed


@case("22.14  a broker import IS caught (detector can fail)")
def _():
    m = tmp_module("import ccxt\nfrom binance.client import Client\n")
    s = quality.scan_writes([m])
    roots = {i["module"].split(".")[0] for i in s["imports"]}
    assert roots & set(quality.BROKER_MODULES) == {"ccxt", "binance"}, roots


@case("22.14  a write to a forbidden table IS caught (detector can fail)")
def _():
    # Names come from quality.FORBIDDEN_TABLES rather than being spelled out: a literal
    # forbidden table name in THIS file is itself a violation, and the detector proved it.
    a = quality.FORBIDDEN_TABLES[0]
    b = next(t for t in quality.FORBIDDEN_TABLES if t.startswith("desk"))
    m = tmp_module(f'import store\n'
                   f'def go(rows):\n'
                   f'    store.insert("{a}", rows)\n'
                   f'    store.patch("{b}", "id=eq.1", {{}})\n')
    s = quality.scan_writes([m])
    assert sorted(w["table"] for w in s["writes"]) == sorted([a, b])
    assert len(s["named_forbidden"]) == 2, s["named_forbidden"]


@case("22.14  sys.path.insert is not mistaken for a store write")
def _():
    m = tmp_module("import sys\nsys.path.insert(0, '/x')\n")
    s = quality.scan_writes([m])
    assert s["writes"] == [] and s["dynamic_targets"] == [], s


@case("22.14  a comment naming a forbidden table is NOT a hit")
def _():
    m = tmp_module('"""Never write desk_triggers or kr_paper_positions."""\n'
                   "# kr_paper_positions is off limits\n"
                   "Y = 2\n")
    s = quality.scan_writes([m])
    assert s["writes"] == [] and s["named_forbidden"] == [], s


# ==========================================================================
# 22.15
# ==========================================================================
def cov(**listing):
    l = {"ran": True, "pagination_complete": False, "items_seen": 40, "stored": 12,
         "ratio": None, "ratio_note": "pagination incomplete: denominator unknown"}
    l.update(listing)
    return {"sources": {"s1": {"listings": {"videos": l},
                               "all_listings_complete": bool(l["pagination_complete"]),
                               "items_seen_total": None}}}


@case("22.15  an incomplete listing withholds its ratio")
def _():
    expect(one("no_unknown_denominator", coverage=cov()), "pass", exercised=True)


@case("22.15  a ratio over an incomplete listing FAILS")
def _():
    expect(one("no_unknown_denominator", coverage=cov(ratio=0.3)), "fail",
           note_has="unknown denominator")


@case("22.15  withholding a ratio without saying why FAILS")
def _():
    expect(one("no_unknown_denominator", coverage=cov(ratio_note=None)), "fail")


@case("22.15  a ratio for a listing that never ran FAILS")
def _():
    expect(one("no_unknown_denominator",
               coverage=cov(ran=False, ratio=1.0, ratio_note="x")), "fail")


@case("22.15  a source total across an incomplete listing set FAILS")
def _():
    c = cov()
    c["sources"]["s1"]["items_seen_total"] = 40
    expect(one("no_unknown_denominator", coverage=c), "fail")


@case("22.15  a complete listing may carry a ratio")
def _():
    expect(one("no_unknown_denominator",
               coverage=cov(pagination_complete=True, ratio=0.98, ratio_note=None)),
           "pass", exercised=False)


@case("22.15  no listing enumerated is vacuous")
def _():
    expect(one("no_unknown_denominator", coverage={"sources": {}}), "vacuous",
           note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# 22.16
# ==========================================================================
HYP = {"vr_hypothesis_links": [{"verdict_id": "kv1", "method_id": "m1",
                                "frozen_hash": "abc"}],
       "vr_methods": [{"method_id": "m1"}],
       "vr_method_excerpts": [{"method_id": "m1", "video_id": "v1", "t_start_ms": 1000}]}


@case("22.16  a registered hypothesis tracing to a timestamped excerpt passes")
def _():
    expect(one("hypothesis_traceable", tables=HYP), "pass")


@case("22.16  an excerpt with no timestamp does not count, so it FAILS")
def _():
    t = dict(HYP, vr_method_excerpts=[{"method_id": "m1", "video_id": "v1",
                                       "t_start_ms": None}])
    expect(one("hypothesis_traceable", tables=t), "fail",
           observed_has={"no_timestamped_excerpt.sample": ["kv1"]})


@case("22.16  a hypothesis whose method is missing FAILS")
def _():
    expect(one("hypothesis_traceable", tables=dict(HYP, vr_methods=[])), "fail",
           observed_has={"method_not_found.sample": ["kv1"]})


@case("22.16  a registration with no frozen_hash FAILS")
def _():
    t = dict(HYP, vr_hypothesis_links=[{"verdict_id": "kv1", "method_id": "m1",
                                        "frozen_hash": ""}])
    expect(one("hypothesis_traceable", tables=t), "fail",
           observed_has={"missing_frozen_hash.sample": ["kv1"]})


@case("22.16  no registrations is vacuous")
def _():
    expect(one("hypothesis_traceable"), "vacuous", note_has=quality.VACUOUS_NOTE)


# ==========================================================================
# module contract
# ==========================================================================
BRIEF_KEYS = (
    "dedupe_playlist_channel", "resume_no_duplication", "unavailable_stays_gap",
    "no_transcript_no_summary", "chart_rule_incomplete", "numeric_uncertainty_kept",
    "presenter_attribution", "no_prepublication_entry", "updates_not_double_counted",
    "losing_calls_retained", "researcher_variants_labelled", "wallet_cohort_frozen",
    "untrusted_text_inert", "no_auto_trade_path", "no_unknown_denominator",
    "hypothesis_traceable")


@case("meta   the 16 check_keys match the brief exactly, in order")
def _():
    assert quality.CHECK_KEYS == BRIEF_KEYS, quality.CHECK_KEYS


@case("meta   skipped and error map to passed=False, never to a pass")
def _():
    assert quality._skip("k", "why").passed is False
    assert quality.Result("k", "error").passed is False
    assert quality.Result("k", "vacuous").passed is True
    assert quality._ok("k").passed is True


@case("meta   the vacuous note is exactly the mandated string")
def _():
    r = quality._vacuous("k", "some_table")
    assert r.note == "vacuous: no rows yet", r.note
    assert r.observed["case_exercised"] is False


@case("meta   a check that raises becomes state=error, not a crash")
def _():
    r = quality.run_one("boom", lambda d: 1 / 0, quality.Data({}))
    assert r.state == "error" and r.passed is False, r.state


@case("meta   vr_quality_checks rows are JSON-serialisable and carry the state")
def _():
    import json
    row = one("untrusted_text_inert").row()
    assert set(row) == {"check_key", "passed", "observed", "note", "at"}, sorted(row)
    assert json.loads(json.dumps(row))["observed"]["state"] == "pass"


@case("meta   report() surfaces vacuous and never invents a pass")
def _():
    if store.configured():
        raise Skipped("credentials present: report() would read the live table")
    rep = quality.report()
    assert rep["checks"] == {} and "error" in rep, rep


# ==========================================================================
# live store — must SKIP without credentials, never pass
# ==========================================================================
STORE_BACKED = tuple(k for k in BRIEF_KEYS if k not in quality.STATIC_CHECKS
                     and k != "resume_no_duplication")


def _live(key):
    def fn():
        r = quality.run_checks(only={key}, write=False)[0]
        if not store.configured():
            assert r.state == "skipped", \
                f"{key} returned {r.state} with no credentials — an unrun check must skip"
            raise Skipped("no Supabase credentials; quality.py reports state=skipped")
        assert r.state in quality.STATES
        if r.state in ("fail", "error"):
            raise AssertionError(f"live store: {r.state} — {r.note}")
    return fn


for _k in STORE_BACKED:
    case(f"live   {_k}")(_live(_k))


@case("live   resume_no_duplication")
def _():
    raise Skipped("the live probe re-upserts a real row; exercised by fixture only")


# ==========================================================================
# runner
# ==========================================================================
def main():
    width = max(len(n) for n, _ in CASES)
    rows, counts = [], {"PASS": 0, "FAIL": 0, "SKIPPED": 0}
    for name, fn in CASES:
        try:
            fn()
            rows.append(("PASS", name, ""))
        except Skipped as e:
            rows.append(("SKIPPED", name, str(e)))
        except Exception as e:  # noqa: BLE001 - a failing case is the product here
            detail = f"{type(e).__name__}: {e}".splitlines()[0][:160]
            rows.append(("FAIL", name, detail))
            if not isinstance(e, AssertionError):
                traceback.print_exc()
        counts[rows[-1][0]] += 1

    print(f"video-research acceptance tests (brief §22) — "
          f"supabase={'configured' if store.configured() else 'NOT configured'}")
    print(f"{'STATUS':<8} {'CASE':<{width}}  DETAIL")
    print("-" * (10 + width + 40))
    for st, name, detail in rows:
        print(f"{st:<8} {name:<{width}}  {detail}")
    print("-" * (10 + width + 40))
    print(f"{counts['PASS']} passed, {counts['FAIL']} failed, {counts['SKIPPED']} skipped, "
          f"{len(CASES)} total")
    return 1 if counts["FAIL"] else 0


if __name__ == "__main__":
    sys.exit(main())
