"""push_text: the corpus boundary and the hash guard. No network, no database."""
import json
import pathlib
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import captions
import push_text
import sources
import store


class Corpus(unittest.TestCase):
    """What the priority corpus is, asserted against the registry rather than a fixed list."""

    def test_corpus_is_exactly_the_presenter_priority_sources(self):
        keys = {s["source_key"] for s in push_text.priority_sources()}
        for s in sources.confirmed():
            prio = s.get("priority", 100)
            if prio < captions.PRESENTER_PRIORITY_MAX:
                self.assertIn(s["source_key"], keys)
            else:
                self.assertNotIn(s["source_key"], keys,
                                 f"{s['source_key']} is a whole archive; pushing its text "
                                 "would blow the bounded-corpus decision")

    def test_whole_archives_are_excluded(self):
        """The named exception is presenters, not the archive. Cowen/Banter/Insider stay out."""
        keys = {s["source_key"] for s in push_text.priority_sources()}
        for key in ("benjamin-cowen", "crypto-banter", "crypto-insider"):
            self.assertNotIn(key, keys)

    def test_the_owners_named_presenters_are_in(self):
        keys = {s["source_key"] for s in push_text.priority_sources()}
        for key in ("sniper-trading-masterclass", "kyle-doops-trading-show", "rans-show",
                    "sniper-crypto-trading-show"):
            self.assertIn(key, keys, f"{key} was named by the owner and must be in the corpus")

    def test_the_readable_corpus_has_its_OWN_threshold(self):
        """Deliberately decoupled from the crawl order — the old coupling had a cost.

        This test previously asserted the opposite: that push_text reused
        captions.PRESENTER_PRIORITY_MAX so "fetched first" and "text pushed" could never
        drift apart. That sounds tidy and it was wrong, because the two answer different
        questions. Crawl order asks "curated show or whole archive?" — Cowen's 3,133-video
        channel is an archive and is rightly fetched late. The readable corpus asks "is this
        a presenter we are trying to learn a method from?" — Cowen plainly is.

        Sharing one number meant he failed both on the same comparison: 498 transcripts
        fetched and scanned, none ever readable, no error, no log line. The corpus now moves
        with its own constants and ignores the crawl-order one.
        """
        saved = captions.PRESENTER_PRIORITY_MAX
        try:
            captions.PRESENTER_PRIORITY_MAX = 0
            self.assertTrue(push_text.priority_sources(),
                            "corpus still follows the crawl-order threshold")
        finally:
            captions.PRESENTER_PRIORITY_MAX = saved

        saved_c = push_text.CURATED_PRIORITY_MAX
        try:
            push_text.CURATED_PRIORITY_MAX = 0
            self.assertEqual(push_text.priority_sources(), [],
                             "corpus ignored its own threshold")
        finally:
            push_text.CURATED_PRIORITY_MAX = saved_c

    def _segs(self, *texts):
        return [{"t_start_ms": i * 1000, "t_end_ms": i * 1000 + 900, "text": t}
                for i, t in enumerate(texts)]

    def _hash(self, *texts):
        return store.sha256("\n".join(texts))

    def test_matching_hash_passes(self):
        ok, reason = push_text.verify(self._segs("alpha", "beta"), self._hash("alpha", "beta"))
        self.assertTrue(ok)
        self.assertEqual(reason, "")

    def test_altered_text_is_a_defect_not_a_merge(self):
        ok, reason = push_text.verify(self._segs("alpha", "BETA"), self._hash("alpha", "beta"))
        self.assertFalse(ok)
        self.assertIn("mismatch", reason)

    def test_empty_transcript_is_refused(self):
        ok, reason = push_text.verify([], "whatever")
        self.assertFalse(ok)
        self.assertEqual(reason, "empty transcript")

    def test_oversized_transcript_is_skipped_with_its_size_named(self):
        saved = push_text.CHAR_CAP
        push_text.CHAR_CAP = 10
        try:
            ok, reason = push_text.verify(self._segs("x" * 50), self._hash("x" * 50))
            self.assertFalse(ok)
            self.assertIn("over cap", reason)
        finally:
            push_text.CHAR_CAP = saved

    def test_cap_check_precedes_the_hash_check(self):
        """An oversized file is reported as oversized, never mislabelled a defect."""
        saved = push_text.CHAR_CAP
        push_text.CHAR_CAP = 5
        try:
            ok, reason = push_text.verify(self._segs("y" * 40), "not-the-right-hash")
            self.assertFalse(ok)
            self.assertIn("over cap", reason)
            self.assertNotIn("mismatch", reason)
        finally:
            push_text.CHAR_CAP = saved


