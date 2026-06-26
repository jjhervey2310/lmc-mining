# Lightning Mines — Architecture & Build Decisions

## Brand
- **Brand name:** Lightning Mines (previously LMC Mining Intelligence)
- **Domain:** lightningmines.com
- **Site URL env:** NEXT_PUBLIC_SITE_URL=https://lightningmines.com
- **Accent color:** #f7931a (Bitcoin orange, replacing amber #f59e0b)
- **Background:** #0a0a0a (replacing #0a0e17)
- **Card background:** #111111 (replacing #111827)
- **Border color:** #222222 (replacing #1f2937)

## Routing
- `/calculator` — new dedicated ROI calculator page (wraps existing Calculator component)
- `/hosting` — new hosting comparison table (separate from existing `/hosts` which is preserved)
- `/miners` — updated to table format with ROI button linking to `/calculator?miner={id}`
- `/university` — rebuilt with 8 category cards + 12 required article slugs
- `/tools` — new affiliate links page (Kraken + Koinly)
- `/review` — updated with new fields per spec
- `/audit` — updated to $97 Mining Deal Audit + $297 Mining Build Plan (Stripe links are placeholders)
- `/about` — completely rewritten with mission, affiliate transparency, no-fabricated-data policy
- Legacy pages (`/hosts`, `/deal-analyzer`, `/data`, `/miners/[slug]`, etc.) preserved but not in main nav

## Navigation
- New nav: Home, Calculator, Hosting, Miners, University, Audit, Tools + "Free Review" CTA button
- Legacy routes excluded from nav per spec ("hide broken test or duplicate routes")

## University Articles
- Added 12 new articles with required slugs to lib/articles.ts (appended to existing ARTICLES array)
- Article page at `/university/[slug]` handles both old and new slugs via `getArticleBySlug`
- Article page branding updated to Lightning Mines

## Hosting Verification
- Only Abundant Mines is marked "Verified" — all others are "Pending Verification"
- No fabricated pricing numbers for unverified providers
- Abundant Mines affiliate URL: https://abundantmines.com (real URL TBD with affiliate link)

## Affiliate Links
- Kraken: https://invite.kraken.com/JDNW/3cpjgj5j
- Koinly: https://koinly.io/?via=2AB53CDA
- Both clearly disclosed on /tools page

## Stripe
- Audit page uses placeholder Stripe URLs (`https://buy.stripe.com/placeholder-97` and `placeholder-297`)
- Owner must replace with real Stripe payment links

## What Was NOT Changed
- Vercel config (vercel.json)
- Supabase connection (lib/supabase.ts)
- Resend setup (lib/send-email.ts)
- API routes (/api/*)
- .env variables or next.config.ts ESLint/TypeScript ignore flags
- Existing /hosts, /deal-analyzer, /data, /financing, /glossary, /alerts pages (preserved, accessible)
