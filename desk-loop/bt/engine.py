"""Event-driven daily engine. Decision at bar i's close (as_of = t_i + bar); fill at bar i+1's OPEN with taker
costs; stops/targets evaluated on each later bar's range (gap through a level fills at that bar's open,
stop checked before target on the same bar); equity marked at each close. Positions are in USD notional."""
import dataclasses
from bt_costs import CostModel


@dataclasses.dataclass
class Order:
    symbol: str
    side: str            # 'buy' | 'sell' (sell = close the position)
    usd: float = 0.0     # notional for buys; ignored for sells
    stop: float = None
    target: float = None
    tag: str = ""


@dataclasses.dataclass
class Position:
    symbol: str
    units: float
    entry_px: float
    entry_t: int
    stop: float = None
    target: float = None
    high: float = 0.0
    tag: str = ""


@dataclasses.dataclass
class Trade:
    symbol: str
    entry_t: int
    exit_t: int
    entry_px: float
    exit_px: float
    units: float
    ret: float       # net fractional return on the notional
    pnl: float
    reason: str
    tag: str = ""


class Portfolio:
    def __init__(self, cash):
        self.cash = cash
        self.positions = {}

    def equity(self, prices):
        return self.cash + sum(p.units * prices.get(s, p.entry_px) for s, p in self.positions.items())


def run(market, strategy, costs: CostModel, start_cash=10_000.0, start_t=None, end_t=None, max_positions=10):
    """strategy(view, portfolio) -> list[Order]. Returns dict(equity=[(t, equity)], trades=[Trade], manifest-ish info)."""
    bar = market.bar_seconds
    times = sorted({b.t for s in market.symbols() for b in market.bars[s]})
    if start_t is not None:
        times = [t for t in times if t >= start_t]
    if end_t is not None:
        times = [t for t in times if t <= end_t]
    pf, trades, equity = Portfolio(start_cash), [], []
    pending = []                                  # orders decided at the previous close, to fill at this bar's open
    side_cost = costs.per_side(taker=True)
    for t in times:
        # 1) fills for yesterday's decisions, at this bar's open
        for o in pending:
            b = market.next_bar(o.symbol, t)
            if b is None or b.t != t:
                continue                          # no bar for this symbol today: order lapses (no_fill)
            if o.side == "buy" and o.symbol not in pf.positions and len(pf.positions) < max_positions:
                usd = min(o.usd, pf.cash)
                if usd <= 0:
                    continue
                px = b.o * (1 + side_cost)
                pf.cash -= usd
                pf.positions[o.symbol] = Position(o.symbol, usd / px, px, t, o.stop, o.target, b.o, o.tag)
            elif o.side == "sell" and o.symbol in pf.positions:
                _close(pf, trades, o.symbol, b.o * (1 - side_cost), t, "signal")
        pending = []
        # 2) stops / targets on this bar's range (stop first; gap through → fill at open)
        for s in list(pf.positions):
            p = pf.positions[s]
            b = market.next_bar(s, t)
            if b is None or b.t != t or p.entry_t == t:
                continue
            if p.stop is not None and b.l <= p.stop:
                _close(pf, trades, s, min(p.stop, b.o) * (1 - side_cost), t, "stop")
                continue
            if p.target is not None and b.h >= p.target:
                _close(pf, trades, s, max(p.target, b.o) * (1 - side_cost), t, "target")
                continue
            p.high = max(p.high, b.h)
        # 3) mark and decide at the close
        prices = {s: market.next_bar(s, t).c for s in pf.positions if market.next_bar(s, t) and market.next_bar(s, t).t == t}
        equity.append((t, pf.equity({**{s: p.entry_px for s, p in pf.positions.items()}, **prices})))
        view = market.as_of(t + bar)
        pending = list(strategy(view, pf) or [])
    # close everything at the last close for a clean mark
    if times:
        t = times[-1]
        for s in list(pf.positions):
            b = market.next_bar(s, t)
            _close(pf, trades, s, (b.c if b and b.t == t else pf.positions[s].entry_px) * (1 - side_cost), t, "eod")
        equity[-1] = (t, pf.cash)
    return {"equity": equity, "trades": trades, "final_cash": pf.cash, "start_cash": start_cash}


def _close(pf, trades, s, px, t, reason):
    p = pf.positions.pop(s)
    pnl = p.units * (px - p.entry_px)
    pf.cash += p.units * px
    trades.append(Trade(s, p.entry_t, t, p.entry_px, px, p.units, px / p.entry_px - 1, pnl, reason, p.tag))
