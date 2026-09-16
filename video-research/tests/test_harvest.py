"""harvest: the supervisor. What is tested is that nothing ends the loop.

Every failure mode below has already happened in production at least once, except the
disk floor, which is the one the owner asked for twice before it existed.
"""
import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
import harvest


class FakeClock:
    """Records what would have been slept instead of sleeping."""

    def __init__(self):
        self.slept = []
        self.t = 0.0

    def sleep(self, s):
        self.slept.append(s)
        self.t += s

    def now(self):
        return self.t


class LoopBase(unittest.TestCase):
    def setUp(self):
        self.clock = FakeClock()
        self._cycle, self._sweep, self._free = harvest.cycle, harvest.sweep, harvest.free_mb
        self._run = harvest.store.Run
        self.sweeps = 0

        class NullRun:
            def __init__(self, *a, **k):
                self.processed = self.skipped = self.failed = self.blocked = 0
                self.id = None

            def __enter__(self):
                return self

            def __exit__(self, *a):
                return False

            def save(self, *a, **k):
                pass

        harvest.store.Run = NullRun
        harvest.free_mb = lambda *a, **k: 10 ** 7
        harvest.sweep = self._count_sweep

    def _count_sweep(self):
        self.sweeps += 1
        return {"listings": 1, "new_videos": 0, "blocked": 0, "errored": 0}

    def tearDown(self):
        harvest.cycle, harvest.sweep, harvest.free_mb = self._cycle, self._sweep, self._free
        harvest.store.Run = self._run

    def result(self, **kw):
        base = {"fetched": 10, "blocked": 0, "failed": 0, "skipped": 0,
                "scanned": 10, "pushed": 0, "remaining": 100, "stopped": "completed"}
        base.update(kw)
        return base


