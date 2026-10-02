// DEFILLAMA FREE TIER → point-in-time snapshot rows. Pure mappers here; the cron route fetches.
// Why daily snapshots: DeFiLlama rewrites history when adapters change and lists protocols with
// backfilled history, so only rows we captured ourselves on the day are point-in-time evidence.

export interface LlamaProtocol {
  slug: string; name: string; symbol?: string | null; gecko_id?: string | null; parentProtocol?: string | null; category?: string | null
  chains?: string[]; tvl?: number | null; mcap?: number | null; change_1d?: number | null; change_7d?: number | null; listedAt?: number | null
}
export interface LlamaOverviewRow { slug: string; parentProtocol?: string | null; total24h?: number | null; total7d?: number | null; total30d?: number | null }

export const familyKey = (p: { slug: string; parentProtocol?: string | null }) => p.parentProtocol || p.slug

/** gecko_id for a protocol: its own, else its parent's (any sibling that carries one). */
export function resolveGecko(p: LlamaProtocol, byParent: Map<string, string>): { gecko_id: string | null; source: 'self' | 'parent' | null } {
  if (p.gecko_id) return { gecko_id: p.gecko_id, source: 'self' }
  const g = p.parentProtocol ? byParent.get(p.parentProtocol) : undefined
  return g ? { gecko_id: g, source: 'parent' } : { gecko_id: null, source: null }
}

export function parentGeckoIndex(protocols: LlamaProtocol[]): Map<string, string> {
  const m = new Map<string, string>()
  for (const p of protocols) if (p.parentProtocol && p.gecko_id && !m.has(p.parentProtocol)) m.set(p.parentProtocol, p.gecko_id)
  return m
}

/** Sum an overview (fees / revenue / dexs) by protocol slug — overview slugs match /protocols slugs. */
export function indexOverview(rows: LlamaOverviewRow[]): Map<string, { d1: number; d7: number; d30: number }> {
  const m = new Map<string, { d1: number; d7: number; d30: number }>()
  for (const r of rows) {
    const cur = m.get(r.slug) ?? { d1: 0, d7: 0, d30: 0 }
    cur.d1 += Number(r.total24h ?? 0); cur.d7 += Number(r.total7d ?? 0); cur.d30 += Number(r.total30d ?? 0)
    m.set(r.slug, cur)
  }
  return m
}

export interface SnapshotRow {
  snapshot_date: string; llama_slug: string; name: string; symbol: string | null; gecko_id: string | null; parent: string | null; category: string | null; chains: string[]
  tvl: number | null; mcap: number | null; change_1d: number | null; change_7d: number | null
  fees_24h: number | null; fees_7d: number | null; fees_30d: number | null; revenue_24h: number | null; revenue_7d: number | null; revenue_30d: number | null
  dex_vol_24h: number | null; dex_vol_7d: number | null; dex_vol_30d: number | null; listed_at: string | null; source_vintage: 'live'
}
export interface TokenMapRow { llama_slug: string; name: string; symbol: string | null; gecko_id: string | null; parent: string | null; category: string | null; gecko_source: 'self' | 'parent' | null }

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)
const sym = (s?: string | null) => (s && s !== '-' ? s.toUpperCase() : null)

/** Keep protocols that matter for a token signal: a token, or real TVL, or any fee/DEX activity. */
export function buildSnapshot(date: string, protocols: LlamaProtocol[], fees: LlamaOverviewRow[], revenue: LlamaOverviewRow[], dexs: LlamaOverviewRow[], minTvl = 1_000_000): { rows: SnapshotRow[]; tokenMap: TokenMapRow[] } {
  const byParent = parentGeckoIndex(protocols)
  const F = indexOverview(fees), R = indexOverview(revenue), D = indexOverview(dexs)
  const rows: SnapshotRow[] = [], tokenMap: TokenMapRow[] = []
  for (const p of protocols) {
    if (!p.slug) continue
    const g = resolveGecko(p, byParent)
    const f = F.get(p.slug), r = R.get(p.slug), d = D.get(p.slug)
    const tvl = num(p.tvl)
    const keep = !!g.gecko_id || (tvl ?? 0) >= minTvl || !!f || !!d
    if (!keep) continue
    rows.push({
      snapshot_date: date, llama_slug: p.slug, name: p.name, symbol: sym(p.symbol), gecko_id: g.gecko_id, parent: p.parentProtocol ?? null, category: p.category ?? null, chains: p.chains ?? [],
      tvl, mcap: num(p.mcap), change_1d: num(p.change_1d), change_7d: num(p.change_7d),
      fees_24h: f?.d1 ?? null, fees_7d: f?.d7 ?? null, fees_30d: f?.d30 ?? null, revenue_24h: r?.d1 ?? null, revenue_7d: r?.d7 ?? null, revenue_30d: r?.d30 ?? null,
      dex_vol_24h: d?.d1 ?? null, dex_vol_7d: d?.d7 ?? null, dex_vol_30d: d?.d30 ?? null,
      listed_at: p.listedAt ? new Date(p.listedAt * 1000).toISOString() : null, source_vintage: 'live',
    })
    if (g.gecko_id || sym(p.symbol)) tokenMap.push({ llama_slug: p.slug, name: p.name, symbol: sym(p.symbol), gecko_id: g.gecko_id, parent: p.parentProtocol ?? null, category: p.category ?? null, gecko_source: g.source })
  }
  return { rows, tokenMap }
}

const OV = 'excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true'
export const LLAMA = {
  protocols: 'https://api.llama.fi/protocols',
  fees: `https://api.llama.fi/overview/fees?${OV}`,
  revenue: `https://api.llama.fi/overview/fees?${OV}&dataType=dailyRevenue`,
  dexs: `https://api.llama.fi/overview/dexs?${OV}`,
  fearGreed: 'https://api.alternative.me/fng/?limit=1&format=json',
}

export async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: 'no-store', headers: { 'User-Agent': 'lmc-desk/1.0' } })
  if (!res.ok) throw new Error(`${url} → ${res.status}`)
  return (await res.json()) as T
}
