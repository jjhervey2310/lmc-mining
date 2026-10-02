"""Event-driven daily engine (v3: slot allocator, review R-G).
SIZING lives here, not in strategies: every buy is ONE SLOT = current_equity * gross_cap / max_positions, all-or-none.
Strategies only say WHICH names (and a priority for ranking when signals exceed free slots); Order.usd is ignored.
Capital starvation is therefore a strategy property (how it ranks), never an allocator artefact.
Chronology per bar opening at t:  (1) fill yesterday's decisions at this OPEN — sells first, then buys as a batch
with a deterministic allocation (priority desc, symbol asc), all-or-none, never partial; (2) stops/targets on this
bar's range INCLUDING the entry bar (stop before target; gap through a level fills at the open); (3) mark equity
at the close, stamped t + bar; (4) decide with as_of(t + bar). `end_t` bounds information: a bar is processed only
if t + bar <= end_t, so a fit window can never see its test window's first bar. Every non-fill is an event."""
import dataclasses
from bt_costs import CostModel


@dataclasses.dataclass
class Order:
    symbol: str
    side: str            # 'buy' | 'sell' (sell = close the position)
    usd: float = 0.0     # IGNORED since v3 — sizing is the engine's slot allocator
    stop: float = None
    target: float = None
    priority: float = 0.0  # higher fills first when capital/slots are scarce; ties by symbol
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
    ret: float
    pnl: float
    reason: str
    tag: str = ""


class Portfolio:
    def __init__(self, cash):
        self.cash = cash
        self.positions = {}

    def equity(self, prices):
        return self.cash + sum(p.units * prices.get(s, p.entry_px) for s, p in self.positions.items())


def run(market, strategy, costs: CostModel, start_cash=10_000.0, start_t=None, end_t=None, max_positions=10, gross_cap=1.0):
    bar = market.bar_seconds
    times = sorted({t for s in market.symbols() for t in market._ts[s]})
    if start_t is not None:
        times = [t for t in times if t >= start_t]
    if end_t is not None:
        times = [t for t in times if t + bar <= end_t]      # information boundary, not a label filter (R-F #1)
    pf, trades, equity, events = Portfolio(start_cash), [], [], []
    pending = []
    side_cost = costs.per_side(taker=True)
    for t in times:
        # (1) sells first, then buys as a batch against post-sell cash and slots
        slot_usd = (equity[-1][1] if equity else start_cash) * gross_cap / max_positions   # sized off the last close mark
        sells = [o for o in pending if o.side == "sell"]
        buys = sorted((o for o in pending if o.side == "buy"), key=lambda o: (-o.priority, o.symbol))
        for o in sells:
            b = market.bar_opening_at(o.symbol, t)
            if b is None:
                events.append((t, o.symbol, "no_fill", "no bar", o.tag)); continue
            if o.symbol in pf.positions:
                _close(pf, trades, o.symbol, b.o * (1 - side_cost), t, "signal")
        for o in buys:
            b = market.bar_opening_at(o.symbol, t)
            if b is None:
                events.append((t, o.symbol, "no_fill", "no bar", o.tag)); continue
            if o.symbol in pf.positions:
                events.append((t, o.symbol, "no_fill", "already held", o.tag)); continue
            if len(pf.positions) >= max_positions:
                events.append((t, o.symbol, "no_fill", "slots", o.tag)); continue
            if slot_usd <= 0 or slot_usd > pf.cash + 1e-9:
                events.append((t, o.symbol, "no_fill", f"cash {pf.cash:.2f} < slot {slot_usd:.2f}", o.tag)); continue
            px = b.o * (1 + side_cost)
            pf.cash -= slot_usd
            pf.positions[o.symbol] = Position(o.symbol, slot_usd / px, px, t, o.stop, o.target, b.o, o.tag)
            events.append((t, o.symbol, "fill", f"{slot_usd:.2f}", o.tag))
        pending = []
        # (2) stops / targets on this bar's range, entry bar included (R-F #2)
        for s in list(pf.positions):
            p = pf.positions[s]
            b = market.bar_opening_at(s, t)
            if b is None:
                continue
            if p.stop is not None and b.l <= p.stop:
                _close(pf, trades, s, min(p.stop, b.o) * (1 - side_cost), t, "stop"); continue
            if p.target is not None and b.h >= p.target:
                _close(pf, trades, s, max(p.target, b.o) * (1 - side_cost), t, "target"); continue
            p.high = max(p.high, b.h)
        # (3) mark at the close, stamped with the close time (R-F #7)
        prices = {}
        for s in pf.positions:
            b = market.bar_opening_at(s, t)
            if b is not None:
                prices[s] = b.c
        equity.append((t + bar, pf.equity(prices)))
        # (4) decide on the completed bar
        pending = list(strategy(market.as_of(t + bar), pf) or [])
    if times:
        t = times[-1]
        for s in list(pf.positions):
            b = market.bar_opening_at(s, t)
            _close(pf, trades, s, (b.c if b else pf.positions[s].entry_px) * (1 - side_cost), t, "eod")
        equity[-1] = (t + bar, pf.cash)
    return {"equity": equity, "trades": trades, "events": events, "final_cash": pf.cash, "start_cash": start_cash, "sizing": {"rule": "slot", "gross_cap": gross_cap, "max_positions": max_positions},
            "no_fills": sum(1 for e in events if e[2] == "no_fill"),
            "no_fill_reasons": _reason_counts(events)}


def _reason_counts(events):
    """no_fill breakdown by class: cash / slots / no bar / already held (the cash reason carries amounts; collapse it)."""
    out = {}
    for e in events:
        if e[2] == "no_fill":
            k = "cash" if e[3].startswith("cash") else e[3]
            out[k] = out.get(k, 0) + 1
    return dict(sorted(out.items()))


def _close(pf, trades, s, px, t, reason):
    p = pf.positions.pop(s)
    pnl = p.units * (px - p.entry_px)
    pf.cash += p.units * px
    trades.append(Trade(s, p.entry_t, t, p.entry_px, px, p.units, px / p.entry_px - 1, pnl, reason, p.tag))
