import os
import unittest
from unittest import mock
from bt_costs import CostModel, from_env


class Costs(unittest.TestCase):
    def test_round_trip_includes_spread_and_slippage(self):
        c = CostModel(0.0022, 0.0038, spread=0.0005, slippage=0.001, venue="kraken", tier="$10k-50k")
        self.assertAlmostEqual(c.per_side(taker=True), 0.0053)
        self.assertAlmostEqual(c.round_trip(taker=False), 2 * 0.0037)

    def test_record_carries_tier(self):
        r = CostModel(0.004, 0.008, venue="kraken", tier="base").as_record()
        self.assertEqual((r["venue"], r["tier"], r["maker_fee"]), ("kraken", "base", 0.004))

    def test_percent_not_fraction_rejected(self):
        with self.assertRaises(ValueError):
            CostModel(0.22, 0.38)

    def test_env_without_fees_refuses(self):
        with mock.patch.dict(os.environ, {}, clear=True), self.assertRaises(SystemExit):
            from_env()


if __name__ == "__main__":
    unittest.main()
