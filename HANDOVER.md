# Lightning Mines — Project Handover

_Last updated: 2026-07-15_

## 1. What this is
**Lightning Mines** (lightningmines.com) — an independent Bitcoin-mining intelligence / lead-gen site.
Positioning: _"The only mining voice honest enough to tell you when NOT to buy."_ Publishes real math
from live network data. Revenue = affiliate (Abundant Mines hosting) + paid audits ($97 / $297).

- **Repo:** github.com/jjhervey2310/lmc-mining
- **Local:** ~/Desktop/lmc-mining
- **Stack:** Next.js 14 (App Router), TypeScript, Tailwind v4, Supabase, Resend, Stripe, Vercel, Cloudflare
- **Voice/rules source of truth:** `BRAND.md`

---

## 2. Website — current state (all LIVE on production)

### Security (critical, fixed)
- **PII leak closed:** the `leads` table was publicly readable via the anon key (anyone could dump
  customer emails/names). RLS hardened — anon read/write blocked, all app access is service-role only.
  Supabase advisors now clean (only INFO-level items = the secure state).

### Correctness / trust fixes
- Hashprice calc bug fixed (was ~350× too low); `/data` now uses **live** network difficulty.
- **Mining-favorability colors:** rising difficulty / rising hashrate now show **RED** (bad for an
  existing miner) with a legend — not the generic "up = green."
- Provider "Verified" badges softened to **"Listed — verify direct"** (per decision).
- Removed fabricated scarcity ("3 spots remaining") + unverifiable "hundreds of deals" claim.
- Abundant Mines **Columbia River hydro / Cascade Locks OR** confirmed real, stated as fact.
- Naming standardized to "Abundant Mines"; hero tagline "The Independent Standard for Bitcoin Mining"
  (dropped "Bloomberg" — trademark); verified dates → June 2026.

### UX / design / SEO / a11y / perf
- Ambient animation pushed behind content (was drawing over data tables); mobile table scroll; killed
  mobile horizontal overflow; homepage mobile nav added; desktop nav overflow fixed.
- SEO: ticker no longer first crawlable text; `/hosts` canonicalizes to `/hosting`; JSON-LD dedup.
- A11y: skip link, aria, contrast fixes, reduced-motion, form-label association, focus rings, exit-intent
  dialog semantics.
- Perf: hero image preconnect + lighter quality; CDN cache header on `/api/btc-price`.
- Conversion: hero CTA now "Run the Free ROI Calculator"; sticky mobile CTA (free funnel); founder
  block + "what we check" deal checklist on /audit + /platform; stronger free-review headline.

### Forms — tested end-to-end (working)
Audit, Free Review, hosting-match, spreadsheet signup all write to Supabase `leads` AND fire Resend
emails. Verified live.

### Live-data refresh cadence
- **BTC price:** client polls 60s, but server-cached ~**10 min** (chosen; cost-free).
- **Difficulty/hashrate:** blockchain.info cached ~2h (real difficulty only moves ~every 2 weeks);
  the "Next Difficulty Adjustment" widget uses mempool.space on a **5-min** refresh.

---

## 3. Content Engine — "the brain" (`content-engine/` in repo)

A fresh, self-contained pipeline that generates daily short-form scripts (YouTube Shorts / Reels /
TikTok / X), grounded in the site's live numbers, and gates everything before it reaches a human.
**Nothing posts automatically** — it produces an approval digest.

### Flow
```
live data → brief → GENERATE (Claude) → GATES → [Claude↔GPT revise loop] → approval digest → (you) → render + post
```

### The gates (a script is blocked unless all pass)
1. **Fact (deterministic):** every $ figure re-checked against today's live BTC/hashprice/miner
   economics using the site's own `lib/calculator.ts`. Catches hallucinated numbers — real math, not
   one AI trusting another.
2. **Brand + FTC (deterministic):** BRAND.md rules — no hype/FOMO, one correct CTA, AI + affiliate
   disclosures, no guaranteed-return promises (negation-aware — "not guaranteed" is fine).
3. **GPT second opinion:** a different model critiques against the rubric, incl. "would a real miner
   call this naive or salesy?" Scores 0–100, pass ≥ 80.

