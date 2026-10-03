"""Phase 3 regime engine tests — design §12 (REGIME-DESIGN.md v2, accepted R-Q)."""
import inspect, math, re, unittest
from market_time import DAY
from bt.data import Bar, Market
from bt import regime, strategies
from bt.engine import Order, run
from bt_costs import CostModel

T0 = 1_600_000_000 - 1_600_000_000 % DAY
COSTS = CostModel(0.001, 0.001, venue="t", tier="t")
N = 420


def path(n, start=100.0, drift=0.001, wobble=0.0, phase=0.0):
    """Deterministic closes: exponential drift plus an optional sine wobble (no randomness → exact expectations)."""
    return [start * math.exp(drift * i) * (1 + wobble * math.sin(i / 3.0 + phase)) for i in range(n)]


def bars_from(closes, t0=T0, vol=1.0):
    out = []
    for i, c in enumerate(closes):
        o = closes[i - 1] if i else c
        out.append(Bar(t0 + i * DAY, o, max(o, c) * 1.001, min(o, c) * 0.999, c, vol))
    return out


def market(n=N, names=22, btc_closes=None, name_closes=None, listed_from=0, drop_btc_bar=None, name_bars=None):
    """BTC plus `names` eligible symbols, all listed at listed_from (bar index). name_bars limits each name's history."""
    bars = {"BTC": bars_from(btc_closes or path(n))}
    listings = {"BTC": (T0, None)}
    for j in range(names):
        cl = name_closes or path(n, drift=0.0012, phase=j)
        if name_bars:
            cl = cl[-name_bars:]
            bars[f"S{j}"] = bars_from(cl, t0=T0 + (n - name_bars) * DAY)
        else:
            bars[f"S{j}"] = bars_from(cl)
        listings[f"S{j}"] = (T0 + listed_from * DAY, None)
    if drop_btc_bar is not None:
        bars["BTC"] = [b for b in bars["BTC"] if b.t != T0 + drop_btc_bar * DAY]
    return Market(bars, listings)


def dec(k):
    """Decision time after bar k completes."""
    return T0 + (k + 1) * DAY


class Startup(unittest.TestCase):
    def test_unknown_before_385_btc_bars_then_risk_on_after_hysteresis(self):
        m = market()
        s = regime.compute_series(m)
        self.assertTrue(all(s.at(dec(k))[0] == "unknown" for k in range(regime.MIN_CLOSES - 1)))
        raw = regime.raw_state(m, dec(regime.MIN_CLOSES - 1))
        self.assertEqual(raw[0], "risk_on")                                  # raw computable at exactly 385 closes
        self.assertEqual(s.at(dec(regime.MIN_CLOSES - 1))[0], "unknown")     # published only after 3 same fresh bars
        self.assertEqual(s.at(dec(regime.MIN_CLOSES + 1))[0], "risk_on")
        self.assertEqual(s.summary()["first_label_t"], dec(regime.MIN_CLOSES + 1))

    def test_19_eligible_names_stay_unknown(self):
        s = regime.compute_series(market(names=18))                          # 18 names + BTC = 19 eligible
        self.assertTrue(all(e[0] == "unknown" for e in s.entries))
        self.assertIn("eligible", s.entries[-1][3]["reason"])

    def test_hard_veto_publishes_at_385_from_unknown(self):
        cl = path(N)
        for i in range(regime.MIN_CLOSES - 25, regime.MIN_CLOSES):          # violent chop in the last 25 bars → vol percentile 1.0
            cl[i] *= 1.25 if i % 2 else 0.8
        s = regime.compute_series(market(btc_closes=cl))
        self.assertEqual(s.at(dec(regime.MIN_CLOSES - 1))[0], "risk_off")
        self.assertTrue(s.at(dec(regime.MIN_CLOSES - 1))[3]["vol"])


