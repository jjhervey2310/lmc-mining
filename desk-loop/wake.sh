#!/usr/bin/env bash
# Hourly reasoning wake: gates -> context -> headless Claude -> loop-briefs + ntfy. Alert-only.
set -euo pipefail
ROOT=${LMC_DESK_ROOT:-/root/lmc-desk}; cd "$ROOT"; set -a; source .env; set +a
STATE="$ROOT/state"; mkdir -p "$STATE"
py() { python3 "$ROOT/$1"; }

ENABLED=$(python3 -c 'from common import loop_enabled; print(loop_enabled())')
[ "$ENABLED" = "True" ] || { echo "loop disabled — skip"; exit 0; }
SPEND_OK=$(python3 -c 'from common import spend_ok; print(spend_ok())')
[ "$SPEND_OK" = "True" ] || { echo "spend cap halt — skip"; exit 0; }

CTX="$STATE/context.json"; py context.py > "$CTX"
PROMPT="$(cat "$ROOT/wake_prompt.md")

=== CONTEXT JSON ===
$(cat "$CTX")"

OUT="$STATE/wake_out.json"
# Headless Claude Code: one web search allowed, JSON output carries cost for the spend ledger.
claude -p "$PROMPT" --output-format json --max-turns 6 --allowedTools "WebSearch" --model claude-sonnet-5 > "$OUT" 2>"$STATE/wake_err.log" || true
python3 - "$OUT" <<'PY'
import json, sys, datetime
sys.path.insert(0, "/root/lmc-desk"); from common import *
o = json.load(open(sys.argv[1]))
text = o.get("result") or ""
cost = float(o.get("total_cost_usd") or o.get("cost_usd") or 0)
add_spend(cost)
if not text.strip():
    ntfy("Desk loop wake: empty result", open(STATE/"wake_err.log").read()[:800] or "no output", "low"); sys.exit(0)
stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")
prev = sb_get("pa_memory", "topic=eq.loop-briefs&select=fact")
old = prev[0]["fact"] if prev else ""
fact = f"── WAKE {stamp} (cost ${cost:.3f}) ──\n{text.strip()}\n\n{old}"[:18000]
sb_upsert("pa_memory", [{"topic": "loop-briefs", "fact": fact, "source": "desk-loop", "active": True, "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
# push: ORDER SPEC lines if any action, else a one-line situation ping (queued in quiet hours)
spec = text.split("ORDER SPEC", 1)[1].strip() if "ORDER SPEC" in text else ""
if spec and not spec.upper().startswith("NO ACTION"):
    ntfy("📋 Desk loop: ORDER SPEC ready", spec[:900], "high")
else:
    ntfy("Desk loop wake", (text.split("ORDER SPEC")[0])[-600:].strip(), "low")
print(f"brief written, cost {cost:.3f}")
PY
