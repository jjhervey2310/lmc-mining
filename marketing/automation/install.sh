#!/bin/bash
# Install the durable daily content chain (run once on Jacob's Mac, re-run after edits).
# Installs to ~/.lightningmines (NOT the repo) because macOS TCC blocks launchd
# from executing scripts under ~/Desktop — same pattern as com.lightningmines.dailyvideo.
set -euo pipefail

SRC_DIR="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.lightningmines"
PLIST="$HOME/Library/LaunchAgents/com.lightningmines.contentchain.plist"

mkdir -p "$DEST" "$HOME/Library/LaunchAgents"
cp "$SRC_DIR/daily-content-chain.sh" "$DEST/daily-content-chain.sh"
chmod +x "$DEST/daily-content-chain.sh"
cp "$SRC_DIR/com.lightningmines.contentchain.plist" "$PLIST"

launchctl unload "$PLIST" 2>/dev/null || true
launchctl load "$PLIST"

echo "Installed. Chain runs daily at 6:45am local."
echo "Logs: ~/LightningMines-Content/logs/chain-<date>.log"
echo "Run now to test:  bash $DEST/daily-content-chain.sh"
echo ""
echo "NOTE: if launchd can't read ~/Desktop/lmc-mining (TCC), either grant Full Disk"
echo "Access to /bin/bash in System Settings, or move the repo out of ~/Desktop and"
echo "set LMC_REPO=<new path> in the plist EnvironmentVariables."
