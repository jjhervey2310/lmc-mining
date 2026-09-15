#!/usr/bin/env python3
"""CYCLE-CONTEXT TESTS for the sleeve (addendum to #10/#11, 2026-09-08). Appends a section to pa_memory 'backtest-audit'.
Runs the A9 breakout rule (backtest_audit.run_rule: next-open entry, real costs, no survivorship) under three
cycle-context gates and reports each against the ungated baseline:
 (a) BTC-DOMINANCE-RISING filter. Free daily dominance history is not published (CoinGecko's global chart is a paid
     endpoint), so dominance is PROXIED by BTC's 30-day return minus the median 30-day return of every other name
     with a candle that day: "rising" = BTC beating the median alt over the trailing 30 days. Stated as a proxy.
 (b) CYCLE-POSITION gates: entries only when BTC is within X% of its running all-time-high close (X = 10 / 25),
     and only when BTC is MORE than 25% below it; and "months since the cycle top" approximated by months since the
     running-ATH date (0-3 / 3-9 / 9+). No halving-window rule here — #12 already found that one fitted to three points.
 (c) was answered by #12 ('backtest-cycle-top'): the 20-week MA rule vs the 30% catastrophe trail — not repeated.
Same window, same costs, same universe as 'backtest-audit'. No live rule changes."""
import datetime, statistics as st
from common import STATE, sb_get, sb_upsert
import backtest_audit as A

def dominance_proxy(data, btc):
    """t -> True when BTC's trailing-30d return beats the median alt's over the same window (dominance rising)."""
    by_sym = {s: {b["t"]: k for k, b in enumerate(bars)} for s, bars in data.items() if s != "BTC"}
    out = {}
    for k in range(30, len(btc)):
        t = btc[k]["t"]; b30 = btc[k]["c"] / btc[k - 30]["c"] - 1
        alts = []
        for s, idx in by_sym.items():
            j = idx.get(t)
            if j is not None and j >= 30: alts.append(data[s][j]["c"] / data[s][j - 30]["c"] - 1)
        out[t] = (len(alts) >= 20 and b30 > st.median(alts))
    return out

def ath_context(btc):
    """t -> (drawdown from the running ATH close, months since that ATH)."""
    out = {}; ath = 0.0; ath_t = btc[0]["t"]
    for b in btc:
        if b["c"] >= ath: ath, ath_t = b["c"], b["t"]
        out[b["t"]] = (b["c"] / ath - 1, (b["t"] - ath_t) / (30.4 * 86400))
    return out

def main():
    data = A.load(); btc = data["BTC"]; btc_by_t = {b["t"]: k for k, b in enumerate(btc)}
    regime = A.btc_regime(btc); dom = dominance_proxy(data, btc); ctx = ath_context(btc)
    kw = dict(t1=0.18, t2=0.25, tp_at=9.9, tp_frac=0.0)
    base = A.run_rule(data, btc, btc_by_t, regime, **kw)
    def sub(name, keep):
        tr = [x for x in base if keep(x["t"])]
        return A.fmt_stats(name, A.stats(tr))
    L = [f"=== CYCLE-CONTEXT TESTS (addendum to #10/#11) — A9 rule, same costs/universe as above, {len(base)} baseline signals ===",
         A.fmt_stats("baseline (no gate)", A.stats(base)),
         "(a) BTC-DOMINANCE proxy = BTC 30d return vs the median alt's 30d return (dominance history is not free; stated as a proxy):",
         sub("  dominance RISING (BTC beating the median alt)", lambda t: dom.get(t, False)),
         sub("  dominance FALLING (alts beating BTC)", lambda t: t in dom and not dom[t]),
         "(b) CYCLE POSITION vs BTC's running all-time-high close:",
         sub("  BTC within 10% of its ATH", lambda t: t in ctx and ctx[t][0] >= -0.10),
         sub("  BTC within 25% of its ATH", lambda t: t in ctx and ctx[t][0] >= -0.25),
         sub("  BTC more than 25% below its ATH", lambda t: t in ctx and ctx[t][0] < -0.25),
         sub("  0-3 months since the running ATH", lambda t: t in ctx and ctx[t][1] < 3),
         sub("  3-9 months since the running ATH", lambda t: t in ctx and 3 <= ctx[t][1] < 9),
         sub("  9+ months since the running ATH", lambda t: t in ctx and ctx[t][1] >= 9),
         "(c) 20-week MA vs the 30% catastrophe trail on the anchors: answered by #12 in 'backtest-cycle-top' — not repeated here.",
         "READ: a gate earns its place only if its cell beats the baseline AND keeps enough trades to mean anything (n >= 200); the 'rising 200d' BULL split in the audit above remains the cleanest filter found. Dominance here is a proxy — do not write it into law as 'BTC dominance' without a real dominance series."]
    out = "\n".join(L); print(out)
    (STATE / "backtest_cycle_ctx.txt").write_text(out)
    prev = sb_get("pa_memory", "topic=eq.backtest-audit&select=fact")
    old = (prev[0]["fact"] if prev else "").split("\n\n=== CYCLE-CONTEXT TESTS", 1)[0]
    sb_upsert("pa_memory", [{"topic": "backtest-audit", "fact": (old + "\n\n" + out)[:24000], "source": "desk-loop backtest_cycle_ctx.py", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")

if __name__ == "__main__":
    main()
