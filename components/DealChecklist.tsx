const CHECKLIST = [
  'Hosting rate (all-in $/kWh or flat)',
  'Setup fee & deposit',
  'Uptime terms & SLA',
  'Exit clause & contract length',
  'Hardware retrieval rights',
  'Power source',
  'BTC breakeven price',
  'Difficulty-growth stress test',
  'Pool fees & firmware freedom',
  'Tax angle (Section 179)',
]

/**
 * "What we check before calling a deal safe" — the standing independent checklist
 * behind every free review and paid audit. Reusable across the audit + landing pages.
 */
export default function DealChecklist() {
  return (
    <section className="rounded-2xl p-6 md:p-8" style={{ background: '#111111', border: '1px solid #222222' }}>
      <h2 className="text-lg md:text-xl font-bold text-white mb-1">What we check before calling a deal safe</h2>
      <p className="text-sm text-gray-400 mb-5">Every review and audit runs the same independent checklist — measured against live network data, not seller math.</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
        {CHECKLIST.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm text-gray-300">
            <span aria-hidden="true" className="mt-0.5" style={{ color: '#00d4aa' }}>✓</span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
