"""Offline tests for calls.py. No network, no Supabase: store's REST calls are captured
in memory and the local cohort cache is redirected to a temp dir.

What is being pinned down is the arithmetic that decides a track record: a viewer cannot
act before publication, one revised trade is one outcome, and 'unscorable' is not a win.
"""
import datetime
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import calls  # noqa: E402
import store  # noqa: E402

UTC = datetime.timezone.utc
PUB = "2025-06-14T09:30:00+00:00"


class Fake:
    """Captures every write; answers reads from what was written."""

    def __init__(self):
        self.tables = {}

    def install(self, t):
        orig = {k: getattr(store, k) for k in ("get", "insert", "upsert", "patch", "CACHE")}
        store.get, store.insert, store.upsert, store.patch = \
            self.get, self.insert, self.upsert, self.patch
        store.CACHE = pathlib.Path(tempfile.mkdtemp())
        t.addCleanup(lambda: [setattr(store, k, v) for k, v in orig.items()])

    # -- writes ---------------------------------------------------------
    def upsert(self, table, rows, on_conflict):
        keys = on_conflict.split(",")
        t = self.tables.setdefault(table, {})
        for r in rows:
            k = tuple(r[c] for c in keys)
            t[k] = {**t.get(k, {}), **r}
        return len(rows)

    def insert(self, table, rows):
        t = self.tables.setdefault(table, {})
        for r in rows:
            t[("_ins", len(t))] = dict(r, id=len(t) + 1)
        return None

    def patch(self, table, query, body):
        want = self._eq(query)
        for r in self.tables.get(table, {}).values():
            if all(str(r.get(c)) == v for c, v in want.items()):
                r.update(body)
        return None

    # -- reads ----------------------------------------------------------
    @staticmethod
    def _eq(query):
        return {p.split("=eq.")[0]: p.split("=eq.")[1]
                for p in query.split("&") if "=eq." in p}

    def get(self, table, query=""):
        want = self._eq(query)
        rows = [r for r in self.tables.get(table, {}).values()
                if all(str(r.get(c)) == v for c, v in want.items())]
        if "offset=" in query:                       # _rows() pages; one page is enough here
            off = int(query.split("offset=")[1].split("&")[0])
            rows = rows[off:]
        return rows

    def rows(self, table):
        return list(self.tables.get(table, {}).values())


def video(**kw):
    v = {"video_id": "vid00000001", "video_type": "upload", "published_at": PUB,
         "live_start_at": None, "duration_s": 3600, "published_precision": "second"}
    v.update(kw)
    return v


# ---------------------------------------------------------------------------
# (a) an upload call can never be receivable before publication  (§22.8)
# ---------------------------------------------------------------------------
class ReceivableNeverPrecedesPublication(unittest.TestCase):
    def test_offset_is_added_to_publication_not_to_recording(self):
        at, basis, band = calls.receivable_time(video(), 90_000)
        self.assertEqual(at, "2025-06-14T09:31:30+00:00")
        self.assertEqual(basis, "published_plus_offset")
        self.assertEqual(band, 0)

    def test_receivable_is_never_earlier_than_published_for_any_accepted_offset(self):
        pub = calls._dt(PUB)
        for precision in ("second", "day"):
            for t in (0, 1, 999, 60_000, 3_600_000, 86_400_000):
                at, _, _ = calls.receivable_time(video(published_precision=precision), t)
                self.assertGreaterEqual(calls._dt(at), pub, f"{precision}/{t}")

    def test_negative_offset_is_refused_not_clamped(self):
        with self.assertRaises(ValueError):
            calls.receivable_time(video(), -1)

    def test_guard_raises_if_the_arithmetic_is_ever_subverted(self):
        # The only way back past publication is a negative offset. Prove the guard fires
        # instead of silently producing a pre-publication fill.
        orig = calls._offset
        calls._offset = lambda t_ms: datetime.timedelta(seconds=-10)
        self.addCleanup(lambda: setattr(calls, "_offset", orig))
        with self.assertRaises(calls.PrePublicationError):
            calls.receivable_time(video(), 1000)

    def test_day_precision_widens_the_band_by_a_day(self):
        at, basis, band = calls.receivable_time(
            video(published_at="2025-06-14T00:00:00+00:00", published_precision=None), 0)
        self.assertEqual(basis, "published_plus_offset_day_precision")
        self.assertEqual(band, calls.DAY_PRECISION_UNCERTAINTY_S)
        self.assertEqual(at, "2025-06-14T00:00:00+00:00")

    def test_recording_time_is_irrelevant_to_an_upload(self):
        # live_start_at on a non-stream row must not pull the receivable time earlier.
        at, basis, _ = calls.receivable_time(
            video(live_start_at="2025-01-01T00:00:00+00:00"), 0)
        self.assertEqual(at, PUB)
        self.assertEqual(basis, "published_plus_offset")

    def test_no_public_time_yields_no_time(self):
        self.assertEqual(calls.receivable_time(video(published_at=None), 0),
                         (None, "unknown_no_public_time", None))