class Boundary(unittest.TestCase):
    def test_label_matches_recomputation_on_truncated_market_every_t(self):
        m = market(n=400)
        s = regime.compute_series(m)
        for k in (383, 384, 386, 390, 398):
            cut = {sym: [b for b in bs if b.t + DAY <= dec(k)] for sym, bs in m.bars.items()}
            r_full = regime.raw_state(m, dec(k)); r_cut = regime.raw_state(Market(cut, m.listings), dec(k))
            self.assertEqual(r_full[:3], r_cut[:3])
            self.assertEqual(regime.compute_series(Market(cut, m.listings)).at(dec(k))[0], s.at(dec(k))[0])

    def test_spike_in_bar_opening_at_t_cannot_change_label(self):
        m = market(n=400)
        k = 395
        bars = dict(m.bars); b = bars["BTC"][k + 1]
        bars["BTC"] = bars["BTC"][:k + 1] + [Bar(b.t, b.o, b.h * 50, b.l, b.c * 50, b.v)] + bars["BTC"][k + 2:]
        self.assertEqual(regime.compute_series(Market(bars, m.listings)).at(dec(k)), regime.compute_series(m).at(dec(k)))


class Vetoes(unittest.TestCase):
    def test_vol_shock_overrides_positive_trend_and_breadth(self):
        cl = path(N)
        for i in range(N - 25, N):
            cl[i] *= 1.25 if i % 2 else 0.8
        r = regime.raw_state(market(btc_closes=cl), dec(N - 1))
        self.assertEqual(r[0], "risk_off"); self.assertTrue(r[2]["vol"]); self.assertEqual(r[1]["breadth"], 1)

    def test_drawdown_floor_is_a_veto(self):
        cl = path(N); cl[N - 1] = max(cl) * 0.45
        r = regime.raw_state(market(btc_closes=cl), dec(N - 1))
        self.assertEqual(r[0], "risk_off"); self.assertTrue(r[2]["dd"])

    def test_breadth_collapse_is_not_a_veto_it_aggregates(self):
        falling = path(N, drift=-0.003)
        r = regime.raw_state(market(name_closes=falling), dec(N - 1))   # BTC up (+1), breadth 0 → neutral, no veto
        self.assertEqual(r[1]["breadth"], -1); self.assertEqual(r[0], "neutral"); self.assertFalse(r[2]["vol"] or r[2]["dd"])


class Transitions(unittest.TestCase):
    def _published(self, raws, hard=None):
        """Drive the §6 state machine directly through compute_series by monkeypatching raw_state."""
        hard = hard or [False] * len(raws)
        seq = list(zip(raws, hard)); orig = regime.raw_state
        def fake(market, t_dec, *a, **kw):
            i = (t_dec - T0) // DAY - 1
            if i >= len(seq):
                i = len(seq) - 1
            raw, h = seq[i]
            if raw is None:
                return None, {}, {}, "stale"
            return raw, {}, {"vol": h, "dd": False}, None
        regime.raw_state = fake
        try:
            m = Market({"BTC": bars_from(path(len(raws)))}, {"BTC": (T0, None)})
            return [e[0] for e in regime.compute_series(m).entries]
        finally:
            regime.raw_state = orig

    def test_counter_resets_on_any_change(self):
        pub = self._published(["risk_on", "risk_on", "neutral", "risk_on", "risk_on", "risk_on", "risk_on"])
        self.assertEqual(pub[:5], ["unknown"] * 5); self.assertEqual(pub[5], "risk_on")     # publishes at the 6th bar, not the 3rd

    def test_unknown_exit_needs_three_same_fresh_bars(self):
        self.assertEqual(self._published(["risk_on", "neutral", "risk_on"]), ["unknown"] * 3)
        self.assertEqual(self._published(["risk_on", "risk_on", "risk_on"])[-1], "risk_on")

    def test_fast_fail_and_slow_recovery(self):
        pub = self._published(["risk_on"] * 3 + ["risk_off"] + ["risk_on"] * 3, hard=[False] * 3 + [True] + [False] * 3)
        self.assertEqual(pub[2], "risk_on"); self.assertEqual(pub[3], "risk_off")          # vol shock: 1 bar
        self.assertEqual(pub[4:6], ["risk_off", "risk_off"]); self.assertEqual(pub[6], "risk_on")   # 3 clean bars to leave
        self.assertEqual(self._published([None, "risk_off"], hard=[False, True])[1], "risk_off")  # hard veto from unknown after 1 fresh bar

    def test_single_cross_one_transition_three_bars_later_and_chop_none(self):
        pub = self._published(["risk_on"] * 3 + ["neutral"] * 6)
        self.assertEqual([i for i in range(1, len(pub)) if pub[i] != pub[i - 1]], [2, 5])   # unknown→on at 3, on→neutral 3 bars after the cross
        chop = self._published(["risk_on"] * 3 + ["neutral", "risk_on"] * 6)
        self.assertEqual(chop[2:], ["risk_on"] * len(chop[2:]))


