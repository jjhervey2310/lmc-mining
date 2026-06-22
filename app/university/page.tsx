import Link from 'next/link'
import { ARTICLES } from '@/lib/articles'

const CATEGORIES = ['All', 'Profitability', 'Hardware', 'Hardware Reviews', 'Hosting', 'Finance', 'Education', 'Operations', 'Industry']

const CATEGORY_ICONS: Record<string, string> = {
  Profitability: '💰',
  Hardware: '⚙️',
  'Hardware Reviews': '🔍',
  Hosting: '🏗️',
  Finance: '📊',
  Education: '🎓',
  Operations: '🔧',
  Industry: '📈',
}

export const metadata = {
  title: 'Bitcoin Mining University — Free Guides 2026',
  description: 'Free Bitcoin mining education. Profitability guides, hardware reviews, hosting comparisons, tax guides, and advanced mining strategy. Learn everything about mining Bitcoin in 2026.',
}

export default function UniversityPage() {
  const featured = ARTICLES.slice(0, 3)
  const rest = ARTICLES.slice(3)

  const byCategory: Record<string, typeof ARTICLES> = {}
  for (const a of ARTICLES) {
    if (!byCategory[a.category]) byCategory[a.category] = []
    byCategory[a.category].push(a)
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'EducationalOrganization',
        name: 'LMC Mining University',
        description: 'Free Bitcoin mining education platform covering profitability, hardware, hosting, and operations.',
        url: 'https://lmcmining.com/university',
        hasCourse: ARTICLES.map(a => ({
          '@type': 'Course',
          name: a.title,
          description: a.meta_description,
          url: `https://lmcmining.com/university/${a.slug}`,
        })),
      }) }} />

      {/* Breadcrumb */}
      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / Mining University
      </div>

      {/* Header */}
      <div className="mb-10">
        <div className="inline-block text-xs font-semibold px-3 py-1 rounded-full mb-4" style={{ background: '#00d4aa20', color: '#00d4aa' }}>
          FREE EDUCATION
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Bitcoin Mining University</h1>
        <p className="text-gray-400 text-lg max-w-2xl">
          Everything you need to mine Bitcoin profitably. Beginner guides to advanced strategy — written by operators, for operators.
        </p>
        <div className="flex items-center gap-6 mt-6 text-sm text-gray-500">
          <span>{ARTICLES.length} guides</span>
          <span>Free forever</span>
          <span>Updated 2026</span>
        </div>
      </div>

      {/* Featured Articles */}
      <div className="mb-12">
        <h2 className="text-xl font-bold text-white mb-5">Start Here</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {featured.map(a => (
            <Link key={a.slug} href={`/university/${a.slug}`} className="group rounded-2xl p-6 transition-colors hover:border-[#00d4aa]" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <div className="text-xs font-medium mb-3 px-2 py-0.5 rounded-full inline-block" style={{ background: '#00d4aa20', color: '#00d4aa' }}>
                {CATEGORY_ICONS[a.category] ?? ''} {a.category}
              </div>
              <h3 className="text-base font-semibold text-white mb-2 group-hover:text-[#00d4aa] transition-colors leading-snug">{a.title}</h3>
              <p className="text-xs text-gray-400 line-clamp-2 mb-4">{a.meta_description}</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-500">{a.reading_time_minutes} min read</span>
                <span className="text-xs" style={{ color: '#00d4aa' }}>Read →</span>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* By Category */}
      {Object.entries(byCategory).map(([cat, articles]) => (
        <div key={cat} className="mb-10">
          <div className="flex items-center gap-3 mb-5">
            <span className="text-lg">{CATEGORY_ICONS[cat] ?? '📄'}</span>
            <h2 className="text-lg font-bold text-white">{cat}</h2>
            <span className="text-xs text-gray-500">({articles.length} guides)</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {articles.map(a => (
              <Link key={a.slug} href={`/university/${a.slug}`} className="group flex gap-4 rounded-xl p-4 transition-colors hover:border-gray-600" style={{ background: '#111827', border: '1px solid #1f2937' }}>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-white mb-1 group-hover:text-[#00d4aa] transition-colors leading-snug">{a.title}</h3>
                  <p className="text-xs text-gray-500 line-clamp-1">{a.meta_description}</p>
                </div>
                <div className="text-xs text-gray-600 whitespace-nowrap mt-0.5">{a.reading_time_minutes}m</div>
              </Link>
            ))}
          </div>
        </div>
      ))}

      {/* CTA */}
      <div className="mt-12 rounded-2xl p-8 text-center" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-xl font-bold text-white mb-2">Ready to Deploy Capital?</h2>
        <p className="text-gray-400 mb-6">Use our free tools to analyze any mining deal before you commit.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link href="/deal-analyzer" className="text-sm font-semibold px-6 py-3 rounded-lg" style={{ background: '#00d4aa', color: '#0a0e17' }}>
            Analyze My Deal →
          </Link>
          <Link href="/" className="text-sm font-semibold px-6 py-3 rounded-lg border border-gray-700 text-gray-300 hover:text-white transition-colors">
            Profitability Calculator →
          </Link>
        </div>
      </div>
    </div>
  )
}
