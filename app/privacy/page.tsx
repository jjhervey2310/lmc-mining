import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: { absolute: 'Privacy Policy | LMC Mining Intelligence' },
  description: 'Privacy policy for LMC Mining Intelligence. Learn how we collect, use, and protect your personal information.',
}

export default function PrivacyPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-12">
      <div className="mb-8">
        <Link href="/" className="text-xs text-gray-500 hover:text-white transition-colors">← Back to home</Link>
      </div>

      <h1 className="text-3xl font-bold text-white mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-10">Last updated: June 2026</p>

      <div className="space-y-8 text-sm text-gray-300 leading-relaxed">

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Who We Are</h2>
          <p>LMC Mining Intelligence (&quot;LMC Mining,&quot; &quot;we,&quot; &quot;us,&quot; or &quot;our&quot;) operates the website at lmc-mining.vercel.app. We provide independent Bitcoin mining data, profitability tools, hardware reviews, and hosting comparisons. We are based in Colorado, USA.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. Information We Collect</h2>
          <p className="mb-3">We collect information in the following ways:</p>
          <div className="space-y-3">
            <div className="rounded-lg p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h3 className="font-semibold text-white mb-1">Information you provide directly</h3>
              <ul className="space-y-1 text-gray-400">
                <li>· Email address (when subscribing to alerts or downloading resources)</li>
                <li>· Name and mining setup details (when booking an audit)</li>
                <li>· Deal details submitted to our deal review tool</li>
              </ul>
            </div>
            <div className="rounded-lg p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
              <h3 className="font-semibold text-white mb-1">Information collected automatically</h3>
              <ul className="space-y-1 text-gray-400">
                <li>· Pages visited, time on site, and click behavior (via Google Analytics 4)</li>
                <li>· Session recordings (via Microsoft Clarity — no keystrokes or passwords captured)</li>
                <li>· Browser type, operating system, and approximate location (country/region)</li>
                <li>· IP address (anonymized)</li>
              </ul>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. How We Use Your Information</h2>
          <ul className="space-y-2 text-gray-400">
            <li>· <span className="text-gray-300">Email communications:</span> We send profitability alerts, educational content, and resources you requested. You can unsubscribe at any time.</li>
            <li>· <span className="text-gray-300">Audit service:</span> Deal details you submit are used solely to provide your audit. We never share your deal specifics with third parties.</li>
            <li>· <span className="text-gray-300">Site improvement:</span> Analytics data helps us understand what content is most useful and improve the tools we offer.</li>
            <li>· <span className="text-gray-300">Legal compliance:</span> We may retain records to comply with applicable law.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Affiliate Links and Third-Party Services</h2>
          <p className="mb-3">LMC Mining contains affiliate links. When you click a link to a hosting provider or marketplace and make a purchase, we may receive a commission at no additional cost to you. Our primary affiliate relationship is with Abundant Miners (abundantmines.com). We also link to hardware marketplaces and exchanges.</p>
          <p>Affiliate compensation does not influence our reviews, ratings, or data. We maintain independent editorial standards.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Cookies and Tracking</h2>
          <p className="mb-3">We use cookies and similar technologies for:</p>
          <ul className="space-y-1 text-gray-400">
            <li>· Analytics (Google Analytics 4 — anonymized)</li>
            <li>· Session behavior (Microsoft Clarity)</li>
            <li>· Remembering your calculator preferences</li>
          </ul>
          <p className="mt-3">You can disable cookies in your browser settings. This may affect some site functionality.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Data Sharing</h2>
          <p className="mb-2">We do not sell your personal information. We may share data with:</p>
          <ul className="space-y-1 text-gray-400">
            <li>· <span className="text-gray-300">Service providers:</span> Analytics platforms (Google, Microsoft) and email delivery services under confidentiality agreements</li>
            <li>· <span className="text-gray-300">Legal requirements:</span> If required by law, court order, or to protect our rights</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. Data Retention</h2>
          <p>We retain email addresses for as long as you remain subscribed. Audit inquiry data is retained for 12 months. Analytics data is retained per the default settings of Google Analytics 4 (14 months). You may request deletion at any time.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">8. Your Rights</h2>
          <p className="mb-2">You have the right to:</p>
          <ul className="space-y-1 text-gray-400">
            <li>· Access, correct, or delete your personal data</li>
            <li>· Opt out of email communications (unsubscribe link in every email)</li>
            <li>· Request a copy of data we hold about you</li>
          </ul>
          <p className="mt-3">To exercise these rights, email us at <span className="text-yellow-400">hello@lmcmining.com</span>.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">9. Security</h2>
          <p>We use industry-standard security practices including HTTPS encryption for all data transmission and access controls on our database. However, no system is 100% secure. We cannot guarantee absolute security of data transmitted over the internet.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">10. Children&apos;s Privacy</h2>
          <p>LMC Mining is not directed to children under 13. We do not knowingly collect personal information from anyone under 13. If you believe a child has provided us with personal information, contact us and we will delete it promptly.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">11. Changes to This Policy</h2>
          <p>We may update this policy periodically. When we do, we will update the &quot;last updated&quot; date at the top. Continued use of the site after changes constitutes acceptance of the updated policy.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-white mb-3">12. Contact</h2>
          <p>Questions about this privacy policy? Contact us:</p>
          <div className="mt-3 rounded-lg p-4" style={{ background: '#111827', border: '1px solid #1f2937' }}>
            <p className="text-gray-300">LMC Mining Intelligence</p>
            <p className="text-gray-400">Colorado, USA</p>
            <p className="text-yellow-400 mt-1">hello@lmcmining.com</p>
          </div>
        </section>

      </div>

      <div className="mt-12 pt-8 border-t border-gray-800 flex gap-4 text-sm text-gray-500">
        <Link href="/terms" className="hover:text-white transition-colors">Terms of Service</Link>
        <span>·</span>
        <Link href="/about" className="hover:text-white transition-colors">About</Link>
        <span>·</span>
        <Link href="/" className="hover:text-white transition-colors">Home</Link>
      </div>
    </div>
  )
}
