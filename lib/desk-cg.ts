import { createServiceClient } from '@/lib/supabase'

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
  TON: 'the-open-network', TAO: 'bittensor', CC: 'canton-network', WLD: 'worldcoin-wld', TRUMP: 'official-trump', SKR: 'seeker',
}

/** CoinGecko fetch carrying the demo key when one is set.
 *  The desk's calls used to go out anonymous while lib/markets.ts, btc-price.ts and the
 *  hashprice cron all used the key — so a couple of Timing clicks in a row hit the
 *  anonymous rate limit and the check 502'd (2026-09-10). A bad or expired key must not
 *  kill the feed either, so a 401/403 retries once without it, as fetchCrypto does. */
// The init type is taken from whatever `fetch` accepts here rather than a bare
// RequestInit, so Next's `next: { revalidate }` option still type-checks.
export async function cgFetch(url: string, init?: Parameters<typeof fetch>[1]): Promise<Response> {
  const key = process.env.COINGECKO_API_KEY
  if (!key) return fetch(url, init)
  const sep = url.includes('?') ? '&' : '?'
  const res = await fetch(`${url}${sep}x_cg_demo_api_key=${key}`, init)
  return res.ok || (res.status !== 401 && res.status !== 403) ? res : fetch(url, init)
}

export async function resolveIds(symbols: string[]): Promise<Record<string, string>> {
  const out = { ...CG }
  // cg_history (Supabase) carries symbol→id for the whole Robinhood universe, written daily by the droplet —
  // a DB read, no CoinGecko call, and it is the same id the history proxy serves. (2026-09-07: TON had no id.)
  try {
    const sb = createServiceClient()
    if (sb) {
      const { data } = await sb.from('cg_history').select('symbol, id')
      for (const r of (data ?? []) as { symbol: string | null; id: string }[]) { const k = r.symbol?.toUpperCase(); if (k && !out[k]) out[k] = r.id }
    }
  } catch { /* fall through */ }
  const missing = [...new Set(symbols.map((s) => s.toUpperCase()))].filter((s) => !out[s])
  if (!missing.length) return out
  try {
    for (const page of [1, 2]) {
      const res = await cgFetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${page}`, { next: { revalidate: 86400 } })
      if (!res.ok) break
      const rows = (await res.json()) as { id: string; symbol: string }[]
      for (const r of rows) { const s = r.symbol.toUpperCase(); if (missing.includes(s) && !out[s]) out[s] = r.id }
    }
  } catch { /* unmapped symbols show "…" for price, never a zero */ }
  return out
}
