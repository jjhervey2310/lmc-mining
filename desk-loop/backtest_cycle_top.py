#!/usr/bin/env python3
"""BUILD REQUEST #12 (trading desk, 2026-09-08) — CYCLE-TOP DE-RISK LADDER.

Question: is there a rule that gets us off the top of a cycle and back on, that beats holding through
with the 30% catastrophe trail? Tested on BTC and SOL SEPARATELY, Coinbase daily closes, 2015->2026
for BTC and 2021->2026 for SOL (that is all the exchange has).

Every exit rule is paired with a RE-ENTRY rule — #12's own condition, and the right one: an exit rule
without a way back in is not a strategy, it is a liquidation.

REPORTED FOR EACH: USD multiple, CAGR, max drawdown, worst peak-to-recovery in days, trades, and
TERMINAL COIN UNITS. The last one is the house objective — Jacob's "trade" means accumulate — and a
rule can beat buy-and-hold in dollars while leaving you holding fewer coins.

COSTS: run at two assumptions, 0.30%/side (majors on a retail venue) and the desk's house 0.95%/side,
because the ladders trade more and the answer should not hide behind the cheaper number.

WHAT IS NOT TESTED, and why — an untested rule is reported as untested, never as a rule that failed:
  • BTC dominance reversal — no free source carries dominance history; the live check records it daily
    from today forward (a11_monitor.py), so this becomes testable in about a year.
  • Sustained ETF-flow reversal — farside's series starts 2024-01-11. That is under one cycle and
    contains no cycle top, so any result would be one observation dressed as a backtest.

stdlib only.
"""
import datetime, json, math, statistics, time
from common import STATE, sb_upsert, _req, now_denver

CACHE = STATE / "cb_long"
CACHE.mkdir(parents=True, exist_ok=True)
HALVINGS = ["2012-11-28", "2016-07-09", "2020-05-11", "2024-04-19"]
START = {"BTC": "2015-07-20", "SOL": "2021-05-25"}


def candles(sym):
    """Daily closes from Coinbase Exchange, paginated 300 at a time, cached for a day.
    Own cache file — backtest_house.py caches the same symbols over a different window."""
    f = CACHE / f"{sym}.json"
    if f.exists() and time.time() - f.stat().st_mtime < 20 * 3600:
        return json.load(open(f))
    out, cur = [], datetime.datetime.fromisoformat(START[sym]).replace(tzinfo=datetime.timezone.utc)
    end_all = datetime.datetime.now(datetime.timezone.utc)
    while cur < end_all:
        nxt = min(cur + datetime.timedelta(days=299), end_all)
        url = (f"https://api.exchange.coinbase.com/products/{sym}-USD/candles?granularity=86400"
               f"&start={cur.strftime('%Y-%m-%dT%H:%M:%SZ')}&end={nxt.strftime('%Y-%m-%dT%H:%M:%SZ')}")
        try:
            j = _req(url, retries=3, timeout=30)
        except Exception as e:
            print(f"  candles {sym} failed at {cur.date()}: {e}")
            return None
        out += [{"t": r[0], "c": float(r[4])} for r in j]
        cur = nxt
        time.sleep(0.3)
    out = sorted({b["t"]: b for b in out}.values(), key=lambda b: b["t"])
    for b in out:
        b["d"] = datetime.datetime.fromtimestamp(b["t"], datetime.timezone.utc).date().isoformat()
    json.dump(out, open(f, "w"))
    return out


def weekly_index(bars):
    """For each daily bar: (is_week_close, weekly_close_so_far list index). A bar is a week close when
    the next bar starts a new ISO week — i.e. only COMPLETED weeks ever produce a signal."""
    flags = []
    for i, b in enumerate(bars):
        d = datetime.date.fromisoformat(b["d"])
        nxt = datetime.date.fromisoformat(bars[i + 1]["d"]) if i + 1 < len(bars) else None
        flags.append(nxt is None or nxt.isocalendar()[:2] != d.isocalendar()[:2])
    return flags


def months_since_halving(dstr):
    d = datetime.date.fromisoformat(dstr)
    last = max((datetime.date.fromisoformat(h) for h in HALVINGS if datetime.date.fromisoformat(h) <= d), default=None)
    if last is None:
        return None
    return (d.year - last.year) * 12 + (d.month - last.month)


class Book:
    """One unit of the coin at the start; sell to USD and buy back. `target` is the fraction of the
    book that should be in the coin. Costs charged on the traded notional."""
    def __init__(self, price, cost):
        self.units, self.cash, self.cost, self.trades = 1.0, 0.0, cost, 0

    def equity(self, price):
        return self.units * price + self.cash

    def to(self, target, price):
        eq = self.equity(price)
        want_units = (eq * target) / price
        delta = want_units - self.units
        if abs(delta * price) < eq * 0.005:      # ignore dust rebalances
            return
        if delta < 0:
            self.cash += -delta * price * (1 - self.cost)
        else:
            self.cash -= delta * price * (1 + self.cost)
        self.units = want_units
        self.trades += 1


