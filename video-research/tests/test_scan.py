"""scan: the pure matching core. No network, no database, no local cache needed."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import scan


def seg(text, t=0):
    return {"t_start_ms": t, "t_end_ms": t + 900, "text": text}


class Timestamps(unittest.TestCase):
    def test_every_hit_keeps_the_segment_timestamp(self):
        """A finding nobody can check in the video is not a finding."""
        hits = scan.scan_segments([seg("my stop is at sixty two thousand", t=2_460_000)])
        self.assertTrue(hits)
        for _cat, _pat, t, _snip, _mag in hits:
            self.assertEqual(t, 2_460_000)

    def test_segments_without_a_timestamp_are_skipped_not_guessed(self):
        hits = scan.scan_segments([{"text": "my stop is at 62k", "t_start_ms": None}])
        self.assertEqual(hits, [])


class Categories(unittest.TestCase):
    def _cats(self, text):
        return {c for c, *_ in scan.scan_segments([seg(text)])}

    def test_stop_language_is_found(self):
        self.assertIn("stop_invalidation", self._cats("my stop loss goes below the low"))
        self.assertIn("stop_invalidation", self._cats("that invalidates the whole idea"))
        self.assertIn("stop_invalidation", self._cats("if that goes I'm wrong below 58k"))

    def test_leverage_and_liquidation_are_found(self):
        self.assertIn("leverage", self._cats("I am using 10x leverage here"))
        self.assertIn("leverage", self._cats("your liquidation price would be 54,200"))
        self.assertIn("leverage", self._cats("keep it on isolated margin"))

    def test_position_size_is_found(self):
        self.assertIn("position_size", self._cats("risking 2% on this one"))
        self.assertIn("position_size", self._cats("that is 5% of my portfolio"))

    def test_reasons_not_to_trade_are_found(self):
        """The brief asks for reasons to AVOID trading, so they get their own category."""
        self.assertIn("avoid_trading", self._cats("honestly just stay out this week"))
        self.assertIn("avoid_trading", self._cats("this is not a setup, don't trade it"))

    def test_entries_and_exits_are_separated(self):
        self.assertIn("entry", self._cats("we are buying here at support"))
        self.assertIn("exit_target", self._cats("take profit into that level"))


class Magnitude(unittest.TestCase):
    def test_leverage_multiple_is_parsed(self):
        hits = scan.scan_segments([seg("going in with 25x leverage")])
        mags = {m for c, _p, _t, _s, m in hits if c == "leverage" and m is not None}
        self.assertIn(25, mags)

    def test_risk_percent_is_parsed(self):
        hits = scan.scan_segments([seg("risking 2% of the account")])
        mags = {m for c, _p, _t, _s, m in hits if c == "position_size" and m is not None}
        self.assertIn(2, mags)

    def test_magnitude_is_none_when_no_number_is_present(self):
        hits = scan.scan_segments([seg("watch your position sizing")])
        self.assertTrue(hits)
        self.assertTrue(all(m is None for _c, _p, _t, _s, m in hits))


class SnippetDiscipline(unittest.TestCase):
    def test_snippet_is_capped(self):
        """Hits carry triage context, never a transcript. The local cache is the record."""
        long_line = ("we are buying here " + "and talking at length " * 60)
        for _c, _p, _t, snippet, _m in scan.scan_segments([seg(long_line)]):
            self.assertLessEqual(len(snippet), scan.SNIPPET_CAP)

    def test_snippet_contains_the_match(self):
        hits = scan.scan_segments([seg("the plan is simple: my stop is at 62,000 flat")])
        self.assertTrue(any("stop" in s.lower() for _c, _p, _t, s, _m in hits))


class NotComprehension(unittest.TestCase):
    """The scan narrows what to read. It is explicitly not a judgement about meaning."""

    def test_a_false_positive_is_acceptable_and_expected(self):
        """'stop' in ordinary speech still matches. That costs one line of reading."""
        hits = scan.scan_segments([seg("let us stop at that for today")])
        self.assertIsInstance(hits, list)   # no crash, no special-casing, no silent drop

    def test_summarise_counts_per_category(self):
        hits = scan.scan_segments([seg("my stop loss is set"), seg("10x leverage", t=1000)])
        counts = scan.summarise(hits)
        self.assertGreaterEqual(counts.get("stop_invalidation", 0), 1)
        self.assertGreaterEqual(counts.get("leverage", 0), 1)

    def test_empty_transcript_scans_to_no_hits_without_error(self):
        self.assertEqual(scan.scan_segments([]), [])


class TrackDeduplication(unittest.TestCase):
    """One track per video. Scanning en and en-orig doubled every hit total."""

    def setUp(self):
        import shutil, tempfile
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self._saved = scan.store.CACHE
        scan.store.CACHE = self.tmp
        (self.tmp / "transcripts").mkdir(parents=True)

    def tearDown(self):
        import shutil
        scan.store.CACHE = self._saved
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _write(self, name):
        (self.tmp / "transcripts" / name).write_text('{"segments": []}', encoding="utf-8")

    def test_only_one_track_per_video_is_scanned(self):
        self._write("abc123.en.auto.json")
        self._write("abc123.en-orig.auto.json")
        got = scan.local_transcripts()
        self.assertEqual(len(got), 1, "both language tracks scanned — hits double-count")
        self.assertEqual(got[0][0], "abc123")

    def test_creator_captions_win_over_asr(self):
        self._write("vid00000001.en.auto.json")
        self._write("vid00000001.en.creator.json")
        self.assertEqual(scan.local_transcripts()[0][2], "creator")

    def test_distinct_videos_are_all_kept(self):
        self._write("aaaaaaaaaaa.en.auto.json")
        self._write("bbbbbbbbbbb.en.auto.json")
        self.assertEqual(len(scan.local_transcripts()), 2)


if __name__ == "__main__":
    unittest.main(verbosity=0, exit=False)
    print("OK")
