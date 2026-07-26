# Lightning Mines — Project Handover

_Last updated: 2026-07-23 (evening) — daily pipeline AUTOMATED end-to-end; cloud session has live Postiz access_

## 1. What this is
**Lightning Mines** (lightningmines.com) — an independent Bitcoin-mining intelligence / lead-gen site.
Positioning: _"The only mining voice honest enough to tell you when NOT to buy."_ Publishes real math
from live network data. Revenue = affiliate (Abundant Mines hosting) + paid audits ($97 / $297).

- **Repo:** github.com/jjhervey2310/lmc-mining · **Local:** ~/Desktop/lmc-mining
- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind v4, Supabase, Resend, Stripe, Vercel, Cloudflare
- **Voice/rules source of truth:** `BRAND.md` · **Owner:** Jacob Hervey (jjhervey1@gmail.com)
- **Jacob is non-technical.** Explain everything plainly; give SINGLE-LINE terminal commands only
  (multi-line pastes leave the last line waiting for Enter — this caused two incidents on 7/23,
  including a triple-render that duplicate-scheduled a day; banned since).

## 2. Website — current state (all LIVE on production)
Unchanged from prior handover: leads RLS hardened; hashprice calc fixed; live difficulty; forms
tested end-to-end; GA4 (G-PSP0VE8ZJJ) + Clarity live. Backlog (non-blocking): centralize difficulty
constant, extract duplicated formulas, newsletter idempotency, remaining a11y, self-host hero image.

## 3. DAILY VIDEO PIPELINE — FULLY AUTOMATED (as of 2026-07-23)

### The format (Jacob's spec, locked 7/22-23)
- **Every default daily video = `bullish_caveat` pillar:** ~30s (70-90 spoken words), always the
  **Antminer S21 XP**, bullish case + mandatory honest "but" caveat, **"Lightning Mines" spoken in
  the first line**, single CTA closing (carries lightningmines.com). See BRAND.md §Standard Daily Format.
- **Timeless phrasing (hard, machine-enforced):** posts publish up to 24h after writing, so scripts
  NEVER say "today"/"right now"/"currently" — claims anchor to price ("At $66,088 Bitcoin...").
  brandGate deterministically fails violations (X failed exactly this on 7/23 and was auto-skipped).
- **Spoken numbers are rounded** ("a dollar fourteen a day"), max 2-3 per script; EXACT figures live
  in onScreenText/captions. Merged 7/23 evening — first video with this: **Sat 7/25. Jacob should
  listen and judge** (his complaint: "I sound like a robot when I say numbers").
- **Wardrobe rotates every video, never the grey hoodie** (reserved for Lightning Lessons):
  navy → grey sweater → olive → studio, keyed to day-of-year (`HEYGEN_BULLISH_ROTATION`,
  navy first = Jacob's "darker top got most views" hypothesis — confirm at Sunday review across 5+).
  One-off override: `HEYGEN_LOOK_OVERRIDE=<talking_photo_id>` env var.
- Voice pinned `locale: en-US` (accent drifted Australian once; also verify HEYGEN_VOICE_ID in
  .env.local = f6a3f8a4c96542ebb2f295c140614aea if it ever sounds off).
- Generator retries invalid JSON 3x with error feedback (crashed a whole run twice on 7/23 pre-fix).

### The automation (survives with NO session alive)
- **launchd `com.lightningmines.contentchain` — 6:45am daily** on Jacob's Mac, runs
  `~/.lightningmines/daily-content-chain.sh` (installed from `marketing/automation/` via `install.sh`;
  re-run install.sh after editing the chain). **PROVEN firing (7/23 6:48am).** TCC was NOT an issue.
- **BUFFER MODE:** each run `git pull`s main (self-updating), generates from live data, renders via
  HeyGen, and schedules **TOMORROW's** 4 posts in Postiz (X 9am / YT 2pm / IG 6pm / TikTok 8pm ET via
  `content-engine/tools/schedule-ahead.js`). Result: a standing ≥24h queue — a dead Mac only ever
  risks the day AFTER tomorrow.
- Idempotency: marker files `~/LightningMines-Content/.scheduled-<date>`. Logs:
  `~/LightningMines-Content/logs/chain-<date>.log` (chain prints nothing to Terminal).
- Gotcha class fixed 7/23: engine names outputs by **UTC date** (rolls at 6pm MT) — chain now picks
  newest files instead of date-matching; schedule-ahead exits non-zero if ANY platform fails and has
  a 280-char X fallback.

### CLI toolbox (all on Jacob's Mac, repo root)
- `npm run content:post -- --queue` — what's scheduled/published, yesterday→+2 days
- `npm run content:post -- --platforms=tiktok` — repost ONE platform without duplicating others
- `npm run content:post -- --check` — list connected Postiz channels
- Full manual chain: `npm run content:run && npm run content:render && npm run content:post` (posts NOW)

