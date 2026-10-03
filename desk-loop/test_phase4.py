"""Phase 4 tournament infrastructure tests — PHASE4-PREREGISTRATION.md v2. Synthetic bars only; no snapshot, no network."""
import inspect, math, re, unittest
from market_time import DAY
from bt_costs import CostModel, scaled
from bt.data import Bar, Market
from bt.engine import Order, run, last_reliable_close
from bt.metrics import summarize
from bt import research, strategies, phase4, universe as U
from bt.regime import RegimeSeries

T0 = 1_704_067_200                      # 2024-01-01 00:00 UTC
COSTS = CostModel(0.001, 0.001, "t", "t")


def bars(closes, t0=T0, vol=1000.0, vols=None):
    out = []
    for i, c in enumerate(closes):
        o = closes[i - 1] if i else c
        v = vols[i] if vols is not None else vol
        out.append(Bar(t0 + i * DAY, o, max(o, c) * 1.001, min(o, c) * 0.999, c, v))
    return out


def trend(n, start=100.0, drift=0.002, phase=0.0):
    return [start * math.exp(drift * i) * (1 + 0.01 * math.sin(i / 5.0 + phase)) for i in range(n)]


def mkt(names=("AAA", "BBB", "CCC"), n=120, vols=None, listings=None, extra=None):
    bs = {s: bars(trend(n, phase=j), vols=(vols or {}).get(s)) for j, s in enumerate(names)}
    if extra:
        bs.update(extra)
    ls = listings or {s: (T0, None) for s in bs}
    return Market(bs, ls)


class ExclusionMap(unittest.TestCase):
    def test_frozen_contents(self):
        self.assertEqual(U.EXCLUDED, frozenset("USDT USDC DAI PYUSD USDS FDUSD TUSD GUSD USDP EURC EUROC WBTC WETH CBETH CBBTC STETH RETH LSETH".split()))
        self.assertTrue(U.is_excluded("WBTC-USD")); self.assertTrue(U.is_excluded("usdc/usd")); self.assertFalse(U.is_excluded("BTC-USD"))


class UniverseBuilder(unittest.TestCase):
    def test_top_n_by_mean_dollar_volume_ties_by_symbol(self):
        v = {"AAA": [10.0] * 120, "BBB": [50.0] * 120, "CCC": [50.0] * 120, "DDD": [5.0] * 120, "USDC": [1e6] * 120}
        m = mkt(("AAA", "BBB", "CCC", "DDD", "USDC"), vols=v)
        r = U.rank_at(m, T0 + 10 * DAY, lookback=5)
        self.assertNotIn("USDC", [s for s, _ in r])                        # excluded even at the highest volume
        self.assertEqual([s for s, _ in r][:2], ["BBB", "CCC"])            # equal dollar volume -> symbol ascending (BBB before CCC)
        uni = U.monthly_top_volume(m, top_n=2, lookback=5)
        self.assertEqual(uni.at(T0 + 40 * DAY), frozenset({"BBB", "CCC"}))

    def test_all_lookback_bars_required_no_forward_fill(self):
        m = mkt(("AAA", "BBB"), n=70)
        hole = Bar(T0 + 10 * DAY, 0, 0, 0, 0, 0)
        m2 = Market({"AAA": [b for b in m.bars["AAA"] if b.t != hole.t], "BBB": m.bars["BBB"]}, m.listings)
        self.assertEqual([s for s, _ in U.rank_at(m2, T0 + 12 * DAY, lookback=5)], ["BBB"])      # the gap is inside AAA's window
        self.assertEqual([s for s, _ in U.rank_at(m2, T0 + 20 * DAY, lookback=5)], ["AAA", "BBB"])  # clean window again

    def test_first_eligible_close_then_frozen_until_next_month(self):
        m = mkt(n=100)
        uni = U.monthly_top_volume(m, top_n=2, lookback=10)
        self.assertEqual(uni.times[0], T0 + 10 * DAY)                      # first decision close with 10 completed bars
        self.assertEqual(U.month_of(uni.times[1] - DAY), (2024, 2))        # next ranking: first close of February
        self.assertEqual(uni.times[1], T0 + 32 * DAY)                      # Feb 1 bar completes at Feb 2 00:00
        self.assertEqual(uni.at(T0 + 10 * DAY), uni.at(T0 + 31 * DAY))     # frozen inside January
        self.assertEqual(uni.at(T0 + 5 * DAY), frozenset())                # nothing before the first ranking
        self.assertEqual(len({U.month_of(t - DAY) for t in uni.times}), len(uni.times))   # one ranking per month

    def test_ranking_sees_only_completed_bars(self):
        m = mkt(n=60)
        t_dec = T0 + 30 * DAY
        base = U.rank_at(m, t_dec, lookback=5)
        spiked = dict(m.bars); b = spiked["CCC"][30]
        spiked["CCC"] = spiked["CCC"][:30] + [Bar(b.t, b.o, b.h, b.l, b.c, 1e12)] + spiked["CCC"][31:]   # the bar OPENING at t_dec
        self.assertEqual(U.rank_at(Market(spiked, m.listings), t_dec, lookback=5), base)
        trunc = Market({s: [x for x in bs if x.t + DAY <= t_dec] for s, bs in m.bars.items()}, m.listings)
        self.assertEqual(U.rank_at(trunc, t_dec, lookback=5), base)

    def test_unlisted_and_delisted_names_are_not_ranked(self):
        m = mkt(listings={"AAA": (T0, None), "BBB": (T0 + 50 * DAY, None), "CCC": (T0, T0 + 20 * DAY)})
        names = [s for s, _ in U.rank_at(m, T0 + 30 * DAY, lookback=5)]
        self.assertEqual(names, ["AAA"])

    def test_manifest_and_hash(self):
        m = mkt(n=100)
        a = U.monthly_top_volume(m, top_n=2, lookback=10); b = U.monthly_top_volume(m, top_n=3, lookback=10)
        self.assertEqual(a.membership_hash(), U.monthly_top_volume(m, top_n=2, lookback=10).membership_hash())
        self.assertNotEqual(a.membership_hash(), b.membership_hash())
        man = a.manifest()
        self.assertEqual(man["months"], len(a.times)); self.assertEqual(man["memberships"][0]["month"], "2024-01"); self.assertIn("USDT", man["excluded"])


