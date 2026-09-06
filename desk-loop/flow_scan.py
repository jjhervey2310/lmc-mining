#!/usr/bin/env python3
"""FLOW RADAR — "follow the money before the price" (build request #8, trading desk 2026-09-06).
Money arriving is observable and LEADS; price momentum lags. For every Robinhood-tradable name this
pulls, from DefiLlama (free, keyless):
  (a) protocol / chain FEES, trailing 7d, and week-over-week growth        (api.llama.fi/overview/fees)
  (b) DEX VOLUME, trailing 7d, week-over-week                                (api.llama.fi/overview/dexs, per chain)
  (c) TVL and its 7d delta                                                   (api.llama.fi/protocols, /v2/historicalChainTvl)
  (d) STABLECOIN supply on the chain, 7d delta                               (stablecoins.llama.fi/stablecoincharts)
  (e) ETF net flows and (f) buyback/burn run-rate: NO free source wired — columns exist, stay null, and
      the desk fills them by hand for the names it verifies. Never faked.
  Also REVENUE (the protocol's own cut, dataType=dailyRevenue) — the yield term uses revenue, not gross fees,
  because gross fees paid to LPs/stakers (Lido, Uniswap LPs) never reach the token.
MATERIALITY: growth % only counts on a real base — fees >= $25k/wk, DEX volume >= $1M/wk, TVL >= $1M. A $1k
week doubling is noise, not flow.
FLOW SCORE = weighted growth (fees 40%, DEX volume 30%, TVL 20%, stablecoins 10%; missing parts drop out
and the weights renormalise; each part clamped to [-100, +200]) + a revenue-yield bonus (annualised 7d
fees / market cap, capped at +50). Normalised by cap through the yield term — a $100k fee week means
something at a $50M cap and nothing at $50B.
STAGE: PRE-EARLY = score rising for 2+ consecutive weekly scans AND price d30 < +20% (money before the
candle). RISING = score >= 10 with d30 < +20% (history too short to call PRE-EARLY yet). PRICED = score >= 10
but price already +20%/30d (money AND price moving — late by this radar's definition). FLAT / FADING / NO-DATA.
Writes public.flow_radar (one row per symbol per scan_date), pa_memory 'flow-radar' (summary for the deep
wake + chat), pushes PRE-EARLY names (queued to the 08:00 digest in quiet hours) and adds a
desk_theses VERIFYING row for any PRE-EARLY name the desk has not already classified — never overwrites
a desk row. Weekly full-universe scan on Sunday, daily for held + POLE/WATCH/VERIFYING names.
COST: $0 — pure code, no model. Alert-only."""
import json, sys, time, datetime, urllib.parse
from pathlib import Path
from common import *
from common import _req

W = {"fees_wow": 0.4, "vol_wow": 0.3, "tvl_delta": 0.2, "stable_delta": 0.1}
CLAMP = (-100.0, 200.0)
PRE_EARLY_D30_MAX = 20.0
MIN_FEES, MIN_VOL, MIN_TVL = 25_000.0, 1_000_000.0, 1_000_000.0    # weekly USD floors for growth % to count
STABLE_IDS = {"USDC", "USDT", "USDG", "PAXG", "DAI"}
# Fees that accrue to a token but are booked under a different DefiLlama object (desk-verified mechanisms).
EXTRA_CHAIN_FEES = {"ARB": [("Robinhood Chain", 0.10)]}  # 10% of Robinhood Chain fees accrue to the Arbitrum ecosystem (thesis 09-04) — counted at that share
HAND_PARENT = {"HYPE": "parent#hyperliquid", "UNI": "parent#uniswap", "AAVE": "parent#aave", "LIT": "lighter",
               "SYRUP": "parent#maple", "ASTER": "aster", "AVNT": "avantis", "MORPHO": "parent#morpho", "LDO": "parent#lido",
               "PUMP": "pump-fun", "JTO": "jito", "RAY": "raydium", "ORCA": "orca", "AERO": "parent#aerodrome",
               "CRV": "parent#curve-finance", "COMP": "parent#compound-finance", "SNX": "parent#synthetix",
               "ENA": "parent#ethena", "ONDO": "parent#ondo-finance", "SKY": "parent#sky", "PYTH": "pyth-network",
               "ZRO": "layerzero", "W": "wormhole", "ZRX": "0x", "EIGEN": "parent#eigenlayer", "GRT": "the-graph",
               "RENDER": "render", "VIRTUAL": "parent#virtuals-protocol", "ZORA": "zora", "BIO": "bio-protocol"}

