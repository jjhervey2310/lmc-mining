# Daily video auto-render (macOS, $0)

Renders a branded vertical MP4 + captions every morning to
`~/LightningMines-Content/` (with a clickable shortcut on the Desktop).
Built entirely on Apple frameworks — no Homebrew, no ffmpeg, no third-party packages.

## Why it installs outside the repo
macOS privacy protection (TCC) blocks background agents (launchd) from reading or
writing anything under `~/Desktop`, and this repo lives there. So `install.sh`
copies the runner + compiled renderer to `~/.lightningmines/` (not protected) and
writes output to `~/LightningMines-Content/` (not protected).

## Pieces
- `render.swift` → compiled to `render` (AppKit + AVFoundation renderer)
- `make-daily-video.sh` — fetches `/api/daily-script`, runs macOS `say` for the
  voiceover, renders the MP4, writes captions, posts a desktop notification
- `install.sh` — compiles + installs to `~/.lightningmines/`, makes the Desktop shortcut
- `~/Library/LaunchAgents/com.lightningmines.dailyvideo.plist` — runs it daily at 7:10am

## Install / update (run after editing render.swift or make-daily-video.sh)
```
marketing/video/install.sh
```

## Run manually right now
```
~/.lightningmines/make-daily-video.sh
```

## How the day's content is chosen
The Next.js endpoint `/api/daily-script` computes live numbers (same math as the
calculator) and picks the day's theme/script from `lib/daily-content.ts`, governed
by `BRAND.md`. The Mac side only renders — it never invents numbers.

## Logs
`~/LightningMines-Content/render.log` (and `launchd.err.log` for scheduler issues)

## Manage the schedule
```
launchctl unload ~/Library/LaunchAgents/com.lightningmines.dailyvideo.plist   # pause
launchctl load  ~/Library/LaunchAgents/com.lightningmines.dailyvideo.plist    # resume
launchctl kickstart -k gui/$(id -u)/com.lightningmines.dailyvideo             # run now
```
If the Mac is asleep at 7:10am, launchd runs the job on the next wake.
