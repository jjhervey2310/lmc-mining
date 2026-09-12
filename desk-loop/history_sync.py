#!/usr/bin/env python3
"""DAILY HISTORY SYNC — one year of daily USD prices for every name in the Robinhood universe,
written to Supabase cg_history so the dashboard charts read from the DB instead of fanning out to
CoinGecko at page load (Vercel's shared IPs get 429'd; a browser gets CORS-blocked — 2026-09-07).
Free. ~88 CoinGecko calls spaced 2.5s = ~4 min. Reuses backtest.py's cached fetch (20h TTL)."""
import json, time, datetime
from common import *
from backtest import universe, id_map
from backtest_house import candles as cb_candles
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
        # Coinbase first (keyless, no 429s, 83/88 names, cached 20h by backtest_house); CoinGecko only for the rest.
        bars = None
        try:
            cb = cb_candles(s)
            if cb and len(cb) >= 5:
                cutoff = time.time() - 366 * 86400
                bars = [{"t": b["t"], "c": b["c"], "v": b.get("v")} for b in cb if b["t"] >= cutoff]   # keep v: dropping it here is why cg_history had no volume
        except Exception:
            bars = None
        if not bars:
            try:
                bars = history365(cid)
            except Exception as e:
                skipped.append(f"{s}({type(e).__name__})"); continue
        if not bars or len(bars) < 5: skipped.append(f"{s}(short)"); continue
        # [ts_ms, close, volume]. Volume was omitted originally, which left the web grader unable to
        # confirm the breakout's volume leg whenever CoinGecko rate-limited it (2026-09-11).
        prices = [[b["t"] * 1000, round(b["c"], 8)] + ([round(b["v"], 4)] if b.get("v") is not None else [])
                  for b in bars if b.get("c") is not None]
        rows.append({"id": cid, "symbol": s, "days": 365, "prices": prices,
                     "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()})
        if len(rows) % 10 == 0:
            sb_upsert("cg_history", rows[-10:], "id")
    if rows:
        sb_upsert("cg_history", rows, "id")
    print(f"history sync: {len(rows)} ids written, {len(skipped)} skipped: {', '.join(skipped[:10])}")

if __name__ == "__main__":
    main()