def get(url, retries=3):
    for i in range(retries):
        try: return _req(url, retries=1)
        except Exception as e:
            if i == retries - 1: raise
            time.sleep(2 * (i + 1))

def pct(a, b):
    try:
        a, b = float(a or 0), float(b or 0)
        return None if b <= 0 else (a / b - 1) * 100
    except Exception: return None

def clamp(x): return None if x is None else max(CLAMP[0], min(CLAMP[1], x))

def universe():
    return json.load(open(Path(__file__).parent / "universe.json"))

def focus_names():
    """Daily set: held + desk_theses POLE/WATCH/VERIFYING + latest flow PRE-EARLY."""
    held = {h["symbol"] for h in sb_get("live_holdings", "select=symbol,qty") if h["symbol"] != "USD" and float(h["qty"] or 0) > 0}
    watch = {t["symbol"] for t in sb_get("desk_theses", "status=in.(POLE,WATCH,VERIFYING)&select=symbol")}
    return sorted(held | watch)

def load_llama():
    d = {}
    d["protocols"] = get("https://api.llama.fi/protocols")
    d["chains"] = get("https://api.llama.fi/v2/chains")
    d["fees"] = get("https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true").get("protocols", [])
    d["revenue"] = get("https://api.llama.fi/overview/fees?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyRevenue").get("protocols", [])
    d["dexs"] = get("https://api.llama.fi/overview/dexs?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true").get("protocols", [])
    return d

def index(d):
    """symbol -> {parents:set(slugs/parent ids), chains:[chain names]} plus lookup tables."""
    by_sym = {}
    # chains by native token (highest-TVL entry wins when a symbol maps twice, e.g. OP Mainnet vs Optimism)
    for c in sorted(d["chains"], key=lambda c: -(c.get("tvl") or 0)):
        s = (c.get("tokenSymbol") or "").upper()
        if s and s not in by_sym.setdefault("_chain", {}): by_sym["_chain"][s] = c
    chain_of = by_sym.pop("_chain", {})
    parent_of = {}          # symbol -> set of keys that identify its protocol family
    tvl_of_key = {}         # key -> (tvl, weighted change_7d numerator)
    for p in d["protocols"]:
        s = (p.get("symbol") or "").upper()
        key = p.get("parentProtocol") or p.get("slug")
        if not key: continue
        tv = float(p.get("tvl") or 0); ch = p.get("change_7d")
        t = tvl_of_key.setdefault(key, [0.0, 0.0, 0.0])
        t[0] += tv
        if ch is not None: t[1] += tv * float(ch); t[2] += tv
        if s and s != "-" and s not in STABLE_IDS:
            parent_of.setdefault(s, set()).add(key)
    for s, k in HAND_PARENT.items(): parent_of.setdefault(s, set()).add(k)
    def fam(rows):
        out = {}
        for r in rows:
            key = r.get("parentProtocol") or r.get("slug")
            if not key: continue
            o = out.setdefault(key, {"t7": 0.0, "t14_7": 0.0, "t30": 0.0, "names": set()})
            o["t7"] += float(r.get("total7d") or 0); o["t14_7"] += float(r.get("total14dto7d") or 0); o["t30"] += float(r.get("total30d") or 0)
            o["names"].add(r.get("displayName") or r.get("name"))
        return out
    fees_fam = fam([r for r in d["fees"] if r.get("category") != "Chain"])
    fees_chain = {(r.get("displayName") or r.get("name")).lower(): r for r in d["fees"] if r.get("category") == "Chain"}
    rev_fam = fam([r for r in d["revenue"] if r.get("category") != "Chain"])
    rev_chain = {(r.get("displayName") or r.get("name")).lower(): r for r in d["revenue"] if r.get("category") == "Chain"}
    dex_fam = fam(d["dexs"])
    return chain_of, parent_of, tvl_of_key, fees_fam, fees_chain, rev_fam, rev_chain, dex_fam

