"""MARKET-TIME RULES — the one place that decides which bars a signal may see.

System rule (docs/CRYPTO-DESK-ARCHITECTURE.md §11): a signal evaluated at decision time T may use only
bars that COMPLETED before T. Bar timestamps are UTC epoch seconds of the bar's OPEN; a bar with open
time t and length L is complete once t + L <= T. Joins between series are by timestamp, never by index.

Every backtest and scan imports from here instead of slicing `[-1]` or trusting `bars[i]` on both series.
"""
import datetime as _dt

DAY = 86400


class LookAheadError(ValueError):
    """Raised when code asks for a bar that had not completed at the decision time."""


def now_utc() -> int:
    return int(_dt.datetime.now(_dt.timezone.utc).timestamp())


def completed_bars(bars, as_of=None, bar_seconds=DAY):
    """Bars (dicts with 't' = open time, UTC epoch seconds) whose close time is <= as_of.
    Default as_of is now. The result is a new list; the input is never mutated."""
    cutoff = now_utc() if as_of is None else int(as_of)
    return [b for b in bars if int(b["t"]) + bar_seconds <= cutoff]


def last_completed_index(bars, as_of, bar_seconds=DAY):
    """Index of the last bar completed at as_of, or None. Linear from the end: series are short."""
    for k in range(len(bars) - 1, -1, -1):
        if int(bars[k]["t"]) + bar_seconds <= int(as_of):
            return k
    return None


def align_index(series, t, bar_seconds=DAY, as_of=None):
    """Index in `series` of the bar with open time <= t (the same-day or most recent earlier bar).
    Timestamp join, so a missing day in one series cannot shift the other. Raises LookAheadError when
    `as_of` is given and the matched bar had not completed by then."""
    for k in range(len(series) - 1, -1, -1):
        if int(series[k]["t"]) <= int(t):
            if as_of is not None and int(series[k]["t"]) + bar_seconds > int(as_of):
                raise LookAheadError(f"bar t={series[k]['t']} not complete at as_of={as_of}")
            return k
    return None


def assert_completed(bar, as_of, bar_seconds=DAY):
    """Guard for the decision point: the bar a signal fires on must have closed before the decision."""
    if int(bar["t"]) + bar_seconds > int(as_of):
        raise LookAheadError(f"signal bar t={bar['t']} closes after decision time {as_of}")
    return bar
