# Architecture & Technical Decisions

## Project Setup

### Next.js 16 (latest) with App Router
Using the latest Next.js release for best performance and App Router for server components, metadata API, and file-based routing. App Router was specified in the requirements.

### Tailwind CSS v4
The create-next-app template installed Tailwind v4. v4 uses `@import "tailwindcss"` instead of the v3 `@tailwind` directives and configures via CSS variables. All color tokens are defined in `globals.css` as CSS custom properties and referenced inline for clarity in components.

### No Geist font
Removed the default Geist font to avoid an external font request and reduce the bundle. Using system fonts (`-apple-system, BlinkMacSystemFont, 'Segoe UI'`) for body text and `'Courier New', Menlo, Monaco` for monospace numbers. This keeps the calculator fast and avoids layout shifts.

### Supabase for database
Using Supabase with the `@supabase/supabase-js` client. Two clients:
- `supabase` (anon key) for client-side read operations
- `createServiceClient()` (service role key) for server-side write operations in API routes only

Row Level Security is enabled on all tables. Public read is allowed on `miners`, `hosting_providers`, and displayed `testimonials`. Inserts to `leads`, `affiliate_clicks`, and `analytics_events` require the service role key (only available server-side).

---

## Data Integrity Decisions

### Hosting provider data
All 6 hosting providers (Abundant Miners + 5 additional) are sourced from their official public websites. Pricing is marked `contact_required` for all providers except Abundant Miners, which publicly lists $225/month for air cooling.

Deposit and contract data for Compass Mining, Core Scientific, Blockware Solutions, Sabre56, and Bit5ive are marked `deposit_status = unverified` and `contract_status = unverified` because this information was not publicly available from their official websites at time of verification.

No affiliate commission rates are fabricated. Only Abundant Miners has `affiliate_program_available = true` because the others did not publicly confirm affiliate programs at verification time.

### Miner database
Air-cooled miners (10 models): specs sourced from Bitmain and Canaan official product pages. All marked `spec_confidence = verified`.

Hydro miners: Antminer S21 Pro Hydro, S21 Hydro, S19 XP Hydro, S19 Pro+ Hydro specs confirmed from Bitmain product sheets (marked verified). Whatsminer M63S Hydro marked `pending_verification` as exact revision specs need manufacturer confirmation.

Immersion miners: Three records (S19 XP Immersion, M50S++ Immersion, S21 Pro Immersion) marked `pending_verification` as manufacturer-specified immersion configurations are not publicly documented in the same detail as air-cooled models. Power estimates reflect typical immersion efficiency gains but are not manufacturer-confirmed exact values.

---

## Calculator Logic

### Difficulty formula
`daily_btc_mined = (hashrate_Hs * 86400 * block_reward) / (difficulty * 2^32)`

Uses the standard Bitcoin mining formula where `hashrate_Hs` is in hashes/second. Hashrate input is in TH/s, converted by multiplying by 1e12.

### Block reward
Set to `3.125 BTC` (post-April 2024 halving). This is hardcoded in `lib/constants.ts` and will need updating after the next halving (~2028).

### Network difficulty fallback
If blockchain.info API is unavailable, uses a static fallback value with a disclosure note in the API response. The static value is updated in `app/api/btc-price/route.ts` and should be updated biweekly.

### Price caching
Bitcoin price and network difficulty are cached in-memory for 10 minutes (as required). On failure, the last cached value is returned with a stale warning shown to users.

---

## UI/UX Decisions

### Cooling type as first-class input
Cooling type filter is the first element in the calculator, above the miner dropdown. This matches the product vision of making air/hydro/immersion a primary dimension rather than an afterthought.

### Abundant Miners grayed out for hydro/immersion
When a hydro or immersion miner is selected, Abundant Miners appears in the provider dropdown but is visually de-emphasized with a note that hydro/immersion is coming ~2027. This is factual and prevents users from mistakenly selecting an incompatible provider.

### No recommendation for unprofitable setups
The calculator shows a red warning when a configuration is currently unprofitable. The `never recommend a mining setup that loses money` constraint is enforced by never showing a CTA for the setup, and by displaying the negative profit clearly with warning styling.

---

## Phase Implementation Order

- **Phase 1**: Project init, database schema, seed data, file structure, env config ✓
- **Phase 2**: BTC price API, difficulty API, analytics tracking ✓
- **Phase 3**: Homepage calculator, hosting comparison table ✓
- **Phase 4**: /review deal form, /hosting-match form, lead API with entity extraction ✓
- **Phase 5**: /audit page with Stripe payment links ✓
- **Phase 6**: Email capture footer component, lead magnet HTML ✓
- **Phase 7**: Affiliate click tracking (track-click API + lib/affiliate.ts) ✓
- **Phase 8**: sitemap.ts, robots.ts, Open Graph metadata, structured data (Organization, FAQ, WebApplication) ✓
- **Phase 9**: TypeScript check, build verification, Vercel deployment prep ✓

---

## Deployment Notes

### Required environment variables before going live
See `.env.example` for all required variables. Critical ones to set:
1. `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` — from Supabase project settings
2. `SUPABASE_SERVICE_ROLE_KEY` — from Supabase project settings (never expose to browser)
3. `NEXT_PUBLIC_SITE_URL` — production URL (used for sitemap and OG tags)
4. `RESEND_API_KEY` and `NOTIFICATION_EMAIL` — for lead email notifications
5. `ABUNDANT_MINERS_AFFILIATE_URL` — from Abundant Miners affiliate dashboard

### Supabase setup
1. Create a new Supabase project
2. Run `supabase/schema.sql` in the SQL editor
3. Run `supabase/seed.sql` in the SQL editor
4. Copy the project URL and keys to `.env.local`

### Vercel deployment
Standard Next.js deployment. Add all environment variables in Vercel project settings. The `NEXT_PUBLIC_*` variables are exposed to the browser — all others are server-only.
