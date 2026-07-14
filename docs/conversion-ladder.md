# Conversion Ladder — Map & Gap Analysis

Revenue ladder: **FREE readers → $97 "Mining Deal Audit" → $297 "Mining Build Plan / Deep Dive"**

Stripe links (do not change):
- $97 Standard Audit — `https://buy.stripe.com/fZuaEYdeQaSEfw08kAf7i01`
- $297 Deep Dive — `https://buy.stripe.com/6oU8wQfmY2m86Zu7gwf7i00`

The two questions this audit answers:
- **(a) Where does a $97 buyer get shown the $297 tier?**
- **(b) Where does a free reader get shown the $97 tier?**

"Next rung shown?" = does that surface point the visitor at the next paid step.
Owner legend: **[me]** = closed in this workstream · **D1** = /audit rebuild agent ·
**D3** = articles agent · **OPEN** = gap not in my file ownership.

---

## Rung 1 — FREE → $97

| # | Free surface | File | $97 shown before? | $97 shown now? | Owner / action |
|---|--------------|------|:---:|:---:|----------------|
| 1 | Homepage / landing | `app/LandingShell.tsx` | Y | Y | Links to `/audit`. No change needed. |
| 2 | Navbar (sitewide) | `components/Navbar.tsx` | Y | Y | `/audit` link. No change needed. |
| 3 | Sticky mobile CTA (sitewide) | `components/StickyMobileCTA.tsx` | Y | Y | Free `/deal-analyzer` + paid `/audit`. No change needed. |
| 4 | University articles | `lib/articles.ts` | Y | Y | In-body `/audit` links (28 refs). **Covered by D3.** |
| 5 | **Free Deal Review** | `app/review/page.tsx` | Weak (one small footer link) | **Y — strong** | **[me]** Added a prominent "Next step" bridge card: free-vs-$97 comparison, primary CTA to `/audit`, plus a line pointing larger/financed deals at the $297 Deep Dive. |
| 6 | Deal Analyzer results | `app/deal-analyzer/page.tsx` | Y | Y | Pre-existing conditional $97 CTA (risk vs. peace-of-mind variants). No change needed. |
| 7 | Nurture email #4 (day 7) | `lib/email-sequences.ts` `EMAIL4` | Y | Y | Dedicated $97 pitch w/ guarantee + scarcity. No change needed. |
| 8 | Nurture email #5 (day 14) | `lib/email-sequences.ts` `EMAIL5` | Y | Y | Case-study email ends with a "have Jacob review your deal" $97 CTA. No change needed. |
| 9 | Deal-analysis result email | `lib/send-email.ts` `sendDealAnalysisEmail` | Y | Y | $97 CTA (risk / peace-of-mind variants). Not my file; already correct. |
| 10 | **Profitability calculator** | `app/calculator/page.tsx` | **N** | **N** | **OPEN.** Calculator links to `/review`, `/hosting`, `/miners` — never to `/audit` or the $97 tier. Only indirect via navbar/sticky CTA. Not in my ownership. **Owner: calculator-page owner** — add an `/audit` next-step card. |

**Rung 1 result:** the only remaining gap is the calculator page (#10). Every other free surface now shows the $97 rung; `/review` (#5) was the weakest and is now closed.

---

## Rung 2 — $97 → $297

| # | $97 touchpoint | File | $297 shown before? | $297 shown now? | Owner / action |
|---|----------------|------|:---:|:---:|----------------|
| 1 | **/audit pricing page** | `app/audit/*` | (rebuild in flight) | Y | **Covered by D1** — page rebuilt to show BOTH tiers, $297 anchored, $97 secondary. Primary on-site $97↔$297 bridge. |
| 2 | **Deal Analyzer results** | `app/deal-analyzer/page.tsx` | **N** (only $97) | **Y** | **[me]** Added a $297 Deep Dive bridge block that appears for **high-budget/complex deals** (hardware ≥ $10k, financing used, or contract ≥ 24 mo). Direct $297 Stripe CTA + "compare both tiers" → `/audit#pricing`, with a fallback line pointing unsure buyers back to the $97 audit. |
| 3 | Nurture email #4 (day 7) | `lib/email-sequences.ts` `EMAIL4` | Y | Y | Already shows $97 primary + $297 Deep Dive ghost CTA. No change needed. |
| 4 | **Post-purchase upsell (after $97 booking)** | `lib/email-sequences.ts` `POST_PURCHASE_UPSELL` | **N — did not exist** | **Partial** | **[me]** Added a new `POST_PURCHASE_UPSELL` email: confirms the Standard Audit, then bridges to the $297 Deep Dive for multi-machine/financed/multi-year buyers ("I'll roll your $97 into it"). **Copy is done; wiring is OPEN** — `lib/send-email.ts` (not my file) must import it and fire it from the audit-booking flow when tier = Standard. **Owner: send-email owner.** |
| 5 | Audit confirmation email | `lib/send-email.ts` `sendAuditConfirmationEmail` | **N** | **N** | **OPEN.** Confirmation email shows only the tier the buyer picked; no cross-sell from $97 → $297. Not my file. **Owner: send-email owner** — add a $297 upgrade line for Standard-tier confirmations (or fire `POST_PURCHASE_UPSELL`). |

**Rung 2 result:** the on-site bridge (D1 `/audit`) and the analyzer nudge (#2, mine) cover the browsing path. The **email post-purchase path is the remaining gap**: I wrote the upsell copy (#4) but it must be wired in `send-email.ts`, and the confirmation email (#5) still doesn't cross-sell. Both live in a file I don't own.

---

## Gaps I closed (in my files)

1. **`/review` free→$97 bridge** — added a full comparison card ("Next step: free verdict vs. $97 audit") with a primary `/audit` CTA. Previously only a one-line grey footer link.
2. **Deal Analyzer $97→$297 nudge** — added a Deep Dive bridge that triggers on high-budget/financed/long-contract deals, which otherwise only ever saw the $97 CTA.
3. **Post-purchase $97→$297 email copy** — new `POST_PURCHASE_UPSELL` export in `email-sequences.ts` (voice-matched to BRAND.md: calm, numbers-first, no hype, honest "don't upgrade if you don't need it").
4. **Affiliate disclosure on `/deal-analyzer`** — page carries the `abundantmines.com/ref/72/` affiliate link but had no `<AffiliateDisclosure />`; added it above the fold (imported from `@/components/AffiliateDisclosure`).

## Gaps left open (not in my file ownership)

| Gap | File | Suggested owner |
|-----|------|-----------------|
| Calculator has no `/audit` / $97 next-step CTA | `app/calculator/page.tsx` | calculator-page owner |
| `POST_PURCHASE_UPSELL` is written but not sent | `lib/send-email.ts` | send-email owner (add `sendPostPurchaseUpsellEmail()` + fire on $97 booking) |
| Audit confirmation email doesn't cross-sell $297 | `lib/send-email.ts` `sendAuditConfirmationEmail` | send-email owner |

## Notes / dependencies

- The primary on-site $97↔$297 bridge is the **/audit** rebuild (**D1**) — everything I built links into `/audit#pricing` rather than duplicating tier-comparison UI.
- The primary free→$97 in-content path is **university article** in-body `/audit` links (**D3**) — already live in `lib/articles.ts`.
- BRAND.md's "one CTA" rule is respected: each new block leads with a single primary action and treats the alternate tier as a secondary/ghost option, not a competing shout.
