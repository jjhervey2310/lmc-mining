import unittest
from market_time import DAY, LookAheadError, completed_bars, last_completed_index, align_index, assert_completed, ret_over

T0 = 1_700_000_000 - (1_700_000_000 % DAY)   # a UTC midnight
BARS = [{"t": T0 + k * DAY, "c": 100 + k} for k in range(5)]   # opens at day 0..4


class CompletedBars(unittest.TestCase):
    def test_partial_bar_excluded(self):
        # Decision at noon on day 4: day 4's bar is still open, days 0-3 are complete.
        as_of = T0 + 4 * DAY + 12 * 3600
        out = completed_bars(BARS, as_of)
        self.assertEqual([b["t"] for b in out], [T0 + k * DAY for k in range(4)])

    def test_bar_completes_exactly_at_close(self):
        as_of = T0 + 5 * DAY
        self.assertEqual(len(completed_bars(BARS, as_of)), 5)
        self.assertEqual(len(completed_bars(BARS, as_of - 1)), 4)

    def test_input_not_mutated(self):
        before = list(BARS)
        completed_bars(BARS, T0)
        self.assertEqual(BARS, before)

    def test_last_completed_index(self):
        self.assertEqual(last_completed_index(BARS, T0 + 2 * DAY + 1), 1)
        self.assertIsNone(last_completed_index(BARS, T0))


class ReturnOver(unittest.TestCase):
    def test_seven_day_return_uses_calendar_days(self):
        bars = [{"t": T0 + k * DAY, "c": 100 + k} for k in range(10)]
        self.assertAlmostEqual(ret_over(bars, T0 + 9 * DAY, 7), 109 / 102 - 1)

    def test_missing_start_day_is_no_evidence(self):
        bars = [{"t": T0 + k * DAY, "c": 100 + k} for k in range(10) if k != 2]   # day 2 missing
        self.assertIsNone(ret_over(bars, T0 + 9 * DAY, 7))      # start would be day 2
        self.assertIsNotNone(ret_over(bars, T0 + 8 * DAY, 7))   # start is day 1, present

    def test_jittered_timestamps_within_half_a_bar_match(self):
        bars = [{"t": T0 + k * DAY + 37, "c": 100 + k} for k in range(10)]   # CoinGecko-style 00:00:37
        self.assertAlmostEqual(ret_over(bars, T0 + 9 * DAY + 37, 7), 109 / 102 - 1)


class Alignment(unittest.TestCase):
    def test_join_by_timestamp_not_index(self):
        # BTC series is missing day 1: index alignment would pair alt day 3 with btc day 4.
        btc = [b for b in BARS if b["t"] != T0 + 1 * DAY]
        k = align_index(btc, BARS[3]["t"])
        self.assertEqual(btc[k]["t"], BARS[3]["t"])

    def test_align_refuses_incomplete_bar(self):
        as_of = T0 + 3 * DAY + 3600          # day 3 open for an hour
        with self.assertRaises(LookAheadError):
            align_index(BARS, BARS[3]["t"], as_of=as_of)

    def test_assert_completed_violation_fails(self):
        with self.assertRaises(LookAheadError):
            assert_completed(BARS[4], T0 + 4 * DAY + 1)
        self.assertIs(assert_completed(BARS[3], T0 + 4 * DAY), BARS[3])


if __name__ == "__main__":
    unittest.main()
