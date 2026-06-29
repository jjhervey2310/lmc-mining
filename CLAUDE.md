# Lightning Mines — Claude Code Context

## Stack
- Next.js 14 App Router / TypeScript / Tailwind v4
- Supabase (project ID: bngwwalucfirmcymqall) — DB + auth
- Resend — transactional email
- Stripe — audit bookings ($97 Standard, $297 Deep Dive)
- Vercel — deployment (project: jacob-hervey-s-projects/lmc-mining)
- Cloudflare — DNS
- GitHub repo: jjhervey2310/lmc-mining (PAT embedded in remote URL)
- Local path: /Users/jacobslaptop/Desktop/lmc-mining

## Hard Rules — Never Touch Without Explicit Instruction
- NEVER modify vercel.json, next.config.ts, or any Cloudflare/DNS config
- NEVER change Supabase project ID or connection strings in .env.local
- NEVER alter Stripe price IDs or webhook endpoints
- NEVER push to main without running `npm run build` first — must be clean
- NEVER modify lib/types.ts HostingProvider or Miner interfaces without confirming schema impact across all consumers

## Data Architecture
- Static fallback: lib/data.ts (MINERS_DATA, PROVIDERS_DATA, GLOSSARY_TERMS)
- DB: Supabase tables mirror lib/types.ts — mapDbRow() in app/api/providers/route.ts handles snake_case → camelCase
- HostingProvider.id = slug string (e.g. 'abundant-mines') — NOT a numeric ID
- listingStatus: 'active' | 'flagged' | 'removed' — controls public visibility
- warningFlag: string | null — renders red banner on provider detail + compare pages

## Key URLs (live)
- Site: https://lightningmines.com
- Affiliate: https://abundantmines.com/ref/72/
- Stripe audit booking: /audit page (Stripe links — verify before touching)

## Open Items (do not mark resolved without testing)
- Supabase migration: DB may still use old schema — verify before any DB writes
- Resend welcome sequence: email flow needs end-to-end test
- NEXT_PUBLIC_SITE_URL: confirm set in Vercel env vars
- /audit page: Stripe placeholder links need verification

## Conventions
- All provider pages: /hosts/[id] where id = HostingProvider.id slug
- Miner pages: /miners/[slug]
- Components in components/ — no barrel index files
- Tailwind only — no inline styles, no CSS modules
- Git commits: imperative tense, one line ("Add Bitkern provider entry")