class DynamicUniverseInEngine(unittest.TestCase):
    def test_entries_only_from_members_and_held_name_keeps_its_exit_rule(self):
        up = trend(60, drift=0.01); crash = [up[-1] * math.exp(-0.05 * (i + 1)) for i in range(30)]
        m = Market({"AAA": bars(up + crash), "BBB": bars(trend(90, drift=0.0))}, {"AAA": (T0, None), "BBB": (T0, None)})
        uni = U.UniverseSeries([T0 + DAY, T0 + 40 * DAY], [frozenset({"AAA"}), frozenset({"BBB"})], [[], []], 1, 5, U.EXCLUDED, DAY)
        r = run(m, strategies.sma_trend(None, fast=3, slow=6), COSTS, universe=uni)
        a = [t for t in r["trades"] if t.symbol == "AAA"]
        self.assertEqual(len(a), 1)                                         # entered while a member, never re-entered after leaving
        self.assertGreater(a[0].exit_t, T0 + 60 * DAY)                      # held past the day-40 drop-out, closed by its own trend break
        self.assertEqual(a[0].reason, "signal")
        self.assertFalse(any(t.symbol == "BBB" for t in r["trades"]) and False)
        self.assertEqual(r["universe"], "dynamic")
        v = m.as_of(T0 + 50 * DAY, universe=uni)
        self.assertEqual(v.universe(), ["BBB"]); self.assertTrue(v.closes("AAA"))   # bars still served for the non-member


