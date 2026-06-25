export default function Home() {
    const navLinks = [
      { href: '/miners', label: 'Hardware DB' },
      { href: '/hosts', label: 'Hosting' },
      { href: '/wallet', label: 'Wallet' },
        ]

  return (
        <main style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', background: '#0a0a0a', color: '#fff' }}>
                <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem 2rem', borderBottom: '1px solid #222' }}>
                          <a href="/" style={{ fontWeight: 800, fontSize: '1.25rem', color: '#f59e0b', textDecoration: 'none' }}>
                                      LMC Mining
                          </a>a>
                          <div style={{ display: 'flex', gap: '1.5rem' }}>
                            {navLinks.map(l => (
                      <a key={l.href} href={l.href} style={{ color: '#ccc', textDecoration: 'none', fontSize: '0.9rem' }}>{l.label}</a>a>
                    ))}
                          </div>div>
                </nav>nav>

                <section style={{ maxWidth: 800, margin: '0 auto', padding: '5rem 2rem 3rem', textAlign: 'center' }}>
                          <h1 style={{ fontSize: '3rem', fontWeight: 800, lineHeight: 1.2, marginBottom: '1.5rem' }}>
                                      Bitcoin Mining Intelligence Platform
                          </h1>h1>
                          <p style={{ fontSize: '1.2rem', color: '#aaa', marginBottom: '2.5rem', lineHeight: 1.7 }}>
                                      Independent data. Compare mining hardware, analyze hosting deals, and calculate profitability without the marketing spin.
                          </p>p>
                          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                                      <a
                                                    href="https://docs.google.com/spreadsheets/d/1XssG19uwdoIZu0wYVBDr-N6MI9g6l6lKC8Yr96Gryfc/edit?usp=sharing"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ background: '#f59e0b', color: '#000', padding: '0.875rem 2rem', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: '1rem' }}
                                                  >
                                                  Free ROI Calculator →
                                      </a>a>
                                    <a
                                                  href="/hosts"
                                                  style={{ background: 'transparent', color: '#fff', padding: '0.875rem 2rem', borderRadius: 8, fontWeight: 600, textDecoration: 'none', fontSize: '1rem', border: '1px solid #444' }}
                                                >
                                                Compare Hosting
                                    </a>a>
                          </div>div>
                </section>section>
        
              <section style={{ maxWidth: 1100, margin: '0 auto', padding: '2rem', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
                {[
          { title: 'Hardware Database', desc: 'Compare 22+ ASIC miners by hashrate, efficiency, and price.', href: '/miners', cta: 'View Miners' },
          { title: 'Hosting Comparison', desc: 'Side-by-side comparison of verified hosting providers with real data.', href: '/hosts', cta: 'Compare Hosts' },
          { title: 'Secure Your Rewards', desc: 'Hardware wallet guide and Ledger affiliate link for miners.', href: '/wallet', cta: 'Get Wallet' },
          { title: 'ROI Calculator', desc: 'Free Google Sheets calculator to estimate your mining returns.', href: 'https://docs.google.com/spreadsheets/d/1XssG19uwdoIZu0wYVBDr-N6MI9g6l6lKC8Yr96Gryfc/edit?usp=sharing', cta: 'Open Calculator', external: true },
                  ].map(card => (
                              <div key={card.title} style={{ background: '#111', border: '1px solid #222', borderRadius: 12, padding: '1.5rem' }}>
                                          <h3 style={{ fontWeight: 700, marginBottom: '0.5rem', fontSize: '1.1rem' }}>{card.title}</h3>h3>
                                          <p style={{ color: '#999', fontSize: '0.875rem', lineHeight: 1.6, marginBottom: '1rem' }}>{card.desc}</p>p>
                                          <a
                                                          href={card.href}
                                                          target={card.external ? '_blank' : undefined}
                                                          rel={card.external ? 'noopener noreferrer' : undefined}
                                                          style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.875rem', textDecoration: 'none' }}
                                                        >
                                            {card.cta} →
                                          </a>a>
                              </div>div>
                            ))}
              </section>section>
        </main>main>
      )
}</a>
