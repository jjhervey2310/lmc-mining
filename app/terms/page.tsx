import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { absolute: 'Terms of Service | Lightning Mines' },
  description: 'Terms of service for Lightning Mines. Read our terms governing use of our Bitcoin mining data, tools, and audit services.',
  alternates: { canonical: '/terms' },
}

export default function TermsPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">← Back to home</Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Terms of Service</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: June 2026 · Governing law: Colorado, USA</p>

      <div className="space-y-8 text-sm text-gray-300 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Acceptance of Terms</h2>
          <p>By accessing or using lightningmines.com (the &quot;Site&quot;), you agree to be bound by these Terms of Service (&quot;Terms&quot;). If you do not agree, do not use the Site. These Terms are governed by the laws of the State of Colorado, USA.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. Description of Service</h2>
          <p>Lightning Mines provides independent Bitcoin mining data, profitability calculators, hardware comparisons, hosting provider reviews, and consulting services including deal audits. The Site is provided for informational and educational purposes.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. Not Financial Advice</h2>
          <div className="rounded-xl p-5 mb-3" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <p className="text-yellow-200/80 font-medium">Nothing on this Site constitutes financial, investment, tax, or legal advice. Bitcoin mining involves substantial risk. You may lose all or part of your investment. Past performance does not guarantee future results. Always consult a qualified financial professional before making investment decisions.</p>
          </div>
          <p>All profitability calculations are estimates based on inputs you provide and market data available at the time. Actual results will vary due to network difficulty changes, Bitcoin price volatility, hardware degradation, and other factors.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Audit Services</h2>
          <p className="mb-2">When you purchase a mining audit:</p>
          <ul className="space-y-2 text-gray-400">
            <li>· Payment is required before service is rendered.</li>
            <li>· Reports are delivered within the timeframe stated at booking (typically 48–72 hours).</li>
            <li>· Audit reports are personal and confidential — for your use only. Redistribution or resale is prohibited.</li>
            <li>· We provide professional analysis based on information you supply. Inaccurate information you provide may affect analysis quality. Lightning Mines is not liable for outcomes resulting from inaccurate inputs.</li>
            <li>· Refunds: Due to the time-intensive nature of custom analysis, refunds are not available once analysis has begun. If we cannot deliver a report within the stated timeframe, you are entitled to a full refund.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Affiliate Relationships</h2>
          <p>Lightning Mines participates in affiliate programs. We may receive compensation when you click certain links or make purchases through them. This includes our primary relationship with Abundant Mines. Affiliate relationships do not influence our editorial content, ratings, or data. See our full <Link href="/about#affiliate" className="text-yellow-400 hover:underline">affiliate disclosure</Link>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Intellectual Property</h2>
          <p>All content on this Site — including text, tools, data compilations, graphics, and code — is the property of Lightning Mines and protected by copyright law. You may not reproduce, distribute, or create derivative works without express written permission. You may share links to our content and quote brief excerpts with attribution.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. User Conduct</h2>
          <p className="mb-2">You agree not to:</p>
          <ul className="space-y-1 text-gray-400">
            <li>· Scrape, crawl, or systematically extract data from the Site without permission</li>
            <li>· Attempt to gain unauthorized access to any part of the Site or its infrastructure</li>
            <li>· Use the Site for any unlawful purpose</li>
            <li>· Submit false information in connection with audit services</li>
            <li>· Interfere with the operation of the Site</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">8. Third-Party Links</h2>
          <p>The Site contains links to third-party websites including hardware marketplaces, hosting providers, and exchanges. Lightning Mines does not control and is not responsible for the content, privacy practices, or terms of any third-party site. Linking does not imply endorsement beyond our editorial assessment.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">9. Limitation of Liability</h2>
          <p>To the maximum extent permitted by law, Lightning Mines shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages arising from your use of the Site or services, including but not limited to losses from mining operations, hardware purchases, or hosting agreements made in reliance on our content.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">10. Disclaimer of Warranties</h2>
          <p>The Site and all content are provided &quot;as is&quot; without warranties of any kind. We do not warrant that information is accurate, complete, or current; that the Site will be uninterrupted or error-free; or that any results from use of our tools will be achieved.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">11. Indemnification</h2>
          <p>You agree to indemnify and hold harmless Lightning Mines, its founders, and affiliates from any claims, damages, or expenses (including attorney fees) arising from your use of the Site, your violation of these Terms, or your violation of any third-party rights.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">12. Governing Law and Disputes</h2>
          <p>These Terms shall be governed by the laws of the State of Colorado, USA, without regard to conflict of law principles. Any disputes shall be resolved in the state or federal courts located in Colorado. You consent to personal jurisdiction in those courts.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">13. Changes to Terms</h2>
          <p>We may update these Terms at any time. Changes take effect when posted. Your continued use of the Site after changes are posted constitutes acceptance. Check the &quot;last updated&quot; date above to track revisions.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">14. Contact</h2>
          <p>Questions about these Terms:</p>
          <div className="mt-3 rounded-lg p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <p className="text-gray-300">Lightning Mines</p>
            <p className="text-gray-400">Colorado, USA</p>
            <p className="text-yellow-400 mt-1">contact@lightningmines.com</p>
          </div>
        </section>

      </div>

      <div className="mt-12 pt-8 border-t border-gray-800 flex gap-4 text-sm text-gray-500">
        <Link href="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link>
        <span>·</span>
        <Link href="/about" className="hover:text-white transition-colors">About</Link>
        <span>·</span>
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
      </div>
    </div>
  )
}