def chain_dex_7d(chain):
    try:
        j = get(f"https://api.llama.fi/overview/dexs/{urllib.parse.quote(chain)}?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true")
        return float(j.get("total7d") or 0), float(j.get("total14dto7d") or 0)
    except Exception: return None, None

def chain_tvl_delta(chain):
    try:
        h = get(f"https://api.llama.fi/v2/historicalChainTvl/{urllib.parse.quote(chain)}")
        if len(h) < 9: return None, None
        return float(h[-1]["tvl"]), pct(h[-1]["tvl"], h[-8]["tvl"])
    except Exception: return None, None

def chain_stable_delta(chain):
    try:
        h = get(f"https://stablecoins.llama.fi/stablecoincharts/{urllib.parse.quote(chain)}?stablecoin=1")
        if len(h) < 9: return None
        cur = float((h[-1].get("totalCirculatingUSD") or {}).get("peggedUSD") or 0)
        prv = float((h[-8].get("totalCirculatingUSD") or {}).get("peggedUSD") or 0)
        return pct(cur, prv)
    except Exception: return None

def market(symbols):
    """market cap + d30 + price: latest fund_radar scan (same universe, daily)."""
    latest = sb_get("fund_radar", "select=scan_date&order=scan_date.desc&limit=1")
    if not latest: return {}
    rows = sb_get("fund_radar", f"scan_date=eq.{latest[0]['scan_date']}&select=symbol,market_cap,d30,price")
    return {r["symbol"]: r for r in rows}

def prior_scores(symbols, today):
    """flow_score at ~7 and ~14 days ago (nearest scan within +-2 days), for the 2-week rising test."""
    out = {}
    since = (today - datetime.timedelta(days=17)).isoformat()
    rows = sb_get("flow_radar", f"scan_date=gte.{since}&scan_date=lt.{today.isoformat()}&select=symbol,scan_date,flow_score")
    for r in rows:
        if r.get("flow_score") is None: continue
        age = (today - datetime.date.fromisoformat(r["scan_date"])).days
        for tgt in (7, 14):
            if abs(age - tgt) <= 2:
                cur = out.setdefault(r["symbol"], {}).get(tgt)
                if cur is None or abs(age - tgt) < cur[0]: out[r["symbol"]][tgt] = (abs(age - tgt), float(r["flow_score"]))
    return {s: {k: v[1] for k, v in d.items()} for s, d in out.items()}

