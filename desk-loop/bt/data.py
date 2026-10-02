import dataclasses, hashlib, json
from market_time import DAY, LookAheadError, completed_bars


@dataclasses.dataclass(frozen=True)
class Bar:
    t: int   # open time, UTC epoch seconds
    o: float
    h: float
    l: float
    c: float
    v: float

    def __getitem__(self, k):            # market_time helpers index bars by key
        return getattr(self, k)


class Market:
    """In-memory bars + listing windows. `listings[sym] = (listed_at, delisted_at|None)` in epoch seconds.
    Strategies never touch this directly; the engine hands them an AsOfView."""

    def __init__(self, bars, listings=None, bar_seconds=DAY):
        self.bar_seconds = bar_seconds
        self.bars = {s: sorted(b, key=lambda x: x.t) for s, b in bars.items()}
        self.listings = listings or {s: (b[0].t, None) for s, b in self.bars.items() if b}

    def symbols(self):
        return sorted(self.bars)

    def as_of(self, t):
        return AsOfView(self, int(t))

    def next_bar(self, sym, t):
        """First bar opening at or after t — the engine's fill bar. Not exposed on AsOfView on purpose."""
        for b in self.bars.get(sym, []):
            if b.t >= t:
                return b
        return None

    def fingerprint(self):
        h = hashlib.sha256()
        for s in self.symbols():
            bs = self.bars[s]
            h.update(f"{s}:{len(bs)}:{bs[0].t if bs else 0}:{bs[-1].t if bs else 0}:{sum(b.c for b in bs):.6f}".encode())
        return h.hexdigest()[:16]

    def universe_fingerprint(self):
        return hashlib.sha256(json.dumps(sorted((s, a, d) for s, (a, d) in self.listings.items())).encode()).hexdigest()[:16]


class AsOfView:
    """Everything a strategy may see at decision time `t`. Bars are those COMPLETED by t; the universe is
    what was listed at t. Asking for anything else raises LookAheadError."""

    def __init__(self, market, t):
        self._m, self.t = market, t

    def bars(self, sym, n=None):
        out = completed_bars(self._m.bars.get(sym, []), self.t, self._m.bar_seconds)
        return out[-n:] if n else out

    def closes(self, sym, n=None):
        return [b.c for b in self.bars(sym, n)]

    def universe(self):
        u = []
        for s, (a, d) in self._m.listings.items():
            if a <= self.t and (d is None or self.t < d) and self.bars(s, 1):
                u.append(s)
        return sorted(u)

    def bar_at(self, sym, t):
        """A specific bar by open time — refused unless it had completed by the view time."""
        if t + self._m.bar_seconds > self.t:
            raise LookAheadError(f"bar {sym}@{t} not complete at {self.t}")
        for b in self._m.bars.get(sym, []):
            if b.t == t:
                return b
        return None


def market_from_rows(rows, bar_seconds=DAY, listings=None):
    """rows: iterable of dicts with symbol, bar_time (ISO or epoch s), open, high, low, close, volume."""
    import datetime as dt
    out = {}
    for r in rows:
        t = r["bar_time"]
        if isinstance(t, str):
            t = int(dt.datetime.fromisoformat(t.replace("Z", "+00:00")).timestamp())
        out.setdefault(r["symbol"], []).append(Bar(int(t), float(r["open"]), float(r["high"]), float(r["low"]), float(r["close"]), float(r["volume"] or 0)))
    return Market(out, listings, bar_seconds)
