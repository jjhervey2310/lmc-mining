# Lightning Mines — Claude Code Context

## Stack
- Next.js 14 App Router / TypeScript / Tailwind v4
- Supabase (project ID: bngwwalucfirmcymqall) — DB + auth
- Resend — transactional email
- Stripe — audit bookings ($97 Standard, $297 Deep Dive)
- Vercel — deployment (project: jacob-hervey-s-projects/lmc-mining)
- Cloudflare — DNS
- GitHub repo: jjhervey2310/lmc-mining (PAT embedded in remote URL)
- Local path: /Users/jacobslaptop/Desktop/lmc-mining

## Hard Rules — Never Touch Without Explicit Instruction
- NEVER modify vercel.json, next.config.ts, or any Cloudflare/DNS config
- NEVER change Supabase project ID or connection strings in .env.local
- NEVER alter Stripe price IDs or webhook endpoints
- NEVER push to main without running `npm run build` first — must be clean
- NEVER modify lib/types.ts HostingProvider or Miner interfaces without confirming schema impact across all consumers

## Data Architecture
- Static fallback: lib/data.ts (MINERS_DATA, PROVIDERS_DATA, GLOSSARY_TERMS)
- DB: Supabase tables mirror lib/types.ts — mapDbRow() in app/api/providers/route.ts handles snake_case → camelCase
- HostingProvider.id = slug string (e.g. 'abundant-mines') — NOT a numeric ID
- listingStatus: 'active' | 'flagged' | 'removed' — controls public visibility
- warningFlag: string | null — renders red banner on provider detail + compare pages

## Key URLs (live)
- Site: https://lightningmines.com
- Affiliate: https://abundantmines.com/ref/72/
- Stripe audit booking: /audit page (Stripe links — verify before touching)

## Open Items (do not mark resolved without testing)
- Supabase schema: verified current (slug/cooling_type/snake_case) as of 2026-07-05 — resolved
- Resend: domain lightningmines.com VERIFIED; all mail sends from no-reply@lightningmines.com; end-to-end confirmed 2026-07-05 — resolved
- NEXT_PUBLIC_SITE_URL: confirmed (sitemap serves www.lightningmines.com) — resolved
- /audit page Stripe links: verified live (both HTTP 200) 2026-07-05 — resolved
- GA4 (G-PSP0VE8ZJJ) + Clarity (xhpj936w12): live via CookieConsent (mounted in app/layout.tsx). Data appears in ~24-48h.

## Marketing Automation (all $0, live 2026-07-05)
- BRAND.md = voice/rules/review-checklist source of truth for ALL content
- Scheduling: Supabase pg_cron + pg_net (NOT Vercel crons). Jobs: daily-hashprice-snapshot (0 0), daily-content-drop (0 13 UTC), weekly-newsletter (0 15 Sun UTC)
- Secret for content endpoints: DAILY_CONTENT_SECRET (Vercel prod env). Endpoints reject without header x-content-secret
- lib/daily-content.ts → /api/cron/daily-content: emails Jacob the day's video script + 4 platform captions, numbers computed live at send time
- lib/newsletter.ts → /api/cron/weekly-newsletter: emails all leads/subscribers, minus email_suppressions table; HMAC unsubscribe via /api/unsubscribe
- To change cron schedule/secret: update via Supabase execute_sql on cron.job, not vercel.json
- Daily content auto-render (macOS, marketing/video/): /api/daily-script serves the day's video spec + chart + carousel slides. render.swift (AppKit+AVFoundation, no ffmpeg) makes a SILENT motion-graphic MP4 (60fps, animated 7-day chart + count-up numbers) for Reels/TikTok/Shorts; carousel.swift makes 6 Instagram slide PNGs. NO voiceover (robotic TTS hurts the trust brand). Installed to ~/.lightningmines/ (NOT the repo — macOS TCC blocks launchd from ~/Desktop). Output: ~/LightningMines-Content/ (+Desktop symlink): DATE.mp4, DATE-slide-1..6.png, DATE-captions.txt. Schedule: launchd com.lightningmines.dailyvideo @ 7:10am. Re-install after edits: marketing/video/install.sh

## Conventions
- All provider pages: /hosts/[id] where id = HostingProvider.id slug
- Miner pages: /miners/[slug]
- Components in components/ — no barrel index files
- Tailwind only — no inline styles, no CSS modules
- Git commits: imperative tense, one line ("Add Bitkern provider entry")
