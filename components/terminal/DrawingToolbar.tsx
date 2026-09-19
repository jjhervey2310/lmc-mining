'use client'

import { DRAWING_COLORS, TOOL_LABELS, type DrawingTool } from '@/lib/chart/drawings'

interface Props {
  tool: DrawingTool
  onToolChange: (tool: DrawingTool) => void
  color: string
  onColorChange: (color: string) => void
  drawingCount: number
  hasSelection: boolean
  onDeleteSelected: () => void
  onClearAll: () => void
}

/** Compact glyphs — an icon font would be a dependency for six shapes. */
const TOOL_ICONS: Record<DrawingTool, string> = {
  cursor: '✥',
  select: '⬈',
  trendline: '╱',
  horizontal: '━',
  ray: '→',
  rect: '▭',
  fib: '≡',
}

const TOOLS: DrawingTool[] = ['cursor', 'select', 'trendline', 'horizontal', 'ray', 'rect', 'fib']

export default function DrawingToolbar({
  tool, onToolChange, color, onColorChange,
  drawingCount, hasSelection, onDeleteSelected, onClearAll,
}: Props) {
  return (
    <div className="flex shrink-0 flex-row items-center gap-1 border-b border-[#222] bg-[#0f0f0f] p-1.5 lg:flex-col lg:border-b-0 lg:border-r lg:py-2">
      {TOOLS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onToolChange(t)}
          title={TOOL_LABELS[t]}
          aria-label={TOOL_LABELS[t]}
          aria-pressed={tool === t}
          className={`flex h-9 w-9 items-center justify-center rounded-md text-base transition-colors ${
            tool === t ? 'bg-[#f7931a] text-black' : 'text-gray-400 hover:bg-[#1c1c1c] hover:text-white'
          }`}
        >
          <span aria-hidden>{TOOL_ICONS[t]}</span>
        </button>
      ))}

      <div className="mx-1 h-6 w-px bg-[#222] lg:mx-0 lg:my-1 lg:h-px lg:w-6" />

      {/* Colour applies to the next shape drawn. */}
      <div className="flex flex-row gap-1 lg:flex-col">
        {DRAWING_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onColorChange(c)}
            title={`Draw in ${c}`}
            aria-label={`Draw in ${c}`}
            aria-pressed={color === c}
            className={`h-4 w-4 rounded-full border transition-transform ${
              color === c ? 'scale-125 border-white' : 'border-transparent hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="mx-1 h-6 w-px bg-[#222] lg:mx-0 lg:my-1 lg:h-px lg:w-6" />

      <button
        type="button"
        onClick={onDeleteSelected}
        disabled={!hasSelection}
        title="Delete selected (Del)"
        aria-label="Delete selected drawing"
        className="flex h-9 w-9 items-center justify-center rounded-md text-base text-gray-400 transition-colors hover:bg-[#1c1c1c] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400"
      >
        <span aria-hidden>⌫</span>
      </button>
      <button
        type="button"
        onClick={onClearAll}
        disabled={drawingCount === 0}
        title={`Clear all drawings${drawingCount ? ` (${drawingCount})` : ''}`}
        aria-label="Clear all drawings"
        className="flex h-9 w-9 items-center justify-center rounded-md text-xs font-bold text-gray-400 transition-colors hover:bg-[#1c1c1c] hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-25 disabled:hover:bg-transparent disabled:hover:text-gray-400"
      >
        <span aria-hidden>✕</span>
      </button>
    </div>
  )
}
