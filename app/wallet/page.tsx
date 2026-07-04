import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Best Bitcoin Hardware Wallets for Miners',
  description: 'Why Bitcoin miners need a hardware wallet, how mining payouts get exposed to theft, and which hardware wallets are the right fit for securing mining rewards.',
}

export default function WalletPage() {
  return (
    <main style={{ maxWidth: 800, margin: '0 auto', padding: '2rem 1rem' }}>
      <div style={{ textAlign: 'center', padding: '3rem 0 2rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>
          ⚡ Secure Your Mining Rewards
        </h1>
        <p style={{ fontSize: '1.1rem', color: '#555', maxWidth: 560, margin: '0 auto' }}>
          Every sat you mine is only yours if it is secured properly. A hardware wallet is the single most important security step for any Bitcoin miner.
        </p>
      </div>

      <section style={{ background: '#fffbeb', border: '1px solid #fbbf24', borderRadius: 12, padding: '2rem', marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Why Miners Need a Hardware Wallet</h2>
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: '1rem' }}>
          When you mine Bitcoin, your mining pool sends payouts directly to a Bitcoin address. If that address is controlled by software on an internet-connected device, it is vulnerable to theft.
        </p>
        <p style={{ color: '#555', lineHeight: 1.7, marginBottom: '1rem' }}>
          For miners receiving regular payouts, this matters even more. Accumulated mining rewards represent significant value, and losing them to malware or a compromised wallet would be devastating.
        </p>
        <p style={{ color: '#555', lineHeight: 1.7 }}>
          The Ledger hardware wallet is the most widely used option in the Bitcoin mining community. It supports Bitcoin natively, has a battle-tested track record, and is easy to set up even for beginners.
        </p>
      </section>

      <section style={{ background: '#f0fdf4', border: '1px solid #16a34a', borderRadius: 12, padding: '2rem', marginBottom: '2rem' }}>
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
          style={{
            display: 'inline-block',
            background: '#f59e0b',
            color: '#000',
            fontWeight: 700,
            padding: '0.75rem 2rem',
            borderRadius: 8,
            textDecoration: 'none',
            fontSize: '1.1rem',
            marginBottom: '1rem'
          }}
        >
          Get Ledger →
        </a>
        <p style={{ fontSize: '0.85rem', color: '#777', marginTop: '0.5rem' }}>
          Disclosure: LMC earns a commission from Ledger sales at no extra cost to you.
        </p>
      </section>

      <section style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '1rem' }}>Other Hardware Wallets</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1.5rem' }}>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Trezor</h3>
            <p style={{ color: '#555', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Open-source hardware wallet with strong community trust. A solid alternative for privacy-conscious miners who prefer auditable firmware.
            </p>
          </div>
          <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem' }}>Coldcard</h3>
            <p style={{ color: '#555', fontSize: '0.95rem', lineHeight: 1.6 }}>
              Bitcoin-only hardware wallet favored by advanced users. Air-gapped signing capability means you never need to connect it to a computer. Highest security option for serious miners.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