### Dual brain (Claude + GPT cross-reference)
When a gate fails, Claude rewrites addressing every note, then re-gate — up to `MAX_REVISIONS` rounds,
then it escalates to you flagged. Proven working. Model per task is swappable (env), so cheap tasks can
be routed to a mini GPT later and measured.

### Run it
```bash
npm run content:run      # live (uses the API keys)
npm run content:dry      # mock generator, deterministic gates still run for real
# optional: --pillar=hardware_reality   to force a pillar
```
Output digest → `content-engine/out/<date>-<pillar>.md`

### Status: LIVE and tested
- `OPENAI_API_KEY` (reviewer, GPT) — in `.env.local`, working (credits added).
- `ANTHROPIC_API_KEY` (generator, Claude) — in `.env.local`, working ($20 credit, 90-day key).
- Real run produced strong on-brand scripts; GPT scored them 95/100; gates + revise loop verified.

---

## 4. Decisions locked
- **Human approval on everything** (one-tap Approve/Reject) — keeps the trust brand safe.
- **Avatar = a clone of Jacob** (real face + real voice) via HeyGen — NOT a generic stock avatar.
- **GPT via OpenAI API** = second brain + reviewer (cross-checks Claude).
- **Shorts-first:** TikTok + Reels + YT Shorts (one vertical repurposed); YouTube long-form = Phase 2.
- **HeyGen 600-credit tier** (has Voice Cloning + watermark removal; ~4× our credit need). Skip the
  1,000/4K tier — 4K is wasted on vertical social.
- **No Make.com needed** — the engine orchestrates render+post in code; Blotato handles multi-platform
  posting; the site itself is the conversion funnel (every script CTA → calculator → lead → audit/affiliate).

---

## 5. Setup status
| Item | Status |
|---|---|
| OpenAI API key | ✅ done, working |
| Anthropic API key | ✅ done, working (rotate reminder set on Google Calendar for Oct 5, 2026) |
| HeyGen account + avatar/voice clone + API key | ⬜ TODO — sign up (600 tier), record ~3–5 min of yourself |
| Blotato (or free Postiz) + connect socials | ⬜ TODO |
| Instagram → Creator/Business account | ⬜ TODO |

Keys live in `~/Desktop/lmc-mining/.env.local` (gitignored — never committed).

---

## 6. Next milestones (in order)
1. **HeyGen render stage** — approved script → your cloned-avatar MP4.
2. **Blotato posting** — video + caption → TikTok / IG / YT / X.
3. **Approval transport** — email/Slack digest with real Approve/Reject buttons.
4. **Daily schedule** — cron/launchd runs the engine each morning.
5. **Analytics feedback loop** — pull post performance back to rank what works.
6. **Cheap-model routing** — measure GPT-mini vs Claude on low-judgment tasks.

---

## 7. Costs (rough monthly)
- OpenAI + Anthropic API: pennies at this volume.
- HeyGen 600 tier: ~$29–89/mo.
- Blotato: ~$29/mo (or Postiz self-hosted = free).
- **Total ≈ $60–120/mo.**

---

## 8. Website backlog (non-blocking, saved for later)
- Centralize the hardcoded network-difficulty constant (in ~8 files; the API fallback differs).
- Extract duplicated mining formulas into one lib function.
- Weekly-newsletter idempotency (retry could re-send); leads route email-format validation.
- Remaining a11y: focus rings on a few pages, broader gray-500→gray-400 contrast pass.
- Minor SEO: LocalBusiness→Organization on host pages, Article schema dates on compare pages.
- Self-host the hero image fully (currently preconnect + reduced quality).
- `.env.local` on the local machine is otherwise real, but was a placeholder template for a while — a
  local dev server's "form success" is not proof; verify against production.

---

## 9. Hard rules (do not touch without explicit instruction)
- Never modify `vercel.json`, `next.config.ts`, Cloudflare/DNS.
- Never change Supabase project ID / connection strings, or Stripe price IDs / webhooks.
- Never push to `main` without a clean `npm run build` first.
- Keep all secrets in `.env.local` only.
