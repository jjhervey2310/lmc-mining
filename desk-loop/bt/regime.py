"""Phase 3 regime engine — docs/desk/REGIME-DESIGN.md v2 (accepted R-Q). Emits ONE frozen label per completed daily
bar, shared by every strategy. It never sees a Portfolio, an Order or a cost model; it cannot trade, size or exit.
States: risk_on / neutral / risk_off / unknown. Canonical entry rule (applied by strategies.regime_gate): new long
entries only in risk_on. All inputs are completed bars (t_bar + bar <= t); the series is built forward in time so the
label at t depends only on bars completed by t (test: equals a recomputation on a market truncated at t)."""
import bisect, math

CANONICAL = {"band": 0.02, "vol_pct": 0.90}
PAIRS = [(b, v) for b in (0.0, 0.02, 0.05) for v in (0.80, 0.90)]            # canonical + five sensitivity pairs
FIXED = {"breadth_hi": 0.55, "breadth_lo": 0.35, "dd_floor": -0.50, "hysteresis": 3,
         "sma_long": 200, "sma_short": 50, "slope": 20, "vol": 20, "volpct": 365, "dd": 365,
         "min_bars": 50, "min_names": 20, "min_coverage": 0.60}
MIN_CLOSES = FIXED["volpct"] + FIXED["vol"]          # 385: 365 vol observations, each needing 20 log returns (21 closes)
STATES = ("risk_on", "neutral", "risk_off", "unknown")
VERSION = 2


def _prefix(xs):
    out = [0.0]
    for x in xs:
        out.append(out[-1] + x)
    return out


def _sma(pre, end, n):
    """Mean of xs[end-n:end] from a prefix-sum array; None if not enough history."""
    return (pre[end] - pre[end - n]) / n if end >= n else None


class _Series:
    """Per-symbol arrays: times, closes, prefix sums — built once, read by index."""
    __slots__ = ("t", "c", "pre")

    def __init__(self, bars):
        self.t = [b.t for b in bars]
        self.c = [b.c for b in bars]
        self.pre = _prefix(self.c)


def _btc_inputs(S, k, band, vol_pct):
    """Inputs from BTC closes c[:k+1] (k = index of the last completed bar). Returns dict or None if history is short."""
    n = k + 1
    if n < MIN_CLOSES:
        return None
    c = S.c
    sma200 = _sma(S.pre, n, FIXED["sma_long"]); sma50 = _sma(S.pre, n, FIXED["sma_short"]); sma50_prev = _sma(S.pre, n - FIXED["slope"], FIXED["sma_short"])
    slope = sma50 / sma50_prev - 1
    vols = []
    for j in range(n - FIXED["volpct"], n):                        # vol observation at each of the last 365 closes
        w = c[j - FIXED["vol"]:j + 1]
        r = [math.log(w[i] / w[i - 1]) for i in range(1, len(w))]
        m = sum(r) / len(r)
        vols.append(math.sqrt(sum((x - m) ** 2 for x in r) / len(r)) * math.sqrt(365))
    vol = vols[-1]
    volpct = sum(1 for x in vols if x <= vol) / FIXED["volpct"]      # current observation included; ties count as <=
    dd = c[k] / max(c[n - FIXED["dd"]:n]) - 1
    close = c[k]
    if close > sma200 * (1 + band) and slope > 0:
        trend = 1
    elif close < sma200 * (1 - band) or (slope <= 0 and close < sma200):
        trend = -1
    else:
        trend = 0
    return {"close": close, "sma200": sma200, "sma50": sma50, "slope": slope, "vol": vol, "volpct": volpct, "dd": dd,
            "trend": trend, "veto_vol": volpct >= vol_pct, "veto_dd": dd <= FIXED["dd_floor"]}


def _breadth(market, series, t_dec, bar):
    """Share of fresh eligible names above their own SMA50; None (with reason) when the gates fail (design §2a)."""
    eligible = fresh = above = 0
    for s, S in series.items():
        a, d = market.listings.get(s, (None, None))
        if a is None or not (a <= t_dec and (d is None or t_dec < d)):
            continue
        i = bisect.bisect_right(S.t, t_dec - bar)                      # completed bars as of t_dec
        if i < FIXED["min_bars"]:
            continue
        eligible += 1
        if S.t[i - 1] != t_dec - bar:                                 # the exact t-1d bar must exist
            continue
        fresh += 1
        if S.c[i - 1] > _sma(S.pre, i, FIXED["sma_short"]):
            above += 1
    if eligible < FIXED["min_names"]:
        return None, f"breadth: {eligible} eligible < {FIXED['min_names']}"
    cov = fresh / eligible
    if cov < FIXED["min_coverage"]:
        return None, f"breadth: coverage {cov:.2f} < {FIXED['min_coverage']}"
    return above / fresh, None


def raw_state(market, t_dec, band=CANONICAL["band"], vol_pct=CANONICAL["vol_pct"], btc="BTC", _series=None):
    """Raw classification at decision time t_dec from bars completed by t_dec. Returns (raw|None, votes, vetoes, reason)."""
    bar = market.bar_seconds
    series = _series or {s: _Series(bs) for s, bs in market.bars.items()}
    B = series.get(btc)
    if B is None:
        return None, {}, {}, "no BTC series"
    k = bisect.bisect_right(B.t, t_dec - bar) - 1
    if k < 0 or B.t[k] != t_dec - bar:
        return None, {}, {}, "BTC bar at t-1d missing"
    x = _btc_inputs(B, k, band, vol_pct)
    if x is None:
        return None, {}, {}, f"history < {MIN_CLOSES} BTC bars"
    breadth, why = _breadth(market, series, t_dec, bar)
    if breadth is None:
        return None, {"trend": x["trend"]}, {"vol": x["veto_vol"], "dd": x["veto_dd"]}, why
    b_vote = 1 if breadth >= FIXED["breadth_hi"] else (-1 if breadth <= FIXED["breadth_lo"] else 0)
    votes = {"trend": x["trend"], "breadth": b_vote, "breadth_value": round(breadth, 4), "volpct": round(x["volpct"], 4), "dd": round(x["dd"], 4)}
    vetoes = {"vol": x["veto_vol"], "dd": x["veto_dd"]}
    if vetoes["vol"] or vetoes["dd"]:
        return "risk_off", votes, vetoes, None
    s = x["trend"] + b_vote
    return ("risk_on" if s >= 1 else "risk_off" if s <= -1 else "neutral"), votes, vetoes, None


