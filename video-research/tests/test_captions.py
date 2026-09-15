"""Unit tests for captions.py. stdlib unittest, no network.

The fixture is hand-written to carry the four shapes real YouTube json3 actually contains:
a layout-only event, a multi-seg cue, a blank-line cue, and a cue with no dDurationMs.
"""
import json
import pathlib
import shutil
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import captions  # noqa: E402

FIXTURE = pathlib.Path(__file__).parent / "fixtures" / "sample.json3"


class ParseJson3(unittest.TestCase):
    def setUp(self):
        self.segs = captions.parse_json3(FIXTURE)

    def test_drops_non_text_events_only(self):
        # 7 events in, 4 text cues out: layout-only, "\n", and "" are not captions.
        self.assertEqual(len(self.segs), 4)

    def test_timestamps_are_exact(self):
        self.assertEqual(self.segs[0], {"t_start_ms": 1000, "t_end_ms": 3500,
                                        "text": "we're going to look at"})
        self.assertEqual(self.segs[1]["t_start_ms"], 3500)
        self.assertEqual(self.segs[1]["t_end_ms"], 5500)

    def test_missing_duration_is_none_not_guessed(self):
        self.assertIsNone(self.segs[2]["t_end_ms"])
        self.assertEqual(self.segs[2]["t_start_ms"], 5500)

    def test_segs_are_joined_not_split(self):
        # tOffsetMs is a word offset inside one cue; it must not create a second cue.
        self.assertEqual(self.segs[1]["text"], "the four hour chart")

    def test_text_is_stripped_but_not_otherwise_altered(self):
        self.assertEqual(self.segs[2]["text"], "invalidation is 61,200")

    def test_span_uses_last_end_and_falls_back_to_start(self):
        self.assertEqual(captions._span_ms(self.segs), 9200)
        self.assertEqual(captions._span_ms(self.segs[2:3]), 5500)
        self.assertIsNone(captions._span_ms([]))

    def test_hash_is_stable_across_reparse(self):
        again = captions.parse_json3(FIXTURE)
        self.assertEqual(captions._normalised_text(self.segs),
                         captions._normalised_text(again))


class SourceTypeDiscipline(unittest.TestCase):
    def test_creator_and_auto_are_read_from_separate_keys(self):
        info = {"subtitles": {"en": [{}]}, "automatic_captions": {"en": [{}], "en-orig": [{}]}}
        creator, auto = captions._caption_shape(info)
        self.assertEqual(creator, ["en"])
        self.assertEqual(auto, ["en", "en-orig"])

    def test_en_orig_is_never_creator(self):
        info = {"subtitles": {}, "automatic_captions": {"en-orig": [{}]}}
        creator, auto = captions._caption_shape(info)
        self.assertEqual(creator, [])
        self.assertEqual(auto, ["en-orig"])

    def test_translated_tracks_are_not_counted(self):
        info = {"subtitles": {}, "automatic_captions": {"en": [{}], "fr": [{}], "de": [{}]}}
        self.assertEqual(captions._caption_shape(info)[1], ["en"])


class Metadata(unittest.TestCase):
    def test_upload_date_only_is_day_precision_at_midnight_utc(self):
        row, precision = captions._metadata("abcdefghijk", {"upload_date": "20250614"})
        self.assertEqual(precision, "day")
        self.assertEqual(row["published_at"], "2025-06-14T00:00:00+00:00")

    def test_release_timestamp_wins_over_upload_date(self):
        row, precision = captions._metadata(
            "abcdefghijk", {"upload_date": "20250614", "release_timestamp": 1750000000})
        self.assertEqual(precision, "second")
        self.assertTrue(row["published_at"].startswith("2025-"))

    def test_live_end_is_never_inferred(self):
        row, _ = captions._metadata("abcdefghijk", {
            "was_live": True, "release_timestamp": 1750000000, "duration": 7200})
        self.assertIsNotNone(row["live_start_at"])
        self.assertNotIn("live_end_at", [k for k, v in row.items() if v])
        self.assertIsNone(row.get("live_end_at"))

    def test_availability_is_never_assumed_public(self):
        row, _ = captions._metadata("abcdefghijk", {})
        self.assertEqual(row["availability"], "unknown")


