"""Shared plumbing for the LMC desk loop: env, Supabase REST, ntfy (quiet hours),
kill switch, spend cap, drawdown halt. stdlib only."""
import json, os, sys, time, datetime, urllib.request, urllib.parse, pathlib

ROOT = pathlib.Path(os.environ.get("LMC_DESK_ROOT", "/root/lmc-desk"))
STATE = ROOT / "state"; STATE.mkdir(parents=True, exist_ok=True)

def load_env():
    p = ROOT / ".env"
    if p.exists():
        for line in p.read_text().splitlines():
            line = line.split("#", 1)[0].strip()
            if "=" in line:
                k, v = line.split("=", 1); k, v = k.strip(), v.strip()
                if v: os.environ[k] = v   # last non-empty wins; blanks never mask a real value
load_env()
SB = os.environ.get("SUPABASE_URL", "").rstrip("/")
SBK = os.environ.get("SUPABASE_SERVICE_KEY", "")
TZ = datetime.timezone(datetime.timedelta(hours=-6))  # Denver (MDT); install.sh also sets system tz

def _req(url, method="GET", body=None, headers=None, timeout=30, retries=3):
    """HTTP with backoff on 429/5xx — free CoinGecko rate-limits when two jobs overlap."""
    h = {"User-Agent": "lmc-desk-loop/1.0"}; h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    if data is not None: h["Content-Type"] = "application/json"
    last = None
    for attempt in range(retries):
        try:
            r = urllib.request.Request(url, data=data, method=method, headers=h)
            with urllib.request.urlopen(r, timeout=timeout) as resp:
                raw = resp.read().decode()
                return json.loads(raw) if raw.strip().startswith(("{", "[")) else raw
        except urllib.error.HTTPError as e:
            last = e
            if e.code in (429, 500, 502, 503, 504) and attempt < retries - 1:
                time.sleep(20 * (attempt + 1)); continue
            raise
        except Exception as e:
            last = e
            if attempt < retries - 1: time.sleep(3); continue
            raise
    raise last

def sb_get(table, query=""):
    return _req(f"{SB}/rest/v1/{table}?{query}", headers={"apikey": SBK, "Authorization": f"Bearer {SBK}"})

def sb_insert(table, rows):
    return _req(f"{SB}/rest/v1/{table}", "POST", rows, {"apikey": SBK, "Authorization": f"Bearer {SBK}", "Prefer": "return=minimal"})

def sb_upsert(table, rows, on_conflict):
    return _req(f"{SB}/rest/v1/{table}?on_conflict={on_conflict}", "POST", rows,
                {"apikey": SBK, "Authorization": f"Bearer {SBK}", "Prefer": "resolution=merge-duplicates,return=minimal"})

def sb_patch(table, query, body):
    return _req(f"{SB}/rest/v1/{table}?{query}", "PATCH", body, {"apikey": SBK, "Authorization": f"Bearer {SBK}", "Prefer": "return=minimal"})

def config(key, default=None):
    rows = sb_get("desk_config", f"key=eq.{key}&select=value")
    return rows[0]["value"] if rows else default

def now_denver():
    return datetime.datetime.now(datetime.timezone.utc).astimezone(TZ)

def quiet_hours():
    h = now_denver().hour
    return h >= 23 or h < 8

def ntfy(title, msg, priority="default", force=False):
    """Push via ntfy. During quiet hours (23:00-08:00 Denver) queue to the 08:00 digest unless force."""
    topic = os.environ.get("NTFY_TOPIC") or config("ntfy_topic")
    if not topic: return False
    if quiet_hours() and not force:
        with open(STATE / "queue.jsonl", "a") as f:
            f.write(json.dumps({"at": now_denver().isoformat(), "title": title, "msg": msg}) + "\n")
        return "queued"
    try:
        _req(f"https://ntfy.sh/{topic}", "POST", None, {"Title": title, "Priority": priority}) if False else None
        r = urllib.request.Request(f"https://ntfy.sh/{topic}", data=msg.encode(), method="POST",
                                   headers={"Title": title, "Priority": priority})
        urllib.request.urlopen(r, timeout=15).read()
        return "sent"
    except Exception as e:
        with open(STATE / "queue.jsonl", "a") as f:
            f.write(json.dumps({"at": now_denver().isoformat(), "title": title, "msg": msg, "err": str(e)}) + "\n")
        return "queued"

