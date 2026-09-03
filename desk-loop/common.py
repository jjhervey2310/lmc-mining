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
                k, v = line.split("=", 1); os.environ.setdefault(k.strip(), v.strip())
load_env()
SB = os.environ.get("SUPABASE_URL", "").rstrip("/")
SBK = os.environ.get("SUPABASE_SERVICE_KEY", "")
TZ = datetime.timezone(datetime.timedelta(hours=-6))  # Denver (MDT); install.sh also sets system tz

def _req(url, method="GET", body=None, headers=None, timeout=30):
    h = {"User-Agent": "lmc-desk-loop/1.0"}; h.update(headers or {})
    data = json.dumps(body).encode() if body is not None else None
    if data is not None: h["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=timeout) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip().startswith(("{", "[")) else raw

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

def prices(symbols):
    ids = sorted({CG[s] for s in symbols if s in CG})
    if not ids: return {}
    j = _req(f"https://api.coingecko.com/api/v3/simple/price?ids={','.join(ids)}&vs_currencies=usd")
    return {s: j[CG[s]]["usd"] for s in symbols if s in CG and CG[s] in j and "usd" in j[CG[s]]}

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