class CostSets(unittest.TestCase):
    def test_three_cost_sets(self):
        self.assertAlmostEqual(phase4.COST_CANONICAL.per_side(), 0.0050, places=12)
        self.assertAlmostEqual(phase4.COST_STRESS.per_side(), 0.00625, places=12)      # x1.25 on EVERY component, not fees only
        self.assertAlmostEqual(phase4.COST_SEVERE.per_side(), 0.0095, places=12)
        self.assertIn("ASSUMED", phase4.COST_CANONICAL.tier); self.assertIn("never a verdict input", phase4.COST_SEVERE.tier)
        self.assertEqual(phase4.COST_CANONICAL.venue, "kraken"); self.assertIn("x1.25", phase4.COST_STRESS.tier)

    def test_scaled_keeps_phase2_behaviour_when_spread_and_slippage_are_zero(self):
        c = scaled(CostModel(0.004, 0.008, "t", "t"), 1.25)
        self.assertAlmostEqual(c.taker_fee, 0.01); self.assertEqual(c.spread, 0.0)

    def test_walk_forward_stress_includes_spread_and_slippage(self):
        m = mkt(n=200)
        wf = research.walk_forward(m, lambda **kw: strategies.sma_trend(["AAA", "BBB", "CCC"], **kw), [{"fast": 3, "slow": 8}], phase4.COST_CANONICAL, 60, 30)
        direct = research.continuous_oos(m, lambda **kw: strategies.sma_trend(["AAA", "BBB", "CCC"], **kw), wf["folds"], phase4.COST_STRESS)
        self.assertLessEqual(wf["oos_fee_stress"]["total_return"], wf["oos"]["total_return"] + 1e-12)
        self.assertEqual(direct["trades"][0].entry_px, direct["trades"][0].entry_px)   # runs under the stressed model


class ContinuousOOS(unittest.TestCase):
    def factory(self):
        return lambda **kw: strategies.sma_trend(["AAA", "BBB", "CCC"], **kw)

    def test_positions_carry_across_fold_boundaries(self):
        m = mkt(n=260)
        wf = research.walk_forward(m, self.factory(), [{"fast": 3, "slow": 8}, {"fast": 5, "slow": 12}], COSTS, 60, 40)
        self.assertGreaterEqual(len(wf["folds"]), 3)
        self.assertGreater(wf["boundary"]["eod_exits_interior"], 0)           # the per-fold run liquidates at every boundary
        cont = research.continuous_oos(m, self.factory(), wf["folds"], COSTS)
        self.assertEqual(cont["eod_exits"], sum(1 for t in cont["trades"] if t.reason == "eod"))
        self.assertLessEqual(cont["eod_exits"], 3)                            # only the sample end
        self.assertLess(len(cont["trades"]), sum(p["oos"]["trades"] for p in wf["folds"]))
        self.assertEqual(len(cont["param_switches"]), len(wf["folds"]))
        self.assertEqual(cont["equity"][0][0], wf["folds"][0]["test"][0] + DAY); self.assertEqual(cont["equity"][-1][0], wf["folds"][-1]["test"][1])
        self.assertEqual(wf["boundary"]["eod_exits_all"], sum(p["eod_exits"] for p in wf["folds"]))

    def test_parameters_switch_exactly_at_the_boundary(self):
        m = mkt(n=200)
        log = []
        def factory(**kw):
            def s(view, pf):
                log.append((view.t, kw["k"])); return []
            return s
        picks = [{"test": (T0 + 100 * DAY, T0 + 130 * DAY), "params": {"k": 1}}, {"test": (T0 + 130 * DAY, T0 + 160 * DAY), "params": {"k": 2}}]
        research.continuous_oos(m, factory, picks, COSTS)
        for t, k in log:
            self.assertEqual(k, 1 if t < T0 + 130 * DAY else 2, t)
        self.assertEqual(min(t for t, _ in log), T0 + 101 * DAY); self.assertEqual(max(t for t, _ in log), T0 + 160 * DAY)

    def test_boundary_dependency_rule(self):
        mk = lambda finals, eods: [{"start_cash": 100.0, "final_cash": f, "eod_exits": 1 if e else 0, "eod_pnl": e} for f, e in zip(finals, eods)]
        ok = research.boundary_dependency(mk([110, 110, 110], [1.0, 1.0, 50.0]))      # last fold's eod never counts
        self.assertFalse(ok["inconclusive"]); self.assertEqual(ok["eod_exits_interior"], 2); self.assertEqual(ok["eod_exits_all"], 3)
        big = research.boundary_dependency(mk([110, 110, 110], [8.0, 8.0, 0.0]))
        self.assertTrue(big["exceeds_threshold"]); self.assertTrue(big["inconclusive"])
        flip = research.boundary_dependency(mk([101, 101, 101], [3.0, 0.0, 0.0]))
        self.assertTrue(flip["flips_sign"]); self.assertTrue(flip["inconclusive"])
        self.assertFalse(research.boundary_dependency([])["inconclusive"])