def scan(symbols, full):
    d = load_llama()
    chain_of, parent_of, tvl_of_key, fees_fam, fees_chain, rev_fam, rev_chain, dex_fam = index(d)
    mk = market(symbols)
    today = now_denver().date()
    hist = prior_scores(symbols, today)
    rows, cache = [], {}
    for s in symbols:
        fees7 = fees14_7 = vol7 = vol14_7 = tvl = tvl_d = stab = rev7 = None; src = []
        keys = parent_of.get(s, set())
        for k in keys:
            f = fees_fam.get(k)
            if f and (f["t7"] or f["t14_7"]):
                fees7 = (fees7 or 0) + f["t7"]; fees14_7 = (fees14_7 or 0) + f["t14_7"]; src.append("fees:" + k)
            rv = rev_fam.get(k)
            if rv and rv["t7"]: rev7 = (rev7 or 0) + rv["t7"]
            v = dex_fam.get(k)
            if v and (v["t7"] or v["t14_7"]):
                vol7 = (vol7 or 0) + v["t7"]; vol14_7 = (vol14_7 or 0) + v["t14_7"]; src.append("dex:" + k)
            t = tvl_of_key.get(k)
            if t and t[0] > 0:
                tvl = (tvl or 0) + t[0]
                if t[2] > 0: tvl_d = (tvl_d or 0) + (t[1] / t[2]) * (t[0] / max(tvl, 1)) if tvl_d is None else tvl_d   # first family's weighted 7d
                src.append("tvl:" + k)
        ch = chain_of.get(s)
        chain_names = ([(ch["name"], 1.0)] if ch else []) + EXTRA_CHAIN_FEES.get(s, [])
        for cn, share in chain_names:
            fr = fees_chain.get(cn.lower())
            if fr:
                fees7 = (fees7 or 0) + share * float(fr.get("total7d") or 0); fees14_7 = (fees14_7 or 0) + share * float(fr.get("total14dto7d") or 0); src.append(f"chainfees:{cn}" + (f"@{share:.0%}" if share != 1.0 else ""))
            rr = rev_chain.get(cn.lower())
            if rr and rr.get("total7d"): rev7 = (rev7 or 0) + share * float(rr["total7d"])
        if ch:
            cn = ch["name"]
            if cn not in cache:
                cache[cn] = (chain_dex_7d(cn), chain_tvl_delta(cn), chain_stable_delta(cn)); time.sleep(0.4)
            (cv7, cv14), (ctvl, ctvl_d), cstab = cache[cn]
            if cv7: vol7 = (vol7 or 0) + cv7; vol14_7 = (vol14_7 or 0) + (cv14 or 0); src.append("chaindex:" + cn)
            if ctvl:
                tvl = (tvl or 0) + ctvl
                if ctvl_d is not None: tvl_d = ctvl_d if tvl_d is None else (tvl_d + ctvl_d) / 2
                src.append("chaintvl:" + cn)
            if cstab is not None: stab = cstab; src.append("stables:" + cn)
        # growth only on a material base (a $1k week doubling is noise, not flow)
        fees_wow = pct(fees7, fees14_7) if (fees7 is not None and max(fees7, fees14_7 or 0) >= MIN_FEES) else None
        vol_wow = pct(vol7, vol14_7) if (vol7 is not None and max(vol7, vol14_7 or 0) >= MIN_VOL) else None
        if tvl is not None and tvl < MIN_TVL: tvl_d = None
        m = mk.get(s) or {}
        mcap = float(m.get("market_cap") or 0) or None
        d30 = float(m["d30"]) if m.get("d30") is not None else None
        rev_yield = (rev7 * 52 / mcap * 100) if (rev7 and mcap) else None     # token-side revenue, not gross fees
        parts = {"fees_wow": clamp(fees_wow), "vol_wow": clamp(vol_wow), "tvl_delta": clamp(tvl_d), "stable_delta": clamp(stab)}
        wsum = sum(W[k] for k, v in parts.items() if v is not None)
        score = None
        if wsum > 0:
            score = sum(W[k] * v for k, v in parts.items() if v is not None) / wsum
            if rev_yield: score += min(rev_yield, 50.0)
            score = round(score, 2)
        h = hist.get(s, {})
        rising2 = score is not None and 7 in h and 14 in h and score > h[7] > h[14]
        quiet_price = d30 is not None and d30 < PRE_EARLY_D30_MAX
        if score is None: stage = "NO-DATA"
        elif rising2 and quiet_price and score > 0: stage = "PRE-EARLY"
        elif score >= 10 and quiet_price: stage = "RISING"
        elif score >= 10: stage = "PRICED"          # money AND price already moving — late by this radar's definition
        elif score <= -10: stage = "FADING"
        else: stage = "FLAT"
        rows.append({"symbol": s, "scan_date": today.isoformat(), "fees_7d": fees7, "fees_wow": None if fees_wow is None else round(fees_wow, 2),
                     "vol_7d": vol7, "vol_wow": None if vol_wow is None else round(vol_wow, 2), "tvl": tvl, "tvl_delta": None if tvl_d is None else round(tvl_d, 2),
                     "stable_delta": None if stab is None else round(stab, 2), "etf_flow": None, "buyback_rate": None, "market_cap": mcap, "revenue_7d": rev7,
                     "price_d30": d30, "rev_yield": None if rev_yield is None else round(rev_yield, 2), "flow_score": score, "stage": stage,
                     "source": ", ".join(sorted(set(src)))[:400] or None})
    return rows

