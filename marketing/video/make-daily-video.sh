#!/bin/bash
# Lightning Mines — daily video builder.
# Fetches the day's script/numbers, generates an AI voiceover with macOS `say`,
# renders a branded vertical MP4, and drops it (plus captions) on the Desktop.
# Designed to run unattended from launchd.
set -uo pipefail

DIR="/Users/jacobslaptop/Desktop/lmc-mining/marketing/video"
OUTDIR="$HOME/Desktop/LightningMines-Content"
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
json.dump({"title": v["title"], "lines": v["lines"], "verdict": v["verdict"], "cta": v["cta"]},
          open(f"{work}/spec.json", "w"))
open(f"{work}/narration.txt", "w").write(v["narration"])
c = data["captions"]
with open(capfile, "w") as f:
    f.write(f"THEME: {data['theme']}\n\nPost the video with these captions:\n")
    for k in ("youtube", "tiktok", "instagram", "x"):
        f.write(f"\n===== {k.upper()} =====\n{c[k]}\n")
PY
if [ ! -s "$WORK/spec.json" ]; then log "ERROR: spec build failed"; exit 1; fi

# 3. Voiceover (prefer Samantha; fall back to the system default voice)
VOICE="Samantha"; say -v '?' 2>/dev/null | grep -q "^Samantha" || VOICE=""
if [ -n "$VOICE" ]; then
  say -v "$VOICE" -o "$WORK/voice.aiff" -f "$WORK/narration.txt" 2>>"$LOG"
else
  say -o "$WORK/voice.aiff" -f "$WORK/narration.txt" 2>>"$LOG"
fi
if [ ! -s "$WORK/voice.aiff" ]; then log "ERROR: voiceover failed"; exit 1; fi

# 4. Render (auto-compile the binary if missing)
if [ ! -x "$DIR/render" ]; then
  log "compiling renderer"; ( cd "$DIR" && swiftc -O render.swift -o render 2>>"$LOG" )
fi
if "$DIR/render" "$WORK/spec.json" "$WORK/voice.aiff" "$OUTDIR/$DATE.mp4" >>"$LOG" 2>&1; then
  log "OK -> $OUTDIR/$DATE.mp4"
  # macOS notification so Jacob knows it's ready
  osascript -e "display notification \"Today's video is ready on your Desktop\" with title \"⚡ Lightning Mines\" sound name \"Glass\"" 2>/dev/null || true
else
  log "ERROR: render failed"; exit 1
fi

rm -rf "$WORK"
