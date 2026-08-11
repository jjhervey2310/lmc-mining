import { MetadataRoute } from 'next'
import { MINERS_DATA, PROVIDERS_DATA } from '@/lib/data'
import { ARTICLES } from '@/lib/articles'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lightningmines.com'

// Honest lastModified dates. Never use build time (new Date()) — a sitemap that
// claims every page changed today is a credibility signal search engines discount.
// Static-page dates come from the last real content change (git history).
// Update the relevant date when a page's content actually changes.
const SITE_LAUNCH = '2026-06-16'
const CONTENT_PASS = '2026-07-14' // sitewide content/SEO pass
const MINER_DATA_UPDATED = '2026-07-14' // last change to MINERS_DATA in lib/data.ts

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: new Date('2026-08-11'), changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/calculator`, lastModified: new Date('2026-08-11'), changeFrequency: 'daily', priority: 0.98 },
    { url: `${BASE_URL}/hosting`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'weekly', priority: 0.95 },
    { url: `${BASE_URL}/hosting-costs`, lastModified: new Date('2026-08-11'), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/miners`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/university`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/review`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE_URL}/audit`, lastModified: new Date('2026-07-31'), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE_URL}/setup`, lastModified: new Date('2026-07-31'), changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE_URL}/tools`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE_URL}/about`, lastModified: new Date('2026-07-04'), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/how-we-verify`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/financing`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/glossary`, lastModified: new Date('2026-07-04'), changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE_URL}/scam-alerts`, lastModified: new Date('2026-07-04'), changeFrequency: 'weekly', priority: 0.75 },
    { url: `${BASE_URL}/privacy`, lastModified: new Date(SITE_LAUNCH), changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: new Date(SITE_LAUNCH), changeFrequency: 'yearly', priority: 0.2 },
    // Legacy pages preserved but lower priority
    { url: `${BASE_URL}/deal-analyzer`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'weekly', priority: 0.7 },
    // /hosts index canonicalizes to /hosting (see app/hosts/layout.tsx) — omitted here to avoid cannibalization.
    { url: `${BASE_URL}/data`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'daily', priority: 0.75 },
    { url: `${BASE_URL}/profitable`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/best-bitcoin-mining-hosting`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/compare/antminer-s21-xp-vs-s21-pro`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE_URL}/compare/abundant-mines-vs-compass-mining`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE_URL}/compare/home-mining-vs-hosted-mining`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE_URL}/miners/compare`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/hosts/compare`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/hosting-match`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE_URL}/alerts`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/mining-pools`, lastModified: new Date(CONTENT_PASS), changeFrequency: 'monthly', priority: 0.6 },
    // /wallet, /buy-bitcoin, /platform intentionally omitted: thin/duplicative
    // affiliate pages that dilute crawl budget on a zero-authority domain.
    // The pages still exist and are linked internally; they just aren't
    // nominated for indexing here.
  ]

  const minerPages: MetadataRoute.Sitemap = MINERS_DATA
    .filter(m => m.slug)
    .map(m => ({
      url: `${BASE_URL}/miners/${m.slug}`,
      lastModified: new Date(MINER_DATA_UPDATED),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  const hostPages: MetadataRoute.Sitemap = PROVIDERS_DATA
    .map(p => ({
      url: `${BASE_URL}/hosts/${p.id}`,
      lastModified: new Date(p.lastVerified || CONTENT_PASS),
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  const articlePages: MetadataRoute.Sitemap = ARTICLES.map(a => ({
    url: `${BASE_URL}/university/${a.slug}`,
    lastModified: new Date(a.dateModified),
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...minerPages, ...hostPages, ...articlePages]
}
