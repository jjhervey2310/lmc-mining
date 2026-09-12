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
_budget_cache = {}

def loop_budget_usd():
    """The monthly AI spend budget. SINGLE SOURCE OF TRUTH: desk_config.loop_budget_usd.
    LOOP_BUDGET_USD / MONTHLY_CAP_USD in .env are fallbacks for a Supabase outage only — before
    2026-09-10 the box enforced and reported the env's $30 while the desk's own budget row said $10."""
    if "usd" not in _budget_cache:
        try:
            raw = config("loop_budget_usd")
        except Exception:
            raw = None
        if raw in (None, ""):
            raw = os.environ.get("LOOP_BUDGET_USD") or os.environ.get("MONTHLY_CAP_USD") or "10"
        try:
            _budget_cache["usd"] = float(raw)
        except (TypeError, ValueError):
            _budget_cache["usd"] = 10.0
    return _budget_cache["usd"]

def add_spend(usd):
    p = STATE / "spend.json"; m = now_denver().strftime("%Y-%m")
    d = json.loads(p.read_text()) if p.exists() else {}
    if d.get("month") != m: d = {"month": m, "usd": 0.0}
    d["usd"] = round(d["usd"] + float(usd), 4); p.write_text(json.dumps(d))
    cap = loop_budget_usd()
    if d["usd"] >= cap:
        (STATE / "halt_spend").write_text(f"{d['usd']} >= {cap} on {now_denver().isoformat()}")
        ntfy("⛔ Desk loop HALTED — spend cap", f"${d['usd']:.2f} of ${cap:.2f}/mo used. Wakes paused until next month, or until desk_config.loop_budget_usd is raised.", "high", force=True)
    return d

def budget_status():
    """Jacob's rule (2026-09-03): AI cost must scale with the book, not the clock.
    Monthly allowance = max(WAKE_MIN_USD, WAKE_BUDGET_PCT% of book value), CAPPED by the budget on
    record (desk_config.loop_budget_usd) — the book may grow the allowance, never past the budget.
    Returns (allowed_month, spent_month, allowed_today, spent_today, ok_to_wake)."""
    pct = float(config("wake_budget_pct", os.environ.get("WAKE_BUDGET_PCT", "1.5")))
    floor = float(config("wake_min_usd", os.environ.get("WAKE_MIN_USD", "5")))
    try:
        book, _ = book_value()
    except Exception:
        book = 0.0
    allowed_month = min(loop_budget_usd(), max(floor, book * pct / 100.0))
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

def cb_spot(sym):
    """Live spot from Coinbase Exchange: keyless, never rate-limited, 83 of the 88 universe names."""
    try:
        j = _req(f"https://api.exchange.coinbase.com/products/{sym}-USD/ticker", retries=1, timeout=12)
        p = float(j.get("price") or 0)
        return p if p > 0 else None
    except Exception:
        return None

def prices(symbols, max_age=60):
    """LIVE FIRST (2026-09-11, Jacob: "we have the live prices"). Order:
       1. COINBASE spot per symbol - keyless, unthrottled, the reason a stale price is now a FAULT
          rather than a normal Tuesday. This is what the web grader uses too.
       2. CoinGecko batch - one call, fills the handful Coinbase has no pair for.
       3. our own /api/markets feed - different provider again.
       4. bounded-stale cache - LAST resort, and the caller is told via prices_stale().
    A 60s cache short-circuit stops two timers firing seconds apart from re-fetching; at a 15-minute
    watcher cadence that is still live."""
    wanted = [s for s in symbols if s not in ("USD", "USDC", "USDT", "USDG")]
    if not wanted: return {}
    cp = STATE / "prices.json"
    cache, cached_at = {}, 0
    if cp.exists():
        try:
            c = json.loads(cp.read_text()); cache = c.get("px", {}) or {}; cached_at = c.get("at", 0)
        except Exception:
            pass
    if time.time() - cached_at < max_age and all(s in cache for s in wanted):
        return {s: cache[s] for s in wanted}

    px, src = {}, {}
    for s in wanted:                                   # 1. Coinbase
        v = cb_spot(s)
        if v: px[s], src[s] = v, "coinbase"
    missing = [s for s in wanted if s not in px]
    if missing:                                        # 2. CoinGecko batch
        ids = sorted({CG[s] for s in missing if s in CG})
        if ids:
            try:
                j = _req(f"https://api.coingecko.com/api/v3/simple/price?ids={','.join(ids)}&vs_currencies=usd", retries=1)
                for s in missing:
                    if s in CG and CG[s] in j and "usd" in j[CG[s]]:
                        px[s], src[s] = j[CG[s]]["usd"], "coingecko"
            except Exception:
                pass
    missing = [s for s in wanted if s not in px]
    if missing:                                        # 3. our own feed
        try:
            feed = _req("https://www.lightningmines.com/api/markets", retries=1)
            live = {q["symbol"].upper(): q["price"] for q in feed.get("quotes", []) if q.get("price")}
            for s in missing:
                if s in live: px[s], src[s] = float(live[s]), "lmc-feed"
        except Exception:
            pass
    stale = [s for s in wanted if s not in px and s in cache]
    for s in stale: px[s], src[s] = cache[s], "CACHE-STALE"   # 4. last resort, named as such
    if px:
        merged = {**cache, **{k: v for k, v in px.items() if src.get(k) != "CACHE-STALE"}}
        try: cp.write_text(json.dumps({"at": time.time(), "px": merged, "src": src}))
        except Exception: pass
    if stale:
        print(f"  !! prices STALE from cache for: {', '.join(stale)} — every live source failed")
    return px