class RegimeSeries:
    """Published labels keyed by decision time; `at(t)` returns the entry at the last decision time <= t."""

    def __init__(self, times, entries, band, vol_pct, bar_seconds):
        self.times, self.entries, self.band, self.vol_pct, self.bar_seconds = times, entries, band, vol_pct, bar_seconds

    def at(self, t):
        i = bisect.bisect_right(self.times, t) - 1
        return self.entries[i] if i >= 0 else ("unknown", None, {}, {"reason": "before first decision"})

    def summary(self):
        n = len(self.entries) or 1
        pct = {s: sum(1 for e in self.entries if e[0] == s) / n for s in STATES}
        trans = sum(1 for i in range(1, len(self.entries)) if self.entries[i][0] != self.entries[i - 1][0])
        first = next((t for t, e in zip(self.times, self.entries) if e[0] != "unknown"), None)
        return {"pct_time": pct, "transitions_count": trans, "first_label_t": first, "bars": len(self.entries)}

    def manifest(self, market, canonical=None):
        return {"version": VERSION, "canonical": (self.band, self.vol_pct) == (CANONICAL["band"], CANONICAL["vol_pct"]) if canonical is None else canonical,
                "band": self.band, "vol_pct": self.vol_pct, **{k: FIXED[k] for k in ("breadth_hi", "breadth_lo", "dd_floor")},
                "hysteresis_bars": FIXED["hysteresis"], "fastfail": ["veto_vol", "veto_dd"],
                "lookbacks": {"sma200": 200, "sma50": 50, "slope": 20, "vol": 20, "volpct": 365, "dd": 365},
                "breadth": {"min_bars": FIXED["min_bars"], "min_names": FIXED["min_names"], "min_coverage": FIXED["min_coverage"]},
                "entry_rule": "risk_on only", "data_hash": market.fingerprint(), "universe_hash": market.universe_fingerprint(), **self.summary()}


def compute_series(market, band=CANONICAL["band"], vol_pct=CANONICAL["vol_pct"], btc="BTC"):
    """Forward pass over every decision time (each bar open + bar) applying the hysteresis of design §6."""
    bar = market.bar_seconds
    series = {s: _Series(bs) for s, bs in market.bars.items()}
    times = sorted({t + bar for s in market.bars for t in series[s].t})
    entries, published, since, cand, cnt = [], "unknown", None, None, 0
    for t_dec in times:
        raw, votes, vetoes, why = raw_state(market, t_dec, band, vol_pct, btc, _series=series)
        if raw is None:
            if published != "unknown":
                published, since = "unknown", t_dec
            cand, cnt = None, 0
            entries.append(("unknown", since, votes, {**vetoes, "reason": why}))
            continue
        hard = vetoes.get("vol") or vetoes.get("dd")
        if raw == cand:
            cnt += 1
        else:
            cand, cnt = raw, 1                                         # any change in the candidate resets the counter to 1
        if hard and published != "risk_off":
            published, since = "risk_off", t_dec                       # fast-fail: 1 bar, from any state including unknown
        elif cnt >= FIXED["hysteresis"] and raw != published:
            published, since = raw, t_dec
        entries.append((published, since, votes, {**vetoes, "counter": cnt, "raw": raw}))
    return RegimeSeries(times, entries, band, vol_pct, bar)


def forward_diagnostics(market, series, windows=None, horizons=(1, 7, 30), btc="BTC"):
    """Design §9: per published state, forward BTC returns and forward 30-bar max drawdown. Descriptive only.
    `windows` = [(start_t, end_t)] of untouched OOS periods; None = whole series."""
    B = _Series(market.bars[btc]); bar = market.bar_seconds
    out = {s: {"n": 0, **{f"ret_{h}d": [] for h in horizons}, "fwd_dd_30": []} for s in STATES}
    for t_dec, e in zip(series.times, series.entries):
        if windows and not any(a <= t_dec < b for a, b in windows):
            continue
        k = bisect.bisect_right(B.t, t_dec - bar) - 1
        if k < 0 or B.t[k] != t_dec - bar:
            continue
        d = out[e[0]]; d["n"] += 1
        for h in horizons:
            if k + h < len(B.c):
                d[f"ret_{h}d"].append(B.c[k + h] / B.c[k] - 1)
        fut = B.c[k + 1:k + 31]
        if fut:
            peak, mdd = B.c[k], 0.0
            for x in fut:
                peak = max(peak, x); mdd = min(mdd, x / peak - 1)
            d["fwd_dd_30"].append(mdd)
    def stats(xs):
        if not xs:
            return None
        xs = sorted(xs); m = len(xs) // 2
        return {"mean": sum(xs) / len(xs), "median": xs[m] if len(xs) % 2 else (xs[m - 1] + xs[m]) / 2, "hit": sum(1 for x in xs if x > 0) / len(xs), "n": len(xs)}
    return {s: {"n": d["n"], **{k: stats(v) for k, v in d.items() if k != "n"}} for s, d in out.items()}
