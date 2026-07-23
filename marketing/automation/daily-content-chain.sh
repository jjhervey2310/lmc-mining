#!/bin/bash
# Lightning Mines — durable daily content chain (launchd, no Claude session required).
# BUFFER MODE (Jacob, 2026-07-22): each run generates from live data, renders via
# HeyGen (wardrobe auto-rotates, never the grey hoodie), and schedules TOMORROW's
# 4 posts in Postiz (X 9am / YT 2pm / IG 6pm / TikTok 8pm ET). Result: at any
# moment the next day is already queued — a standing >=24h content buffer.
# Scripts use price-conditional phrasing ("at $66,088 BTC...") so the ~1-day lag
# never makes a claim stale.
# Idempotent: skips if the target day was already scheduled (marker file).
set -euo pipefail

# launchd runs with a bare PATH; include Homebrew + system node locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin"

REPO="${LMC_REPO:-$HOME/Desktop/lmc-mining}"
LOG_DIR="$HOME/LightningMines-Content/logs"
mkdir -p "$LOG_DIR"
TODAY="$(date +%F)"
TARGET="$(date -v+1d +%F)"
exec >>"$LOG_DIR/chain-$TODAY.log" 2>&1

echo "=== $(date) — daily content chain start (buffering $TARGET) ==="
cd "$REPO"

MARKER="$HOME/LightningMines-Content/.scheduled-$TARGET"
if [ -f "$MARKER" ]; then
  echo "$TARGET already scheduled ($MARKER exists) — exiting."
  exit 0
fi

# Stay current with main so format changes ship without manual pulls.
git pull --ff-only origin main || echo "WARN: git pull failed — running with local code"

npm run content:run
# The engine names outputs by UTC date, which is a day ahead of Mountain Time in
# the evening — so select the NEWEST files rather than matching today's local date.
JSON="$(ls -t content-engine/out/*.json 2>/dev/null | head -1)"
if [ -z "$JSON" ]; then
  echo "ERROR: content:run produced no pipeline JSON"; exit 1
fi

npm run content:render
MP4="$(ls -t content-engine/out/*.mp4 2>/dev/null | head -1)"
if [ -z "$MP4" ]; then
  echo "ERROR: content:render produced no MP4"; exit 1
fi

NODE_PATH="$REPO/node_modules" node content-engine/tools/schedule-ahead.js "$JSON" "$MP4" "$TARGET"
touch "$MARKER"
echo "=== $(date) — chain complete: $TARGET queued on all 4 platforms ==="