def flush_queue():
    q = STATE / "queue.jsonl"
    if not q.exists(): return 0
    lines = [l for l in q.read_text().splitlines() if l.strip()]
    if not lines: return 0
    items = [json.loads(l) for l in lines]
    body = "\n\n".join(f"[{i['at'][11:16]}] {i['title']}\n{i['msg']}" for i in items)
    ntfy(f"Overnight digest — {len(items)} item(s)", body[:3800], force=True)
    q.unlink(); return len(items)

def loop_enabled():
    return str(config("loop_enabled", "true")).lower() == "true"

# ── spend cap: token accounting in state/spend.json, halt file when over ──
def add_spend(usd):
    p = STATE / "spend.json"; m = now_denver().strftime("%Y-%m")
    d = json.loads(p.read_text()) if p.exists() else {}
    if d.get("month") != m: d = {"month": m, "usd": 0.0}
    d["usd"] = round(d["usd"] + float(usd), 4); p.write_text(json.dumps(d))
    cap = float(os.environ.get("MONTHLY_CAP_USD", "30"))
    if d["usd"] >= cap:
        (STATE / "halt_spend").write_text(f"{d['usd']} >= {cap} on {now_denver().isoformat()}")
        ntfy("⛔ Desk loop HALTED — spend cap", f"${d['usd']:.2f} of ${cap:.0f}/mo used. Wakes paused until next month or cap raised.", "high", force=True)
    return d

def budget_status():
    """Jacob's rule (2026-09-03): AI cost must scale with the book, not the clock.
    Monthly allowance = max(WAKE_MIN_USD, WAKE_BUDGET_PCT% of book value).
    Returns (allowed_month, spent_month, allowed_today, spent_today, ok_to_wake)."""
    pct = float(config("wake_budget_pct", os.environ.get("WAKE_BUDGET_PCT", "1.5")))
    floor = float(config("wake_min_usd", os.environ.get("WAKE_MIN_USD", "5")))
    try:
        book, _ = book_value()
    except Exception:
        book = 0.0
    allowed_month = max(floor, book * pct / 100.0)
    p = STATE / "spend.json"; m = now_denver().strftime("%Y-%m")
    d = json.loads(p.read_text()) if p.exists() else {}
    spent_month = d.get("usd", 0.0) if d.get("month") == m else 0.0
    days_in_month = 30.0
    allowed_today = allowed_month / days_in_month
    dp = STATE / "spend_day.json"; today = now_denver().strftime("%Y-%m-%d")
    dd = json.loads(dp.read_text()) if dp.exists() else {}
    spent_today = dd.get("usd", 0.0) if dd.get("day") == today else 0.0
    # Allow a 3x daily burst (event days cost more), still hard-capped by the month.
    ok = spent_month < allowed_month and spent_today < allowed_today * 3
    return allowed_month, spent_month, allowed_today, spent_today, ok

def add_day_spend(usd):
    dp = STATE / "spend_day.json"; today = now_denver().strftime("%Y-%m-%d")
    dd = json.loads(dp.read_text()) if dp.exists() else {}
    if dd.get("day") != today: dd = {"day": today, "usd": 0.0}
    dd["usd"] = round(dd["usd"] + float(usd), 4); dp.write_text(json.dumps(dd))
    return dd

def spend_ok():
    p = STATE / "spend.json"; m = now_denver().strftime("%Y-%m")
    if (STATE / "halt_spend").exists():
        d = json.loads(p.read_text()) if p.exists() else {}
        if d.get("month") == m: return False
        (STATE / "halt_spend").unlink()
    return True

