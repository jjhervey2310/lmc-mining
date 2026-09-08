'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { SYMBOLS, groupedSymbols, type ChartSymbol } from '@/lib/chart/symbols'

interface Props {
  value: ChartSymbol
  onChange: (symbol: ChartSymbol) => void
}

export default function SymbolPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Closing always clears the filter, so the list is never reopened
  // mid-search. Done here rather than in an effect keyed on `open`, which
  // would set state during an effect for something the event already knows.
  const close = useCallback(() => {
    setOpen(false)
    setQuery('')
  }, [])

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open, close])

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return groupedSymbols()
    const matches = SYMBOLS.filter(
      (s) => s.label.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.id.toLowerCase().includes(q),
    )
    const out: { group: string; symbols: ChartSymbol[] }[] = []
    for (const s of matches) {
      const g = out.find((x) => x.group === s.group)
      if (g) g.symbols.push(s)
      else out.push({ group: s.group, symbols: [s] })
    }
    return out
  }, [query])

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        className="flex items-center gap-2 rounded-lg border border-[#222] bg-[#111] px-3 py-2 text-left transition-colors hover:border-[#333]"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-mono text-sm font-bold text-white">{value.label}</span>
        <span className="hidden text-xs text-gray-500 sm:inline">{value.description}</span>
        <span className="text-gray-600" aria-hidden>▾</span>
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 max-h-96 w-80 overflow-y-auto rounded-lg border border-[#222] bg-[#0f0f0f] shadow-2xl">
          <div className="sticky top-0 border-b border-[#222] bg-[#0f0f0f] p-2">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search symbols…"
              className="w-full rounded border border-[#222] bg-[#0a0a0a] px-2 py-1.5 text-sm text-white placeholder-gray-600 outline-none focus:border-[#f7931a]"
            />
          </div>

          {groups.length === 0 && (
            <p className="px-3 py-4 text-sm text-gray-500">No symbols match “{query}”.</p>
          )}

          {groups.map((g) => (
            <div key={g.group}>
              <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-wider text-gray-600">
                {g.group}
              </div>
              {g.symbols.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { onChange(s); close() }}
                  className={`flex w-full items-baseline gap-2 px-3 py-2 text-left transition-colors hover:bg-[#1a1a1a] ${
                    s.id === value.id ? 'bg-[#181818]' : ''
                  }`}
                >
                  <span className={`font-mono text-sm font-bold ${s.id === value.id ? 'text-[#f7931a]' : 'text-white'}`}>
                    {s.label}
                  </span>
                  <span className="truncate text-xs text-gray-500">{s.description}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
