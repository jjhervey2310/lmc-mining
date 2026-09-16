#!/bin/bash
# Install the unattended harvester as a launchd agent.
#
# Why not just run it in a terminal: every terminal run so far has died — a closed window,
# a sleep, an unhandled exception at 03:00 — and each death cost hours nobody noticed until
# morning. launchd restarts it on crash, on login and on wake. The job's own loop handles
# everything short of the process disappearing; this handles the process disappearing.
#
# Why it does not run from the repo: macOS TCC blocks background agents from reading
# ~/Desktop, and the repo lives there. Same trap marketing/video/install.sh documented.
# Code is copied to ~/.lightningmines/vr, the caption cache moves to ~/.lightningmines/
# vr-cache, and neither is inside a git working tree.
#
# Re-run this after any change to the video-research code. It is safe to re-run.
set -euo pipefail

SRC="$(cd "$(dirname "$0")" && pwd)"
DEST="$HOME/.lightningmines/vr"
CACHE="$HOME/.lightningmines/vr-cache"
LOG="$HOME/.lightningmines/vr-harvest.log"
LABEL="com.lightningmines.vrharvest"
PLIST="$HOME/Library/LaunchAgents/$LABEL.plist"

# Bake in the SAME interpreter this script is being run with, by absolute path. launchd
# has no shell profile, so "python3" there is whatever /usr/bin holds — not necessarily the
# python.org 3.13 that had its root certificates installed and that every successful run so
# far has used. Guessing the interpreter is how a job that works by hand fails unattended.
PY="$(command -v python3)"
PYBIN="$("$PY" -c 'import site,os; print(os.path.join(site.USER_BASE, "bin"))')"

echo "==> Interpreter: $PY"
if ! "$PY" -c 'import ssl,urllib.request; urllib.request.urlopen("https://pypi.org", timeout=15)' 2>/dev/null; then
  echo "    WARNING: this interpreter cannot make a verified HTTPS request."
  echo "    If it is the python.org build, run: /Applications/Python\ 3.13/Install\ Certificates.command"
fi
if ! command -v yt-dlp >/dev/null 2>&1 && [ ! -x "$PYBIN/yt-dlp" ]; then
  echo "    WARNING: yt-dlp not found on PATH or in $PYBIN — the fetch will do nothing."
fi

echo "==> Stopping any running harvester"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true

# A launchd bootout does NOT stop a fetcher started by hand in a terminal, and this script
# MOVES the caption cache and then deletes the repo copy. Racing that delete against a
# process actively writing transcripts is how a cache gets holes in it — so refuse instead,
# and say exactly what to stop. Checked by command line, not by PID file, because the
# terminal runs are ad hoc and never wrote one.
# Matched on PYTHON processes only. A bare `pgrep -f` on the script names also matches any
# shell whose command line happens to contain them — including, depending on how it was
# invoked, this script's own — and a guard that fires when nothing is running is a guard
# nobody keeps. A real fetcher is always python running one of these modules.
RUNNING="$(ps -Ao pid=,comm=,args= 2>/dev/null \
  | awk '$2 ~ /python/ && $0 ~ /(cli\.py[[:space:]]+(captions|scan|push-text|frames))|harvest\.py/ { print }' \
  || true)"
if [ -n "$RUNNING" ]; then
  echo
  echo "REFUSING TO INSTALL — a fetcher is still running:" >&2
  echo "$RUNNING" | sed 's/^/    /' >&2
  echo >&2
  echo "This script moves the caption cache out of the repo and deletes the repo copy." >&2
  echo "Doing that under a live writer can lose transcripts." >&2
  echo >&2
  echo "Stop it first (Ctrl-C in its terminal, or):" >&2
  echo "    pkill -f 'cli\.py captions'" >&2
  echo >&2
  echo "Then re-run this script. Nothing has been changed." >&2
  exit 1
fi

echo "==> Installing code to $DEST"
mkdir -p "$DEST" "$CACHE" "$HOME/Library/LaunchAgents"
cp "$SRC"/*.py "$DEST/"
cp "$SRC"/*.swift "$DEST/" 2>/dev/null || true
[ -f "$SRC/.env" ] && cp "$SRC/.env" "$DEST/.env"
[ -f "$SRC/schema.sql" ] && cp "$SRC/schema.sql" "$DEST/"

# Move the existing cache rather than re-fetching 1,888 transcripts. Same volume, so a
# move is instant and costs no extra space — which matters, because duplicating the cache
# is exactly the "do not fill my computer" failure.
OLD="$SRC/state/cache"
if [ -d "$OLD" ]; then
  n_old=$(find "$OLD" -type f | wc -l | tr -d ' ')
  if [ "$n_old" -gt 0 ]; then
    echo "==> Moving $n_old cached file(s) out of the repo into $CACHE"
    rsync -a --ignore-existing "$OLD/" "$CACHE/"
    n_new=$(find "$CACHE" -type f | wc -l | tr -d ' ')
    if [ "$n_new" -ge "$n_old" ]; then
      rm -rf "$OLD"
      echo "    moved; $n_new file(s) now in the cache, repo copy removed"
    else
      # Never delete the only copy on a count that does not add up.
      echo "    WARNING: $CACHE has $n_new file(s) but the repo had $n_old — keeping both."
    fi
  fi
fi

echo "==> Writing $PLIST"
sed -e "s|__VRDIR__|$DEST|g" \
    -e "s|__CACHE__|$CACHE|g" \
    -e "s|__PYBIN__|$PYBIN|g" \
    -e "s|__PY__|$PY|g" \
    -e "s|__LOG__|$LOG|g" \
    "$SRC/com.lightningmines.vrharvest.plist" > "$PLIST"

echo "==> Starting"
launchctl bootstrap "gui/$(id -u)" "$PLIST"
launchctl enable "gui/$(id -u)/$LABEL"
sleep 2

if launchctl print "gui/$(id -u)/$LABEL" >/dev/null 2>&1; then
  echo
  echo "Harvester is running. It restarts on crash, on login and on wake."
  echo
  echo "  watch it:   tail -f $LOG"
  echo "  stop it:    launchctl bootout gui/$(id -u)/$LABEL"
  echo "  start it:   launchctl bootstrap gui/$(id -u) $PLIST"
  echo
  echo "Cache: $CACHE   Code: $DEST"
else
  echo "ERROR: the agent did not start. Check $LOG" >&2
  exit 1
fi