class ErrorClassification(unittest.TestCase):
    def test_bot_check_is_blocked_not_unavailable(self):
        self.assertEqual(
            captions._classify("ERROR: Sign in to confirm you're not a bot")[:2],
            ("blocked", "bot_check"))

    def test_429_is_blocked(self):
        self.assertEqual(captions._classify("HTTP Error 429: Too Many Requests")[1], "bot_check")

    def test_private_and_deleted_are_distinguished(self):
        self.assertEqual(captions._classify("ERROR: Private video")[2], "private")
        self.assertEqual(captions._classify("ERROR: Video unavailable")[2], "deleted")

    def test_unknown_failure_is_error_not_deleted(self):
        self.assertEqual(captions._classify("ERROR: not a known failure at all")[0], "error")


class SilentBotGate(unittest.TestCase):
    """Regression: measured 2026-09-13, the gate exits 0 and only warns.

    yt-dlp printed exit code 0, a title, a description and no player response while
    stderr carried 'HTTP Error 429' and 'Sign in to confirm you're not a bot'. Reading
    the exit code alone turned a transient block into a permanent 'no captions' verdict.
    """
    REAL = ("WARNING: [youtube] 5TIPLsQVSHI: Unable to download webpage: HTTP Error 429: "
            "Too Many Requests\n"
            "WARNING: [youtube] No title found in player responses; falling back to title "
            "from initial data. Other metadata may also be missing\n"
            "WARNING: [youtube] Sign in to confirm you’re not a bot.\n"
            "WARNING: No video formats found!\n")

    def test_gate_is_detected_in_warnings(self):
        self.assertEqual(captions._gate(self.REAL), (True, "bot_check"))

    def test_degraded_extraction_alone_is_still_a_block(self):
        self.assertEqual(
            captions._gate("WARNING: No title found in player responses")[0], True)

    def test_clean_stderr_is_not_a_gate(self):
        self.assertEqual(captions._gate("WARNING: no subtitles for the requested languages"),
                         (False, None))
        self.assertEqual(captions._gate(""), (False, None))

    def test_no_captions_requires_the_player_response(self):
        # Title + description from initial data is NOT evidence the video lacks captions.
        self.assertFalse(captions._saw_player_response({"title": "t", "description": "d"}))
        self.assertTrue(captions._saw_player_response({"duration": 620}))
        self.assertTrue(captions._saw_player_response({"formats": [{"format_id": "18"}]}))

    def test_zero_duration_still_counts_as_seen(self):
        self.assertTrue(captions._saw_player_response({"duration": 0}))

    def test_digest_leads_with_the_diagnosis_not_the_boilerplate(self):
        noisy = ("WARNING: [youtube] No supported JavaScript runtime could be found. Only "
                 "deno is enabled by default; to use another runtime add --js-runtimes "
                 "RUNTIME[:PATH] to your command/config. YouTube extraction without a JS "
                 "runtime has been deprecated. See https://github.com/yt-dlp/wiki/EJS\n"
                 "WARNING: [youtube] Sign in to confirm you're not a bot. "
                 "See https://github.com/yt-dlp/yt-dlp/wiki/FAQ\n")
        d = captions._digest(noisy)
        self.assertTrue(d.startswith("WARNING: [youtube] Sign in to confirm"))
        self.assertNotIn("https://", d)      # links are documentation, not diagnosis


