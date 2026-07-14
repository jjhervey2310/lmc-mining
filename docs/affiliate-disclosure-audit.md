# Affiliate Disclosure Audit — Lightning Mines

**Date:** 2026-07-14
**Scope:** FTC "clear and conspicuous" affiliate disclosure on every page carrying an
Abundant Mines (`abundantmines.com`) or Kaboomracks (`kaboomracks.com`) affiliate link.
**Method:** grep-verified, not assumed. Command used:

```
grep -rln "abundantmines\|kaboomracks" app
```

Plus data-driven links resolved from `lib/data.ts` (`affiliateLink` field) and article
bodies in `lib/articles.ts` (rendered via `app/university/[slug]`).

---

## What changed

1. **`components/AffiliateDisclosure.tsx`** — Rewritten for FTC prominence. Old version was
   low-contrast (`#6b7280` text, gray border) and easy to miss. New version: solid orange
   `#f7931a` border, `rgba(247,147,26,0.10)` background, `#e5e7eb` body text (WCAG-legible),
   `text-sm` (up from `text-xs`), a flag glyph, and a link to the new `/disclosures` policy.
   Still a pure server component — no `'use client'`, no hooks.
2. **`app/disclosures/page.tsx`** — NEW standalone full disclosure policy (FTC-style), with a
   `Metadata` export and `alternates.canonical = '/disclosures'`.
3. Disclosure added/repositioned **above the fold** on every owned affiliate-carrying page.

---

## Audit table — every page in the site that carries an affiliate link

Legend for "Before": **yes** = compliant above-the-fold disclosure already present ·
**too-low** = a disclosure existed but sat below the first affiliate link (or was a weak,
low-contrast variant) · **no** = none.

| Page | Affiliate link source | Before | After | Fix owner |
|------|----------------------|--------|-------|-----------|
| `app/best-bitcoin-mining-hosting/page.tsx` | abundantmines (direct) | no | yes | **me** |
| `app/platform/page.tsx` | abundantmines (direct) | no | yes | **me** |
| `app/compare/home-mining-vs-hosted-mining/page.tsx` | abundantmines (direct) | no | yes | **me** |
| `app/compare/abundant-mines-vs-compass-mining/page.tsx` | abundantmines (direct) | too-low (weak low-contrast pill only) | yes (pill replaced with standard component) | **me** |
| `app/compare/antminer-s21-xp-vs-s21-pro/page.tsx` | abundantmines (direct) | no | yes | **me** |
| `app/miners/[slug]/page.tsx` | kaboomracks (direct) | no | yes | **me** |
| `app/hosting-match/page.tsx` | abundantmines (direct, quiz results) | no | yes | **me** |
| `app/hosts/abundant-miners/page.tsx` | abundantmines (direct) | too-low (disclosure sat *below* the hero CTA button) | yes (added above CTA) | **me** |
| `app/hosting/page.tsx` | abundantmines via `affiliateLink` data | yes (already above fold) | yes | **me** (verified) |
| `app/hosts/[slug]/page.tsx` | abundantmines via `p.affiliateLink` (abundant-miners provider) | no | yes (conditional: only when `p.affiliateLink` exists) | **me** |
| `app/university/[slug]/page.tsx` (article template) | abundantmines/kaboomracks in article body (`lib/articles.ts`) | no | yes (conditional: only when body contains an affiliate link) | **me** |
| `app/deal-analyzer/page.tsx` | abundantmines (direct, `AFFILIATE_URL`) | yes (disclosure L240 sits above affiliate link L459) | yes | **other agent** (already compliant) |
| `app/buy-bitcoin/page.tsx` | exchange links (river/coinbase/kraken — **plain, non-affiliate**); no AM/Kaboom link | yes (disclosure already above fold) | yes | **me** (no change needed) |
| `app/financing/page.tsx` | internal links to `/hosts/abundant-miners` only (no direct outbound affiliate) | yes (disclosure already above fold) | yes | **me** (no change needed) |
| `app/miners/page.tsx` | internal links to `/miners/[slug]` only (no direct outbound affiliate) | yes (disclosure already above fold) | yes | **me** (no change needed) |

---

## Affiliate references found that are NOT affiliate CTAs (no on-page banner required)

| Page | Note | Owner |
|------|------|-------|
| `app/privacy/page.tsx` | grep hit is prose inside the privacy policy ("Our primary affiliate relationship is with Abundant Miners…"), **not** a clickable affiliate link. This *is itself* a disclosure. No banner needed. | not in my ownership list — left untouched |

## Pages confirmed to carry NO affiliate links

Grep-verified clean (no `abundantmines`/`kaboomracks`, owned by other agents, excluded from my edits):

- `app/review/**` — none
- `app/audit/**` — none

---

## Notes / honesty flags

- **`app/buy-bitcoin/page.tsx`** already imported `AffiliateDisclosure` and displays it above
  the fold, but its outbound exchange links (`river.com`, `coinbase.com`, `kraken.com`) are
  **plain URLs with no affiliate ref params** — so it currently carries no Abundant Mines /
  Kaboomracks link. The disclosure is retained (harmless and future-proof). Not counted as a
  required fix.
- **`app/financing/page.tsx`** and **`app/miners/page.tsx`** link only *internally* to pages
  that themselves carry affiliate links. They already showed the disclosure above the fold; left
  as-is.
- **`app/deal-analyzer/page.tsx`** is owned by another agent and was already compliant
  (disclosure precedes the affiliate link in document order). Listed for completeness only —
  not edited.
- `hosts/[slug]` and `university/[slug]` disclosures are **conditional** so the "this page
  contains affiliate links" statement stays truthful on provider/article variants that have no
  affiliate link.

## Files I changed

- `components/AffiliateDisclosure.tsx` (rewrite)
- `app/disclosures/page.tsx` (new)
- `app/best-bitcoin-mining-hosting/page.tsx`
- `app/platform/page.tsx`
- `app/compare/home-mining-vs-hosted-mining/page.tsx`
- `app/compare/abundant-mines-vs-compass-mining/page.tsx`
- `app/compare/antminer-s21-xp-vs-s21-pro/page.tsx`
- `app/miners/[slug]/page.tsx`
- `app/hosting-match/page.tsx`
- `app/hosts/abundant-miners/page.tsx`
- `app/hosts/[slug]/page.tsx`
- `app/university/[slug]/page.tsx`
- `docs/affiliate-disclosure-audit.md` (this file)

Not touched (already compliant, verified only): `app/hosting/page.tsx`,
`app/buy-bitcoin/page.tsx`, `app/financing/page.tsx`, `app/miners/page.tsx`.