def main():
    if not loop_enabled():
        print("loop disabled"); return
    full = "--full" in sys.argv or now_denver().weekday() == 6
    syms = universe() if full else focus_names()
    if not syms:
        print("nothing to scan"); return
    rows = scan(syms, full)
    sb_upsert("flow_radar", rows, "symbol,scan_date")
    scored = [r for r in rows if r["flow_score"] is not None]
    scored.sort(key=lambda r: -r["flow_score"])
    pre = [r for r in rows if r["stage"] == "PRE-EARLY"]
    stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")
    def line(r):
        f = lambda v, u="": "—" if v is None else f"{v:+.0f}%{u}"
        m = "—" if not r["fees_7d"] else (f"${r['fees_7d']/1e6:.2f}M" if r["fees_7d"] >= 1e6 else f"${r['fees_7d']/1e3:.0f}k")
        y = "—" if r["rev_yield"] is None else f"{r['rev_yield']:.1f}%/yr"
        return f"{r['symbol']:<7} score {r['flow_score']:+6.1f}  {r['stage']:<9} fees7d {m:>8} ({f(r['fees_wow'])}) vol {f(r['vol_wow'])} tvl {f(r['tvl_delta'])} stables {f(r['stable_delta'])} rev-yield {y} d30 {f(r['price_d30'])}"
    head = f"FLOW RADAR {stamp} — {'FULL universe' if full else 'daily held+watch'} ({len(rows)} names, {len(scored)} with flow data). Money before price: fees/volume/TVL/stablecoin growth, cap-normalised. NOT picks — laws + mechanism verification govern every entry."
    body = [head, "PRE-EARLY (score rising 2+ weekly scans, d30 < +20%): " + (", ".join(r["symbol"] for r in pre) or "none (needs two prior weekly scans on record — the first flags can land after two Sundays)")]
    body += ["RISING with a quiet price (d30 < +20%) — the hunting ground: " + (", ".join(f"{r['symbol']} {r['flow_score']:+.0f}" for r in scored if r["stage"] == "RISING") or "none")]
    body += ["TOP 12 BY FLOW SCORE (PRICED = money and price both already moving):"] + [line(r) for r in scored[:12]]
    body += ["FADING: " + (", ".join(r["symbol"] for r in scored if r["stage"] == "FADING") or "none")]
    body += ["NO DATA (no DefiLlama object matched): " + (", ".join(r["symbol"] for r in rows if r["stage"] == "NO-DATA") or "none")]
    body += ["Sources: DefiLlama fees/revenue/dexs/protocols/chains/stablecoins (free). etf_flow / buyback_rate: no free source — desk fills by hand for verified names. Growth counts only on fees >= $25k/wk, volume >= $1M/wk, TVL >= $1M."]
    out = "\n".join(body)
    prev = sb_get("pa_memory", "topic=eq.flow-radar&select=fact")
    old = (prev[0]["fact"] if prev else "")
    keep = old.split("\n\n── PRIOR ──\n", 1)[0] if old else ""
    fact = (out + ("\n\n── PRIOR ──\n" + keep if keep else ""))[:14000]
    sb_upsert("pa_memory", [{"topic": "flow-radar", "fact": fact, "source": "desk-loop flow_scan.py", "active": True,
                             "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
    if pre:
        existing = {t["symbol"]: t["status"] for t in sb_get("desk_theses", "select=symbol,status")}
        new = [r for r in pre if r["symbol"] not in existing]
        if new:
            sb_upsert("desk_theses", [{"symbol": r["symbol"], "status": "VERIFYING",
                                       "thesis": f"Flow radar PRE-EARLY {r['scan_date']}: flow score {r['flow_score']:+.0f} rising 2+ weeks (fees {r['fees_wow']}% wow, vol {r['vol_wow']}% wow, tvl {r['tvl_delta']}%), price d30 {r['price_d30']}%. Money arriving before the candle. Auto-added by the loop — thesis unverified.",
                                       "gate": "VERIFY: does the TOKEN capture the revenue (fee switch / buyback / burn)? Unlocks? Laws on a live quote. No zone without a mechanism.",
                                       "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()} for r in new], "symbol")
        ntfy(f"💧 Flow radar: {len(pre)} PRE-EARLY", "\n".join(line(r)[:120] for r in pre)[:900] + "\nMoney before price. Verify the mechanism before any zone.", "high")
    print(out)

if __name__ == "__main__":
    main()