def prices_stale():
    """Which symbols the last prices() call could only serve from cache. A watcher that cannot get a
    live price must SAY so rather than act on yesterday's number."""
    cp = STATE / "prices.json"
    if not cp.exists(): return []
    try:
        return [k for k, v in (json.loads(cp.read_text()).get("src") or {}).items() if v == "CACHE-STALE"]
    except Exception:
        return []

def book_value():
    rows = sb_get("live_holdings", "select=symbol,qty")
    px = prices([r["symbol"] for r in rows if r["symbol"] != "USD"])
    total, missing = 0.0, []
    for r in rows:
        if r["symbol"] == "USD": total += float(r["qty"])
        elif r["symbol"] in px: total += float(r["qty"]) * px[r["symbol"]]
        else: missing.append(r["symbol"])
    return total, missing

ANCHOR_SYMS = {"BTC", "SOL"}     # v4: the anchor. Everything else held is the sleeve.
ANCHOR_STANDING_TRAIL_USD = 5000.0   # A11 §3: at this book value the standing anchor trail returns, permanently
BREAKER_DD, BREAKER_CLEAR = 0.20, 0.10

def resting_stop_required(sym, book_usd=None):
    """Does this symbol have to carry a resting stop row right now?

    AMENDMENT A11 (ratified by Jacob 2026-09-08, pa_memory 'house-strategy'):
      §1 the fixed anchor trails were CANCELLED — BTC and SOL hold through corrections with no
         resting stop, an accepted risk;
      §2 anchor protection is CONDITION-TRIGGERED (primary: a weekly close below the 20-week MA;
         see the 'derisk_watch' rows in desk_triggers) — armed, not resting;
      §3 the standing trail returns at ANCHOR_STANDING_TRAIL_USD of book value, permanently;
      §4 the sleeve and the basket are UNCHANGED — every non-anchor position keeps a stop at all times.
    So: only the anchor is ever exempt, and only while the book is under the threshold. If the book
    cannot be valued we return True — an unproven exemption must not silence the law screen."""
    if sym not in ANCHOR_SYMS:
        return True                                  # A11 §4: sleeve + basket always
    if book_usd is None:
        try:
            book_usd, _ = book_value()
        except Exception:
            return True                              # fail loud, not silent
    return float(book_usd) >= ANCHOR_STANDING_TRAIL_USD

def sleeve_breaker(holdings=None, px=None):
    """A9 (2026-09-06): the circuit breaker is SLEEVE-ONLY. Ratio = sleeve market value / sleeve cost basis
    (adds and proportional exits leave it unchanged, so it tracks P&L, not flows). Trips at 20% below the
    ratio's high-water mark -> (True, info); clears on recovery to within 10%, or when the desk deletes
    state/sleeve_breaker.json. The old whole-book 5% intraday halt is retired: an anchor drawdown is a
    deposit opportunity, never a reason to freeze the sleeve."""
    if holdings is None:
        holdings = [h for h in sb_get("live_holdings", "select=symbol,qty,avg_cost") if h["symbol"] != "USD" and float(h["qty"] or 0) > 0]
    sleeve = [h for h in holdings if h["symbol"] not in ANCHOR_SYMS]
    f = STATE / "sleeve_breaker.json"
    st = json.loads(f.read_text()) if f.exists() else {"hwm": 0.0, "since": None}
    if not sleeve:
        st.update({"hwm": 0.0, "since": None}); f.write_text(json.dumps(st)); return False, st
    if px is None: px = prices([h["symbol"] for h in sleeve])
    val = sum(float(h["qty"]) * px[h["symbol"]] for h in sleeve if h["symbol"] in px)
    cost = sum(float(h["qty"]) * float(h["avg_cost"] or 0) for h in sleeve if h["symbol"] in px)
    if cost <= 0 or val <= 0: return bool(st.get("since")), st
    ratio = val / cost
    # COMPOSITION REBASE (2026-09-10 defect): the high-water mark describes the sleeve that WAS held.
    # On 09-07 ARB was sold at +25.8% — a harvested win — and the ratio fell from 1.418 (with ARB) to
    # 1.025 (NEAR alone). The breaker read a realised PROFIT as a 27.7% drawdown and froze new entries
    # for three days. A ratio is only comparable to its own history while the holdings are the same set,
    # so when the set changes the mark rebases to today's ratio and any trip is cleared.
    # TRADE-OFF, stated: a drawdown that straddles an entry or exit is no longer caught. The proper fix
    # is a breaker that counts REALISED P&L too; this one only stops it lying about wins.
    syms_now = sorted(h["symbol"] for h in sleeve if h["symbol"] in px)
    if st.get("syms") is not None and st["syms"] != syms_now:
        st["rebased"] = {"at": now_denver().isoformat(), "from_hwm": st.get("hwm"), "was": st.get("syms"), "now": syms_now}
        st["hwm"] = ratio; st["since"] = None
    st["syms"] = syms_now
    st["hwm"] = max(float(st.get("hwm") or 0), ratio); st["ratio"] = ratio
    if st.get("since"):
        if ratio >= st["hwm"] * (1 - BREAKER_CLEAR): st["since"] = None          # recovered
    elif ratio <= st["hwm"] * (1 - BREAKER_DD):
        st["since"] = now_denver().isoformat()
    f.write_text(json.dumps(st))
    return bool(st.get("since")), st

def drawdown_halted():
    """A9: new-entry briefs halt only on the SLEEVE breaker. Kept under its old name for wake/context callers."""
    try:
        halted, _ = sleeve_breaker()
        return halted
    except Exception:
        return False