## 4. CLOUD SESSION POWERS (new 7/23 — big change)
- **Postiz API access works FROM THE CLOUD.** Jacob added `POSTIZ_API_KEY` env var + network allow
  for api.postiz.com in the claude.ai/code environment settings (applies to new sessions).
  Auth header: `Authorization: <key>` (no Bearer). **Use curl — node fetch bypasses the proxy and 403s.**
  - `GET /public/v1/posts?startDate=...&endDate=...` — the queue (note: TikTok's 8pm ET slot is
    stored 00:00Z NEXT day, looks like tomorrow in UTC)
  - `POST /public/v1/posts` — CAN post (did so 7/23: X text post, Jacob's explicit approval =
    the approval tap). `value[0].image: []` is REQUIRED even for text-only.
  - `DELETE /public/v1/posts/:id` — used twice on 7/23 to dedupe (keep NEWEST complete set of 4)
- **HeyGen is NOT cloud-reachable** (no key in env, host not allowlisted) — rendering only happens
  on the Mac. Cloud can check/queue/post/delete but not create videos.
- ⚠️ **Postiz key was pasted in chat/screenshots — regenerate it** in Postiz Settings→API sometime,
  then update .env.local AND the cloud env var. Not urgent, good hygiene.

## 5. STATE SNAPSHOT (2026-07-23 ~8:30pm MT)
- **Thu 7/23: 4/4 PUBLISHED** — YT 9_kWnWu3540 · IG reel DbJMGYBigvM · TikTok @lightningmines ·
  X status 2080342494769000889 (X was gate-skipped for "today" phrasing; clean text posted from
  cloud with Jacob's approval)
- **Fri 7/24: 4 QUEUED** (grey-sweater re-render; the near-duplicate navy set + 3 accidental
  duplicate sets were deleted via API)
- **Sat 7/25 onward: automatic** via 6:45am chain — first human-numbers video
- Earlier this week: Tue 7/21 4/4 and Wed 7/22 4/4 published. No platform has ever received the
  same video twice.
- HeyGen wallet: ~2,575 units on 7/17; ~6 renders since (~80 units each incl. 3 wasted on the 7/23
  paste-repeat) → roughly ~2,000 left ≈ 25 days. Top up under 300: app.heygen.com/settings?nav=API.

## 6. SCHEDULED / RECURRING
- **Sunday 7:33pm MT weekly review** — per `docs/weekly-deep-dive.md` (pre-registered metrics +
  KEEP/ADJUST/REVERT criteria; watch-through is THE metric; medians; % AND raw seconds; first-3s
  hold on the "Lightning Mines" open; wardrobe breakdown). **Jul 26 = 5-day directional early read
  only. Aug 2 = first full-week decision.** Pull Supabase-side data yourself (leads,
  affiliate_clicks, analytics_events, hashprice_snapshots — project bngwwalucfirmcymqall); ask Jacob
  to paste per-video platform stats.
- ⚠️ The Sunday trigger lives as a SESSION-ONLY cron in the 7/22-23 session ("Postiz video posting
  setup"). If that session is gone, RECREATE the schedule. A durable server-side Routine was blocked
  on a permission approval — worth retrying create_trigger from an interactive session.
- HeyGen avatar month trial ends ~8/22 (evaluate vs $0 motion-graphic pipeline / Remotion idea).

## 7. OPEN ITEMS
1. **Hosting-provider verification (Jacob's ask 7/23):** nobody has verified. Compass (Colby)
   redirected 7/20 → email **marketing@compassmining.io**. Simple Mining (Adam, aobrien@) offered
   2% referral then went silent after 6/24 follow-up → re-ping. Gmail drafts were offered, not yet
   written.
2. Regenerate + re-home Postiz key (see §4).
3. Jacob's IG bio still missing lightningmines.com link; daily outbound replies remain the #1
   organic growth lever per prior reviews.
4. Later/nice-to-have: log wardrobe look per video into analytics; X revise-loop hardening (retry
   handles most); Remotion motion-graphics exploration (parked — HeyGen month first); banners;
   $997 tier landing page.

## 8. CONVENTIONS FOR THE ASSISTANT
- PR flow: branch `claude/postiz-video-posting-v1z5o1` (restart from origin/main after each merge —
  all of PRs #11-#19 are merged), draft PR, wait Vercel green, Jacob says "merge" (he sometimes
  pre-authorizes with intent like "I want X done now"). Commits: imperative, one line.
- Never push to main without clean `npm run build`. No edits to vercel.json / next.config.ts /
  Cloudflare / Supabase IDs / Stripe.
- Human approval rule stands: nothing posts without Jacob's action or explicit in-chat instruction.
- Verify claims against Postiz/Supabase directly instead of trusting memory — "check the queue"
  should always be answered with a fresh API read.

## 9. Costs (~monthly)
OpenAI/Anthropic pennies · HeyGen ~$40/mo at 1 video/day (after trial decision) · Postiz $0 ·
total well under $100/mo. Anthropic key rotate reminder Oct 5 2026.
