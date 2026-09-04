#!/usr/bin/env bash
# Reasoning wake. Two modes:
#   triage (default) — cheap model, small ask: "has anything materially changed?"
#   deep             — full model + web search, used on scheduled deep runs and on fired triggers
# Cost is gated by a book-scaled budget (Jacob's rule: spend scales with the account, not the clock).
set -euo pipefail
MODE="${1:-triage}"
ROOT=${LMC_DESK_ROOT:-/root/lmc-desk}; cd "$ROOT"; set -a; source .env; set +a
STATE="$ROOT/state"; mkdir -p "$STATE"

ENABLED=$(python3 -c 'from common import loop_enabled; print(loop_enabled())')
[ "$ENABLED" = "True" ] || { echo "loop disabled — skip"; exit 0; }

read -r ALLOWED_M SPENT_M ALLOWED_D SPENT_D OK <<<"$(python3 -c '
from common import budget_status
a,b,c,d,ok = budget_status(); print(f"{a:.2f} {b:.2f} {c:.3f} {d:.3f} {ok}")')"
if [ "$OK" != "True" ]; then
  echo "budget gate: spent \$$SPENT_M of \$$ALLOWED_M this month (today \$$SPENT_D) — skipping $MODE wake"
  exit 0
fi

if [ "$MODE" = "deep" ]; then
  MODEL="claude-sonnet-5"; TURNS=5; TOOLS="WebSearch"
else
  MODEL="claude-haiku-4-5-20251001"; TURNS=1; TOOLS=""
fi

python3 context.py > "$STATE/context.json"

if [ "$MODE" = "deep" ]; then
  ASK="$(cat "$ROOT/wake_prompt.md")"
else
  ASK="You are the cheap TRIAGE wake of a 24/7 trading desk. Context JSON attached. Do NOT search the web. In under 120 words answer only: (1) has anything MATERIALLY changed vs the last loop-brief — a held position near its stop, an armed line within 2% of triggering, book value moved >3%, or a radar name newly EARLY with score >=55? (2) Verdict line, exactly one of: 'ESCALATE: <one-line reason>' if a deep wake with web research is warranted now, or 'QUIET: <one-line reason>' if not. Be strict: escalate only for something actionable, not for noise."
fi

PROMPT="$ASK

=== CONTEXT JSON ===
$(cat "$STATE/context.json")"

OUT="$STATE/wake_out.json"
if [ -n "$TOOLS" ]; then
  claude -p "$PROMPT" --output-format json --max-turns "$TURNS" --allowedTools "$TOOLS" --model "$MODEL" > "$OUT" 2>"$STATE/wake_err.log" || true
else
  claude -p "$PROMPT" --output-format json --max-turns "$TURNS" --model "$MODEL" > "$OUT" 2>"$STATE/wake_err.log" || true
fi

# If the model ended on a tool call (turn budget exhausted) the result is empty. Retry once,
# no tools, from context alone — a brief without a search beats no brief. (Defect seen 09-04 17:08.)
if [ "$MODE" = "deep" ] && ! python3 -c 'import json,sys; o=json.load(open(sys.argv[1])); sys.exit(0 if (o.get("result") or "").strip() else 1)' "$OUT" 2>/dev/null; then
  echo "empty deep result (stop_reason=$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1])).get("stop_reason"))' "$OUT" 2>/dev/null)) — retrying without tools"
  python3 - "$OUT" <<'PY'
import json, sys; sys.path.insert(0, "/root/lmc-desk"); from common import add_spend, add_day_spend
o = json.load(open(sys.argv[1])); c = float(o.get("total_cost_usd") or 0); add_spend(c); add_day_spend(c)
PY
  claude -p "$PROMPT

NOTE: the previous attempt ran out of turns before writing. Do NOT search. Write the SITUATION BRIEF and ORDER SPEC now from the context alone; state what you could not verify." --output-format json --max-turns 1 --model "$MODEL" > "$OUT" 2>>"$STATE/wake_err.log" || true
fi

python3 - "$OUT" "$MODE" <<'PY'
import json, sys, datetime, subprocess
sys.path.insert(0, "/root/lmc-desk"); from common import *
o = json.load(open(sys.argv[1])); mode = sys.argv[2]
text = (o.get("result") or "").strip()
cost = float(o.get("total_cost_usd") or o.get("cost_usd") or 0)
add_spend(cost); add_day_spend(cost)
if not text:
    ntfy("Desk loop: empty wake result", open(STATE/"wake_err.log").read()[:600] or "no output", "low"); sys.exit(0)
stamp = now_denver().strftime("%Y-%m-%d %H:%M MT")
if mode == "triage":
    escalate = text.upper().find("ESCALATE:") >= 0
    (STATE/"last_triage").write_text(f"{stamp} ${cost:.4f} {'ESCALATE' if escalate else 'QUIET'}\n{text}")
    print(f"triage {'ESCALATE' if escalate else 'QUIET'} cost {cost:.4f}")
    if escalate:
        ntfy("🔎 Triage escalated — running deep wake", text[:400], "default")
        subprocess.run(["systemctl", "start", "lmc-wake-deep.service"], check=False)
    sys.exit(0)
# deep: persist the brief and push
prev = sb_get("pa_memory", "topic=eq.loop-briefs&select=fact")
old = prev[0]["fact"] if prev else ""
fact = f"── WAKE {stamp} (deep, cost ${cost:.3f}) ──\n{text}\n\n{old}"[:18000]
sb_upsert("pa_memory", [{"topic": "loop-briefs", "fact": fact, "source": "desk-loop", "active": True,
                         "updated_at": datetime.datetime.now(datetime.timezone.utc).isoformat()}], "topic")
spec = text.split("ORDER SPEC", 1)[1].strip() if "ORDER SPEC" in text else ""
if spec and not spec.upper().startswith("NO ACTION"):
    ntfy("📋 Desk loop: ORDER SPEC ready", spec[:900], "high")
else:
    ntfy("Desk loop (deep)", text.split("ORDER SPEC")[0][-500:].strip(), "low")
print(f"deep brief written, cost {cost:.3f}")
PY