# ---------------------------------------------------------------------------
# (b) livestream fallback sets a large uncertainty
# ---------------------------------------------------------------------------
class LivestreamTiming(unittest.TestCase):
    def test_known_start_anchors_the_offset_with_a_segment_band(self):
        at, basis, band = calls.receivable_time(
            video(video_type="livestream", live_start_at="2025-06-14T08:00:00+00:00"), 600_000)
        self.assertEqual(at, "2025-06-14T08:10:00+00:00")
        self.assertEqual(basis, "live_start_plus_offset")
        self.assertEqual(band, calls.LIVE_UNCERTAINTY_S)

    def test_live_viewer_may_receive_before_the_vod_is_published(self):
        # Not a violation of §22.8: the stream WAS public at that moment.
        at, _, _ = calls.receivable_time(
            video(video_type="livestream", live_start_at="2025-06-14T08:00:00+00:00"), 0)
        self.assertLess(calls._dt(at), calls._dt(PUB))

    def test_unknown_start_falls_back_to_published_with_a_large_band(self):
        at, basis, band = calls.receivable_time(
            video(video_type="livestream", live_start_at=None), 600_000)
        self.assertEqual(basis, "stream_start_unknown")
        self.assertGreaterEqual(band, calls.STREAM_UNKNOWN_UNCERTAINTY_S)
        self.assertGreater(band, calls.LIVE_UNCERTAINTY_S * 100)
        self.assertEqual(at, "2025-06-14T09:40:00+00:00")

    def test_unknown_offset_widens_to_the_video_duration(self):
        at, basis, band = calls.receivable_time(video(duration_s=7200), None)
        self.assertTrue(basis.endswith("_offset_unknown"))
        self.assertEqual(band, 7200)
        self.assertEqual(at, PUB)


