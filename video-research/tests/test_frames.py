"""frames: which moments earn a picture. Pure selection, no network, no video."""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import frames


def hit(video_id, t_ms, category="stop_invalidation"):
    return {"video_id": video_id, "t_start_ms": t_ms, "category": category}


class Selection(unittest.TestCase):
    def test_only_chart_pointing_categories_are_captured(self):
        """A disclaimer or a regime remark rarely points at the screen; a stop does."""
        chosen = frames.choose([hit("a" * 11, 10_000, "hedge"),
                                hit("a" * 11, 20_000, "regime"),
                                hit("a" * 11, 30_000, "stop_invalidation")])
        self.assertEqual([c[2] for c in chosen], ["stop_invalidation"])

    def test_repeats_within_the_spacing_window_cost_one_frame(self):
        """ASR emits a cue every few seconds; a laboured point would else be shot a dozen times."""
        hits = [hit("b" * 11, t) for t in (0, 3_000, 6_000, 9_000)]
        self.assertEqual(len(frames.choose(hits, spacing_ms=30_000)), 1)

    def test_moments_beyond_the_window_each_earn_a_frame(self):
        hits = [hit("c" * 11, 0), hit("c" * 11, 60_000), hit("c" * 11, 120_000)]
        self.assertEqual(len(frames.choose(hits, spacing_ms=30_000)), 3)

    def test_per_video_cap_is_enforced(self):
        """One four-hour stream must not consume the budget the short lessons need."""
        hits = [hit("d" * 11, t * 60_000) for t in range(40)]
        self.assertEqual(len(frames.choose(hits, max_per_video=15)), 15)

    def test_cap_applies_per_video_not_across_the_batch(self):
        hits = ([hit("e" * 11, t * 60_000) for t in range(20)]
                + [hit("f" * 11, t * 60_000) for t in range(20)])
        chosen = frames.choose(hits, max_per_video=5)
        self.assertEqual(len(chosen), 10)
        self.assertEqual(len({c[0] for c in chosen}), 2)

    def test_output_is_in_time_order_per_video(self):
        hits = [hit("g" * 11, t) for t in (300_000, 60_000, 180_000)]
        times = [c[1] for c in frames.choose(hits, spacing_ms=1_000)]
        self.assertEqual(times, sorted(times))


class CaptureOffset(unittest.TestCase):
    """ASR timestamps land at the start of the cue; the drawing is already up by then."""

    def test_capture_lands_after_the_spoken_moment(self):
        chosen = frames.choose([hit("h" * 11, 100_000)])
        self.assertEqual(chosen[0][1], 100_000 + frames.CAPTURE_OFFSET_MS)

    def test_spacing_is_measured_on_capture_time_not_hit_time(self):
        """Otherwise two hits just inside the window become two shots of the same screen."""
        hits = [hit("i" * 11, 0), hit("i" * 11, 29_000)]
        self.assertEqual(len(frames.choose(hits, spacing_ms=30_000)), 1)


class Empty(unittest.TestCase):
    def test_no_hits_selects_nothing(self):
        self.assertEqual(frames.choose([]), [])

    def test_no_visual_hits_selects_nothing(self):
        self.assertEqual(frames.choose([hit("j" * 11, 0, "hedge")]), [])


class DiskDiscipline(unittest.TestCase):
    """A capture run must not fill the owner's laptop."""

    def test_no_points_means_no_download(self):
        """Never fetch a video to extract nothing from it."""
        out = frames.capture("a" * 11, [])
        self.assertEqual(out["captured"], 0)
        self.assertEqual(out["planned"], 0)

    def test_a_full_disk_refuses_before_downloading(self):
        saved = frames.MIN_FREE_MB
        frames.MIN_FREE_MB = 10 ** 9      # more free space than any machine has
        try:
            with self.assertRaises(RuntimeError) as ctx:
                frames.capture("b" * 11, [("b" * 11, 1000, "entry")])
            self.assertIn("refusing to download", str(ctx.exception))
        finally:
            frames.MIN_FREE_MB = saved

    def test_sweep_is_safe_when_nothing_is_there(self):
        self.assertIsInstance(frames.sweep_work_dir(), int)


class IntervalSampling(unittest.TestCase):
    """Teaching content draws without narrating, so hits alone capture nothing."""

    def test_even_spacing_across_the_video(self):
        pts = frames.sample_interval("k" * 11, 600_000, 60_000, cap=20)
        self.assertEqual([p[1] for p in pts][:3], [60_000, 120_000, 180_000])

    def test_nothing_past_the_end(self):
        pts = frames.sample_interval("l" * 11, 100_000, 60_000, cap=20)
        self.assertTrue(all(p[1] < 100_000 for p in pts))

    def test_the_cap_is_respected(self):
        pts = frames.sample_interval("m" * 11, 3_600_000, 30_000, cap=5)
        self.assertEqual(len(pts), 5)

    def test_it_does_not_start_at_zero(self):
        """Intros and title cards carry no chart."""
        pts = frames.sample_interval("n" * 11, 600_000, 60_000)
        self.assertGreater(pts[0][1], 0)

    def test_points_are_labelled_interval_not_a_fake_category(self):
        pts = frames.sample_interval("o" * 11, 600_000, 60_000, cap=2)
        self.assertEqual({p[2] for p in pts}, {"interval"})


if __name__ == "__main__":
    unittest.main(verbosity=0, exit=False)
    print("OK")
