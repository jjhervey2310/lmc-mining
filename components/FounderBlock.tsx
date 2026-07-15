/**
 * Human founder credibility block. Jacob is an operator, not a faceless brand —
 * this states who's behind the data and why, without overclaiming.
 */
export default function FounderBlock() {
  return (
    <section className="rounded-2xl p-6 md:p-8 flex items-start gap-4" style={{ background: '#111111', border: '1px solid #222222' }}>
      <div
        className="shrink-0 w-12 h-12 rounded-full flex items-center justify-center text-base font-bold"
        style={{ background: 'rgba(247,147,26,0.15)', color: '#f7931a' }}
        aria-hidden="true"
      >
        JH
      </div>
      <div>
        <div className="text-sm font-semibold text-white mb-1">Built by Jacob Hervey</div>
        <p className="text-sm text-gray-400 leading-relaxed">
          I run my own mining operation and built Lightning Mines to give retail miners a neutral source of
          truth — so you can avoid bad hosting contracts, bad hardware math, and seller-driven ROI claims.
          Every number here is computed from live network data, not a spreadsheet someone is trying to sell you.
        </p>
      </div>
    </section>
  )
}