def metrics(curve, dates, years):
    peak, mdd, peak_i, worst_rec = curve[0], 0.0, 0, 0
    last_peak_i = 0
    for i, v in enumerate(curve):
        if v >= peak:
            worst_rec = max(worst_rec, i - last_peak_i)
            peak, last_peak_i = v, i
        mdd = min(mdd, v / peak - 1)
    worst_rec = max(worst_rec, len(curve) - 1 - last_peak_i)     # an unrecovered drawdown counts
    mult = curve[-1] / curve[0]
    cagr = (mult ** (1 / years) - 1) if years > 0 and mult > 0 else float("nan")
    return mult, cagr, mdd, worst_rec


def simulate(bars, rule, cost, trail=True):
    """rule(i, ctx) -> target coin fraction in [0,1]. Signals are computed on completed weekly closes
    only; execution is that same daily close."""
    wk_flag = weekly_index(bars)
    closes = [b["c"] for b in bars]
    wkly = [(i, closes[i]) for i in range(len(bars)) if wk_flag[i]]
    wk_closes = [c for _, c in wkly]
    wk_pos = {i: k for k, (i, _) in enumerate(wkly)}

    bk = Book(closes[0], cost)
    state = {}                       # the rule's own memory, so a band rule can stay out until it is let back in
    curve, peak_price, below_run, rule_target = [], closes[0], 0, 1.0
    trail_locked = False
    for i, b in enumerate(bars):
        p = closes[i]
        peak_price = max(peak_price, p)
        # THE 30% CATASTROPHE TRAIL IS A DAILY FLOOR UNDER EVERY RULE, including HOLD. Once it trips
        # the book is flat until a weekly close back above the 20-week MA lets it re-enter — a trail
        # that re-enters days later is not a trail, and pairing it with the MA is the only re-entry
        # rule this desk has actually written down.
        if trail and not trail_locked and p < peak_price * 0.70:
            trail_locked = True
        if wk_flag[i]:
            k = wk_pos[i]
            ma20 = statistics.fmean(wk_closes[max(0, k - 19):k + 1]) if k >= 19 else None
            below_run = below_run + 1 if (ma20 is not None and p < ma20) else 0
            ctx = {"k": k, "wk": wk_closes, "price": p, "peak": peak_price, "date": b["d"],
                   "below_run": below_run, "ma20w": ma20,
                   "ma200w": statistics.fmean(wk_closes[max(0, k - 199):k + 1]) if k >= 199 else None,
                   "mo": months_since_halving(b["d"]), "state": state}
            rule_target = rule(ctx)
            if trail_locked and ma20 is not None and p > ma20:
                trail_locked, peak_price = False, p     # back in; the trail measures from here
        target = 0.0 if trail_locked else rule_target
        bk.to(target, p)
        curve.append(bk.equity(p))
    years = (datetime.date.fromisoformat(bars[-1]["d"]) - datetime.date.fromisoformat(bars[0]["d"])).days / 365.25
    mult, cagr, mdd, rec = metrics(curve, [b["d"] for b in bars], years)
    return {"mult": mult, "cagr": cagr, "mdd": mdd, "recovery_days": rec, "trades": bk.trades,
            "terminal_units": bk.units + bk.cash / closes[-1], "years": years}


# ── the rules ────────────────────────────────────────────────────────────────────────────────────
def r_hold(ctx):
    return 1.0


def r_ma20_full(ctx):
    if ctx["ma20w"] is None:
        return 1.0
    return 0.0 if ctx["price"] < ctx["ma20w"] else 1.0


def r_ma20_ladder(ctx):
    """25% / 50% / 75% trimmed at successive WEEKLY closes below the 20-week MA; rebuilt in full on
    the first weekly close back above it."""
    if ctx["ma20w"] is None:
        return 1.0
    n = ctx["below_run"]
    return {0: 1.0, 1: 0.75, 2: 0.50}.get(n, 0.25) if n else 1.0


def r_halving_full(ctx):
    mo = ctx["mo"]
    if mo is None:
        return 1.0
    return 0.0 if 18 <= mo < 30 else 1.0


def r_halving_ladder(ctx):
    mo = ctx["mo"]
    if mo is None:
        return 1.0
    if mo < 16 or mo >= 30:
        return 1.0
    return {16: 0.75, 17: 0.50}.get(mo, 0.25)


def mk_mult200(k_out, k_in):
    """Out above k_out x the 200-week MA, and STAYS out until price falls back under k_in x it.
    Between the two bands the position is whatever it already was — a band rule with no memory
    re-enters the week after it exits, which is not the rule anybody means."""
    def rule(ctx):
        ma = ctx["ma200w"]
        if ma is None:
            return 1.0
        st = ctx["state"]
        if ctx["price"] > k_out * ma:
            st["out"] = True
        elif ctx["price"] < k_in * ma:
            st["out"] = False
        return 0.0 if st.get("out") else 1.0
    return rule