class ScaleInvariance(unittest.TestCase):
    def test_slot_sizing_is_scale_invariant(self):
        m = mkt(n=200)
        f = lambda **kw: strategies.sma_trend(["AAA", "BBB", "CCC"], **kw)
        wf = research.walk_forward(m, f, [{"fast": 3, "slow": 8}], COSTS, 60, 30)
        sc = research.scale_invariance(m, f, wf["folds"], COSTS, cash_a=10_000, cash_b=100_000)
        self.assertTrue(sc["pass"]); self.assertLessEqual(sc["max_abs_diff"], 1e-6); self.assertEqual(sc["trades"][0], sc["trades"][1])


class DelistingStress(unittest.TestCase):
    def dead_market(self):
        n = 150
        closes = [100.0] * n
        vols = [20_000.0] * 140 + [1.0] * 10                                   # dollar volume 2.0M/day then 100/day for the last 10 bars
        dead = bars(closes, vols=vols)
        m = Market({"DEAD": dead, "BTC": bars([100.0] * 200)}, {"DEAD": (T0, T0 + n * DAY), "BTC": (T0, None)})
        return m, dead

    def test_canonical_mild_tail_cells(self):
        m, dead = self.dead_market()
        s = strategies.buy_and_hold(["DEAD"])
        base = run(m, strategies.buy_and_hold(["DEAD"]), COSTS)
        self.assertEqual(base["trades"][0].reason, "delisted"); self.assertAlmostEqual(base["trades"][0].exit_px, dead[-1].c * (1 - COSTS.per_side()))
        for label, cell in phase4.DELISTING_CELLS.items():
            r = run(m, strategies.buy_and_hold(["DEAD"]), COSTS, delisting=phase4.delisting_cfg(**cell))
            tr = r["trades"][0]
            self.assertEqual(tr.reason, "delisted_stress", label)
            self.assertAlmostEqual(tr.exit_px, 100.0 * (1 - cell["haircut"]) * (1 - COSTS.per_side()), msg=label)   # last reliable close is 100 (bars <= day 139)
        tail = run(m, strategies.buy_and_hold(["DEAD"]), COSTS, delisting=phase4.delisting_cfg(20, 1.0))["trades"][0]
        self.assertEqual(tail.exit_px, 0.0); self.assertAlmostEqual(tail.ret, -1.0)

    def test_floor_scales_with_slot_and_unrecoverable_when_nothing_qualifies(self):
        m, dead = self.dead_market()
        r = run(m, strategies.buy_and_hold(["DEAD"]), COSTS, start_cash=10_000_000, delisting=phase4.delisting_cfg(10, 0.5))   # slot $1M -> floor $10M > $2M/day
        self.assertEqual(r["trades"][0].reason, "delisted_unrecoverable"); self.assertEqual(r["trades"][0].exit_px, 0.0)
        r = run(m, strategies.buy_and_hold(["DEAD"]), COSTS, start_cash=10_000, delisting=phase4.delisting_cfg(10, 0.5))       # slot $1k -> floor max(50k, 10k) = 50k < 2M
        self.assertEqual(r["trades"][0].reason, "delisted_stress")

    def test_last_reliable_close_is_a_rolling_median_since_entry(self):
        m, dead = self.dead_market()
        self.assertEqual(last_reliable_close(m, "DEAD", T0, T0 + 150 * DAY, 50_000), 100.0)
        self.assertIsNone(last_reliable_close(m, "DEAD", T0 + 141 * DAY, T0 + 150 * DAY, 50_000))      # entered after liquidity left
        self.assertIsNone(last_reliable_close(m, "DEAD", T0, T0 + 150 * DAY, 3_000_000))
        self.assertIsNone(last_reliable_close(m, "DEAD", T0, T0 + 2 * DAY, 1))                          # fewer than 3 bars: never a single print

    def test_exposure_shares_and_materiality(self):
        from bt.engine import Trade
        mk = lambda s, pnl, reason="signal": Trade(s, 0, 1, 1, 1, 1, 0, pnl, reason)
        listings = {"AAA": (0, None), "DEAD": (0, 100)}
        e = research.delisting_exposure([mk("AAA", 10), mk("AAA", -10), mk("AAA", 10), mk("DEAD", 2, "delisted")], listings)
        self.assertTrue(e["material"]); self.assertEqual(e["trades"], 1); self.assertAlmostEqual(e["trade_share"], 0.25); self.assertAlmostEqual(e["pnl_abs_share"], 2 / 32)
        e2 = research.delisting_exposure([mk("AAA", 10)] * 19 + [mk("DEAD", 0.5)], listings)
        self.assertFalse(e2["material"]); self.assertEqual(e2["exits_by_delisting"], 0)


