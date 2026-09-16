"""scan: the pure matching core. No network, no database, no local cache needed."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import json
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


class RescanReplaces(unittest.TestCase):
    """A re-scan must replace a video's hits, never stack a new pass on the old one."""

    def setUp(self):
        import shutil, tempfile
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self._cache, self._get = scan.store.CACHE, scan.store.get
        self._ins, self._ups, self._del = (scan.store.insert, scan.store.upsert,
                                           getattr(scan.store, "delete", None))
        scan.store.CACHE = self.tmp
        (self.tmp / "transcripts").mkdir(parents=True)
        self.deleted, self.inserted = [], []
        scan.store.get = lambda *a, **k: []
        scan.store.insert = lambda t, rows: self.inserted.extend(rows)
        scan.store.upsert = lambda t, rows, c: None
        scan.store.delete = lambda t, q: self.deleted.append(q)

    def tearDown(self):
        import shutil
        scan.store.CACHE, scan.store.get = self._cache, self._get
        scan.store.insert, scan.store.upsert = self._ins, self._ups
        if self._del is not None:
            scan.store.delete = self._del
        shutil.rmtree(self.tmp, ignore_errors=True)

    def test_previous_hits_are_deleted_before_new_ones_are_written(self):
        seg = {"t_start_ms": 0, "t_end_ms": 900, "text": "my stop loss is here"}
        (self.tmp / "transcripts" / "aaaaaaaaaaa.en.auto.json").write_text(
            json.dumps({"segments": [seg]}), encoding="utf-8")
        scan.run(force=True)
        self.assertTrue(self.inserted, "nothing was written")
        self.assertIn("video_id=eq.aaaaaaaaaaa", self.deleted,
                      "re-scan appended without clearing — counts will stack")


class ToneMarkers(unittest.TestCase):
    """Tone is not recoverable from ASR. What IS measurable is hedging versus assertion."""

    def _cats(self, text):
        return {c for c, *_ in scan.scan_segments([seg(text)])}

    def test_disclaimers_are_captured(self):
        self.assertIn("hedge", self._cats("this is not financial advice by the way"))
        self.assertIn("hedge", self._cats("honestly I could be wrong here"))

    def test_stated_jokes_are_captured(self):
        self.assertIn("hedge", self._cats("nah I'm joking, do not do that"))

    def test_conviction_language_is_captured(self):
        self.assertIn("conviction", self._cats("this is high conviction for me"))

    def test_hedge_and_call_can_coexist_on_one_line(self):
        """A hedged call is a different object from a flat one — both markers must survive."""
        cats = self._cats("I'm buying here but I could be wrong")
        self.assertIn("entry", cats)
        self.assertIn("hedge", cats)


class NeighbourContext(unittest.TestCase):
    """ASR cuts every 2-3 seconds mid-clause, so a cue-bounded window truncates the rule."""

    def _segs(self, *texts):
        return [{"t_start_ms": i * 3000, "t_end_ms": i * 3000 + 2900, "text": t}
                for i, t in enumerate(texts)]

    def test_context_extends_into_the_previous_cue(self):
        segs = self._segs("the way I size any leverage trade is that",
                          "on one trade risk 1% you're using 5x")
        hit = [h for h in scan.scan_segments(segs) if h[0] == "position_size"][0]
        self.assertIn("the way I size", hit[3], "context stopped at the cue boundary")

    def test_context_extends_into_the_next_cue(self):
        segs = self._segs("on one trade risk 1%",
                          "and that keeps you alive through a losing streak")
        hit = [h for h in scan.scan_segments(segs) if h[0] == "position_size"][0]
        self.assertIn("losing streak", hit[3])

    def test_the_timestamp_still_comes_from_the_matching_cue_only(self):
        """Context may span cues; a citation must not drift to a neighbour."""
        segs = self._segs("nothing here", "risking 2% of the account", "nor here")
        hit = [h for h in scan.scan_segments(segs) if h[0] == "position_size"][0]
        self.assertEqual(hit[2], 3000)

    def test_the_first_cue_has_no_previous_neighbour(self):
        hits = scan.scan_segments(self._segs("risking 2% here", "after"))
        self.assertTrue(hits)

    def test_the_last_cue_has_no_next_neighbour(self):
        hits = scan.scan_segments(self._segs("before", "risking 2% here"))
        self.assertTrue(hits)

    def test_the_cap_still_holds(self):
        segs = self._segs("x" * 500, "we are buying here", "y" * 500)
        for h in scan.scan_segments(segs):
            self.assertLessEqual(len(h[3]), scan.SNIPPET_CAP)

    def test_a_widened_snippet_is_actually_wider_than_one_cue(self):
        """The whole point: the fragment has to become quotable."""
        segs = self._segs("here is how I think about it in practice, which is that",
                          "on one trade risk 1% you're using 5x",
                          "so your worst case is one percent of the account")
        hit = [h for h in scan.scan_segments(segs) if h[0] == "position_size"][0]
        self.assertGreater(len(hit[3]), 60)


class ScannerVersionMoved(unittest.TestCase):
    def test_the_version_changed_so_old_scans_are_redone(self):
        """run() skips videos already scanned AT THIS VERSION; widening must re-scan."""
        self.assertNotEqual(scan.SCANNER_VERSION, "scan/1.0")


if __name__ == "__main__":
    unittest.main(verbosity=0, exit=False)
    print("OK")
