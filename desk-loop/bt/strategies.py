"""Baseline strategies for the tournament. Each is a callable (view, portfolio) -> [Order]. They see only the
AsOfView, so none can read a bar that had not closed at decision time."""
from .engine import Order


def _sma(xs, n):
    return sum(xs[-n:]) / n if len(xs) >= n else None


def buy_and_hold(symbols, weight_usd):
    done = set()
    def s(view, pf):
        out = []
        for sym in symbols:
            if sym not in done and sym in view.universe():
                done.add(sym); out.append(Order(sym, "buy", weight_usd, tag="bh"))
        return out
    return s


def cash():
    return lambda view, pf: []


def dca(symbols, usd_per_buy, every_days=30):
    last = {}
    def s(view, pf):
        out = []
        for sym in symbols:
            if sym in view.universe() and view.t - last.get(sym, 0) >= every_days * 86400:
                last[sym] = view.t; out.append(Order(sym, "buy", usd_per_buy, tag="dca"))
        return out
    return s


def sma_trend(symbols, usd, fast=50, slow=200):
    def s(view, pf):
        out = []
        for sym in symbols:
            c = view.closes(sym, slow + 1)
            f, sl = _sma(c, fast), _sma(c, slow)
            if f is None or sl is None:
                continue
            long = c[-1] > sl and f > sl
            if long and sym not in pf.positions:
                out.append(Order(sym, "buy", usd, tag="trend"))
            elif not long and sym in pf.positions:
                out.append(Order(sym, "sell", tag="trend"))
        return out
    return s


def breakout20(usd, lookback=20, vol_mult=1.5, max_ext=0.15, stop_pct=0.12, btc="BTC"):
    """The house breakout rule, on completed bars: close > prior 20d high, volume >= 1.5x prior 20d avg,
    7d RS > BTC, extension <= 15%. Fixed % stop; exit otherwise on close below the 20d low."""
    def s(view, pf):
        out = []
        bc = view.closes(btc, 8)
        btc7 = bc[-1] / bc[-8] - 1 if len(bc) >= 8 else None
        for sym in view.universe():
            bars = view.bars(sym, lookback + 8)
            if len(bars) < lookback + 8 or btc7 is None:
                continue
            c, v = bars[-1].c, bars[-1].v
            win = bars[-lookback - 1:-1]
            hi, lo = max(b.c for b in win), min(b.l for b in win)
            avgv = sum(b.v for b in win) / len(win) or 1
            r7 = c / bars[-8].c - 1
            if sym in pf.positions:
                if c < lo:
                    out.append(Order(sym, "sell", tag="brk"))
                continue
            if c > hi and v >= vol_mult * avgv and r7 > btc7 and c / hi - 1 <= max_ext:
                out.append(Order(sym, "buy", usd, stop=c * (1 - stop_pct), tag="brk"))
        return out
    return s


def momentum_top(n, usd, lookback=90, rebalance_days=30):
    state = {"last": 0}
    def s(view, pf):
        if view.t - state["last"] < rebalance_days * 86400:
            return []
        state["last"] = view.t
        scores = []
        for sym in view.universe():
            c = view.closes(sym, lookback + 1)
            if len(c) >= lookback + 1 and c[-lookback - 1] > 0:
                scores.append((c[-1] / c[-lookback - 1] - 1, sym))
        top = {sym for _, sym in sorted(scores, reverse=True)[:n]}
        out = [Order(sym, "sell", tag="mom") for sym in pf.positions if sym not in top]
        out += [Order(sym, "buy", usd, tag="mom") for sym in top if sym not in pf.positions]
        return out
    return s


def mean_reversion(symbols, usd, n=20, dip=0.10, stop_pct=0.15):
    def s(view, pf):
        out = []
        for sym in symbols:
            c = view.closes(sym, n + 1)
            m = _sma(c, n)
            if m is None:
                continue
            if sym in pf.positions:
                if c[-1] >= m:
                    out.append(Order(sym, "sell", tag="mr"))
            elif c[-1] <= m * (1 - dip):
                out.append(Order(sym, "buy", usd, stop=c[-1] * (1 - stop_pct), target=m, tag="mr"))
        return out
    return s


REGISTRY = {"buy_and_hold": buy_and_hold, "cash": cash, "dca": dca, "sma_trend": sma_trend, "breakout20": breakout20, "momentum_top": momentum_top, "mean_reversion": mean_reversion}