class Freshness(unittest.TestCase):
    def test_missing_btc_bar_yields_unknown_not_previous_state(self):
        s = regime.compute_series(market(drop_btc_bar=400))
        self.assertEqual(s.at(dec(399))[0], "risk_on"); self.assertEqual(s.at(dec(400))[0], "unknown")

    def test_breadth_coverage_gate_and_new_listings_do_not_count_as_missing(self):
        m = market(names=20)
        # 9 of 20 eligible names miss their t-1 bar → coverage 55% → unknown; 8 miss → 60% → labelled
        def with_missing(k_missing):
            bars = dict(m.bars)
            for j in range(k_missing):
                bars[f"S{j}"] = [b for b in bars[f"S{j}"] if b.t != T0 + (N - 1) * DAY]
            return Market(bars, m.listings)
        self.assertIsNone(regime.raw_state(with_missing(9), dec(N - 1))[0])
        self.assertEqual(regime.raw_state(with_missing(8), dec(N - 1))[0], "risk_on")
        # a wave of 30 new listings with < 50 bars is not eligible and does not change coverage
        bars = dict(m.bars); L = dict(m.listings)
        for j in range(30):
            bars[f"NEW{j}"] = bars_from(path(10), t0=T0 + (N - 10) * DAY); L[f"NEW{j}"] = (T0 + (N - 10) * DAY, None)
        self.assertEqual(regime.raw_state(Market(bars, L), dec(N - 1))[0], "risk_on")


class Conventions(unittest.TestCase):
    def test_slope_zero_is_non_positive_and_volpct_includes_current(self):
        flat = [100.0] * N                                                 # SMA50 slope exactly 0, close == SMA200 → not above band
        r = regime.raw_state(market(btc_closes=flat, name_closes=path(N)), dec(N - 1))
        self.assertIn(r[1]["trend"], (0, -1)); self.assertNotEqual(r[1]["trend"], 1)
        S = regime._Series(bars_from(path(N)))
        x = regime._btc_inputs(S, N - 1, 0.02, 0.9)
        self.assertGreaterEqual(x["volpct"], 1 / regime.FIXED["volpct"])  # the current observation counts itself


class Gate(unittest.TestCase):
    def test_entries_blocked_outside_risk_on_and_labels_shared(self):
        m = market()
        s = regime.compute_series(m)
        seen = {}
        every = lambda tag: lambda view, pf: (seen.setdefault(tag, []).append(view.regime()[0]) or [Order("S1", "buy", tag=tag)])
        a = run(m, strategies.regime_gate(every("a")), COSTS, regime=s, max_positions=1)
        b = run(m, strategies.regime_gate(every("b")), COSTS, regime=s, max_positions=1)
        self.assertEqual(seen["a"], seen["b"])                                  # identical label series for two strategies
        first_fill = min(e[0] for e in a["events"] if e[2] == "fill")
        self.assertEqual(first_fill, s.summary()["first_label_t"])             # nothing fills while unknown; first fill at the first risk_on decision
        self.assertTrue(a["regime_filtered"])
        u = run(m, strategies.regime_gate(lambda view, pf: [Order("S1", "buy")]), COSTS, max_positions=1)  # no series → unfiltered, fills at the first open
        self.assertEqual(min(e[0] for e in u["events"] if e[2] == "fill"), T0 + DAY)

    def test_gate_never_blocks_sells(self):
        m = market()
        s = regime.compute_series(m)
        calls = {"n": 0}
        def strat(view, pf):
            calls["n"] += 1
            return [Order("S1", "sell")] if calls["n"] > 1 else []
        out = strategies.regime_gate(strat)(m.as_of(dec(10), s), None); out = strategies.regime_gate(strat)(m.as_of(dec(10), s), None)
        self.assertEqual([o.side for o in out], ["sell"])


