"""Phase 4 dynamic liquidity universe — docs/desk/PHASE4-PREREGISTRATION.md v2 §1 (R-S 1). FROZEN mechanics:
on the first eligible decision close of each UTC calendar month, rank currently listed, non-excluded assets by mean
daily dollar volume (close x volume) over the preceding `lookback` (90) COMPLETED daily bars — all 90 bars required,
contiguous, no forward-filling of a missing bar or volume; take the top `top_n` (20); ties by symbol ascending;
membership frozen until the next monthly ranking; the ranking at decision close t uses only bars completed by t and
trades begin at the next open (the engine's normal fill rule). A name that drops out receives no new entries (it leaves
view.universe()) but open positions continue under the strategy's own exit rule (the view keeps serving its bars).
The exclusion map is frozen here and is never edited after results: fiat-pegged stablecoins and wrapped / staked
derivatives of listed assets. This module reads the Market directly (like regime.py); strategies never do."""
import bisect, datetime as dt, hashlib, json

TOP_N = 20
LOOKBACK = 90
EXCLUDED_STABLE = ("USDT", "USDC", "DAI", "PYUSD", "USDS", "FDUSD", "TUSD", "GUSD", "USDP", "EURC", "EUROC")
EXCLUDED_WRAPPED = ("WBTC", "WETH", "CBETH", "CBBTC", "STETH", "RETH", "LSETH")
EXCLUDED = frozenset(EXCLUDED_STABLE + EXCLUDED_WRAPPED)
VERSION = 2


def base_symbol(sym):
    """'WBTC', 'WBTC-USD' and 'wbtc/usd' all map to 'WBTC'."""
    return sym.split("-")[0].split("/")[0].upper()


def is_excluded(sym, excluded=EXCLUDED):
    return base_symbol(sym) in excluded


def month_of(t):
    d = dt.datetime.fromtimestamp(t, dt.timezone.utc)
    return (d.year, d.month)


def rank_at(market, t_dec, lookback=LOOKBACK, excluded=EXCLUDED):
    """[(symbol, mean_dollar_volume)] of every eligible name at decision close t_dec, sorted (-dollar_volume, symbol).
    Eligible: listed at t_dec, not excluded, and the `lookback` bars completed by t_dec are exactly the last `lookback`
    daily bars (the bar ending at t_dec is present and the window has no gap)."""
    bar = market.bar_seconds
    out = []
    for s in market.symbols():
        if is_excluded(s, excluded):
            continue
        a, d = market.listings.get(s, (None, None))
        if a is None or a > t_dec or (d is not None and t_dec >= d):
            continue
        ts = market._ts[s]
        i = bisect.bisect_right(ts, t_dec - bar)
        if i < lookback or ts[i - 1] != t_dec - bar or ts[i - lookback] != t_dec - lookback * bar:
            continue                                               # missing bar in the window: ineligible this month, never filled forward
        win = market.bars[s][i - lookback:i]
        out.append((s, sum(b.c * b.v for b in win) / lookback))
    out.sort(key=lambda x: (-x[1], x[0]))
    return out


class UniverseSeries:
    """Monthly memberships keyed by the ranking's decision time; at(t) = membership published at the last ranking <= t."""

    def __init__(self, times, members, ranks, top_n, lookback, excluded, bar_seconds):
        self.times, self.members, self.ranks = times, members, ranks
        self.top_n, self.lookback, self.excluded, self.bar_seconds = top_n, lookback, tuple(sorted(excluded)), bar_seconds

    def at(self, t):
        i = bisect.bisect_right(self.times, t) - 1
        return self.members[i] if i >= 0 else frozenset()

    def memberships(self):
        return [{"t": t, "month": "%04d-%02d" % month_of(t - self.bar_seconds), "members": sorted(m)} for t, m in zip(self.times, self.members)]

    def membership_hash(self):
        return hashlib.sha256(json.dumps([(t, sorted(m)) for t, m in zip(self.times, self.members)]).encode()).hexdigest()[:16]

    def manifest(self):
        ms = self.memberships()
        names = sorted({s for m in self.members for s in m})
        return {"version": VERSION, "rule": "monthly top-N mean daily dollar volume over the preceding completed bars; all bars required; ties by symbol asc; frozen until next ranking",
                "top_n": self.top_n, "lookback_bars": self.lookback, "excluded": list(self.excluded), "months": len(ms),
                "first_ranking_t": self.times[0] if self.times else None, "distinct_members": len(names), "membership_hash": self.membership_hash(), "memberships": ms}


def monthly_top_volume(market, top_n=TOP_N, lookback=LOOKBACK, excluded=EXCLUDED):
    """Forward pass over every decision close; one ranking per UTC calendar month at its first eligible decision close
    (the first close at which at least one name has the full window). The month is that of the completed bar's date."""
    bar = market.bar_seconds
    times = sorted({t + bar for s in market.bars for t in market._ts[s]})
    done, out_t, out_m, out_r = set(), [], [], []
    for t_dec in times:
        ym = month_of(t_dec - bar)
        if ym in done:
            continue
        ranked = rank_at(market, t_dec, lookback, excluded)
        if not ranked:
            continue
        done.add(ym)
        top = ranked[:top_n]
        out_t.append(t_dec); out_m.append(frozenset(s for s, _ in top)); out_r.append([(s, v) for s, v in top])
    return UniverseSeries(out_t, out_m, out_r, top_n, lookback, excluded, bar)
