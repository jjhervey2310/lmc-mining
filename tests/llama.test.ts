import { describe, expect, it } from 'vitest'
import { buildSnapshot, indexOverview, resolveGecko, parentGeckoIndex, type LlamaProtocol } from '@/lib/desk/llama'

const P: LlamaProtocol[] = [
  { slug: 'aave', name: 'Aave', symbol: 'AAVE', gecko_id: 'aave', parentProtocol: 'parent#aave', tvl: 100, mcap: 5e9, chains: ['Ethereum'], listedAt: 1_600_000_000 },
  { slug: 'aave-v3', name: 'Aave V3', symbol: 'AAVE', gecko_id: null, parentProtocol: 'parent#aave', tvl: 1.8e10, change_7d: 0.7 },
  { slug: 'tiny', name: 'Tiny', symbol: '-', gecko_id: null, tvl: 10 },
  { slug: 'dexy', name: 'Dexy', symbol: 'DXY', gecko_id: null, tvl: 0 },
]

describe('llama mappers', () => {
  it('a child resolves its gecko_id through the parent', () => {
    const idx = parentGeckoIndex(P)
    expect(resolveGecko(P[1], idx)).toEqual({ gecko_id: 'aave', source: 'parent' })
    expect(resolveGecko(P[2], idx)).toEqual({ gecko_id: null, source: null })
  })
  it('overviews sum by slug', () => {
    const m = indexOverview([{ slug: 'a', total24h: 1, total7d: 7, total30d: 30 }, { slug: 'a', total24h: 1 }])
    expect(m.get('a')).toEqual({ d1: 2, d7: 7, d30: 30 })
  })
  it('snapshot keeps tokens, real TVL and anything with fee/DEX activity; drops dust', () => {
    const { rows, tokenMap } = buildSnapshot('2026-10-02', P, [], [], [{ slug: 'dexy', total24h: 5 }])
    expect(rows.map((r) => r.llama_slug).sort()).toEqual(['aave', 'aave-v3', 'dexy'])
    expect(rows.find((r) => r.llama_slug === 'dexy')?.dex_vol_24h).toBe(5)
    expect(rows.find((r) => r.llama_slug === 'aave')?.listed_at).toBe('2020-09-13T12:26:40.000Z')
    expect(tokenMap.find((t) => t.llama_slug === 'aave-v3')).toMatchObject({ gecko_id: 'aave', gecko_source: 'parent', symbol: 'AAVE' })
    expect(rows.every((r) => r.source_vintage === 'live')).toBe(true)
  })
})
