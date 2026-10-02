import os
import unittest
from unittest import mock
from bt_costs import CostModel, from_env, stamp


class Costs(unittest.TestCase):
    def test_round_trip_includes_spread_and_slippage(self):
        c = CostModel(0.0022, 0.0038, "kraken", "$10k-50k", spread=0.0005, slippage=0.001)
        self.assertAlmostEqual(c.per_side(taker=True), 0.0053)
        self.assertAlmostEqual(c.round_trip(taker=False), 2 * 0.0037)

    def test_record_carries_tier(self):
        r = CostModel(0.004, 0.008, venue="kraken", tier="base").as_record()
        self.assertEqual((r["venue"], r["tier"], r["maker_fee"]), ("kraken", "base", 0.004))

    def test_percent_not_fraction_rejected(self):
        with self.assertRaises(ValueError):
            CostModel(0.22, 0.38, "kraken", "base")

    def test_nan_and_inf_rejected(self):
        for bad in (float("nan"), float("inf")):
            with self.assertRaises(ValueError):
                CostModel(bad, 0.001, "kraken", "base")

    def test_missing_provenance_rejected(self):
        for v, t in (("", "base"), ("kraken", "unspecified"), ("kraken", "  ")):
            with self.assertRaises(ValueError):
                CostModel(0.001, 0.002, v, t)

    def test_stamp_names_universe_and_fill(self):
        s = stamp(CostModel(0.001, 0.002, "kraken", "base"), "next open")
        self.assertIn("DIAGNOSTIC ONLY", s); self.assertIn("fill=next open", s); self.assertIn("'tier': 'base'", s)

    def test_env_without_fees_refuses(self):
        with mock.patch.dict(os.environ, {}, clear=True), self.assertRaises(SystemExit):
            from_env()


if __name__ == "__main__":
    unittest.main()
