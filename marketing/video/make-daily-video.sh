#!/bin/bash
# Lightning Mines — daily video builder.
# Fetches the day's script/numbers, generates an AI voiceover with macOS `say`,
# renders a branded vertical MP4, and drops it (plus captions) on the Desktop.
# Designed to run unattended from launchd.
set -uo pipefail

# Location-independent: render binary sits next to this script. Output goes to a
# non-TCC-protected home folder so launchd (a background agent) can write to it.
DIR="$(cd "$(dirname "$0")" && pwd)"
OUTDIR="$HOME/LightningMines-Content"
WORK="$(mktemp -d)"
DATE="$(date +%Y-%m-%d)"
LOG="$OUTDIR/render.log"
API="https://www.lightningmines.com/api/daily-script"

mkdir -p "$OUTDIR"
log() { echo "$(date '+%H:%M:%S') $*" >> "$LOG"; }
log "=== run $DATE ==="

# 1. Fetch today's content (retry a few times in case the site is warming up)
for i in 1 2 3 4 5; do
  if curl -fsS "$API" -o "$WORK/api.json" 2>>"$LOG"; then break; fi
  log "fetch attempt $i failed, retrying"; sleep 15
done
if ! python3 -c "import json,sys; json.load(open('$WORK/api.json'))" 2>>"$LOG"; then
  log "ERROR: could not fetch valid content — aborting"; exit 1
fi

# 2. Split the payload into a render spec, narration, and captions file
python3 - "$WORK/api.json" "$WORK" "$OUTDIR/$DATE-captions.txt" <<'PY' 2>>"$LOG"
import json, sys
data = json.load(open(sys.argv[1])); work = sys.argv[2]; capfile = sys.argv[3]
v = data["video"]
spec = {"title": v["title"], "lines": v["lines"], "verdict": v["verdict"], "cta": v["cta"]}
if data.get("chart"): spec["chart"] = data["chart"]
json.dump(spec, open(f"{work}/spec.json", "w"))
open(f"{work}/narration.txt", "w").write(v["narration"])
c = data["captions"]
with open(capfile, "w") as f:
    f.write(f"THEME: {data['theme']}\n\nPost the video with these captions:\n")
    for k in ("youtube", "tiktok", "instagram", "x"):
        f.write(f"\n===== {k.upper()} =====\n{c[k]}\n")
PY
if [ ! -s "$WORK/spec.json" ]; then log "ERROR: spec build failed"; exit 1; fi

# 3. Voiceover — prefer the most natural voice installed, in this order:
#    Premium/Enhanced neural voice (near-human) > known-good standard > system default.
pick_voice() {
  local list; list="$(say -v '?' 2>/dev/null)"
  # premium/enhanced English voices sound near-human (user installs via System Settings)
  local v
  v="$(echo "$list" | grep -iE 'en_US|en_GB' | grep -iE 'premium|enhanced' | head -1 | sed -E 's/  +.*//')"
  if [ -n "$v" ]; then echo "$v"; return; fi
  for name in Ava Zoe Evan Samantha Alex; do
    if echo "$list" | grep -q "^$name "; then echo "$name"; return; fi
  done
  echo ""
}
VOICE="$(pick_voice)"; log "voice: ${VOICE:-system-default}"
if [ -n "$VOICE" ]; then
  say -v "$VOICE" -r 180 -o "$WORK/voice.aiff" -f "$WORK/narration.txt" 2>>"$LOG"
else
  say -r 180 -o "$WORK/voice.aiff" -f "$WORK/narration.txt" 2>>"$LOG"
fi
if [ ! -s "$WORK/voice.aiff" ]; then log "ERROR: voiceover failed"; exit 1; fi

# 4. Render (auto-compile the binary if missing)
if [ ! -x "$DIR/render" ]; then
  log "compiling renderer"; ( cd "$DIR" && swiftc -O render.swift -o render 2>>"$LOG" )
fi
if "$DIR/render" "$WORK/spec.json" "$WORK/voice.aiff" "$OUTDIR/$DATE.mp4" >>"$LOG" 2>&1; then
  log "OK -> $OUTDIR/$DATE.mp4"
  # macOS notification so Jacob knows it's ready
  osascript -e "display notification \"Today's video is ready in LightningMines-Content\" with title \"⚡ Lightning Mines\" sound name \"Glass\"" 2>/dev/null || true
else
  log "ERROR: render failed"; exit 1
fi

rm -rf "$WORK"