class SizingSensitivity(unittest.TestCase):
    def test_gross_cap_changes_the_slot_only(self):
        m = mkt(n=30)
        s = lambda view, pf: [Order("AAA", "buy")] if view.t == T0 + DAY else []
        full = run(m, s, COSTS, gross_cap=1.0); part = run(m, s, COSTS, gross_cap=0.9)
        fills = lambda r: [float(e[3]) for e in r["events"] if e[2] == "fill"]
        self.assertEqual(fills(full), [1000.0]); self.assertEqual(fills(part), [900.0])
        self.assertEqual(part["sizing"]["gross_cap"], 0.9); self.assertEqual(phase4.SIZING_SENSITIVITIES, (0.95, 0.90))


class RegimeReporting(unittest.TestCase):
    def test_per_state_attribution_with_filter_off(self):
        m = mkt(n=120)
        r = run(m, strategies.sma_trend(["AAA", "BBB", "CCC"], fast=3, slow=8), COSTS)
        self.assertGreater(len(r["trades"]), 0)
        times = [T0 + k * DAY for k in range(1, 121)]
        entries = [("risk_off" if k < 60 else "neutral", None, {}, {}) for k in range(1, 121)]
        series = RegimeSeries(times, entries, 0.02, 0.9, DAY)
        a = research.regime_attribution(r, series)
        self.assertEqual(sum(v["trades"] for v in a.values()), len(r["trades"]))
        self.assertEqual(a["risk_on"]["trades"], 0); self.assertGreater(a["risk_off"]["trades"] + a["neutral"]["trades"], 0)   # entries happened outside risk_on: filter OFF
        self.assertEqual(sum(v["bars"] for v in a.values()), len(r["equity"]) - 1)
        prod = 1.0
        for v in a.values():
            prod *= 1 + v["curve_return"]
        self.assertAlmostEqual(prod, r["equity"][-1][1] / r["equity"][0][1], places=9)


class Advancement(unittest.TestCase):
    def test_thirds(self):
        eq = [(T0 + k * DAY, 100 + k) for k in range(30)]
        th = research.chronological_thirds(eq)
        self.assertEqual(th["positive"], 3); self.assertTrue(th["pass"])
        eq2 = [(T0 + k * DAY, 100 - k) for k in range(30)]
        self.assertFalse(research.chronological_thirds(eq2)["pass"])

    def test_eight_conditions(self):
        gate = {"verdict": "accepted", "checks": {"not_single_year": True, "symbols>=min": True, "not_top3_dependent": True}}
        cont = {"total_return": 0.3, "trades": 150}
        ok = research.advancement(gate, cont, {"total_return": 0.1}, {"pass": True}, {"pass": True}, {"material": False, "cells": {}}, {"inconclusive": False})
        self.assertEqual(ok["verdict"], "accepted"); self.assertTrue(ok["research_accepted"]); self.assertFalse(ok["trade_approved"])
        self.assertEqual(set(ok["checks"]), set(research.ADVANCEMENT_CONDITIONS))
        few = research.advancement(gate, {"total_return": 0.3, "trades": 99}, {"total_return": 0.1}, {"pass": True}, {"pass": True}, {"material": False}, {"inconclusive": False})
        self.assertEqual(few["verdict"], "rejected"); self.assertEqual(few["failed"], ["oos_trades>=100"])
        dl = research.advancement(gate, cont, {"total_return": 0.1}, {"pass": True}, {"pass": True}, {"material": True, "cells": {"canonical": {"total_return": -0.1}}}, {"inconclusive": False})
        self.assertEqual(dl["failed"], ["survives_canonical_delisting"])
        bd = research.advancement(gate, cont, {"total_return": 0.1}, {"pass": True}, {"pass": True}, {"material": False}, {"inconclusive": True})
        self.assertEqual(bd["verdict"], "inconclusive")
        stress = research.advancement(gate, cont, {"total_return": -0.01}, {"pass": True}, {"pass": True}, {"material": False}, {"inconclusive": False})
        self.assertIn("positive_under_fee_stress", stress["failed"])


