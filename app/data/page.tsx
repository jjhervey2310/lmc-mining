export default function DataPage() {
  return (
      <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
            <h1 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>Live Bitcoin Mining Data</h1>
                  <p style={{ color: '#666', marginBottom: '2rem' }}>Real-time Bitcoin network statistics for miners.</p>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                {['BTC Price', 'Network Hashrate', 'Difficulty', 'Block Reward', 'Mempool', 'Next Halving'].map(metric => (
                                          <div key={metric} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1.25rem' }}>
                                                      <div style={{ color: '#888', fontSize: '0.75rem', marginBottom: '0.25rem' }}>{metric}</div>
                                                                  <div style={{ fontWeight: 700, fontSize: '1.25rem' }}>Loading...</div>
                                                                            </div>
                                                                                    ))}
                                                                                          </div>
                                                                                                <p style={{ color: '#999', fontSize: '0.8rem', marginTop: '2rem' }}>Data powered by public Bitcoin APIs. Refreshes every 60 seconds.</p>
                                                                                                    </main>
                                                                                                      )
                                                                                                      }