class NothingEndsTheLoop(LoopBase):
    def test_a_raising_cycle_does_not_end_the_run(self):
        """The production failure: one exception, process gone, hours lost before anyone looked."""
        calls = []

        def boom(*a, **k):
            calls.append(1)
            raise RuntimeError("yt-dlp exploded")

        harvest.cycle = boom
        harvest.loop(max_cycles=3, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(len(calls), 3, "the loop stopped at the first exception")

    def test_a_raising_cycle_pauses_before_retrying(self):
        harvest.cycle = lambda *a, **k: (_ for _ in ()).throw(ValueError("nope"))
        harvest.loop(max_cycles=2, sleep=self.clock.sleep, now=self.clock.now)
        self.assertIn(harvest.ERROR_PAUSE_S, self.clock.slept,
                      "a permanently failing cycle would spin at full speed")

    def test_a_blocked_cycle_backs_off_and_continues(self):
        seen = []

        def blocked(*a, **k):
            seen.append(1)
            return self.result(fetched=0, blocked=5)

        harvest.cycle = blocked
        harvest.loop(max_cycles=3, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(len(seen), 3, "blocking ended the loop instead of slowing it")
        self.assertEqual(self.clock.slept[:2],
                         [harvest.BLOCK_BACKOFF_START_S, harvest.BLOCK_BACKOFF_START_S * 2],
                         "backoff did not double")

    def test_backoff_is_capped(self):
        harvest.cycle = lambda *a, **k: self.result(fetched=0, blocked=1)
        harvest.loop(max_cycles=12, sleep=self.clock.sleep, now=self.clock.now)
        self.assertLessEqual(max(self.clock.slept), harvest.BLOCK_BACKOFF_CAP_S)

    def test_a_clean_cycle_resets_the_backoff(self):
        """The gate is per-burst. A recovered run must not keep paying an hour a cycle."""
        seq = [self.result(fetched=0, blocked=9), self.result(), self.result(fetched=0, blocked=9)]
        harvest.cycle = lambda *a, **k: seq.pop(0)
        harvest.loop(max_cycles=3, sleep=self.clock.sleep, now=self.clock.now)
        blocks = [s for s in self.clock.slept if s >= harvest.BLOCK_BACKOFF_START_S]
        self.assertEqual(blocks, [harvest.BLOCK_BACKOFF_START_S] * 2,
                         "backoff carried over a successful cycle")


class DiskFloor(LoopBase):
    """Asked for twice: do not fill the machine."""

    def test_a_full_disk_pauses_without_fetching(self):
        called = []
        harvest.cycle = lambda *a, **k: called.append(1) or self.result()
        harvest.free_mb = lambda *a, **k: harvest.DISK_FLOOR_MB - 1
        harvest.loop(max_cycles=2, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(called, [], "fetched anyway with the disk below the floor")

    def test_a_full_disk_does_not_exit(self):
        """Exiting would need a human to restart it, which is the failure this removes."""
        harvest.free_mb = lambda *a, **k: 0
        n = harvest.loop(max_cycles=4, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(n, 4)

    def test_space_returning_resumes_fetching(self):
        free = [0, 0, 10 ** 7]
        harvest.free_mb = lambda *a, **k: free.pop(0) if free else 10 ** 7
        called = []
        harvest.cycle = lambda *a, **k: (called.append(1), self.result(remaining=0))[1]
        harvest.loop(max_cycles=3, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(len(called), 1, "did not resume once space came back")


class DailySweep(LoopBase):
    """Once caught up the job becomes the sweep the owner asked for, not an exit."""

    def test_being_caught_up_does_not_end_the_loop(self):
        harvest.cycle = lambda *a, **k: self.result(fetched=0, remaining=0)
        n = harvest.loop(max_cycles=3, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(n, 3)

    def test_the_first_caught_up_cycle_sweeps(self):
        harvest.cycle = lambda *a, **k: self.result(fetched=0, remaining=0)
        harvest.loop(max_cycles=1, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(self.sweeps, 1)

    def test_it_does_not_sweep_every_cycle(self):
        """Re-enumerating 8,000 videos every hour is a good way to earn a bot check."""
        harvest.cycle = lambda *a, **k: self.result(fetched=0, remaining=0)
        harvest.loop(max_cycles=5, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(self.sweeps, 1)

    def test_it_sweeps_again_after_the_interval(self):
        harvest.cycle = lambda *a, **k: self.result(fetched=0, remaining=0)
        harvest.loop(max_cycles=40, sleep=self.clock.sleep, now=self.clock.now)
        self.assertGreaterEqual(self.sweeps, 2, "the daily sweep never came back round")

    def test_a_raising_sweep_does_not_end_the_loop(self):
        harvest.cycle = lambda *a, **k: self.result(fetched=0, remaining=0)
        harvest.sweep = lambda: (_ for _ in ()).throw(RuntimeError("listing gated"))
        n = harvest.loop(max_cycles=3, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(n, 3)

    def test_work_outranks_the_sweep(self):
        """While anything is still unfetched, sweeping is not what the time is for."""
        harvest.cycle = lambda *a, **k: self.result(remaining=500)
        harvest.loop(max_cycles=3, sleep=self.clock.sleep, now=self.clock.now)
        self.assertEqual(self.sweeps, 0)


class CycleComposition(unittest.TestCase):
    """A cycle fetches, then scans. A failure in the tail must not lose the fetch."""

    def setUp(self):
        self._ing, self._sel = harvest.captions.ingest_batch, harvest.captions.select_batch
        self._scan, self._push = harvest.scan.run, harvest.push_text.push
        harvest.captions.ingest_batch = lambda **k: {
            "processed": 7, "blocked": 0, "failed": 0, "skipped": 1, "stopped": "completed"}
        harvest.captions.select_batch = lambda *a, **k: ["x"] * 12
        harvest.scan.run = lambda *a, **k: {"scanned": 7}
        harvest.push_text.push = lambda **k: {"pushed": 3}

    def tearDown(self):
        harvest.captions.ingest_batch, harvest.captions.select_batch = self._ing, self._sel
        harvest.scan.run, harvest.push_text.push = self._scan, self._push

    def test_a_cycle_reports_what_it_did(self):
        out = harvest.cycle()
        self.assertEqual((out["fetched"], out["scanned"], out["pushed"], out["remaining"]),
                         (7, 7, 3, 12))

    def test_a_failing_scan_does_not_lose_the_fetch(self):
        harvest.scan.run = lambda *a, **k: (_ for _ in ()).throw(OSError("cache gone"))
        out = harvest.cycle()
        self.assertEqual(out["fetched"], 7)
        self.assertIn("scan_error", out)

    def test_a_failing_push_does_not_lose_the_fetch(self):
        harvest.push_text.push = lambda **k: (_ for _ in ()).throw(TimeoutError("slow"))
        out = harvest.cycle()
        self.assertEqual(out["fetched"], 7)
        self.assertIn("push_error", out)

    def test_an_unreadable_remainder_is_none_not_zero(self):
        """Zero means caught up and triggers the sweep. Unknown must not masquerade as it."""
        harvest.captions.select_batch = lambda *a, **k: (_ for _ in ()).throw(OSError("db"))
        self.assertIsNone(harvest.cycle()["remaining"])

    def test_nothing_fetched_means_nothing_to_scan(self):
        harvest.captions.ingest_batch = lambda **k: {
            "processed": 0, "blocked": 3, "failed": 0, "skipped": 0, "stopped": "blocked"}
        scanned = []
        harvest.scan.run = lambda *a, **k: scanned.append(1) or {"scanned": 0}
        harvest.cycle()
        self.assertEqual(scanned, [], "scanned the whole cache after fetching nothing")


class SweepShape(unittest.TestCase):
    """inventory.refresh returns a list of listings, not a summary."""

    def setUp(self):
        self._refresh = harvest.inventory.refresh

    def tearDown(self):
        harvest.inventory.refresh = self._refresh

    def test_new_videos_are_summed_across_listings(self):
        harvest.inventory.refresh = lambda *a, **k: [
            {"persisted": 3}, {"persisted": 0}, {"persisted": 5}]
        self.assertEqual(harvest.sweep()["new_videos"], 8)

    def test_blocked_and_errored_listings_are_counted_not_swallowed(self):
        harvest.inventory.refresh = lambda *a, **k: [
            {"persisted": 1}, {"blocker_kind": "bot_check"}, {"error": "boom"}]
        out = harvest.sweep()
        self.assertEqual((out["blocked"], out["errored"], out["listings"]), (1, 1, 3))

    def test_a_missing_persisted_key_counts_as_zero_not_a_crash(self):
        harvest.inventory.refresh = lambda *a, **k: [{"error": "gated"}]
        self.assertEqual(harvest.sweep()["new_videos"], 0)


if __name__ == "__main__":
    unittest.main(verbosity=0, exit=False)
    print("OK")
