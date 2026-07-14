# Post-Launch Verification Report — Monetization Gaps

**Branch:** `monetization-gaps`
**Date:** 2026-07-14
**Verifier:** Claude (orchestrator), running the CLAUDE.md verification loop personally after the five build sub-agents finished.
**Scope:** The six monetization deliverables and every file they touched.

This report follows the CLAUDE.md HONESTY CLAUSE: every claim below is either **VERIFIED** (I ran the check and observed the result) or **NOT VERIFIED** (I could not confirm it in this environment, and I say why). Nothing here is inferred from code and reported as tested.

---

## 1. Deliverables — all six exist, none empty (VERIFIED)

| # | Deliverable | Primary file(s) | Bytes |
|---|-------------|-----------------|-------|
| 1 | `/audit` $297-anchored sales page | `app/audit/page.tsx` (+ `layout.tsx`) | rewritten |
| 2 | Affiliate disclosure system | `components/AffiliateDisclosure.tsx`, `app/disclosures/page.tsx` (6.3 KB), `docs/affiliate-disclosure-audit.md` (6.1 KB) + 13 pages | — |
| 3 | Internal linking pass | `lib/articles.ts`, `docs/internal-link-graph.md` (8.5 KB) | — |
| 4 | AEO `/how-we-verify` rewrite | `app/how-we-verify/page.tsx` | rewritten |
| 5 | $97→$297 ladder bridges | `lib/email-sequences.ts`, `lib/send-email.ts`, `app/deal-analyzer/page.tsx`, `app/review/page.tsx`, `app/calculator/page.tsx`, `docs/conversion-ladder.md` (6.6 KB) | — |
| 6 | This verification report | `docs/verification-report.md` | this file |

**Full changeset:** 21 modified files + new `app/disclosures/` route + 4 new docs.

---

## 2. Build gate (VERIFIED)

`npm run build` → **exit 0, "Compiled successfully"**, 62 routes generated. Run three times (after sub-agents, after seam fixes, after final polish) — clean each time.

- One runtime log during static generation: `BTC price fetch failed: CoinGecko error: 401`. This is a **pre-existing** invalid/expired `COINGECKO_API_KEY` in `.env.local`; `getLivePriceData()` catches it and falls back to a static price. It is **not** a build failure and **not** introduced by this work. See §7.

---

## 3. `/audit` page — both viewports (VERIFIED)

- **Desktop 1440px:** renders clean. Hero ("Don't wire $20,000 into a mining deal you haven't stress-tested"), scarcity badge, $297 Deep Dive anchor card with full deliverables list, primary CTA, secondary $97 link. **Screenshot taken.**
- **Mobile 390px (rendered 375):** hero wraps cleanly, nav collapses to hamburger, no page-level horizontal overflow (`documentElement.scrollWidth` 376 vs 375 = 1px sub-pixel rounding). The tier-comparison table correctly **scrolls inside its own `overflow-x-auto` container** (the `$97` column clips at the container edge, page body does not scroll) — the required behavior. **Screenshot taken.**
- **Console errors:** `read_console_messages(onlyErrors)` → **none** on `/audit` at both viewports.
- **CTA → Stripe mapping (VERIFIED in rendered DOM):**
  - `Get My Mining Build Plan — $297` ×2 → `https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00`
  - `Start with the $97 audit` / `$97 Mining Deal Audit` ×2 → `https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01`
- **Credibility + methodology link (VERIFIED):** "8 years" credibility line present; `/how-we-verify` link present; FAQPage JSON-LD present; `id="pricing"` anchor present.

---

## 4. Affiliate disclosure — grep-verified, not assumed (VERIFIED)

Method: `grep -rln "abundantmines\|kaboomracks" app` **plus** tracing data-driven links (`affiliateLink` in `lib/data.ts`) and article-body links, **plus** confirming `website` vs `affiliateLink` in the data.

Key facts established:
- `abundant-miners` data: `website: https://abundantminers.com` (plain, non-commission) vs `affiliateLink: https://abundantmines.com/ref/72/` (the commission link). Only pages rendering the **`affiliateLink`** (or the literal ref URL) require disclosure.
- **Every page that renders an actual affiliate/commission link has an above-the-fold `<AffiliateDisclosure />`:** `hosting`, `hosts/[slug]` (conditional on `p.affiliateLink`), `hosts/abundant-miners`, `miners`, `miners/[slug]`, `financing`, `platform`, `hosting-match`, `best-bitcoin-mining-hosting`, all three `compare/*`, `deal-analyzer`, and the `university/[slug]` article template (conditional on the article body containing `abundantmines`/`kaboomracks`).
- **Correctly NOT carrying a disclosure (no commission link):** `hosts` (list) and `hosts/compare` link only to plain `website` / internal routes; `privacy` contains a prose disclosure itself; `disclosures` IS the policy page; `buy-bitcoin`'s exchange links are non-affiliate (disclosure present anyway, harmless).
- **Dead code note:** `components/HostingTable.tsx` renders an affiliate link but is imported by **no page** — never rendered live.
- **Rendered confirmation:** on a live article with affiliate links, the `/disclosures` disclosure element renders (VERIFIED in browser).

---

## 5. Internal linking — all 32 articles (VERIFIED)