# ---------------------------------------------------------------------------
# (c) three updates to one trade score ONCE  (§22.9)
# (d) unscorable is never a win
# ---------------------------------------------------------------------------
class Scoring(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.fake.install(self)

    def _trade(self, n, outcome, asset="BTC", horizon="swing"):
        """n calls on one trade, chained, terminal call carrying `outcome`."""
        ids = []
        for i in range(n):
            r = calls.record_call(
                "vid00000001", 1000 * (i + 1), asset, "long", "actionable",
                video=video(), entry_zone="61,000-61,400", invalidation="60,800",
                target="66,000", horizon=horizon,
                outcome=(outcome if i == n - 1 else None))
            ids.append(r["call_id"])
        for prev, new in zip(ids, ids[1:]):
            calls.link_update(prev, new)
        return ids

    def test_three_updates_to_one_trade_are_one_group_and_one_outcome(self):
        ids = self._trade(3, "win")
        self.assertEqual(len(set(ids)), 3)
        s = calls.score_summary({})
        self.assertEqual(s["actionable"]["rows"], 3)      # three rows survive, nothing deleted
        self.assertEqual(s["actionable"]["groups"], 1)    # ...and score as ONE trade
        self.assertEqual(s["actionable"]["by_outcome"]["win"], 1)
        self.assertEqual(s["win_rate"], 1.0)

    def test_a_second_trade_is_a_second_group(self):
        self._trade(3, "win")
        self._trade(2, "loss", asset="ETH")
        s = calls.score_summary({})
        self.assertEqual(s["actionable"]["groups"], 2)
        self.assertEqual(s["actionable"]["by_outcome"], dict(
            win=1, loss=1, flat=0, cancelled=0, open=0, unscored=0, unscorable=0))
        self.assertEqual(s["win_rate"], 0.5)

    def test_unscorable_is_not_a_win_and_not_a_loss(self):
        rows = [{"call_id": "a", "call_type": "actionable", "update_group": "g1",
                 "superseded_by": None, "outcome": "unscorable"},
                {"call_id": "b", "call_type": "actionable", "update_group": "g2",
                 "superseded_by": None, "outcome": "win"}]
        s = calls.score_summary(rows=rows)
        self.assertEqual(s["actionable"]["by_outcome"]["unscorable"], 1)
        self.assertEqual(s["actionable"]["unscorable"], 1)
        self.assertEqual(s["actionable"]["by_outcome"]["win"], 1)
        self.assertEqual(s["actionable"]["by_outcome"]["loss"], 0)
        # An unknown denominator forbids a percentage — no 100% off 1-of-1.
        self.assertIsNone(s["win_rate"])
        self.assertIn("unscorable", s["win_rate_note"])

    def test_open_and_unscored_groups_withhold_the_percentage(self):
        base = {"call_type": "actionable", "superseded_by": None}
        for outcome in ("open", None):
            s = calls.score_summary(rows=[
                dict(base, call_id="a", update_group="g1", outcome="win"),
                dict(base, call_id="b", update_group="g2", outcome=outcome)])
            self.assertIsNone(s["win_rate"], outcome)

    def test_losing_and_cancelled_calls_are_kept_and_counted(self):
        base = {"call_type": "actionable", "superseded_by": None}
        s = calls.score_summary(rows=[
            dict(base, call_id="a", update_group="g1", outcome="win"),
            dict(base, call_id="b", update_group="g2", outcome="loss"),
            dict(base, call_id="c", update_group="g3", outcome="cancelled")])
        self.assertEqual(s["actionable"]["by_outcome"]["loss"], 1)
        self.assertEqual(s["actionable"]["by_outcome"]["cancelled"], 1)
        self.assertEqual(s["win_rate"], 0.5)             # cancelled excluded from the ratio
        self.assertIn("cancelled", s["win_rate_note"])   # ...and named, not dropped

    def test_an_unlinked_fork_is_unresolved_not_a_win(self):
        base = {"call_type": "actionable", "update_group": "g1", "superseded_by": None}
        s = calls.score_summary(rows=[dict(base, call_id="a", outcome="win"),
                                      dict(base, call_id="b", outcome="loss")])
        self.assertEqual(s["actionable"]["unresolved_groups"], ["g1"])
        self.assertEqual(s["actionable"]["by_outcome"]["win"], 0)
        self.assertIsNone(s["win_rate"])

    def test_ungrouped_calls_are_each_their_own_trade(self):
        rows = [{"call_id": "a", "call_type": "actionable", "update_group": None,
                 "superseded_by": None, "outcome": "win"},
                {"call_id": "b", "call_type": "actionable", "update_group": None,
                 "superseded_by": None, "outcome": "loss"}]
        self.assertEqual(calls.score_summary(rows=rows)["actionable"]["groups"], 2)

    def test_non_actionable_types_are_counted_but_not_scored(self):
        rows = [{"call_id": "a", "call_type": "opinion", "update_group": "g1",
                 "superseded_by": None, "outcome": None}]
        s = calls.score_summary(rows=rows)
        self.assertEqual(s["by_call_type"], {"opinion": 1})
        self.assertEqual(s["actionable"]["groups"], 0)


class RecordAndChain(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.fake.install(self)

    def test_call_id_is_stable_so_re_extraction_updates_in_place(self):
        a = calls.record_call("vid00000001", 5000, "BTC", "long", "opinion", video=video())
        b = calls.record_call("vid00000001", 5000, "BTC", "long", "opinion", video=video(),
                              stated_confidence="high")
        self.assertEqual(a["call_id"], b["call_id"])
        self.assertEqual(len(self.fake.rows("vr_calls")), 1)
        self.assertEqual(self.fake.rows("vr_calls")[0]["stated_confidence"], "high")

    def test_missing_scoring_inputs_are_named_not_defaulted(self):
        r = calls.record_call("vid00000001", 5000, "BTC", "long", "actionable", video=video())
        self.assertEqual(r["missing_info"], ["entry", "horizon", "invalidation", "target"])

    def test_a_win_without_an_entry_is_refused(self):
        with self.assertRaises(ValueError):
            calls.record_call("vid00000001", 5000, "BTC", "long", "actionable", video=video(),
                              outcome="win")

    def test_enums_are_enforced(self):
        for kw in ({"call_type": "great"}, {"call_type": "opinion", "outcome": "amazing"},
                   {"call_type": "opinion", "direction": "sideways"}):
            args = {"call_type": "opinion", "direction": "long"}
            args.update(kw)
            with self.assertRaises(ValueError):
                calls.record_call("vid00000001", 1, "BTC", args.pop("direction"),
                                  args.pop("call_type"), video=video(), **args)

    def test_link_update_walks_to_the_tail_instead_of_forking(self):
        ids = [calls.record_call("vid00000001", 1000 * i, "BTC", "long", "actionable",
                                 video=video(), entry_zone="61k", invalidation="60k",
                                 horizon="swing")["call_id"] for i in (1, 2, 3)]
        calls.link_update(ids[0], ids[1])
        calls.link_update(ids[0], ids[2])            # out-of-order arrival, same trade
        by_id = {r["call_id"]: r for r in self.fake.rows("vr_calls")}
        self.assertEqual(by_id[ids[0]]["superseded_by"], ids[1])
        self.assertEqual(by_id[ids[1]]["superseded_by"], ids[2])
        self.assertIsNone(by_id[ids[2]].get("superseded_by"))
        self.assertEqual(calls.score_summary({})["actionable"]["groups"], 1)

    def test_re_extraction_does_not_detach_a_linked_call_from_its_group(self):
        a = calls.record_call("vid00000001", 1000, "BTC", "long", "actionable", video=video(),
                              horizon="swing")["call_id"]
        b = calls.record_call("vid00000002", 2000, "BTC", "long", "actionable",
                              video=video(video_id="vid00000002"), horizon="scalp")["call_id"]
        calls.link_update(a, b)
        joined = {r["call_id"]: r["update_group"] for r in self.fake.rows("vr_calls")}[b]
        calls.record_call("vid00000002", 2000, "BTC", "long", "actionable",
                          video=video(video_id="vid00000002"), horizon="scalp")
        again = {r["call_id"]: r["update_group"] for r in self.fake.rows("vr_calls")}[b]
        self.assertEqual(again, joined)
        self.assertEqual(calls.score_summary({})["actionable"]["groups"], 1)

    def test_self_supersession_is_refused(self):
        with self.assertRaises(ValueError):
            calls.link_update("x", "x")


class NewsLinks(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.fake.install(self)

    def test_citation_claim_without_the_citation_is_downgraded(self):
        r = calls.link_news("c1", "presenter_cites_event", primary_source=None,
                            event_at="2025-06-14T09:00:00+00:00")
        self.assertEqual(r["relationship"], "association_only")
        self.assertEqual(r["downgraded_from"], "presenter_cites_event")
        self.assertIn("sequence alone is not causation", r["note"])

    def test_citation_claim_with_quote_and_source_is_kept(self):
        r = calls.link_news("c1", "presenter_cites_event",
                            primary_source="https://sec.gov/news/example",
                            excerpt="the SEC filing this morning says",
                            event_at="2025-06-14T09:00:00+00:00")
        self.assertEqual(r["relationship"], "presenter_cites_event")
        self.assertIsNone(r["downgraded_from"])

    def test_ordering_alone_stays_association_only(self):
        r = calls.link_news("c1", "event_preceded_call_rationale_unstated",
                            primary_source="https://example.org/wire",
                            event_at="2025-06-14T09:00:00+00:00")
        self.assertEqual(r["relationship"], "event_preceded_call_rationale_unstated")

    def test_unknown_relationship_is_refused(self):
        with self.assertRaises(ValueError):
            calls.link_news("c1", "caused_by")

    def test_same_link_twice_is_one_row(self):
        for _ in range(2):
            calls.link_news("c1", "association_only", primary_source="s", statement_t_ms=10)
        self.assertEqual(len(self.fake.rows("vr_news_links")), 1)


class CohortFreeze(unittest.TestCase):
    def setUp(self):
        self.fake = Fake()
        self.fake.install(self)

    def test_freeze_stores_a_real_timestamp_and_the_membership(self):
        before = datetime.datetime.now(UTC)
        r = calls.freeze_cohort("whales-q3", ["w1", "w2", "w3"], controls=["w3"])
        self.assertGreaterEqual(calls._dt(r["recorded_at"]), before)
        self.assertEqual(r["n_members"], 3)
        self.assertTrue(pathlib.Path(r["local_ref"]).exists())
        self.assertTrue(self.fake.rows("vr_quality_checks")[0]["passed"])

    def test_no_controls_stores_the_freeze_but_fails_the_check(self):
        calls.freeze_cohort("winners-only", ["w1", "w2"])
        row = self.fake.rows("vr_quality_checks")[0]
        self.assertFalse(row["passed"])
        self.assertIn("NO CONTROLS", row["note"])

    def test_refreezing_the_same_members_is_idempotent(self):
        calls.freeze_cohort("whales-q3", ["w1", "w2"], controls=["w2"])
        again = calls.freeze_cohort("whales-q3", ["w2", "w1"], controls=["w2"])
        self.assertTrue(again["already_frozen"])
        self.assertEqual(len(self.fake.rows("vr_quality_checks")), 1)

    def test_swapping_members_after_the_fact_is_refused(self):
        calls.freeze_cohort("whales-q3", ["w1", "w2"], controls=["w2"])
        with self.assertRaises(calls.CohortDrift):
            calls.freeze_cohort("whales-q3", ["w1", "w9"], controls=["w9"])

    def test_a_declared_supersede_appends_and_never_overwrites(self):
        calls.freeze_cohort("whales-q3", ["w1", "w2"], controls=["w2"])
        calls.freeze_cohort("whales-q3", ["w1", "w9"], controls=["w9"],
                            supersede_reason="w2 address was mis-transcribed")
        rows = self.fake.rows("vr_quality_checks")
        self.assertEqual(len(rows), 2)
        self.assertIsNotNone(rows[1]["observed"]["supersedes_hash"])

    def test_a_future_freeze_timestamp_is_refused(self):
        soon = (datetime.datetime.now(UTC) + datetime.timedelta(hours=1)).isoformat()
        with self.assertRaises(ValueError):
            calls.freeze_cohort("later", ["w1"], frozen_at=soon, controls=["w1"])

    def test_a_backdated_freeze_is_stored_and_flagged(self):
        old = (datetime.datetime.now(UTC) - datetime.timedelta(days=30)).isoformat()
        r = calls.freeze_cohort("backdated", ["w1"], frozen_at=old, controls=["w1"])
        self.assertTrue(r["backdated"])
        self.assertFalse(self.fake.rows("vr_quality_checks")[0]["passed"])

    def test_an_empty_cohort_cannot_be_frozen(self):
        with self.assertRaises(ValueError):
            calls.freeze_cohort("empty", [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