class FrozenConfig(unittest.TestCase):
    def test_candidates_grids_and_roles(self):
        self.assertEqual(set(phase4.CANDIDATES), {"sma_trend", "momentum_top", "mean_reversion", "breakout20"})
        for name, spec in phase4.CANDIDATES.items():
            self.assertLessEqual(len(spec["grid"]), 4, name)
        self.assertEqual(phase4.CANDIDATES["sma_trend"]["grid"], [{"fast": 20, "slow": 100}, {"fast": 50, "slow": 200}])
        self.assertEqual(sorted((g["lookback"], g["n"]) for g in phase4.CANDIDATES["momentum_top"]["grid"]), [(60, 5), (60, 10), (90, 5), (90, 10)])
        self.assertEqual(sorted((g["dip"], g["n"]) for g in phase4.CANDIDATES["mean_reversion"]["grid"]), [(0.08, 20), (0.08, 30), (0.1, 20), (0.1, 30)])
        self.assertEqual(phase4.CANDIDATES["breakout20"]["role"], "negative_control")
        self.assertEqual((phase4.FIT_DAYS, phase4.TEST_DAYS, phase4.SIZING, phase4.MIN_OOS_TRADES), (365, 90, {"max_positions": 10, "gross_cap": 1.0}, 100))
        self.assertEqual(phase4.DELISTING_CELLS["canonical"], {"mult": 10, "haircut": 0.50}); self.assertEqual(len(phase4.DELISTING_GRID), 9)
        self.assertEqual((U.TOP_N, U.LOOKBACK), (20, 90))

    def test_phase4_and_cli_never_store(self):
        self.assertIsNone(re.search(r"save_run|sb_upsert|sb_insert|store\.", inspect.getsource(phase4)))
        with open(__file__.replace("test_phase4.py", "bt_phase4.py")) as f:
            src = f.read()
        self.assertIsNone(re.search(r"add_argument\(\"--(no-)?store|save_run|from bt import.*store", src))


class RunnerSmoke(unittest.TestCase):
    def test_full_table_on_synthetic_data_small_windows(self):
        names = tuple(f"S{j:02d}" for j in range(8)) + ("BTC",)
        bs = {s: bars(trend(300, drift=0.001 + 0.0005 * (j % 3), phase=j), vols=[1000.0 + 100 * j] * 300) for j, s in enumerate(names)}
        bs["DEAD"] = bars(trend(200, drift=0.002), vols=[5000.0] * 200)
        ls = {s: (T0, None) for s in names}; ls["DEAD"] = (T0, T0 + 200 * DAY)
        m = Market(bs, ls)
        table = phase4.run_table(m, fit_days=60, test_days=30, with_regime=False, mc_n=20, log=lambda *a: None)
        self.assertEqual(set(table["candidates"]), set(phase4.CANDIDATES))
        for name, man in table["candidates"].items():
            self.assertIn(man["verdict"], ("accepted", "rejected", "inconclusive", "control: not evaluated"), name)
            for k in ("scale_invariance", "chronological_thirds", "boundary", "delisting", "cost_sensitivities", "sizing_sensitivities", "universe_membership_hash", "limitation", "advancement", "folds"):
                self.assertIn(k, man, (name, k))
            self.assertEqual(set(man["cost_sensitivities"]), {"stress", "severe"}); self.assertEqual(set(man["sizing_sensitivities"]), {"gross_cap=0.95", "gross_cap=0.9"})
            self.assertEqual(set(man["delisting"]["cells"]), {"canonical", "mild", "tail"})
            self.assertTrue(man["scale_invariance"]["pass"], name)
            self.assertEqual(man["regime"]["applied"], False)
        self.assertIsNone(table["candidates"]["breakout20"]["trial_count"])
        folds = len(table["candidates"]["sma_trend"]["folds"])
        self.assertEqual(table["trials_total"], folds * (2 + 4 + 4))
        self.assertEqual(set(table["benchmarks"]), {"buy_and_hold_btc", "cash"}); self.assertEqual(table["benchmarks"]["cash"]["total_return"], 0.0)
        self.assertEqual(table["benchmarks"]["buy_and_hold_btc"]["sizing"]["max_positions"], 1)
        md = phase4.render_table(table)
        self.assertIn("| sma_trend | candidate |", md); self.assertIn("buy_and_hold_btc | benchmark", md)


if __name__ == "__main__":
    unittest.main()
