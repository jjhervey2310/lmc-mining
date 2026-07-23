#!/bin/bash
# Lightning Mines — durable daily content chain (launchd, no Claude session required).
# Generates today's bullish_caveat script from live data, renders via HeyGen
# (wardrobe auto-rotates, never the grey hoodie), and schedules today's 4 posts
# in Postiz (X 9am / YT 2pm / IG 6pm / TikTok 8pm ET via tools/schedule-ahead.js).
#
# Numbers are computed at run time, so same-day scheduling keeps them fresh
# (stale-numbers rule). Idempotent: exits early if today's MP4 already exists.
set -euo pipefail

# launchd runs with a bare PATH; include Homebrew + system node locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO="${LMC_REPO:-$HOME/Desktop/lmc-mining}"
LOG_DIR="$HOME/LightningMines-Content/logs"
mkdir -p "$LOG_DIR"
TODAY="$(date +%F)"
exec >>"$LOG_DIR/chain-$TODAY.log" 2>&1

echo "=== $(date) — daily content chain start ==="
cd "$REPO"

MP4="content-engine/out/$TODAY.mp4"
if [ -f "$MP4" ]; then
  echo "Already rendered today ($MP4 exists) — assuming scheduled; exiting."
  exit 0
fi

# Stay current with main so format changes ship without manual pulls.
git pull --ff-only origin main || echo "WARN: git pull failed — running with local code"

npm run content:run
JSON="$(ls -t content-engine/out/"$TODAY"-*.json 2>/dev/null | head -1)"
if [ -z "$JSON" ]; then
  echo "ERROR: content:run produced no JSON for $TODAY"; exit 1
fi

npm run content:render -- --date="$TODAY"

NODE_PATH="$REPO/node_modules" node content-engine/tools/schedule-ahead.js "$JSON" "$MP4" "$TODAY"
echo "=== $(date) — chain complete: $TODAY queued on all 4 platforms ==="