class PacerArithmetic(unittest.TestCase):
    def setUp(self):
        self.slept = []
        self.p = captions.Pacer(base=20, cooldown_start=300, cooldown_cap=3600,
                                sleep=self.slept.append)

    def test_first_call_does_not_wait(self):
        self.assertEqual(self.p.wait(), 0.0)
        self.assertGreater(self.p.wait(), 0.0)

    def test_cooldown_doubles_to_the_cap(self):
        got = [self.p.cooldown_sleep() for _ in range(6)]
        self.assertEqual(got, [300, 600, 1200, 2400, 3600, 3600])

    def test_success_resets_the_cooldown(self):
        self.p.cooldown_sleep()
        self.p.ok()
        self.assertEqual(self.p.cooldown, 300)
        self.assertEqual(self.p.consecutive_blocks, 0)

    def test_consecutive_blocks_count_up(self):
        self.assertEqual([self.p.note_block() for _ in range(3)], [1, 2, 3])

    def test_no_successes_reports_no_rate(self):
        self.assertIsNone(self.p.stats()["seconds_per_video"])
        self.assertIsNone(self.p.stats()["videos_per_hour"])


class Selection(unittest.TestCase):
    def test_risk_vocabulary_carries_no_outcome_words(self):
        # "take profit" stays: it names an exit RULE, not a result. What is banned is any
        # term that selects for remembered wins.
        banned = ("profits", "gain", "100x", "10x", "called it", "winner", "banked",
                  "made money", "nailed", "massive", "insane")
        joined = " ".join(captions.RISK_VOCAB)
        for w in banned:
            self.assertNotIn(w, joined, f"{w!r} would bias selection toward wins")

    def test_settled_states_are_skipped_and_blocked_is_not(self):
        done = {"video_id": "a", "vr_transcripts": [{"video_id": "a"}]}
        gone = {"video_id": "b", "vr_video_stages": [
            {"stage": "TRANSCRIPT_AVAILABLE", "state": "unavailable"}]}
        held = {"video_id": "c", "vr_video_stages": [
            {"stage": "TRANSCRIPT_AVAILABLE", "state": "blocked"}]}
        self.assertFalse(captions._eligible(done, force=False))
        self.assertTrue(captions._eligible(done, force=True))
        self.assertFalse(captions._eligible(gone, force=False))
        self.assertTrue(captions._eligible(held, force=False))

    def test_private_videos_are_never_selected(self):
        self.assertFalse(captions._eligible({"video_id": "d", "availability": "private"}, False))

    def test_tier_order_is_the_spec_order(self):
        self.assertEqual([t[0] for t in captions._tiers()],
                         ["1-sniper-playlist", "1-sniper-channel", "2-risk-vocabulary",
                          "3-dated-calls", "4-benjamin-cowen", "5-crypto-banter"])


