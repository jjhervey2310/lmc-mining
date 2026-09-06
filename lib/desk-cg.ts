// Symbol → CoinGecko id for the desk pages and routes. Hand map for the names the desk trades;
// everything else resolves from the top-500 by market cap (cached a day). Shared by the ROBINHOOD
// tab, /api/fund/timing and /api/fund/buy so a symbol never resolves differently in two places.

export const CG: Record<string, string> = {
  BTC: 'bitcoin', ETH: 'ethereum', SOL: 'solana', XRP: 'ripple', DOGE: 'dogecoin',
  ADA: 'cardano', AVAX: 'avalanche-2', LINK: 'chainlink', LTC: 'litecoin', BCH: 'bitcoin-cash',
  XLM: 'stellar', UNI: 'uniswap', AAVE: 'aave', SHIB: 'shiba-inu', PEPE: 'pepe',
  BONK: 'bonk', WIF: 'dogwifcoin', DOT: 'polkadot', SUI: 'sui', HYPE: 'hyperliquid',
  LIT: 'lighter', ONDO: 'ondo-finance', MOODENG: 'moo-deng', ZEC: 'zcash', PUMP: 'pump-fun',
  ARB: 'arbitrum', LDO: 'lido-dao', STRK: 'starknet', NEAR: 'near', FET: 'fetch-ai', SEI: 'sei-network',
  OP: 'optimism', XPL: 'plasma', ZRO: 'layerzero', ENA: 'ethena', AERO: 'aerodrome-finance', JTO: 'jito-governance-token',
  SYRUP: 'syrup', ASTER: 'aster-2', AVNT: 'avantis', MORPHO: 'morpho', EIGEN: 'eigenlayer', WLFI: 'world-liberty-financial',
}

export async function resolveIds(symbols: string[]): Promise<Record<string, string>> {
  const out = { ...CG }
  const missing = [...new Set(symbols.map((s) => s.toUpperCase()))].filter((s) => !out[s])
  if (!missing.length) return out
  try {
    for (const page of [1, 2]) {
      const res = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`, { next: { revalidate: 86400 } })
      if (!res.ok) break
      const rows = (await res.json()) as { id: string; symbol: string }[]
      for (const r of rows) { const s = r.symbol.toUpperCase(); if (missing.includes(s) && !out[s]) out[s] = r.id }
    }
  } catch { /* unmapped symbols show "…" for price, never a zero */ }
  return out
}
