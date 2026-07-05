#!/bin/bash
# Installs the daily-video pipeline to a non-TCC-protected location so launchd
# can run it (macOS blocks background agents from ~/Desktop). Re-run after any
# change to render.swift or make-daily-video.sh.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.lightningmines"
mkdir -p "$DEST"

echo "Compiling renderer + carousel…"
( cd "$SRC" && swiftc -O render.swift -o "$DEST/render" && swiftc -O carousel.swift -o "$DEST/carousel" )
cp "$SRC/make-daily-video.sh" "$DEST/make-daily-video.sh"
chmod +x "$DEST/make-daily-video.sh"

mkdir -p "$HOME/LightningMines-Content"
# Convenience shortcut on the Desktop (created by the interactive user, who has access)
ln -sfn "$HOME/LightningMines-Content" "$HOME/Desktop/LightningMines-Content" 2>/dev/null || true

echo "Installed to $DEST"
echo "Output folder: $HOME/LightningMines-Content (shortcut on Desktop)"