class Hygiene(unittest.TestCase):
    def test_regime_module_has_no_portfolio_order_or_cost_references(self):
        src = inspect.getsource(regime).split('"""', 2)[2]                 # code only: skip the module docstring
        code = "\n".join(l.split("#", 1)[0] for l in src.splitlines())      # and comments
        self.assertIsNone(re.search(r"\b(Portfolio|Order|CostModel|cash|positions|place|size)\b", code))

    def test_strategies_do_not_import_regime(self):
        self.assertIsNone(re.search(r"\bregime\b\s*import|import\s+.*\bregime\b|from \.regime", inspect.getsource(strategies)))


class Diagnostics(unittest.TestCase):
    def test_forward_diagnostics_shape_and_windows(self):
        m = market()
        s = regime.compute_series(m)
        d = regime.forward_diagnostics(m, s, windows=[(dec(390), dec(419))])
        self.assertEqual(set(d), set(regime.STATES))
        self.assertGreater(d["risk_on"]["n"], 0); self.assertEqual(d["risk_off"]["n"], 0)
        self.assertIn("hit", d["risk_on"]["ret_7d"]); self.assertLessEqual(d["risk_on"]["fwd_dd_30"]["mean"], 0)
        man = s.manifest(m)
        self.assertTrue(man["canonical"]); self.assertEqual(man["entry_rule"], "risk_on only"); self.assertIn("data_hash", man)


class Overlay(unittest.TestCase):
    def test_eligibility_core_checks_and_one_non_core_miss(self):
        from bt import research
        ok = {"checks": {"oos_positive": True, "survives_fees_x1.25": True, "survives_fees_x1.25_oos": True, "symbols>=min": True, "not_single_year": False, "not_top3_dependent": True, "param_surface_smooth": True}}
        self.assertTrue(research.overlay_eligible(ok)[0])
        two = {"checks": {**ok["checks"], "not_top3_dependent": False}}
        self.assertFalse(research.overlay_eligible(two)[0])
        losing = {"checks": {**ok["checks"], "oos_positive": False, "not_single_year": True}}
        self.assertFalse(research.overlay_eligible(losing)[0])              # a losing strategy is never run filtered

    def test_verdict_rejects_cash_sitting_and_requires_all_five(self):
        from bt import research
        base = {"total_return": 0.20, "max_drawdown": -0.30, "trades": 300, "avg_trade_ret": 0.01, "profit_factor": 1.2}
        cash = {"total_return": 0.25, "max_drawdown": -0.10, "trades": 120, "avg_trade_ret": 0.01, "profit_factor": 1.2}
        self.assertFalse(research.overlay_verdict(base, cash)["wins"])        # better return and DD but no per-trade improvement
        good = {**cash, "avg_trade_ret": 0.015, "trades": 160}                  # ≥ 50% of 300 and ≥ 100
        self.assertTrue(research.overlay_verdict(base, good)["wins"])
        few = {**good, "trades": 90}
        self.assertFalse(research.overlay_verdict(base, few)["wins"])

    def test_walk_forward_carries_filtered_twin_on_same_folds(self):
        from bt import research
        m = market(n=800)
        s = regime.compute_series(m)
        wf = research.walk_forward(m, lambda **kw: strategies.sma_trend(["S1", "S2"], **kw), [{"fast": 20, "slow": 50}], COSTS, 365, 90, regime=s, gate_fn=strategies.regime_gate)
        self.assertIn("oos", wf); self.assertIn("oos_filtered", wf); self.assertIn("oos_filtered_fee_stress", wf)
        self.assertEqual(wf["regime"], {"band": 0.02, "vol_pct": 0.9})
        self.assertLessEqual(wf["oos_filtered"].get("trades", 0), wf["oos"].get("trades", 0))   # a filter can only remove entries
