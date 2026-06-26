# Lightning Mines — Launch Checklist

## Build Status
- [x] `npm run build` passes clean — 94 pages, 0 TypeScript errors, 0 compile errors

## Pages Built
- [x] `/` — Homepage with hero, trust bar, ROI preview, hosting preview, how we help, mistakes, university preview, email capture, final CTA
- [x] `/calculator` — Dedicated ROI calculator page with full Calculator component, FAQ schema, breadcrumb schema
- [x] `/hosting` — Hosting comparison table: Abundant Mines (Verified #1 PICK), 4 others (Pending Verification)
- [x] `/miners` — Comparison table with hashrate, power, J/TH, cooling, price, ROI button linking to `/calculator?miner={id}`
- [x] `/university` — 8 category cards + all 12 article links
- [x] `/university/what-is-bitcoin-mining` ✓
- [x] `/university/is-bitcoin-mining-profitable` ✓
- [x] `/university/hosted-bitcoin-mining-explained` ✓
- [x] `/university/how-to-calculate-bitcoin-mining-roi` ✓
- [x] `/university/bitcoin-mining-electricity-costs` ✓
- [x] `/university/best-bitcoin-miners-for-beginners` ✓
- [x] `/university/bitcoin-mining-hosting-red-flags` ✓
- [x] `/university/asic-miner-efficiency-explained` ✓
- [x] `/university/mining-pool-fees-explained` ✓
- [x] `/university/home-mining-vs-hosted-mining` ✓
- [x] `/university/bitcoin-mining-tax-basics` ✓
- [x] `/university/how-to-avoid-bad-mining-deals` ✓
- [x] `/review` — Lead form: Name, Email, Miner model, Number of miners, Purchase price, Hosting provider, Hosting cost, Contract length, Setup fee, Question
- [x] `/audit` — $97 Mining Deal Audit + $297 Mining Build Plan with deliverables
- [x] `/about` — Mission, affiliate transparency, no-fabricated-data policy, educational purpose
- [x] `/tools` — Kraken (affiliate) + Koinly (affiliate), clearly labelled

## Navigation
- [x] Header: Home, Calculator, Hosting, Miners, University, Audit, Tools + "Free Review" orange CTA
- [x] Footer: All main nav links, University category links, affiliate disclosure, legal disclaimer, contact, privacy/terms
- [x] Mobile hamburger menu functional

## SEO
- [x] Metadata on all pages (title, description, OG, Twitter card)
- [x] FAQPage schema on /calculator, /hosting, /audit, /university/[slug]
- [x] Article schema on university article pages
- [x] BreadcrumbList schema on all pages
- [x] EducationalOrganization schema on /university
- [x] Organization schema on /about
- [x] /sitemap.xml — updated with all new routes
- [x] /robots.txt — exists
- [x] Internal linking throughout (articles link to /calculator, /hosting, /review, /audit)

## Design
- [x] Background #0a0a0a
- [x] Bitcoin orange accent #f7931a
- [x] Card background #111111
- [x] Border #222222
- [x] Mobile-first responsive layout

## ⚠ Owner Action Required Before Launch

### Critical
- [ ] **Supabase:** Create project → run supabase/v2-migration.sql → add env vars to Vercel dashboard
- [ ] **Resend:** Configure sender domain → verify email flows work (review form, email capture)
- [ ] **Abundant Mines affiliate URL:** Replace `https://abundantmines.com` with real affiliate tracking URL in:
  - `app/page.tsx` (hosting preview section)
  - `app/hosting/page.tsx` (top pick + table)
- [ ] **Stripe payment links:** Replace placeholders in `app/audit/page.tsx`:
  - `https://buy.stripe.com/placeholder-97` → real $97 Stripe payment link
  - `https://buy.stripe.com/placeholder-297` → real $297 Stripe payment link
- [ ] **NEXT_PUBLIC_SITE_URL:** Set to `https://lightningmines.com` in Vercel environment variables

### Nice-to-Have
- [ ] Update `/api/og` route to use Lightning Mines branding
- [ ] Update `components/TickerBar.tsx` to use Lightning Mines brand colors
- [ ] Update `components/EmailCapture.tsx` to use NEXT_PUBLIC_EMAIL_FORM_URL if using Mailchimp/ConvertKit
- [ ] Add Google Analytics 4 ID and Clarity Project ID to `components/CookieConsent.tsx`
- [ ] Verify Abundant Mines affiliate link is working and tracked
- [ ] Test review form end-to-end (submits to Supabase + sends Resend email)
- [ ] Add privacy policy content to `/privacy`
- [ ] Add terms of service content to `/terms`
- [ ] Submit sitemap to Google Search Console after domain is live

## Files Changed This Session
- `lib/constants.ts` — brand name, site URL, colors
- `app/globals.css` — CSS variables updated (#0a0a0a bg, #f7931a accent)
- `components/Navbar.tsx` — complete rewrite with new nav links
- `app/layout.tsx` — complete rewrite with new footer, metadata, brand
- `app/page.tsx` — complete rewrite of homepage
- `app/calculator/page.tsx` — new page
- `app/hosting/page.tsx` — new page
- `app/miners/page.tsx` — complete rewrite as table
- `app/university/page.tsx` — complete rewrite with 8 category cards
- `app/university/[slug]/page.tsx` — brand updates, CTA updates
- `app/review/page.tsx` — updated fields per spec
- `app/audit/page.tsx` — rewritten with $97/$297 tiers
- `app/about/page.tsx` — complete rewrite
- `app/tools/page.tsx` — new page
- `lib/articles.ts` — 12 new articles appended
- `lib/affiliates.ts` — TypeScript fix
- `app/sitemap.ts` — updated with new routes
- `app/audit/layout.tsx` — updated metadata
- `DECISIONS.md` — created
- `LAUNCH_CHECKLIST.md` — created