class FetchOneDecisions(unittest.TestCase):
    """fetch_one end to end with yt-dlp stubbed. No network, no database."""

    VID = "5TIPLsQVSHI"

    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self._saved = (captions.WORK, captions.TRANSCRIPTS, captions.subprocess.run)
        captions.WORK = self.tmp / "work"
        captions.TRANSCRIPTS = self.tmp / "transcripts"

    def tearDown(self):
        captions.WORK, captions.TRANSCRIPTS, captions.subprocess.run = self._saved
        shutil.rmtree(self.tmp, ignore_errors=True)

    def _stub(self, stdout, stderr="", rc=0, subs=None):
        """subs: {lang: json3 path to copy into the work dir}, as yt-dlp would write them."""
        class Done:
            def __init__(s, o, e, r):
                s.stdout, s.stderr, s.returncode = o, e, r

        def run(argv, **kw):
            home = [a for a in argv if a.startswith("home:")][0][5:]
            for lang, src in (subs or {}).items():
                pathlib.Path(home).mkdir(parents=True, exist_ok=True)
                shutil.copy(src, pathlib.Path(home) / f"{self.VID}.{lang}.json3")
            return Done(stdout, stderr, rc)
        captions.subprocess.run = run

    def test_silent_gate_yields_blocked_and_writes_nothing(self):
        # The exact shape measured on 2026-09-13: rc 0, partial JSON, gate in stderr.
        self._stub(json.dumps({"title": "While Bitcoin Stalls", "description": "..."}),
                   SilentBotGate.REAL, rc=0)
        r = captions.fetch_one(self.VID)
        self.assertEqual(r["status"], "blocked")
        self.assertEqual(r["blocker"], "bot_check")
        self.assertEqual(r["transcripts"], [])
        self.assertIsNone(r["meta"])        # no partial metadata leaks into vr_videos
        self.assertFalse(captions.TRANSCRIPTS.exists())

    def test_genuine_absence_needs_the_player_response(self):
        self._stub(json.dumps({"title": "t", "duration": 620, "upload_date": "20250614",
                               "subtitles": {}, "automatic_captions": {}}),
                   "WARNING: There are no subtitles for the requested languages\n")
        r = captions.fetch_one(self.VID)
        self.assertEqual(r["status"], "no_captions")
        self.assertEqual(r["blocker"], "no_captions")
        self.assertEqual(r["transcripts"], [])
        self.assertEqual(r["meta"]["caption_source"], "none")

    def test_captions_win_over_a_noisy_log(self):
        self._stub(json.dumps({"title": "t", "duration": 620, "upload_date": "20250614",
                               "subtitles": {}, "automatic_captions": {"en": [{}]}}),
                   "WARNING: No supported JavaScript runtime could be found\n",
                   subs={"en": FIXTURE})
        r = captions.fetch_one(self.VID)
        self.assertEqual(r["status"], "ok")
        self.assertEqual(len(r["transcripts"]), 1)
        t = r["transcripts"][0]
        self.assertEqual(t["source_type"], "auto")      # came out of automatic_captions
        self.assertEqual(t["segment_count"], 4)
        self.assertEqual(t["duration_ms"], 9200)
        self.assertEqual(t["retention"], captions.RETENTION)
        self.assertEqual(r["meta"]["caption_source"], "auto")
        self.assertEqual(r["meta"]["caption_langs"], ["en"])

    def test_creator_track_is_labelled_creator(self):
        self._stub(json.dumps({"title": "t", "duration": 620, "upload_date": "20250614",
                               "subtitles": {"en": [{}]}, "automatic_captions": {"en": [{}]}}),
                   subs={"en": FIXTURE})
        r = captions.fetch_one(self.VID)
        self.assertEqual(r["transcripts"][0]["source_type"], "creator")
        self.assertEqual(r["meta"]["caption_source"], "both")   # both tracks exist

    def test_full_text_stays_in_the_cache_not_the_row(self):
        self._stub(json.dumps({"title": "t", "duration": 620, "upload_date": "20250614",
                               "subtitles": {}, "automatic_captions": {"en": [{}]}}),
                   subs={"en": FIXTURE})
        r = captions.fetch_one(self.VID)
        row = r["transcripts"][0]
        self.assertNotIn("text", row)
        self.assertNotIn("segments", row)
        cached = json.loads((captions.TRANSCRIPTS / f"{self.VID}.en.auto.json").read_text())
        self.assertEqual(len(cached["segments"]), 4)
        self.assertEqual(row["local_ref"], f"transcripts/{self.VID}.en.auto.json")

    def test_hard_error_is_classified_and_work_dir_is_cleaned(self):
        self._stub("", "ERROR: [youtube] Private video. Sign in if you've been granted access",
                   rc=1)
        r = captions.fetch_one(self.VID)
        self.assertEqual(r["status"], "unavailable")
        self.assertEqual(r["blocker"], "private")
        self.assertEqual(r["meta"]["availability"], "private")
        self.assertFalse((captions.WORK / self.VID).exists())


class ArgvSafety(unittest.TestCase):
    def test_untrusted_id_never_reaches_argv(self):
        for bad in ("; rm -rf /", "--exec=echo", "short", "", None, "a" * 12):
            with self.assertRaises(ValueError):
                captions.fetch_one(bad)

    def test_no_simulate_is_present(self):
        # --dump-single-json implies simulate, which skips subtitle writing entirely.
        argv = captions._argv("abcdefghijk", "/tmp/x")
        self.assertIn("--no-simulate", argv)
        self.assertIn("en,en-orig", argv)
        self.assertEqual(argv[-1], "https://www.youtube.com/watch?v=abcdefghijk")


if __name__ == "__main__":
    unittest.main(verbosity=2)