- The brief said "12 articles"; `lib/articles.ts` actually contains **32**. All 32 covered.
- Static validator (`linkcheck.mjs`): **155 distinct literal internal hrefs** checked against **116 valid routes** (34 static + 32 articles + 24 hosts + 27 miners), including hrefs inside article HTML → **ZERO broken internal links.**
- Same-page anchors verified: `/audit#pricing` target `id="pricing"` exists; all 8 `#` anchors on `best-bitcoin-mining-hosting` resolve.
- **Rendered article check** (`is-bitcoin-mining-profitable-2026`): 7 cross-article links, 3 money-page links (`/audit`|`/hosting`), **0 self-links** — my self-link fix in `addInternalLinks()` works.
- Self-link fix: `addInternalLinks(content, currentSlug)` now skips injecting a link whose href equals the current article's own `/university/<slug>`.

---

## 6. Conversion ladder + secret scan

- **Ladder bridges (VERIFIED rendered):** `/review` shows "See the $97 Mining Deal Audit →"; `/calculator` shows "See Audit Options →" → `/audit#pricing`; `/deal-analyzer` shows a conditional $297 nudge (+ its own `<AffiliateDisclosure />`). `send-email.ts` confirmation email now cross-sells $297 to $97 (Standard) buyers; `POST_PURCHASE_UPSELL` email copy added in `email-sequences.ts`.
- **Secret scan of client bundle `.next/static` (VERIFIED):** bundle populated (32 JS chunks, 1.0 MB). Value-level check of each non-`NEXT_PUBLIC` secret against the bundle:
  - `SUPABASE_SERVICE_ROLE_KEY` — not in bundle ✓
  - `RESEND_API_KEY` — not in bundle ✓
  - `COINGECKO_API_KEY` — not in bundle ✓
  - `DAILY_CONTENT_SECRET` — not in bundle ✓
  - No Stripe secret key exists in this repo (payment links only; no `sk_`/`pk_` in bundle).
  - `NOTIFICATION_EMAIL` matched, but its `.env.local` value is the placeholder string `your@email.com`, which collides with the email input `placeholder` text — a false positive, not a credential. Only real reference is server-side (`app/api/leads/route.ts`).
  - **Result: no secrets leaked.**

---

## 6a. Stripe price resolution — objectively VERIFIED

Rendered both live payment links in a real browser (view-only; no data entered, Pay never clicked — no live keys touched, consistent with the test-mode/keys constraint):

- **$97 link** `https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01` → checkout shows **"Pay LMC MINING — US$97.00"**, line item "LMC Mining Audit — US$97.00", Subtotal US$97.00, **Total due US$97.00**. **Screenshot taken.**
- **$297 link** `https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00` → checkout shows **"Pay LMC MINING — US$297.00"**, line item "LMC Build Plan — US$297.00" (description: everything in Basic Audit, Section 179, financing, hardware), Subtotal US$297.00, **Total due US$297.00**. **Screenshot taken.**

Both links resolve to the correct price. The in-app preview browser could render Stripe on retry once the model-classifier outage (which had caused the earlier 300s navigation timeouts) cleared.

**Minor observation (not a blocker, out of scope):** the $97 Stripe product is titled "LMC Mining Audit" with a description reading "Monthly Bitcoin mining intelligence…", while the site copy calls it the "$97 Mining Deal Audit." The **price is correct**; only the Stripe-side product name/description differs from the on-site naming. Editing Stripe product config is outside this repo and the no-touch-Stripe constraint — flagged for the owner.

## 7. What I could NOT verify (honest gaps)

1. **Every-page-both-viewports screenshots.** I screenshotted `/audit` at both viewports (the deliverable's explicit requirement) and swept `/disclosures`, `/how-we-verify`, `/review`, `/calculator`, and one `/university` article at desktop with DOM/console checks. I did **not** capture mobile screenshots of every one of the ~13 disclosure pages or all 32 articles — I spot-checked structure/console instead of full visual review on those.
2. **Live email send.** The new `POST_PURCHASE_UPSELL` copy and the `send-email.ts` $297 cross-sell were verified as code and compile clean, but I did **not** trigger a real email send to confirm rendering in an inbox.
3. **CoinGecko 401 (pre-existing).** Live-price pages (`/calculator`, home, `/deal-analyzer`) log a server-side `CoinGecko error: 401` and fall back to a static price. This is an expired/invalid API key in `.env.local`, **not** part of this work and not fixable in code — flagged for the owner to rotate the key. `/audit` itself has no such error.

---

## 8. Done-conditions scorecard

| Done-condition | Status |
|----------------|--------|
| All six deliverables exist as committed files, none empty | ✅ VERIFIED |
| `/audit` zero console errors at 1440 + 390, screenshots taken | ✅ VERIFIED |
| Every affiliate-link page has above-the-fold disclosure (grep) | ✅ VERIFIED (grep + data-trace + rendered) |
| All 12 (actually 32) articles ≥2 outbound + ≥1 money-page link | ✅ VERIFIED |
| Zero broken internal links site-wide | ✅ VERIFIED (155 hrefs / 116 routes) |
| Both Stripe links resolve to correct price | ✅ VERIFIED — $97 link → US$97.00, $297 link → US$297.00 (rendered live, screenshots taken; see §6a) |
| No secrets in client bundle | ✅ VERIFIED (value-level scan) |
| Report lists what was checked AND skipped | ✅ (this document) |
