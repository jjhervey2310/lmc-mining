import random, unittest
from market_time import DAY, LookAheadError
from bt_costs import CostModel
from bt.data import Bar, Market
from bt.engine import Order, run
from bt.metrics import summarize
from bt import research, strategies

T0 = 1_700_000_000 - (1_700_000_000 % DAY)
COSTS = CostModel(0.004, 0.008, "test", "unit", slippage=0.001)


def walk(seed, n=400, start=100.0, drift=0.0005, vol=0.03):
    rng = random.Random(seed); out, px = [], start
    for k in range(n):
        o = px; c = o * (1 + rng.gauss(drift, vol)); h = max(o, c) * (1 + abs(rng.gauss(0, 0.005))); l = min(o, c) * (1 - abs(rng.gauss(0, 0.005)))
        out.append(Bar(T0 + k * DAY, o, h, l, c, 1000 + rng.random() * 500)); px = c
    return out


def market(n=400):
    return Market({"BTC": walk(1, n), "AAA": walk(2, n), "BBB": walk(3, n), "DEAD": walk(4, 150)}, {"BTC": (T0, None), "AAA": (T0, None), "BBB": (T0, None), "DEAD": (T0, T0 + 150 * DAY)})


class AsOf(unittest.TestCase):
    def test_view_hides_incomplete_and_future_bars(self):
        m = market(); v = m.as_of(T0 + 10 * DAY + 3600)       # an hour into day 10
        self.assertEqual(len(v.bars("BTC")), 10)                # days 0..9 only
        with self.assertRaises(LookAheadError):
            v.bar_at("BTC", T0 + 10 * DAY)

    def test_universe_excludes_delisted_and_unlisted(self):
        m = market()
        self.assertIn("DEAD", m.as_of(T0 + 100 * DAY).universe())
        self.assertNotIn("DEAD", m.as_of(T0 + 160 * DAY).universe())

    def test_strategy_cannot_see_decision_bar_future(self):
        seen = {}
        def spy(view, pf):
            seen["max_t"] = max(seen.get("max_t", 0), max(b.t for b in view.bars("BTC"))); return []
        run(market(50), spy, COSTS)
        self.assertEqual(seen["max_t"], T0 + 49 * DAY)         # never a bar at/after the last decision close


class Fills(unittest.TestCase):
    def test_buy_fills_next_open_with_costs_and_sell_closes(self):
        m = market(30); fired = {"n": 0}
        def s(view, pf):
            fired["n"] += 1
            if fired["n"] == 1: return [Order("AAA", "buy", 1000, tag="t")]
            if fired["n"] == 3: return [Order("AAA", "sell")]
            return []
        r = run(m, s, COSTS)
        tr = r["trades"][0]
        self.assertEqual(tr.entry_t, T0 + 1 * DAY)              # decided at close of day 0, filled day 1 open
        self.assertAlmostEqual(tr.entry_px, m.bars["AAA"][1].o * (1 + COSTS.per_side()), places=9)
        self.assertEqual(tr.exit_t, T0 + 3 * DAY); self.assertEqual(tr.reason, "signal")

    def test_stop_before_target_and_gap_fills_at_open(self):
        bars = [Bar(T0, 100, 101, 99, 100, 1), Bar(T0 + DAY, 100, 101, 99, 100, 1), Bar(T0 + 2 * DAY, 80, 130, 70, 120, 1)]
        m = Market({"X": bars}, {"X": (T0, None)})
        s = lambda view, pf: [Order("X", "buy", 1000, stop=90, target=125)] if view.t == T0 + DAY else []
        r = run(m, s, COSTS); tr = r["trades"][0]
        self.assertEqual(tr.reason, "stop")
        self.assertAlmostEqual(tr.exit_px, 80 * (1 - COSTS.per_side()), places=9)   # gapped through 90: fills at the open

    def test_costs_reduce_pnl(self):
        m = market(60); s = strategies.buy_and_hold(["AAA"], 1000)
        free = CostModel(0.0, 0.0, "test", "free")
        self.assertLess(run(m, s, COSTS)["final_cash"], run(m, strategies.buy_and_hold(["AAA"], 1000), free)["final_cash"])


class Research(unittest.TestCase):
    def test_folds_do_not_overlap_fit_and_test(self):
        fs = research.folds(T0, T0 + 400 * DAY, 180, 60)
        self.assertTrue(fs)
        for a, fe, ts, te in fs:
            self.assertEqual(fe, ts); self.assertGreater(te, ts)

    def test_walk_forward_counts_trials_and_reports_oos(self):
        m = market(400)
        wf = research.walk_forward(m, lambda **kw: strategies.sma_trend(["AAA", "BBB"], 1000, **kw), [{"fast": 20, "slow": 50}, {"fast": 10, "slow": 40}], COSTS, 180, 60)
        self.assertEqual(wf["trials"], 2 * len(wf["folds"]))
        self.assertIn("total_return", wf["oos"])

    def test_gate_rejects_single_symbol_edge_and_accepts_broad(self):
        bad = {"total_return": 0.5, "symbols_with_profit": 1, "pnl_by_year": {2024: 10, 2025: 5}, "pnl_ex_top": {3: 1}}
        self.assertEqual(research.gate(bad, {"fees_x1.25": {"total_return": 0.3}, "neighbours": []}, 4)["verdict"], "rejected")
        good = {"total_return": 0.5, "symbols_with_profit": 5, "pnl_by_year": {2024: 10, 2025: 5}, "pnl_ex_top": {3: 12}}
        self.assertEqual(research.gate(good, {"fees_x1.25": {"total_return": 0.3}, "neighbours": []}, 4)["verdict"], "accepted")
        self.assertEqual(research.gate(None, None, None)["verdict"], "inconclusive")

    def test_manifest_hashes_are_deterministic(self):
        m = market(50)
        a = research.manifest("x", {"k": 1}, m, COSTS, "rule", [], {}, {}, None, {"verdict": "inconclusive"})
        b = research.manifest("x", {"k": 1}, m, COSTS, "rule", [], {}, {}, None, {"verdict": "inconclusive"})
        self.assertEqual((a["config_hash"], a["data_hash"], a["universe_hash"]), (b["config_hash"], b["data_hash"], b["universe_hash"]))
        self.assertNotEqual(a["config_hash"], research.manifest("x", {"k": 2}, m, COSTS, "rule", [], {}, {}, None, {})["config_hash"])

    def test_monte_carlo_shape(self):
        mc = research.monte_carlo(run(market(300), strategies.buy_and_hold(["AAA", "BBB"], 1000), COSTS), n=50, block=10)
        self.assertLessEqual(mc["terminal_p05"], mc["terminal_p95"]); self.assertLessEqual(mc["mdd_p05"], 0)


if __name__ == "__main__":
    unittest.main()
