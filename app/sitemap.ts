import { MetadataRoute } from 'next'
import { MINERS_DATA, PROVIDERS_DATA } from '@/lib/data'
import { ARTICLES } from '@/lib/articles'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.lightningmines.com'
const NOW = new Date()

export default function sitemap(): MetadataRoute.Sitemap {
  const staticPages: MetadataRoute.Sitemap = [
    { url: BASE_URL, lastModified: NOW, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/calculator`, lastModified: NOW, changeFrequency: 'daily', priority: 0.98 },
    { url: `${BASE_URL}/hosting`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.95 },
    { url: `${BASE_URL}/miners`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/university`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.9 },
    { url: `${BASE_URL}/review`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE_URL}/audit`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.85 },
    { url: `${BASE_URL}/tools`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE_URL}/about`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/how-we-verify`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE_URL}/financing`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.7 },
    { url: `${BASE_URL}/glossary`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.65 },
    { url: `${BASE_URL}/scam-alerts`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.75 },
    { url: `${BASE_URL}/privacy`, lastModified: NOW, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${BASE_URL}/terms`, lastModified: NOW, changeFrequency: 'yearly', priority: 0.2 },
    // Legacy pages preserved but lower priority
    { url: `${BASE_URL}/deal-analyzer`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/hosts`, lastModified: NOW, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/data`, lastModified: NOW, changeFrequency: 'daily', priority: 0.75 },
    { url: `${BASE_URL}/profitable`, lastModified: NOW, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/best-bitcoin-mining-hosting`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.8 },
    { url: `${BASE_URL}/compare/antminer-s21-xp-vs-s21-pro`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE_URL}/compare/abundant-mines-vs-compass-mining`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.75 },
    { url: `${BASE_URL}/compare/home-mining-vs-hosted-mining`, lastModified: NOW, changeFrequency: 'monthly', priority: 0.75 },
  ]

  const minerPages: MetadataRoute.Sitemap = MINERS_DATA
    .filter(m => m.slug)
    .map(m => ({
      url: `${BASE_URL}/miners/${m.slug}`,
      lastModified: NOW,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  const hostPages: MetadataRoute.Sitemap = PROVIDERS_DATA
    .map(p => ({
      url: `${BASE_URL}/hosts/${p.id}`,
      lastModified: NOW,
      changeFrequency: 'weekly' as const,
      priority: 0.8,
    }))

  const articlePages: MetadataRoute.Sitemap = ARTICLES.map(a => ({
    url: `${BASE_URL}/university/${a.slug}`,
    lastModified: NOW,
    changeFrequency: 'monthly' as const,
    priority: 0.7,
  }))

  return [...staticPages, ...minerPages, ...hostPages, ...articlePages]
}
