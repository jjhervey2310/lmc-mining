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

# 2. Split the payload into a silent-video spec, a carousel spec, and captions
python3 - "$WORK/api.json" "$WORK" "$OUTDIR/$DATE-captions.txt" <<'PY' 2>>"$LOG"
import json, sys
data = json.load(open(sys.argv[1])); work = sys.argv[2]; capfile = sys.argv[3]
v = data["video"]
vspec = {"title": v["title"], "lines": v["lines"], "verdict": v["verdict"], "cta": v["cta"]}
if data.get("chart"): vspec["chart"] = data["chart"]
json.dump(vspec, open(f"{work}/spec.json", "w"))
cspec = {"slides": v.get("slides", [])}
if data.get("chart"): cspec["chart"] = data["chart"]
json.dump(cspec, open(f"{work}/carousel.json", "w"))
c = data["captions"]
with open(capfile, "w") as f:
    f.write(f"THEME: {data['theme']}\n\nPost the silent video to Reels / TikTok / Shorts,\nand the slide images as an Instagram carousel. Captions:\n")
    for k in ("youtube", "tiktok", "instagram", "x"):
        f.write(f"\n===== {k.upper()} =====\n{c[k]}\n")
PY
if [ ! -s "$WORK/spec.json" ]; then log "ERROR: spec build failed"; exit 1; fi

# 3. Compile binaries if missing
for bin in render carousel; do
  if [ ! -x "$DIR/$bin" ]; then log "compiling $bin"; ( cd "$DIR" && swiftc -O "$bin.swift" -o "$bin" 2>>"$LOG" ); fi
done

# 4. Silent motion-graphic video (no voiceover — robotic TTS hurts a trust brand)
if "$DIR/render" "$WORK/spec.json" "-" "$OUTDIR/$DATE.mp4" >>"$LOG" 2>&1; then
  log "OK video -> $OUTDIR/$DATE.mp4"
else
  log "ERROR: video render failed"
fi

# 5. Instagram carousel slides
rm -f "$OUTDIR/$DATE-slide-"*.png 2>/dev/null
if "$DIR/carousel" "$WORK/carousel.json" "$OUTDIR" "$DATE" >>"$LOG" 2>&1; then
  log "OK carousel slides -> $OUTDIR/$DATE-slide-*.png"
else
  log "ERROR: carousel render failed"
fi

osascript -e "display notification \"Today's video + carousel are ready in LightningMines-Content\" with title \"⚡ Lightning Mines\" sound name \"Glass\"" 2>/dev/null || true
rm -rf "$WORK"
