xport default function WalletPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', padding: '3rem 0 2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>
          Secure Your Mining Rewards
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#555', maxWidth: 560, margin: '0 auto' }}>
          Every sat you mine is only yours if it is secured properly. A hardware wallet is the single most important security step for any Bitcoin miner.
        </p>
      </div>

      <section style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 12, padding: '2rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Why Miners Need a Hardware Wallet</h2>
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: '1rem' }}>
          When you mine Bitcoin, your mining pool sends payouts directly to a Bitcoin address. If that address is controlled by a software wallet on a connected device, it is vulnerable to hacks, malware, and exchange failures. Hardware wallets store your private keys on an offline device — your Bitcoin cannot be spent without physical confirmation.
        </p>
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: '1rem' }}>
          For miners receiving regular payouts, this matters even more. Accumulated mining rewards represent significant value that grows over time. A hardware wallet ensures that even if your computer or phone is compromised, your funds remain safe.
        </p>
        <p style={{ color: '#555', lineHeight: 1.7 }}>
          The Ledger hardware wallet is the most widely used option in the Bitcoin mining community. It supports Bitcoin natively, has a clear display to verify transactions, and connects via USB or Bluetooth. Setup takes under 10 minutes.
        </p>
      </section>

      <section style={{ background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 12, padding: '2rem', marginBottom: '2rem', textAlign: 'center' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
          Ledger Hardware Wallet
        </h2>
        <p style={{ color: '#555', marginBottom: '1.5rem' }}>
          Recommended by LMC Mining. Industry-standard cold storage for Bitcoin miners.
        </p>
        <a
          href="https://shop.ledger.com/?r=e8ab22756ddf"
          target="_blank"
          rel="noopener noreferrer"
          style={{ display: 'inline-block', background: '#000', color: '#fff', padding: '0.875rem 2.5rem', borderRadius: 8, fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}
        >
          Get Your Ledger Wallet →
        </a>
        <p style={{ fontSize: '0.75rem', color: '#888', marginTop: '1rem' }}>
          Disclosure: LMC Mining earns a commission from Ledger sales through this link. This does not affect our recommendation — we only recommend products we believe are genuinely useful for miners.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1rem' }}>Other Hardware Wallet Options</h2>
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Trezor</h3>
            <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.5 }}>
              Open-source firmware, strong community trust. Trezor Model T supports Bitcoin and many altcoins with a touchscreen interface. Good choice if you prefer open-source hardware.
            </p>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem' }}>
            <h3 style={{ fontWeight: 700, marginBottom: '0.5rem' }}>Coldcard</h3>
            <p style={{ fontSize: '0.875rem', color: '#666', lineHeight: 1.5 }}>
              Bitcoin-only hardware wallet, favored by advanced users. Air-gapped signing capability means you never need to connect it to a computer. Highest security option for serious miners.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
