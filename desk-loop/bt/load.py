"""Load bars from Supabase md_candles (paged, service key from env) or from a JSON export. Snapshot the result
to disk so a run's data_hash is reproducible even after the forward fill adds bars."""
import json, os
from common import sb_get
from .data import market_from_rows, DAY


def load_md_candles(symbols=None, venue="coinbase", interval_minutes=1440, start=None, page=1000):
    rows, off = [], 0
    base = f"venue=eq.{venue}&interval_minutes=eq.{interval_minutes}&select=symbol,bar_time,open,high,low,close,volume&order=symbol,bar_time"
    if symbols:
        base += "&symbol=in.(" + ",".join(symbols) + ")"
    if start:
        base += f"&bar_time=gte.{start}"
    while True:
        chunk = sb_get("md_candles", f"{base}&limit={page}&offset={off}")
        rows += chunk
        if len(chunk) < page:
            break
        off += page
    return rows


def load_universe(venue="coinbase"):
    """listed/delisted proxies from universe_history: first_bar (proxy for listing) and delisted_at (observed)."""
    import datetime as dt
    out = {}
    for r in sb_get("universe_history", f"venue=eq.{venue}&select=symbol,first_bar,delisted_at,first_seen"):
        a = r.get("first_bar") or r.get("first_seen")
        a_t = int(dt.datetime.fromisoformat(str(a).replace("Z", "+00:00")).timestamp()) if a else 0
        d = r.get("delisted_at")
        d_t = int(dt.datetime.fromisoformat(f"{d}T00:00:00+00:00").timestamp()) if d else None
        out[r["symbol"]] = (a_t, d_t)
    return out


def snapshot(rows, listings, path):
    json.dump({"rows": rows, "listings": listings}, open(path, "w"))


def load_snapshot(path, bar_seconds=DAY):
    j = json.load(open(path))
    if not j.get("listings"):
        raise ValueError(f"{path}: snapshot has no listings (universe_history) — refusing to infer a universe from bars")
    listings = {k: tuple(v) for k, v in j["listings"].items()}
    return market_from_rows(j["rows"], bar_seconds, listings)
