# Lightning Mines — Project Handover

_Last updated: 2026-07-15 (afternoon) — pipeline code-complete; Postiz signup is the only blocker to posting_

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
