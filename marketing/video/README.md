# Daily video auto-render (macOS, $0)

Renders a branded vertical MP4 + captions every morning and drops them in
`~/Desktop/LightningMines-Content/`. Built entirely on Apple frameworks —
no Homebrew, no ffmpeg, no third-party packages.

## Pieces
- `render.swift` → compiled to `render` (AppKit + AVFoundation renderer)
- `make-daily-video.sh` — fetches `/api/daily-script`, runs macOS `say` for the
  voiceover, renders the MP4, writes captions, posts a desktop notification
- `~/Library/LaunchAgents/com.lightningmines.dailyvideo.plist` — runs it at 7:10am daily

## How the day's content is chosen
The Next.js endpoint `/api/daily-script` computes live numbers (same math as the
calculator) and picks the day's theme/script from `lib/daily-content.ts`, which is
governed by `BRAND.md`. The Mac side only renders — it never invents numbers.

## Run manually
```
marketing/video/make-daily-video.sh
```

## Recompile the renderer (after editing render.swift)
```
cd marketing/video && swiftc -O render.swift -o render
```

## Logs
`~/Desktop/LightningMines-Content/render.log`

## Manage the schedule
```
launchctl unload ~/Library/LaunchAgents/com.lightningmines.dailyvideo.plist   # pause
launchctl load  ~/Library/LaunchAgents/com.lightningmines.dailyvideo.plist    # resume
```
If the Mac is asleep at 7:10am, launchd runs the job on the next wake.
