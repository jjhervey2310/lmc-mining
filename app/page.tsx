export default function Home() {
  const navLinks = [
    { href: '/miners', label: 'Hardware DB' },
    { href: '/hosts', label: 'Hosting' },
    { href: '/wallet', label: 'Wallet' },
    { href: '/data', label: 'Live Data' },
    { href: '/financing', label: 'Financing' },
    { href: '/hosting-match', label: 'Hosting Match' },
  ]

  const features = [
    { title: 'Hardware Database', desc: 'Compare Antminer, Whatsminer, and more with real efficiency data.', href: '/miners' },
    { title: 'Hosting Comparison', desc: 'Side-by-side hosting costs from vetted providers across the US.', href: '/hosts' },
    { title: 'Wallet Security', desc: 'Protect your mining rewards with hardware wallet guidance.', href: '/wallet' },
    { title: 'ROI Calculator', desc: 'Free spreadsheet to estimate your mining profitability.', href: 'https://docs.google.com/spreadsheets/d/1XssG19uwdoIZu0wYVBDr-N6MI9g6l6lKC8Yr96Gryfc/edit?usp=sharing' },
  ]

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #222' }}>
        <a href="/" style={{ fontWeight: 800, fontSize: '1.25rem', color: '#f59e0b', textDecoration: 'none' }}>
          LMC Mining
        </a>
        <div style={{ display: 'flex', gap: '1.5rem' }}>
          {navLinks.map(l => (
            <a key={l.href} href={l.href} style={{ color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}>{l.label}</a>
          ))}
        </div>
      </nav>

      <section style={{ maxWidth: 800, margin: '0 auto', padding: '5rem 2rem 3rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1.5rem' }}>
          Bitcoin Mining Intelligence Platform
        </h1>
        <p style={{ fontSize: '1.2rem', color: '#aaa', marginBottom: '2.5rem', lineHeight: 1.7 }}>
          Independent data. Compare mining hardware, analyze hosting deals, and calculate profitability without the marketing spin.
        </p>
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          <a
            href="https://docs.google.com/spreadsheets/d/1XssG19uwdoIZu0wYVBDr-N6MI9g6l6lKC8Yr96Gryfc/edit?usp=sharing"
            target="_blank"
            rel="noopener noreferrer"
            style={{ background: '#f59e0b', color: '#000', padding: '0.75rem 1.75rem', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: '1rem' }}
          >
            Free ROI Calculator
          </a>
          <a
            href="/hosts"
            style={{ border: '1px solid #444', color: '#fff', padding: '0.75rem 1.75rem', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: '1rem' }}
          >
            Compare Hosts
          </a>
        </div>
      </section>

      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem 2rem 5rem' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
          {features.map(f => (
            <a
              key={f.href}
              href={f.href}
              target={f.href.startsWith('http') ? '_blank' : undefined}
              rel={f.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '1.5rem', textDecoration: 'none', color: '#fff', display: 'block' }}
            >
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', color: '#f59e0b' }}>{f.title}</h3>
              <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: 1.6, margin: 0 }}>{f.desc}</p>
            </a>
          ))}
        </div>
      </section>

      <footer style={{ borderTop: '1px solid #222', padding: '1.5rem 2rem', textAlign: 'center', color: '#666', fontSize: '0.85rem' }}>
        LMC Mining Corp &copy; 2025 &middot; Independent Bitcoin Mining Intelligence
      </footer>
    </main>
  )
}