# ── prices + drawdown halt ──
CG = {"BTC":"bitcoin","ETH":"ethereum","SOL":"solana","XRP":"ripple","DOGE":"dogecoin","UNI":"uniswap","AAVE":"aave","LINK":"chainlink",
      "OP":"optimism","ARB":"arbitrum","ZRO":"layerzero","LDO":"lido-dao","PUMP":"pump-fun","ZEC":"zcash","LIT":"lighter","SUI":"sui",
      "STRK":"starknet","NEAR":"near","FET":"fetch-ai","SEI":"sei-network","AVAX":"avalanche-2","ADA":"cardano","HYPE":"hyperliquid","PEPE":"pepe"}

PRICE_TTL = 120  # seconds — jobs that run back-to-back share one fetch

def prices(symbols):
    """Cached + rate-limit-tolerant. Falls back to the last good cache rather than
    failing a whole run (a stale price beats a crashed watcher; staleness is bounded)."""
    ids = sorted({CG[s] for s in symbols if s in CG})
    if not ids: return {}
    cp = STATE / "prices.json"
    cache = {}
    if cp.exists():
        try:
            c = json.loads(cp.read_text())
            if time.time() - c.get("at", 0) < PRICE_TTL:
                cache = c.get("px", {})
                if all(s in cache for s in symbols if s in CG):
                    return {s: cache[s] for s in symbols if s in cache}
            else:
                cache = c.get("px", {})
        except Exception:
            cache = {}
    px = {}
    try:
        j = _req(f"https://api.coingecko.com/api/v3/simple/price?ids={','.join(ids)}&vs_currencies=usd", retries=2)
        px = {s: j[CG[s]]["usd"] for s in symbols if s in CG and CG[s] in j and "usd" in j[CG[s]]}
    except Exception:
        pass
    missing = [s for s in symbols if s in CG and s not in px]
    if missing:
        # Fallback: our own deployed markets feed (different provider, no shared rate limit).
        try:
            feed = _req("https://www.lightningmines.com/api/markets", retries=2)
            live = {q["symbol"].upper(): q["price"] for q in feed.get("quotes", []) if q.get("price")}
            for s in missing:
                if s in live: px[s] = float(live[s])
        except Exception:
            pass
    if px:
        merged = {**cache, **px}
        cp.write_text(json.dumps({"at": time.time(), "px": merged}))
        return {s: merged[s] for s in symbols if s in merged}
    if cache:
        return {s: cache[s] for s in symbols if s in cache}   # bounded staleness beats a dead watcher
    raise RuntimeError("no price source available (CoinGecko + fallback both failed, cache empty)")

def book_value():
    rows = sb_get("live_holdings", "select=symbol,qty")
    px = prices([r["symbol"] for r in rows if r["symbol"] != "USD"])
    total, missing = 0.0, []
    for r in rows:
        if r["symbol"] == "USD": total += float(r["qty"])
        elif r["symbol"] in px: total += float(r["qty"]) * px[r["symbol"]]
        else: missing.append(r["symbol"])
    return total, missing

def drawdown_halted():
    """5% intraday drop vs the latest banked snapshot -> halt new-entry briefs + page Jacob (once)."""
    snaps = sb_get("fund_snapshots", "select=snapshot_date,total&order=snapshot_date.desc&limit=1")
    if not snaps: return False
    base = float(snaps[0]["total"]); total, missing = book_value()
    if missing or base <= 0: return False
    dd = (total - base) / base
    flag = STATE / "halt_drawdown"
    if dd <= -0.05:
        if not flag.exists():
            flag.write_text(f"{dd:.3%} vs {snaps[0]['snapshot_date']} base {base:.2f} now {total:.2f}")
            ntfy("⛔ Desk loop: 5% intraday drawdown", f"Book {total:.2f} vs day-start {base:.2f} ({dd:.1%}). New-entry briefs paused; stops remain at broker. Open the desk.", "urgent", force=True)
        return True
    if flag.exists() and dd > -0.03: flag.unlink()  # re-arm after recovery
    return flag.exists()
