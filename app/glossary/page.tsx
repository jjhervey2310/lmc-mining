import Link from 'next/link'
import { GLOSSARY_TERMS } from '@/lib/data'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Bitcoin Mining Glossary — Key Terms Explained',
  description: 'Bitcoin mining glossary. Hashrate, hashprice, difficulty, J/TH, FPPS, block reward — key mining terms explained in plain language.',
  alternates: { canonical: '/glossary' },
}

export default function GlossaryPage() {
  const sorted = [...GLOSSARY_TERMS].sort((a, b) => a.term.localeCompare(b.term))
  const letters = [...new Set(sorted.map(t => t.term[0].toUpperCase()))]

  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: sorted.map(t => ({
      '@type': 'Question',
      name: `What is ${t.term} in Bitcoin mining?`,
      acceptedAnswer: { '@type': 'Answer', text: t.definition },
    })),
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-10">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.lightningmines.com' },
          { '@type': 'ListItem', position: 2, name: 'Mining Glossary', item: 'https://www.lightningmines.com/glossary' },
        ],
      }) }} />

      <div className="text-xs text-gray-500 mb-6">
        <Link href="/" className="hover:text-white">Home</Link> / Mining Glossary
      </div>

      <h1 className="text-3xl font-bold text-white mb-3">Bitcoin Mining Glossary</h1>
      <p className="text-gray-400 mb-8">Every key term in Bitcoin mining explained in plain language. From hashrate to hashprice, J/TH to FPPS.</p>

      {/* Alphabet nav */}
      <div className="flex flex-wrap gap-1.5 mb-10">
        {letters.map(l => (
          <a key={l} href={`#${l}`} className="w-8 h-8 flex items-center justify-center rounded text-xs font-mono font-semibold transition-colors hover:text-white"
            style={{ background: '#111827', color: '#9ca3af', border: '1px solid #1f2937' }}>
            {l}
          </a>
        ))}
      </div>

      {/* Terms by letter */}
      {letters.map(letter => {
        const terms = sorted.filter(t => t.term[0].toUpperCase() === letter)
        return (
          <div key={letter} id={letter} className="mb-10">
            <div className="text-xl font-bold font-mono mb-4 pb-2" style={{ color: '#00d4aa', borderBottom: '1px solid #1f2937' }}>{letter}</div>
            <div className="space-y-6">
              {terms.map(term => (
                <div key={term.term}>
                  <h2 className="text-base font-bold text-white mb-1">{term.term}</h2>
                  <p className="text-sm text-gray-400 mb-2">{term.definition}</p>
                  {term.extended_explanation && (
                    <p className="text-xs text-gray-500 leading-6">{term.extended_explanation}</p>
                  )}
                  {term.related_terms && term.related_terms.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      <span className="text-xs text-gray-600">See also:</span>
                      {term.related_terms.map(r => (
                        <span key={r} className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#1f2937', color: '#9ca3af' }}>{r}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* CTA */}
      <div className="mt-10 rounded-2xl p-6 text-center" style={{ background: '#111827', border: '1px solid #1f2937' }}>
        <h2 className="text-base font-bold text-white mb-2">Learn More at Mining University</h2>
        <p className="text-sm text-gray-400 mb-4">Go deeper with our free guides on profitability, hardware, and hosting.</p>
        <Link href="/university" className="text-sm font-semibold px-5 py-2.5 rounded-lg inline-block" style={{ background: '#00d4aa', color: '#0a0e17' }}>
          Browse All Guides →
        </Link>
      </div>
    </div>
  )
}
