import type { ReactNode } from 'react'

/**
 * A concise, extractable "Quick Answer" callout placed near the top of a page.
 * Structured so Google AI Overviews, ChatGPT, and Perplexity can lift a direct,
 * self-contained answer. Pair the visible text with matching FAQ/Article schema
 * already on the page — do not introduce a claim here that isn't supported below.
 */
export default function QuickAnswer({
  question,
  children,
}: {
  question?: string
  children: ReactNode
}) {
  return (
    <div
      className="rounded-2xl p-5 md:p-6 mb-8"
      style={{ background: 'rgba(0,212,170,0.06)', border: '1px solid rgba(0,212,170,0.25)' }}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wide px-2 py-0.5 rounded" style={{ background: 'rgba(0,212,170,0.15)', color: '#00d4aa' }}>
          Quick Answer
        </span>
        {question && <span className="text-sm font-semibold text-white">{question}</span>}
      </div>
      <div className="text-sm md:text-[15px] text-gray-300 leading-relaxed">{children}</div>
    </div>
  )
}
