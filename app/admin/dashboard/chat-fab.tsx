'use client'

import { useState } from 'react'
import ChatWindow from './chat'

// Floating PA: a bubble pinned to the corner of every terminal page. Click to
// pop the chat open, click ✕ (or the bubble) to shrink it away. Conversation
// survives open/close and page moves — ChatWindow persists to localStorage.

export default function ChatFab({ secret }: { secret: string }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      {open && (
        <div className="lmc-solid fixed bottom-20 right-4 z-50 w-[min(92vw,390px)] rounded-lg border border-neutral-200 bg-white shadow-2xl dark:border-white/15">
          <div className="flex items-center justify-between rounded-t-lg border-b border-neutral-200 bg-cyan-100 px-3 py-1.5 dark:border-white/10 dark:bg-cyan-400/15">
            <span className="text-[12px] font-bold uppercase tracking-widest text-cyan-700">🤖 PA — ask me anything</span>
            <button onClick={() => setOpen(false)} className="px-1 text-neutral-600 hover:text-neutral-900 dark:text-neutral-300 dark:hover:text-white">✕</button>
          </div>
          <div className="p-3">
            <ChatWindow secret={secret} />
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        title={open ? 'close PA' : 'open PA'}
        className="fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-neutral-900 text-2xl shadow-xl ring-2 ring-amber-500 transition-transform hover:scale-110"
      >
        {open ? '✕' : '🤖'}
      </button>
    </>
  )
}
