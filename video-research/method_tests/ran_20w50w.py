"""Test ran-20w-50w-bear-regime-v1 against 11 years of daily BTC-USD.

The first extracted method put to a real test. It qualifies because it needs no chart
reading: two moving averages on weekly closes, and a stated invalidation. Everything else
extracted so far bottoms out in a line drawn on a screen.

The claim, from CF7m0ited_Y @ 00:11:24 (2025-11-27):

    "in bear markets, every time we've had a bear market, the 20-week and the 50-week have
    basically crossed each other ... in this interim dip over here, the one we had in 2021,
    the 50-week and the 20-week didn't cross each other on the way down. And until this
    chart crosses on the way down, I don't believe that we're going into a bear market."

Three separable assertions, and they do not all survive:
  (a) bear markets are marked by a downward 20w/50w cross
  (b) the 2021 interim dip produced no cross
  (c) no cross means no bear market  <- this is the one that judges the speaker

Data: Coinbase's public daily candles, the same free endpoint desk-loop already uses. No
key, no paid call. Prices are not persisted; this recomputes from source so the result
cannot quietly drift from a stale copy.

Interpretation choices, stated because they can move a cross by a week:
  - SIMPLE moving average. He says "moving average" here and "50-week SMA" earlier in the
    same video, so simple is the reading. EMA is the obvious robustness check.
  - Weekly close = the last daily close in each ISO week, from Coinbase's UTC daily bars.
    TradingView's weekly candles may differ by a bar at the boundaries.
"""
import datetime
import json
import time
import urllib.request

PRODUCT = "BTC-USD"
DAY = 86400
UA = {"User-Agent": "lmc-research/1.0"}


def daily_closes(pages=60):
    """{date: close} back to the start of the product, paged 300 bars at a time."""
    out, end = {}, int(time.time())
    for _ in range(pages):
        start = end - 300 * DAY
        u = (f"https://api.exchange.coinbase.com/products/{PRODUCT}/candles"
             f"?granularity={DAY}"
             f"&start={datetime.datetime.utcfromtimestamp(start).isoformat()}"
             f"&end={datetime.datetime.utcfromtimestamp(end).isoformat()}")
        rows = json.loads(urllib.request.urlopen(
            urllib.request.Request(u, headers=UA), timeout=30).read())
        if not rows:
            break
        for t, _lo, _hi, _op, close, _vol in rows:
            out[datetime.date.fromtimestamp(int(t))] = float(close)
        end = start
        time.sleep(0.35)
    return out


def weekly(daily):
    """[(date, close)] — the last daily close of each ISO week."""
    buckets = {}
    for d in sorted(daily):
        buckets[d.isocalendar()[:2]] = (d, daily[d])
    return [buckets[k] for k in sorted(buckets)]


def sma(vals, n, i):
    return sum(vals[i - n + 1:i + 1]) / n if i >= n - 1 else None


def ema(vals, n):
    """Exponential average, seeded on the first value. The alternative reading of
    "moving average" — run as a robustness check rather than argued about."""
    k, out, cur = 2 / (n + 1), [], None
    for v in vals:
        cur = v if cur is None else v * k + cur * (1 - k)
        out.append(cur)
    return out


def crossovers(wk, fast=20, slow=50, kind="sma"):
    """[(date, 'below'|'above', close)] — every state change, on weekly closes."""
    closes = [c for _d, c in wk]
    ef, es = (ema(closes, fast), ema(closes, slow)) if kind == "ema" else (None, None)
    out, prev = [], None
    for i, (d, c) in enumerate(wk):
        if kind == "ema":
            a, b = (ef[i], es[i]) if i >= slow - 1 else (None, None)
        else:
            a, b = sma(closes, fast, i), sma(closes, slow, i)
        if a is None or b is None:
            continue
        state = "above" if a > b else "below"
        if prev and state != prev:
            out.append((d, state, c))
        prev = state
    return out


def forward_return(wk, from_date, months):
    base = next((c for d, c in wk if d == from_date), None)
    if base is None:
        return None
    target = from_date + datetime.timedelta(days=30 * months)
    later = [c for d, c in wk if d >= target]
    return 100 * (later[0] - base) / base if later else None


def main():
    daily = daily_closes()
    wk = weekly(daily)
    closes = [c for _d, c in wk]
    print(f"weekly bars {len(wk)}   {wk[0][0]} -> {wk[-1][0]}\n")

    print("(a) DOWNWARD CROSSES, and what followed")
    for d, state, c in crossovers(wk):
        if state != "below":
            continue
        fwd = "  ".join(f"{m}mo {r:+.1f}%" for m in (3, 6, 12)
                        if (r := forward_return(wk, d, m)) is not None)
        print(f"    {d}  BTC {c:>9,.0f}   {fwd}")

    print("\n    same, under EMA (robustness check — the other reading of 'moving average'):")
    for d, state, c in crossovers(wk, kind="ema"):
        if state == "below":
            print(f"    {d}  BTC {c:>9,.0f}")

    print("\n(b) THE 2021 INTERIM DIP")
    peak = max(c for d, c in wk if datetime.date(2021, 3, 1) <= d <= datetime.date(2021, 5, 1))
    trough = min(c for d, c in wk if datetime.date(2021, 6, 1) <= d <= datetime.date(2021, 8, 1))
    gap = []
    for i, (d, _c) in enumerate(wk):
        if not datetime.date(2021, 4, 1) <= d <= datetime.date(2021, 9, 1):
            continue
        a, b = sma(closes, 20, i), sma(closes, 50, i)
        if a and b:
            gap.append((d, a, b))
    d, a, b = min(gap, key=lambda r: r[1] - r[2])
    print(f"    drawdown {peak:,.0f} -> {trough:,.0f} ({100*(trough-peak)/peak:.1f}%)")
    print(f"    closest approach {d}: 20w {a:,.0f} vs 50w {b:,.0f} "
          f"({100*(a-b)/b:+.1f}%)  crossed: {'YES' if a < b else 'NO'}")

    i = len(wk) - 1
    a, b = sma(closes, 20, i), sma(closes, 50, i)
    print(f"\n(c) TODAY {wk[i][0]}  BTC {wk[i][1]:,.0f}  20w {a:,.0f}  50w {b:,.0f}"
          f"  ->  {'BEAR' if a < b else 'BULL'} by the rule")


if __name__ == "__main__":
    main()