class LocalCache(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self._saved = store.CACHE
        store.CACHE = self.tmp

    def tearDown(self):
        store.CACHE = self._saved
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_absent_file_reads_as_none_not_empty(self):
        """None means 'fetched on another machine'; [] would mean 'this video had no text'."""
        self.assertIsNone(push_text.read_local("transcripts/missing.en.auto.json"))

    def test_segments_survive_the_round_trip_untouched(self):
        segs = [{"t_start_ms": 0, "t_end_ms": 900, "text": "we are buying here"}]
        p = self.tmp / "transcripts" / "abc.en.auto.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"video_id": "abc", "segments": segs}), encoding="utf-8")
        self.assertEqual(push_text.read_local("transcripts/abc.en.auto.json"), segs)

    def test_timestamps_are_preserved_so_excerpts_stay_citable(self):
        segs = [{"t_start_ms": 123456, "t_end_ms": 124000, "text": "invalidation is here"}]
        p = self.tmp / "transcripts" / "def.en.creator.json"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(json.dumps({"video_id": "def", "segments": segs}), encoding="utf-8")
        got = push_text.read_local("transcripts/def.en.creator.json")
        self.assertEqual(got[0]["t_start_ms"], 123456)


class UploadChunking(unittest.TestCase):
    """Batch by payload size. 199 transcripts in one request timed out on the first run."""

    def _row(self, segments):
        return {"video_id": "x" * 11, "lang": "en", "source_type": "auto",
                "segments": [{"t_start_ms": i, "text": "word " * 20}
                             for i in range(segments)]}

    def test_large_rows_are_split_across_requests(self):
        rows = [self._row(400) for _ in range(10)]
        chunks = push_text.size_chunks(rows, max_bytes=50_000)
        self.assertGreater(len(chunks), 1, "oversized batch was not split")
        self.assertEqual(sum(len(c) for c in chunks), len(rows), "rows were lost")

    def test_small_rows_travel_together(self):
        rows = [self._row(1) for _ in range(10)]
        self.assertEqual(len(push_text.size_chunks(rows, max_bytes=1_000_000)), 1)

    def test_a_single_oversized_row_is_sent_alone_not_dropped(self):
        rows = [self._row(500)]
        chunks = push_text.size_chunks(rows, max_bytes=10)
        self.assertEqual(sum(len(c) for c in chunks), 1)

    def test_no_empty_chunks(self):
        for c in push_text.size_chunks([self._row(50) for _ in range(6)], max_bytes=1000):
            self.assertTrue(c)


class SelectiveArchiveInclusion(unittest.TestCase):
    """A whole archive is admitted by evidence, not wholesale — and not excluded outright.

    Both halves matter. Pushing Cowen's 3,133 videos would blow the bounded-corpus decision;
    excluding him entirely meant 498 fetched and scanned transcripts could NEVER be read,
    silently, for the source the owner named as the best chart reader of the three.
    """

    def test_curated_sources_stay_whole(self):
        keys = {s["source_key"] for s in push_text.priority_sources()}
        for k in ("kyle-doops-trading-show", "rans-show", "sniper-crypto-trading-show",
                  "sniper-trading-masterclass", "crypto-trading-tutorials"):
            self.assertIn(k, keys)

    def test_a_whole_archive_is_not_a_curated_source(self):
        keys = {s["source_key"] for s in push_text.priority_sources()}
        self.assertNotIn("benjamin-cowen", keys,
                         "an archive back in the wholesale corpus — the size bound is gone")

    def test_cowen_is_reachable_selectively(self):
        keys = {s["source_key"] for s in push_text.selective_sources()}
        self.assertIn("benjamin-cowen", keys,
                      "Cowen unreachable again — 498 transcripts nobody can read")

    def test_the_general_channels_are_in_neither(self):
        """5,044 Crypto Banter videos belong in no corpus meant to be read closely."""
        keys = ({s["source_key"] for s in push_text.priority_sources()}
                | {s["source_key"] for s in push_text.selective_sources()})
        self.assertNotIn("crypto-banter", keys)
        self.assertNotIn("crypto-insider", keys)

    def test_the_two_bands_do_not_overlap(self):
        a = {s["source_key"] for s in push_text.priority_sources()}
        b = {s["source_key"] for s in push_text.selective_sources()}
        self.assertEqual(a & b, set())

    def test_rule_bearing_of_nothing_queries_nothing(self):
        called = []
        saved = push_text.store.get_all
        push_text.store.get_all = lambda *a, **k: called.append(1) or []
        try:
            self.assertEqual(push_text.rule_bearing(set()), set())
        finally:
            push_text.store.get_all = saved
        self.assertEqual(called, [])

    def test_rule_bearing_returns_only_flagged_videos(self):
        saved = push_text.store.get_all
        push_text.store.get_all = lambda *a, **k: [{"video_id": "aaaaaaaaaaa"}]
        try:
            got = push_text.rule_bearing({"aaaaaaaaaaa", "bbbbbbbbbbb"})
        finally:
            push_text.store.get_all = saved
        self.assertEqual(got, {"aaaaaaaaaaa"})

    def test_rule_bearing_chunks_large_id_sets(self):
        """PostgREST in.() lists have a URL length limit; 3,133 ids do not fit in one."""
        calls = []
        saved = push_text.store.get_all
        push_text.store.get_all = lambda t, q, **k: calls.append(q) or []
        try:
            push_text.rule_bearing({f"v{i:010d}" for i in range(450)})
        finally:
            push_text.store.get_all = saved
        self.assertGreater(len(calls), 1, "sent 450 ids in a single request")


if __name__ == "__main__":
    unittest.main(verbosity=0, exit=False)
    print("OK")
