import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ARTICLES, getArticleBySlug } from '@/lib/articles'
import type { Metadata } from 'next'
import ArticleEmailCapture from '@/components/ArticleEmailCapture'

export async function generateStaticParams() {
  return ARTICLES.map(a => ({ slug: a.slug }))
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) return {}
  return {
    title: article.title,
    description: article.meta_description,
    alternates: { canonical: `/university/${slug}` },
    openGraph: {
      title: article.title,
      description: article.meta_description,
      type: 'article',
      images: [{ url: `/api/og?title=${encodeURIComponent(article.title)}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image' as const,
      images: [`/api/og?title=${encodeURIComponent(article.title)}`],
    },
  }
}

function addInternalLinks(content: string): string {
  const LINKS: [string, string][] = [
    // Money pages — high priority
    ['profitability audit', '/audit'],
    ['mining audit', '/audit'],
    ['deal analyzer', '/deal-analyzer'],
    ['ROI calculator', '/calculator'],
    ['mining calculator', '/calculator'],
    ['free deal review', '/review'],
    ['hosting provider', '/hosting'],
    ['compare hosting', '/hosting'],
    // Miner pages
    ['Antminer S21 Pro', '/miners/antminer-s21-pro'],
    ['Antminer S21 XP', '/miners/antminer-s21-xp'],
    ['Whatsminer M60S', '/miners/whatsminer-m60s'],
    // Host pages
    ['Abundant Mines', '/hosts/abundant-miners'],
    ['Abundant Miners', '/hosts/abundant-miners'],
    // Cross-article links
    ['network difficulty', '/university/what-is-network-difficulty'],
    ['difficulty adjustment', '/university/what-is-network-difficulty'],
    ['Bitcoin halving', '/university/bitcoin-halving-effect-on-mining'],
    ['2028 halving', '/university/bitcoin-halving-effect-on-mining'],
    ['Section 179', '/university/bitcoin-mining-taxes'],
    ['mining taxes', '/university/bitcoin-mining-taxes'],
    ['hashprice', '/university/what-is-hashprice'],
    ['mining pool', '/university/mining-pool-comparison'],
    ['immersion cooling', '/university/air-vs-hydro-vs-immersion-cooling'],
    ['hydro cooling', '/university/air-vs-hydro-vs-immersion-cooling'],
    ['air cooling', '/university/air-vs-hydro-vs-immersion-cooling'],
    ['profitability calculator', '/university/how-to-calculate-bitcoin-mining-profitability'],
    ['breakeven price', '/university/mining-breakeven-calculator'],
    ['hosting contract', '/university/mining-contract-red-flags'],
    ['red flags', '/university/mining-contract-red-flags'],
    ['mining financing', '/university/mining-financing-options'],
    ['home mining', '/university/hosted-vs-home-mining'],
    ['hosted mining', '/university/hosted-vs-home-mining'],
    ['beginners', '/university/bitcoin-mining-for-beginners'],
    ['mining at scale', '/university/mining-at-scale'],
    ['Antminer vs Whatsminer', '/university/antminer-vs-whatsminer'],
    ['future of Bitcoin mining', '/university/future-of-bitcoin-mining'],
    ['S21 Pro review', '/university/antminer-s21-pro-review'],
  ]
  for (const [phrase, href] of LINKS) {
    if (content.includes(`href="${href}"`)) continue
    const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    let replaced = false
    content = content.replace(
      new RegExp(`(<a[^>]*>[\\s\\S]*?<\\/a>)|${escaped}`, 'gi'),
      (match, existingLink) => {
        if (existingLink) return existingLink
        if (replaced) return match
        replaced = true
        return `<a href="${href}" class="text-[#00d4aa] hover:underline">${match}</a>`
      }
    )
  }
  return content
}

const CATEGORY_COLORS: Record<string, string> = {
  Profitability: '#00d4aa',
  Hardware: '#3d7aed',
  'Hardware Reviews': '#3d7aed',
  Hosting: '#a855f7',
  Finance: '#fbbf24',
  Education: '#00d4aa',
  Operations: '#f97316',
  Industry: '#ec4899',
}

export default async function ArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const article = getArticleBySlug(slug)
  if (!article) notFound()

  const related = ARTICLES.filter(a => a.slug !== slug && (a.category === article.category || a.tags.some(t => article.tags.includes(t)))).slice(0, 3)

  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.meta_description,
    datePublished: article.datePublished,
    dateModified: article.dateModified,
    author: { '@type': 'Person', name: 'Jacob H.', jobTitle: 'Founder', worksFor: { '@type': 'Organization', name: 'Lightning Mines' } },
    publisher: { '@type': 'Organization', name: 'Lightning Mines' },
    keywords: article.tags.join(', '),
    articleSection: article.category,
    timeRequired: `PT${article.reading_time_minutes}M`,
  }

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: article.faqs.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://lightningmines.com' },
      { '@type': 'ListItem', position: 2, name: 'Mining University', item: 'https://lightningmines.com/university' },
      { '@type': 'ListItem', position: 3, name: article.title, item: `https://lightningmines.com/university/${article.slug}` },
    ],
  }

  const accentColor = CATEGORY_COLORS[article.category] ?? '#00d4aa'

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }} />

      <div className="flex gap-10">
        {/* Main content */}
        <div className="flex-1 min-w-0">
          {/* Breadcrumb */}
          <div className="text-xs text-gray-500 mb-6">
            <Link href="/" className="hover:text-white">Home</Link> /{' '}
            <Link href="/university" className="hover:text-white">Mining University</Link> /{' '}
            <span className="text-gray-400">{article.category}</span>
          </div>

          {/* Header */}
          <div className="mb-8">
            <div className="text-xs font-semibold px-2.5 py-1 rounded-full inline-block mb-4" style={{ background: `${accentColor}20`, color: accentColor }}>
              {article.category}
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">{article.title}</h1>
            <p className="text-gray-400 text-base mb-5">{article.meta_description}</p>
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg,#f59e0b,#d97706)', color: '#000' }}>
                  JH
                </div>
                <div>
                  <div className="text-xs font-semibold text-white">Jacob H.</div>
                  <div className="text-xs text-gray-500">Founder, Lightning Mines · 8 years in Bitcoin mining</div>
                </div>
              </div>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-500">{article.reading_time_minutes} min read</span>
              <span className="text-gray-700">·</span>
              <span className="text-xs text-gray-500">
                Updated {new Date(article.dateModified).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <Link href="/about" className="text-xs hover:underline" style={{ color: '#f59e0b' }}>About the author →</Link>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-4">
              {article.tags.map(tag => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1f2937', color: '#9ca3af' }}>
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Article Content */}
          <div
            className="article-content text-gray-300 text-[15px] leading-7"
            style={{
              '--heading-color': '#ffffff',
              '--link-color': '#00d4aa',
            } as React.CSSProperties}
            dangerouslySetInnerHTML={{ __html: addInternalLinks(article.content) }}
          />

          <ArticleEmailCapture />

          {/* FAQ Section */}
          <div className="mt-12 rounded-2xl p-6" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <h2 className="text-xl font-bold text-white mb-6">Frequently Asked Questions</h2>
            <div className="space-y-6">
              {article.faqs.map((faq, i) => (
                <div key={i}>
                  <h3 className="text-base font-semibold text-white mb-2">{faq.question}</h3>
                  <p className="text-sm text-gray-400 leading-6">{faq.answer}</p>
                </div>
              ))}
            </div>
          </div>

          {/* End-of-article CTAs */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-2xl p-6 flex flex-col" style={{ background: '#111111', border: '1px solid #222222' }}>
              <div className="text-base font-bold text-white mb-2">Calculate Your ROI</div>
              <p className="text-sm text-gray-400 flex-1 mb-4">
                Use our free calculator to get exact profitability numbers for your hardware, hosting cost, and current BTC price.
              </p>
              <Link href="/calculator" className="text-sm font-semibold px-5 py-2.5 rounded-lg text-center" style={{ background: '#f7931a', color: '#000' }}>
                Open Calculator →
              </Link>
            </div>
            <div className="rounded-2xl p-6 flex flex-col" style={{ background: '#111111', border: '1px solid rgba(247,147,26,0.25)' }}>
              <div className="text-base font-bold text-white mb-2">Get a Free Deal Review</div>
              <p className="text-sm text-gray-400 flex-1 mb-4">
                Submit your deal and get an honest Pass / Avoid assessment within 48 hours. Completely free.
              </p>
              <Link href="/review" className="text-sm font-semibold px-5 py-2.5 rounded-lg text-center" style={{ background: 'rgba(247,147,26,0.12)', color: '#f7931a', border: '1px solid rgba(247,147,26,0.3)' }}>
                Free Deal Review →
              </Link>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside className="w-64 shrink-0 hidden xl:block">
          <div className="sticky top-8 space-y-6">
            {/* Quick tools */}
            <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="text-sm font-semibold text-white mb-4">Free Mining Tools</div>
              <div className="space-y-2">
                {[
                  { label: 'ROI Calculator', href: '/calculator' },
                  { label: 'Compare Hosting', href: '/hosting' },
                  { label: 'Compare Miners', href: '/miners' },
                  { label: 'Free Deal Review', href: '/review' },
                  { label: 'Mining Audit', href: '/audit' },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} className="flex items-center justify-between text-xs py-2 px-3 rounded-lg transition-colors hover:border-gray-600" style={{ background: '#0a0e17', border: '1px solid #1f2937', color: '#9ca3af' }}>
                    <span>{label}</span>
                    <span>→</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Related articles */}
            {related.length > 0 && (
              <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="text-sm font-semibold text-white mb-4">Related Articles</div>
                <div className="space-y-4">
                  {related.map(a => (
                    <Link key={a.slug} href={`/university/${a.slug}`} className="block group">
                      <div className="text-xs font-medium mb-1 group-hover:text-[#00d4aa] transition-colors" style={{ color: CATEGORY_COLORS[a.category] ?? '#00d4aa' }}>{a.category}</div>
                      <div className="text-xs text-gray-300 leading-snug group-hover:text-white transition-colors">{a.title}</div>
                      <div className="text-xs text-gray-600 mt-1">{a.reading_time_minutes} min read</div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Glossary CTA */}
            <div className="rounded-2xl p-5" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="text-sm font-semibold text-white mb-2">Mining Glossary</div>
              <p className="text-xs text-gray-400 mb-3">Confused by a term? Look it up in our complete Bitcoin mining glossary.</p>
              <Link href="/glossary" className="text-xs font-semibold" style={{ color: '#00d4aa' }}>Browse Glossary →</Link>
            </div>
          </div>
        </aside>
      </div>

      {/* Mobile related articles */}
      {related.length > 0 && (
        <div className="mt-10 xl:hidden">
          <h2 className="text-lg font-bold text-white mb-4">Related Articles</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {related.map(a => (
              <Link key={a.slug} href={`/university/${a.slug}`} className="rounded-xl p-4 group" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="text-xs mb-1" style={{ color: CATEGORY_COLORS[a.category] ?? '#00d4aa' }}>{a.category}</div>
                <div className="text-sm font-medium text-white group-hover:text-[#00d4aa] transition-colors leading-snug">{a.title}</div>
                <div className="text-xs text-gray-600 mt-1">{a.reading_time_minutes} min read</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Back to university */}
      <div className="mt-10 text-center">
        <Link href="/university" className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Back to Mining University
        </Link>
      </div>
    </div>
  )
}
