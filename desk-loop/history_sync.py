#!/usr/bin/env python3
"""DAILY HISTORY SYNC — one year of daily USD prices for every name in the Robinhood universe,
written to Supabase cg_history so the dashboard charts read from the DB instead of fanning out to
CoinGecko at page load (Vercel's shared IPs get 429'd; a browser gets CORS-blocked — 2026-09-07).
Free. ~88 CoinGecko calls spaced 2.5s = ~4 min. Reuses backtest.py's cached fetch (20h TTL)."""
import json, time, datetime
from common import *
from backtest import universe, id_map
from common import _req

H365 = STATE / "hist365"; H365.mkdir(parents=True, exist_ok=True)

def history365(cid):
    """365d daily bars with its OWN cache (backtest.history caches by id regardless of days, and the
    breakout scan keeps that cache at 60d)."""
    f = H365 / f"{cid}.json"
    if f.exists() and time.time() - f.stat().st_mtime < 20 * 3600:
        return json.loads(f.read_text())
    j = _req(f"https://api.coingecko.com/api/v3/coins/{cid}/market_chart?vs_currency=usd&days=365&interval=daily", retries=4)
    out = [{"t": int(t // 1000), "c": v} for t, v in j.get("prices", [])]
    f.write_text(json.dumps(out)); time.sleep(2.5)
    return out

def main():
    syms = universe(); ids = id_map(set(syms))
    rows, skipped = [], []
    for s in syms:
        cid = ids.get(s) or CG.get(s)
        if not cid: skipped.append(s); continue
        try:
            bars = history365(cid)
        except Exception as e:
            skipped.append(f"{s}({type(e).__name__})"); continue
        if not bars or len(bars) < 5: skipped.append(f"{s}(short)"); continue
        prices = [[b["t"] * 1000, round(b["c"], 8)] for b in bars if b.get("c") is not None]
        rows.append({"id": cid, "symbol": s, "days": 365, "prices": prices,
                     "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
        if len(rows) % 20 == 0:
            sb_upsert("cg_history", rows[-20:], "id")
    if rows:
        sb_upsert("cg_history", rows, "id")
    print(f"history sync: {len(rows)} ids written, {len(skipped)} skipped: {', '.join(skipped[:10])}")

if __name__ == "__main__":
    main()
