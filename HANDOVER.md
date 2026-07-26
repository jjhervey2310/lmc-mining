# Lightning Mines — Project Handover

_Last updated: 2026-07-26 (~4:30am) — GATED WEEKLY PIPELINE FULLY AUTONOMOUS; analytics loop live. Read §0 first._

## 0b. SESSION CLOSE-OUT 2026-07-26 (~4:30am) — what a fresh session must know first
- **Jacob lives in DENVER (moved early) — everything is Mountain Time.** UTC crons drift an hour
  at the November DST change; re-check then.
- **YouTube analytics CONNECTED this session:** YOUTUBE_API_KEY + YOUTUBE_CHANNEL_ID
  (UCez675kSdaqUrIlhmxSCLEw, @lightningmines23 "Lightning Mines", 12 videos) in Vercel prod.
  First run: 12 snapshots, 0 lessons (models correctly refused — data too thin; lessons start
  as views accumulate). Note: an EMPTY second channel @lightningmines (0 videos) also exists.
- **MONEY — the priority now. Jacob has no job yet; first income goal $3,000.** Agreed plan:
  (1) BUILD NEXT: $997 "Done-With-You Mining Setup" landing page (3 sales = goal; Jacob must
  create the Stripe payment link — never touch existing Stripe config); (2) BUILD NEXT: daily
  "whale hunting" digest — 5 high-intent Reddit/X questions + drafted math-first replies emailed
  each morning, Jacob approves and posts BY HAND (never auto-post); (3) route audit buyers
  ($97/$297, pages live) toward the $997 tier. Content machine = marketing dept; direct outreach
  = where week-one revenue comes from (was already the #1 ranked growth lever).
- **The autonomous weekly rhythm (all MT, nothing needs the laptop or Jacob):**
  Sat 5pm HeyGen balance check (emails if <600 units) → Sat 6pm warm-generate next 7 days →
  Sat 7pm Weekly Batch renders 7 videos + queues 28 Postiz posts → Sun 8pm analytics review
  (snapshot → Claude proposes → GPT vets → agreed lessons auto-feed future scripts + email).
  Week of 7/26–8/1 is fully queued. Next batch fires Sat 8/1 7pm MT.
- Parked, ready when Jacob says go: free chart-card video opener (tier-1 polish), AI×Mining
  weekly episode (pillar not built), TikTok/IG/X metrics (phase 2).

## 0. CURRENT STATE (2026-07-25) — Make.com is now THE posting pipeline

**Jacob's decision 2026-07-25: option 2 — Make.com runs daily posting, because the laptop is
rarely awake in time (missed runs 7/24 and 7/25 mornings prove it).** A previous Claude chat
built this with Jacob on the evening of 7/24; it was never written down, which caused a full
session of confused debugging on 7/25. Do not repeat that: keep this file current.

- **Make scenarios (Jacob's account, eu1.make.com, team "My Team" id 527795):**
  - `LMC Daily Generate` (id 3675754) — daily 6:15am MT (12:15 UTC), generates + schedules the
    day's posts via Postiz API. 11 ops/run, Free plan (1,000 ops/mo — fine).
  - `LMC Publish` (id 5764107) — webhook-triggered publisher. 7 historical errors, works now.
- **Keys:** Postiz API key was ROTATED for Make (new key also in `.env.local`, plaintext, working).
  HeyGen key was also rotated — the new one lives ONLY in Make; the copy in `.env.local` is DEAD
  (401). Get it from Jacob if local rendering is ever needed again.
- **Laptop chain DISABLED 2026-07-25:** `com.lightningmines.contentchain` launchd job unloaded,
  plist renamed to `.plist.disabled` in `~/Library/LaunchAgents/`. Re-enable = rename back + `launchctl bootstrap`.
  The 7:10am `com.lightningmines.dailyvideo` (silent motion-graphic + carousel, posts nothing) is STILL ON.
- **QUALITY GAP FIXED 2026-07-26 (this session): Make is now GATED.** The content-engine
  (Claude generate → fact gate → brand/FTC gate → GPT review → revise loop) was ported INTO the
  site: `lib/make-content.ts` + secret-protected `/api/make-content` (header `x-content-secret`
  = DAILY_CONTENT_SECRET, same as the cron endpoints). ANTHROPIC_API_KEY + OPENAI_API_KEY are now
  in Vercel prod env — the laptop is fully out of the loop.
  - `LMC Daily Generate` was REWIRED: its GPT self-generation + self-grading modules are GONE;
    it now does one GET to /api/make-content and feeds the gate-passed script to the same HeyGen
    render call (avatar rotation/callback untouched). Non-200 → `generate-failed` datastore record.
  - `LMC Publish` now posts PER-PLATFORM captions (caption_x / caption_youtube / caption_instagram
    / caption_tiktok, new fields in datastore 152060) — all with CTA + AI disclosure, all gate-passed.
  - Day's drop is generated ONCE and cached in Supabase `make_content_cache` (service-role only);
    pg_cron job `make-content-warm` (jobid 4, 00:30 UTC) pre-warms it before Make's run.
    `?refresh=1` forces regeneration; `?date=YYYY-MM-DD` serves a future day (weekly batching).
  - **WEEKLY BATCH LIVE (Jacob's design, built 2026-07-26 ~3am): `LMC Weekly Batch` (renamed
    3675754) runs SATURDAYS 7pm MT** (weekly days:[0] time 02:00 Make-time = 01:00 UTC Sunday,
    right after the week's last post) and makes the NEXT 7 DAYS: iterator offsets 0-6 →
    GET /api/make-content?date=D → HeyGen render per day (day-keyed outfit rotation, Jacob's
    voice f6a3...4aea, never raw footage) → datastore record keyed by HEYGEN VIDEO_ID carrying
    per-platform captions + post_date/post_date_next. `LMC Publish` matches each render callback
    to its record by video_id and schedules that day's 4 Postiz posts at the record's dates
    (X 13:30Z / YT 18:00Z / IG 22:00Z / TT next-day 00:30Z). Offset 0 = Sunday's numbers post,
    generated Saturday evening = freshest possible price while still banking the week.
    pg_cron warm job (jobid 4) pre-generates all 7 at Sat 6pm MT ('0 0 * * 0', generate_series 0-6).
    The whole coming week is visible in Postiz every Saturday night. Next auto-fire: Sat 8/1 7pm MT.
  - Fallback chain: engine gates fail / API down → pre-approved template drop from
    lib/daily-content.ts (computed numbers, fixed copy) → never a wrong or CTA-less post.
- **CONTENT RULES (Jacob, 2026-07-25 night):** (1) hooks ALWAYS name Bitcoin mining — preferred
  framing "Is Bitcoin mining still worth it…?" (in generator prompt + brand gate + BRAND.md §Sounding
  Human #9); (2) **price/dollar numbers are SUNDAY-ONLY** — Mon–Sat is evergreen educational content
  with ZERO dollar figures (deterministic evergreen gate in lib/make-content.ts), so posts can be
  banked a week ahead without going stale. Sunday = the live "worth it at $X" numbers check.
- **FRAMING BUG FOUND+FIXED 2026-07-26 morning (Jacob spotted it): the 7/24-era HeyGen call
  letterboxed every video** — v3 /v3/videos with type:avatar has NO scale/offset controls, so the
  landscape studio looks rendered as a small 16:9 strip inside the 9:16 canvas (file measures
  1080×1920, picture doesn't fill it — probe dimensions AND eyeball a frame: `qlmanage -t` is $0).
  Fix: Weekly Batch now uses the content-engine's proven call — POST /v2/video/generate,
  character type **talking_photo** + **scale 2.7** + dimension 720×1280 (same look IDs).
  HeyGen account-level webhook now registered (avatar_video.success → the Make hook), since v2
  has no per-request callback_url. The whole week was re-rendered + re-queued (first batch of 7
  renders wasted ~$8 — RULE: one test render + frame check BEFORE any batch). Sunday 7/26's
  7:30am X post went out letterboxed (only casualty; delete/repost manually if desired).
  ⚠ **HeyGen v2 API sunsets 2026-10-31** — before then, migrate to v3 (needs scale support or
  reframed 9:16 looks); reminder: check developers.heygen.com when v3 gains framing controls.
- **Postiz UI shows queued videos with NO preview — that's cosmetic.** upload-from-url returns
  `thumbnail: null` (Postiz doesn't thumbnail URL-uploaded video); the mp4 is really stored and
  attached (verified: uploads.postiz.com file serves video/mp4) and publishes fine. Don't panic,
  don't re-upload.
- **Cost guardrails (Jacob, 2026-07-26):** HeyGen balance was 929 units after this week's 7
  renders; a week burns ~300–550. `heygen-quota-alert` pg_cron (jobid 5, Sat 5pm MT, before the
  batch) hits /api/cron/heygen-quota-check → emails Jacob if balance < 600 (HEYGEN_API_KEY +
  threshold in Vercel env). Magic number: ~$30–45/mo at current lengths; $50 top-up ≈ 3–4 weeks.
  Gates now run CHEAPEST-FIRST: deterministic (fact/brand/evergreen/variety) free, GPT review only
  on drafts that passed them; reviewer receives brief.angle so it can enforce format rules; the
  variety gate compares hooks across the cached week so duplicates bounce before any render.
- **DESKTOP APP + PA + JOB WIRE v2 (2026-07-26 afternoon):** Native macOS app **"LMC Terminal"
  on Jacob's Desktop** — Swift/AppKit WKWebView wrapper (source `~/.lightningmines/terminal-app/
  main.swift`, secret embedded from ADMIN_SECRET, NOT in repo; rebuild: `swiftc -O -framework
  Cocoa -framework WebKit main.swift -o "LMC Terminal.app/Contents/MacOS/LMCTerminal"`). Opens as
  a tall right-edge panel; Cmd+R reloads. Dashboard is light/clear theme; PA chat is now
  **ChatGPT-voiced (gpt-4o) with Claude as silent verifier** (Jacob's pick — reverse of before);
  18-rig S21 XP fleet P&L box (simulated, Abundant $225/mo/rig) on Overview. Job sweep: RemoteOK/
  WWR REMOVED; **Adzuna** fetcher (Indeed aggregator WITH salary) + fit ranking (ops/growth/
  founder/BD) live but **BLOCKED on Jacob: free ADZUNA_APP_ID + ADZUNA_APP_KEY from
  developer.adzuna.com → Vercel env**. job_finds gained salary + fit_score columns. Direct
  Indeed/LinkedIn scrapers were requested and refused (no API / bot-blocked / ToS) — deep-links
  in the brief instead.
- **PA HAS HANDS (2026-07-26 evening):** the dashboard chat (ChatGPT voice, Claude verifier)
  now ACTS via server-side tools: list_queue / delete_post (confirm-first) / regenerate_content
  (cache only, no re-render) / add_lesson (feeds every future script — Jacob can steer content
  by chatting) / job_status / check_balance / run_watchdog / recent_leads. Deliberate boundary:
  the web PA never gets deploy/DB/Make/shell powers — those stay in Claude Code sessions
  (one leaked URL must not equal total compromise). Explained to and accepted by Jacob.
- **WEEK OF 7/26–8/1 was generated + queued live this session:** Sun 7/26 numbers post (GPT 95)
  + Mon–Sat evergreen (all gates passed; distinct hooks; tone = bullish/funny/human per Jacob).
  Evergreen gate also blocks live difficulty/hashrate figures ("126.2 trillion"), not just $.
  brandGate is now negation-aware ("no guaranteed returns" passes; promises still fail).
- **ANALYTICS LOOP LIVE (built 2026-07-26 ~4am):** `/api/cron/weekly-analytics` (secret-gated,
  pg_cron jobid 6, Sundays 8pm MT) snapshots per-video stats into `video_metrics`, then Claude
  proposes ≤2 lessons and GPT independently critiques — only lessons BOTH agree on land in
  `content_lessons`, which lib/make-content.ts loads into every future script's brief. Emails
  Jacob the weekly report. 5+ videos-with-data required before any lesson (brand rule).
  **Jacob's one human step: create a free YouTube Data API key + find the channel ID, then add
  `YOUTUBE_API_KEY` and `YOUTUBE_CHANNEL_ID` to Vercel prod env** — until then the report emails
  "no metrics source connected". TikTok/IG/X metrics = phase 2 (need platform app approvals).
- **Video polish tiers (discussed, not built):** tier 1 $0 = site-generated chart-card image as a
  HeyGen opening scene (cloud version of chart-open.swift, /api/og pattern); tier 2 $30-50/mo =
  Creatomate/Shotstack compositing (lower-thirds, captions, b-roll). Decide with analytics data.
- **AI × Mining series (Jacob's idea, 2026-07-26):** origin story "they said AI would take over
  mining, so I became the AI to find out" — approved direction: keep daily mining engine, add ONE
  AI-vs-mining episode/week at the intersection (AI datacenters vs miners for power, AI vs ASIC
  energy, can AI predict hashprice). Expand only if analytics beat mining episodes 4-6 weeks
  straight. NOT built yet — needs an 'ai_mining' pillar in lib/make-content.ts when Jacob says go.
- Postiz duplicate-detection does not exist; never run two pipelines at once.
- 2026-07-26 scripts were generated locally (passed all gates, in `content-engine/out/`) but never
  rendered/scheduled (HeyGen 401). Make will cover 7/26 on its own at 6:15am.

---

_Previous update: 2026-07-15 (afternoon) — pipeline code-complete; Postiz signup was the only blocker to posting_

## 1. What this is
**Lightning Mines** (lightningmines.com) — an independent Bitcoin-mining intelligence / lead-gen site.
Positioning: _"The only mining voice honest enough to tell you when NOT to buy."_ Publishes real math
from live network data. Revenue = affiliate (Abundant Mines hosting) + paid audits ($97 / $297).

- **Repo:** github.com/jjhervey2310/lmc-mining · **Local:** ~/Desktop/lmc-mining
- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind v4, Supabase, Resend, Stripe, Vercel, Cloudflare
- **Voice/rules source of truth:** `BRAND.md` · **Owner:** Jacob Hervey (jjhervey1@gmail.com)

---

## 2. Website — current state (all LIVE on production)
- **Security fixed:** `leads` table RLS hardened (was publicly readable via anon key); all DB access service-role only.
- **Correctness/trust:** hashprice calc bug fixed (~350× off); /data uses live difficulty; rising difficulty shows RED;
  "Verified" softened to "Listed — verify direct"; fake scarcity removed; tagline "The Independent Standard for Bitcoin Mining".
- **UX/SEO/a11y/perf sweep done** (mobile nav/tables, JSON-LD, skip links, contrast, cache headers, sticky CTA, etc.).
- Forms tested end-to-end (Supabase leads + Resend email). GA4 + Clarity live.
- Backlog (non-blocking): centralize difficulty constant, extract duplicated formulas, newsletter idempotency,
  remaining a11y, minor schema, self-host hero image.

---

## 3. Content Engine — CODE-COMPLETE end-to-end (`content-engine/` in repo)
The full daily workflow, all tested live:

```
npm run content:run      live data → Claude writes scripts → 3 gates + GPT review (+revise loop) → approval digest + JSON
npm run content:render   approved script → HeyGen (Jacob's avatar) → out/<date>.mp4 (720×1280 vertical)
npm run content:post     MP4 + per-platform captions → YouTube/Instagram/TikTok via Postiz; text-native post → X
```

- **Gates:** fact (deterministic $-check vs lib/calculator.ts), brand+FTC (BRAND.md rules), GPT review ≥80.
  On fail: Claude revises against reviewer notes up to MAX_REVISIONS, then escalates. Last live run scored **95/100**.
- **Approval is human:** running `content:post` IS the one-tap approval. It refuses gate-failed scripts.
  `npm run content:post -- --check` lists connected Postiz channels.
- **HeyGen (working):** key in `.env.local` (verified; ~900 API quota units). Render defaults locked:
  look `41920dc9d7e44063b3725b4a36818085` ("Broadcaster in a grey hoodie" — Jacob's pick, matches his hearted in-app video;
  render as `talking_photo`, NOT `avatar`), voice `f6a3f8a4c96542ebb2f295c140614aea`, scale 3.2 (fills 9:16, no letterbox).
  All overridable via env (`HEYGEN_TALKING_PHOTO_ID`, `HEYGEN_VOICE_ID`, `HEYGEN_SCALE`).
- **YouTube note:** vertical <3 min auto-becomes a Short — one upload covers "YouTube + Shorts". Long-form = Phase 2.
- **Proof artifacts:** `content-engine/out/2026-07-15.mp4` (real daily video, 71s) + Desktop `lmc-heygen-demo-v3.mp4` (15s teaser, correct framing).

## 4. BLOCKER STATUS (updated 2026-07-15 evening) — Postiz DONE, first post ON HOLD for handles
- **Postiz LIVE:** free tier, Public API not paywalled. `POSTIZ_API_KEY` in `.env.local`. `--check` verified:
  `youtube` (Jacob Hervey) · `tiktok` (swerve23) · `x` (SWERVE — identifier is literal `x`, post.ts match OK) ·
  `instagram-standalone` (Jacob).
- **TikTok "swerve23" label is NOT the wrong account (verified 2026-07-16 evening).** The Postiz TikTok channel's
  `profile` field is `lightningmines` and its cached avatar is pixel-identical to @lightningmines' brand avatar;
  "swerve23" is only a stale cached *display name* from before the rename. The separate @swerve23 account that still
  exists on TikTok has a default grey avatar/no bio and is NOT what's connected. Do NOT delete/reconnect the channel
  again — silent re-adds never hit TikTok (Postiz restores its stored token server-side), which is why every
  reconnect attempt "came back as swerve23". Cosmetic only; label should refresh on a future token refresh.
- **⚠ TikTok Ep. 1 retry post is GONE:** the quota-error retry queued for 2026-07-17T00:15Z no longer exists in
  Postiz (`GET /posts` shows only the published IG reel) — almost certainly cascade-deleted when the TikTok channel
  was deleted/re-added during the 2026-07-16 reconnect attempts. Needs re-queueing (remember post.ts lacks the
  required tiktok settings block — see content-engine memory / §gotchas — use the direct API call pattern).
- **HOLD (Jacob's call):** those are personal accounts, not @lightningmines. No post until handles are fixed.
  Jacob's remaining human steps, in order:
  1. Rename/re-point all 4 accounts to @lightningmines (or agreed fallback); bio → lightningmines.com, never affiliate.
  2. Instagram: switch to Creator/Business linked to a Facebook Page on his EXISTING personal Facebook
     (decision changed 2026-07-15 — new FB account signup failed). Then in Postiz: Add Channel →
     **Instagram (Facebook Business)** → select the Page; remove the old `instagram-standalone` channel
     (post.ts's substring match will target it and standalone likely can't publish Reels via API).
  3. HeyGen key still in plain text in `~/Desktop/Jacob's /HeyGEN .docx` — move to 1Password, delete doc.
- **When posting resumes:** re-run `content:run` + `content:render` that day (numbers must be fresh — don't post a
  stale-dated video), then `content:post -- --check`, then `content:post` = the approval tap.

## 5. Brand assets (Desktop: ~/LightningMines-Brand/)
- **profile-photo-1024.png / -400.png** — Jacob's avatar photo (best frame from demo video), USE AS PROFILE PIC on all socials
  (decided: human face > logo for a personal trust brand).
- **avatar-blaze.svg** — bold glowing bolt mark (best at small sizes) · **avatar-strike.svg** — realistic lightning
  (spectacular full-size; recommended as X/YouTube BANNER art, not avatar). Banner builds not started — offer to make
  1500×500 (X) + 2560×1440 (YT) with strike art + wordmark + tagline.

## 6. Decisions locked
- Human one-tap approval on everything; nothing posts automatically.
- Avatar = HeyGen clone of Jacob (grey hoodie look). NO robotic TTS, no stock avatars.
- GPT (OpenAI API) = independent reviewer/second brain vs Claude generator — two models on purpose.
- Shorts-first; YouTube long-form Phase 2. Postiz free before Blotato. No Make.com — engine orchestrates in code.

## 7. Next milestones (in order)
1. Jacob: accounts + Postiz key (section 4) → first live post same day.
2. Approval transport: email/Slack digest with Approve button (replaces manually running content:post).
3. Daily schedule (cron) for content:run + render; post stays behind approval.
4. Analytics feedback loop (what performs → informs briefs). 5. Cheap-model routing. 6. Banners (section 5).

## 7b. Content operating pattern (agreed 2026-07-16 night)
- **One video/day, fixed hour (7am MT target).** Decision rule each morning: (1) if a bullish trigger in
  `content-engine/ideas.md` is TRUE per live data → that's the day's video; (2) else weekday pillar; (3) school
  episodes (Lightning Lessons, numbered curriculum) own the Thu explainer + Sun slots.
- **3-post evergreen buffer, always.** Banked now: Ep 2 (`out/2026-07-16-ep2.mp4`) + Ep 3 (`out/2026-07-17-lessons-ep3.mp4`,
  all 4 captions gate-passed in `-lessons-ep3.json`). Slot 3 = cloud-mining myth-bust: scripts in `out/2026-07-17-cloudmining.json`
  but IG + X captions FAILED brand gate (quoting "guaranteed returns" while debunking trips the check) — needs a wording
  revision + render. Only evergreen content gets banked (stale-numbers rule). Post one → replace within 48h.
- **Renderer mix (cost control):** HeyGen avatar ONLY for school eps / face-worthy content; daily numbers posts use the
  $0 silent motion-graphic pipeline (`marketing/video/`, launchd 7:10am → ~/LightningMines-Content/). Publish any MP4 via
  `content:post -- --video=<path>` (new flag) with the day's captions. Scripts now hard-capped at 110-150 words (~45-60s)
  — better retention AND ~half the render cost.
- **X format (fixed 2026-07-17 after Jacob flagged duplicate-looking feed):** X gets the VIDEO attached natively plus its
  own long-form written breakdown (`xPostFor`: hook + body + hashtags — account has Premium), NOT a short caption + bare
  link. Bare-link posts all render the identical lightningmines.com preview card → feed reads as reposted spam, and X
  downranks link-only posts. X ships as a separate /posts call with auto-fallback to the 280-char `tweetFor` version if
  the long post is rejected.
- **Avatar wardrobe rotation (2026-07-17):** 4 extra motion looks live; pillar→look map `HEYGEN_LOOK_BY_PILLAR` in
  content-engine/config.ts (sweater=numbers days, olive=red flags, studio=myth-busts, navy=hardware, grey hoodie
  reserved for Lightning Lessons). IDs in memory + config comments.
- **HeyGen quota reality (2026-07-16 night): 65 API units left** (~1 render at old length, ~2 short). Burn was ~39 units
  per ~80s render. Daily avatar-everything needs a paid plan (~$100/mo API tier — verify current pricing); the mix above
  keeps it $0-30/mo.
- **Research loop:** `npm run content:ideas` weekly (Sun) — Claude proposes school/bullish/evergreen topics, GPT scores →
  ranked backlog in `content-engine/ideas.md` (12 seeded, school eps 3-8 scored 85-95). Bullish ideas carry explicit
  live-data triggers; post only when the trigger is true.
- **Sunday analytics review (manual until scripted):** per video log views/watch-through/likes/comments/follows against
  pillar+hook+length; write one lesson/week into BRAND.md; never react to a single video, only patterns across 5+.
- **Engagement human-jobs (Jacob, not automatable):** reply to every comment in hour 1; on X, reply useful math to 3-5
  big mining accounts daily; TikTok video-replies to good comments.

## 7c. SOCIAL MEDIA WORK FLOW — live state snapshot (2026-07-17 night)
The session running this is titled "SOCIAL MEDIA WORK FLOW". A fresh session picking this up needs to know:
- **Scheduled & guaranteed (Postiz server-side, fires even with everything closed):** 8 posts queued —
  Sat 7/18 cloud-mining warning (studio look, "3 Red Flags" chart-open) + Sun 7/19 Lightning Lessons Ep 4 (grey hoodie,
  "Ep. 4" card open); each day X 9am / YT 2pm / IG 6pm / TikTok 8pm ET. Hand-tuned YouTube titles are saved INSIDE the
  script JSONs (`out/2026-07-17-cloudmining-v2.json`, `out/2026-07-17-lessons-ep4.json` → youtube_shorts script.title).
- **Session-only automations (die with the session — RECREATE in a new session):**
  (a) daily 6:47am content-lead maintenance: keep Postiz 2 days ahead with the next EVERGREEN item (Lightning Lessons
  Ep 5 = breakeven formula is next, alternate with myth-bust/red-flag from content-engine/ideas.md), chain =
  content:run --pillar/--angle → content:render --date=<exact json prefix> (wardrobe auto) → chart-open → frame-check →
  `NODE_PATH=<repo>/node_modules node content-engine/tools/schedule-ahead.js <json> <mp4> <D+2>`; idempotency guard first
  (skip if D+2 already has 4 QUEUE posts). (b) Sun 7/19 7:33pm one-shot: full week-1 analytics report + dual-brain
  (Claude generateJSON + GPT reviewJSON) traction analysis + apply cheap fixes + BRAND.md lessons entry.
- **Analytics baseline (Fri 7/17 ~11am, for Sunday deltas):** YT 2 subs, Shorts 1/3/1 views · TikTok 2 followers/1 like ·
  IG 2 followers · X 9 followers.
- **Tools:** `marketing/video/chart-open.swift <main.mp4> <out.mp4> <bigText> <label> [spark]` — 2s animated open
  (spark = chart mode for same-day numbers content only, from lightningmines.com/api/daily-script chart.points;
  no spark = episode card for evergreen). `content-engine/tools/schedule-ahead.js` — schedules one day's 4 posts at the
  staggered times (times hardcoded inside, July EDT offsets).
- **HeyGen wallet:** ~2,575 units; $50 = 3,000 units (≈1.7¢/unit), renders ≈80 units (≈$1.35/video, ~$1/min).
  Top-up at https://app.heygen.com/settings?nav=API when under 300.
- **Jacob's open human items:** (1) Instagram bio still missing the lightningmines.com link (Edit profile → Links) —
  only clickable path from Reels; (2) daily 30-60min outbound replies on bigger mining/BTC accounts — both growth
  reviewers ranked this the #1 lever, above everything automated; (3) reply to own-post comments within the hour.
- **Live post URLs so far:** YT _iXYcyWgeWw + 7hND0G0zaT4 + 3qsUNllV-lA · IG Da3gK_qCoa6 + Da4EGUvij4j + Da5jgzDgVD_ ·
  X status 2077934972154130936 + 2078141973765218702 · TikTok on @lightningmines profile.

## 8. Growth plan sketch ($500 / 30-day discussion, 2026-07-15)
Honest expectation set: $10k/30d is tail outcome; $1.5–4k + compounding machine is realistic.
Key moves agreed worth pursuing: post 2–3×/day (marginal cost ~0), design a **$997 "Done-With-You Mining Setup"** tier
(stacks with affiliate commission), subagent-assisted "whale hunting" (draft genuinely helpful math-first replies to
high-intent Reddit/X/YouTube questions — always human-approved, never auto-posted), hold ad spend until an organic
winner exists, then boost only proven videos. Landing page for $997 tier: not started.

## 9. Costs (~monthly)
OpenAI/Anthropic pennies · HeyGen ~$29–89 · Postiz $0 (target) · total well under $100/mo.
Anthropic key: $20 credit, 90-day — rotate reminder Oct 5 2026 (on Google Calendar).

## 10. Hard rules (don't touch without instruction)
No edits to vercel.json / next.config.ts / Cloudflare-DNS. No changes to Supabase IDs/connection or Stripe price
IDs/webhooks. **Never push to main without a clean `npm run build`.** Secrets only in `.env.local` (gitignored).
Commits: imperative, one line.