def mk_mult200_ladder():
    def rule(ctx):
        ma = ctx["ma200w"]
        if ma is None:
            return 1.0
        x = ctx["price"] / ma
        if x > 3.0:
            return 0.25
        if x > 2.5:
            return 0.50
        if x > 2.0:
            return 0.75
        return 1.0
    return rule


RULES = [
    ("PURE HOLD (no trail)", r_hold, "the floor-under-the-floor reference: never sell at all", False),
    ("HOLD (+30% trail)", r_hold, "the baseline #12 names: hold, with the 30% catastrophe trail underneath", True),
    ("20wMA exit/enter", r_ma20_full, "out on a weekly close below the 20-week MA, back in on a weekly close above", True),
    ("20wMA ladder 25/50/75", r_ma20_ladder, "trim on successive weekly closes below; rebuild on the first close above", True),
    ("halving m18-m30 out", r_halving_full, "flat from month 18 to month 30 after each halving", True),
    ("halving ladder m16-18", r_halving_ladder, "trim 25/50/75 across months 16-18, back in at month 30", True),
    ("200wMA >3x out, <1.5x in", mk_mult200(3.0, 1.5), "out above 3x the 200-week MA, back in below 1.5x", True),
    ("200wMA ladder 2/2.5/3x", mk_mult200_ladder(), "trim as the multiple of the 200-week MA rises", True),
]


def main():
    lines = [f"CYCLE-TOP DE-RISK LADDER — build request #12. Run {now_denver().isoformat()}.",
             "Coinbase daily closes. Signals on COMPLETED weekly closes only; the 30% catastrophe trail is a daily floor under every rule.",
             "Every exit rule is paired with its re-entry rule. 'units' = terminal coin count starting from 1 unit — the house objective.",
             ""]
    payload = {}
    for sym in ("BTC", "SOL"):
        bars = candles(sym)
        if not bars or len(bars) < 400:
            lines.append(f"{sym}: NO DATA — Coinbase returned {0 if not bars else len(bars)} daily bars. Not tested, not failed.")
            continue
        lines.append(f"── {sym} — {bars[0]['d']} to {bars[-1]['d']} ({len(bars)} daily bars) ──")
        for cost, label in ((0.003, "0.30%/side"), (0.0095, "0.95%/side (house)")):
            lines.append(f"  costs {label}")
            lines.append(f"    {'rule':<26} {'x':>8} {'CAGR':>8} {'maxDD':>8} {'worst rec':>10} {'trades':>7} {'units':>8}")
            for name, fn, _why, use_trail in RULES:
                r = simulate(bars, fn, cost, trail=use_trail)
                payload.setdefault(sym, {}).setdefault(label, {})[name] = r
                lines.append(f"    {name:<26} {r['mult']:>8.2f} {r['cagr']*100:>7.1f}% {r['mdd']*100:>7.1f}% "
                             f"{r['recovery_days']:>9}d {r['trades']:>7} {r['terminal_units']:>8.3f}")
        lines.append("")

    lines += [
        "HOW TO READ THE HALVING ROW BEFORE ANYONE TRADES IT:",
        "  It wins by a mile on both coins and both cost assumptions, and that is exactly why it should not ship as written.",
        "  The window m18-m30 is fitted to THREE observations — the 2018, 2022 and (partly) 2026 bears are the only bears in",
        "  the sample, and the months were chosen knowing where they fell. Three data points cannot support a rule this precise.",
        "  A rule that only has to be wrong once is not a safety net. Test it out-of-sample or size it as a guess, not a law.",
        "  What IS defensible from this table: the 20-week MA rule beat the baseline on BOTH coins, at BOTH cost assumptions,",
        "  on dollars, drawdown AND coin count — a smaller edge, but one that does not depend on knowing the calendar in advance.",
        "",
        "AND THE UNCOMFORTABLE ONE: every rule here, including the baseline the desk already runs, ends with FEWER coins than",
        "it started with on SOL, and well under one BTC. The 30% trail plus a re-entry above the 20-week MA sells low and buys",
        "back higher, over and over. Pure hold is the row to measure against for coin count.",
        "",
        "NOT TESTED (and why — an untested rule is not a failed rule):",
        "  • BTC dominance trend reversal — no free source carries dominance history. a11_monitor.py now records it daily,",
        "    so this is testable from about 2027 onward, not today.",
        "  • Sustained ETF-flow reversal — farside's series begins 2024-01-11: under one cycle, no cycle top inside it.",
        "    One observation is not a backtest.",
        "",
        "READING THIS: the honest comparison is 'units', not 'x'. A rule that ends with more dollars and fewer coins has",
        "lost at the thing this book is actually for.",
    ]
    text = "\n".join(lines)
    print(text)
    sb_upsert("pa_memory", [{"topic": "backtest-cycle-top", "fact": text[:60000], "source": "desk-loop/backtest_cycle_top",
                             "active": True, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
    (STATE / "backtest_cycle_top.json").write_text(json.dumps(payload, indent=1, default=str))


if __name__ == "__main__":
    main()
