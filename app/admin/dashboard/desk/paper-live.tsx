'use client'
import { useEffect, useState } from 'react'

// Live view of the shadow paper ledger: entry/stop/target from the DB, price from /api/fund/prices (the
// same feed the ROBINHOOD tab uses, 60s refresh). Unrealised % is gross of fees; fee_model records the
// costs the exit will be graded with. Nothing here writes anything.

export interface PaperRow { id: number; symbol: string; opened_at: string; entry_px: number; stop_px: number | null; target_px: number | null; size_usd: number; status: string; exit_px: number | null; exit_reason: string | null; pnl_pct: number | null; expires_at?: string | null; rule_version?: string }
type Live = { price: number }

const pct = (a: number, b: number) => ((a / b - 1) * 100)
const fmtPx = (n: number | null) => n == null ? '—' : n >= 100 ? n.toFixed(2) : n >= 1 ? n.toFixed(3) : n.toPrecision(4)

export default function PaperLive({ rows, secret }: { rows: PaperRow[]; secret: string }) {
  const [live, setLive] = useState<Record<string, Live>>({})
  const [at, setAt] = useState<string | null>(null)
  const open = rows.filter((r) => r.status === 'open')
  const syms = [...new Set(open.map((r) => r.symbol))]
  useEffect(() => {
    if (!syms.length) return
    let dead = false
    const pull = async () => {
      try {
        const r = await fetch(`/api/fund/prices?symbols=${syms.join(',')}`, { cache: 'no-store', headers: { 'x-admin-secret': secret } })
        if (!r.ok) return
        const j = (await r.json()) as { at: string | null; prices: Record<string, Live> }
        if (!dead) { setLive(j.prices ?? {}); setAt(j.at) }
      } catch { /* keep the last quote */ }
    }
    pull(); const t = setInterval(pull, 60_000)
    return () => { dead = true; clearInterval(t) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syms.join(','), secret])

  const unreal = open.reduce((s, r) => { const p = live[r.symbol]?.price; return p ? s + (r.size_usd * (p / r.entry_px - 1)) : s }, 0)
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-neutral-500"><span>{open.length} open · unrealised {unreal >= 0 ? '+' : ''}{unreal.toFixed(2)} USD on {open.reduce((s, r) => s + r.size_usd, 0)} USD paper</span><span>{at ? `prices ${new Date(at).toLocaleTimeString('en-US', { hour12: false })}` : 'prices loading…'}</span></div>
      <table className="w-full text-xs"><thead><tr className="text-left text-neutral-500"><th>sym</th><th className="text-right">entry</th><th className="text-right">live</th><th className="text-right">unreal</th><th className="text-right">stop</th><th className="text-right">target</th><th>status</th></tr></thead>
        <tbody>{rows.map((r) => {
          const p = r.status === 'open' ? live[r.symbol]?.price : r.exit_px
          const u = p ? pct(p, r.entry_px) : null
          const toStop = p && r.stop_px ? pct(r.stop_px, p) : null
          const toTgt = p && r.target_px ? pct(r.target_px, p) : null
          return (
            <tr key={r.id} className="border-t border-neutral-200/60 dark:border-white/5">
              <td className="py-0.5 font-bold">{r.symbol}</td>
              <td className="text-right font-mono">{fmtPx(r.entry_px)}</td>
              <td className="text-right font-mono">{fmtPx(p ?? null)}</td>
              <td className={`text-right font-mono ${u == null ? '' : u >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{u == null ? '—' : `${u >= 0 ? '+' : ''}${u.toFixed(1)}%`}</td>
              <td className="text-right font-mono">{fmtPx(r.stop_px)}{toStop != null && <span className="text-neutral-500"> ({toStop.toFixed(0)}%)</span>}</td>
              <td className="text-right font-mono">{fmtPx(r.target_px)}{toTgt != null && <span className="text-neutral-500"> (+{toTgt.toFixed(0)}%)</span>}</td>
              <td>{r.status}{r.exit_reason ? ` · ${r.exit_reason}` : ''}{r.status === 'open' && r.expires_at ? ` · exp ${r.expires_at.slice(0, 10)}` : ''}</td>
            </tr>
          )
        })}</tbody></table>
      {!rows.length && <p className="text-sm text-neutral-500">No paper positions yet.</p>}
    </div>
  )
}
