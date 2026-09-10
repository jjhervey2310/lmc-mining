'use client'

import { useState } from 'react'

// The to-do list. Optimistic on every action so a tick feels instant on the
// phone, then reconciled against the server; a failed write rolls back and says
// so rather than leaving a lie on screen.

export interface Todo {
  id: string
  title: string
  notes: string | null
  done: boolean
  priority: number
  due_date: string | null
  source: string
  created_at: string
  done_at: string | null
}

const PRIORITY: Record<number, { label: string; chip: string }> = {
  1: { label: 'NOW', chip: 'bg-rose-500/15 text-rose-600 dark:text-rose-300 border-rose-500/40' },
  2: { label: 'NEXT', chip: 'bg-amber-400/15 text-amber-700 dark:text-amber-300 border-amber-500/40' },
  3: { label: 'WHENEVER', chip: 'bg-white/5 text-neutral-500 dark:text-neutral-400 border-neutral-400/30' },
}

export default function TodoList({ initial, secret }: { initial: Todo[]; secret: string }) {
  const [todos, setTodos] = useState<Todo[]>(initial)
  const [title, setTitle] = useState('')
  const [priority, setPriority] = useState(2)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [showDone, setShowDone] = useState(false)

  async function call(body: Record<string, unknown>) {
    const res = await fetch('/api/admin/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, ...body }),
    })
    const d = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(d.error || `failed (${res.status})`)
    return d
  }

  async function add() {
    const t = title.trim()
    if (!t || busy) return
    setBusy(true); setErr(null)
    try {
      const { todo } = await call({ action: 'add', title: t, priority })
      setTodos((x) => [todo, ...x])
      setTitle('')
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'could not add that')
    } finally { setBusy(false) }
  }

  async function toggle(t: Todo) {
    const next = !t.done
    setTodos((x) => x.map((y) => (y.id === t.id ? { ...y, done: next } : y)))
    setErr(null)
    try {
      await call({ action: 'toggle', id: t.id, done: next })
    } catch (e) {
      // Put it back the way it was — never leave the screen claiming a save.
      setTodos((x) => x.map((y) => (y.id === t.id ? { ...y, done: t.done } : y)))
      setErr(e instanceof Error ? e.message : 'could not save that tick')
    }
  }

  async function remove(t: Todo) {
    const before = todos
    setTodos((x) => x.filter((y) => y.id !== t.id))
    setErr(null)
    try {
      await call({ action: 'delete', id: t.id })
    } catch (e) {
      setTodos(before)
      setErr(e instanceof Error ? e.message : 'could not delete that')
    }
  }

  const open = todos.filter((t) => !t.done)
  const done = todos.filter((t) => t.done)
  const shown = showDone ? done : open

  return (
    <div>
      {/* Add box */}
      <div className="mb-3 flex flex-wrap gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="what needs doing?"
          className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-[14px] text-neutral-900 placeholder:text-neutral-400 focus:border-amber-500 focus:outline-none dark:border-white/15 dark:bg-white/5 dark:text-neutral-100 dark:placeholder:text-neutral-500"
        />
        <select value={priority} onChange={(e) => setPriority(Number(e.target.value))}
          className="rounded-lg border border-neutral-300 bg-white px-2 py-2 text-[12px] font-bold uppercase tracking-wide text-neutral-700 dark:border-white/15 dark:bg-white/5 dark:text-neutral-200">
          <option value={1}>Now</option>
          <option value={2}>Next</option>
          <option value={3}>Whenever</option>
        </select>
        <button onClick={add} disabled={busy || !title.trim()}
          className="rounded-lg bg-amber-500 px-4 py-2 text-[13px] font-bold uppercase tracking-wide text-black transition-colors hover:bg-amber-400 disabled:opacity-40">
          Add
        </button>
      </div>

      {err && <div className="mb-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[12px] text-rose-600 dark:text-rose-300">{err}</div>}

      {/* Open / done switch */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {([[false, `Open (${open.length})`], [true, `Done (${done.length})`]] as const).map(([v, label]) => (
          <button key={String(v)} onClick={() => setShowDone(v)}
            className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide transition-colors ${
              showDone === v ? 'bg-amber-500 text-black' : 'bg-white/10 text-neutral-600 hover:bg-white/20 dark:text-neutral-300'
            }`}>{label}</button>
        ))}
      </div>

      <div className="space-y-1.5">
        {shown.map((t) => {
          const p = PRIORITY[t.priority] ?? PRIORITY[2]
          return (
            <div key={t.id}
              className="group flex items-start gap-3 rounded-lg border border-neutral-200 bg-white px-3 py-2 transition-colors hover:border-amber-500/50 dark:border-white/10 dark:bg-white/[0.03]">
              <button onClick={() => toggle(t)} aria-label={t.done ? 'mark not done' : 'mark done'}
                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[12px] font-bold transition-colors ${
                  t.done ? 'border-emerald-500 bg-emerald-500 text-black' : 'border-neutral-400 hover:border-amber-500 dark:border-white/25'
                }`}>{t.done ? '✓' : ''}</button>

              <div className="min-w-0 flex-1">
                <div className={`text-[14px] leading-snug ${t.done ? 'text-neutral-400 line-through dark:text-neutral-500' : 'text-neutral-900 dark:text-neutral-100'}`}>
                  {t.title}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide">
                  {!t.done && <span className={`rounded border px-1.5 py-0.5 font-bold ${p.chip}`}>{p.label}</span>}
                  {t.source !== 'jacob' && <span className="text-neutral-400">from {t.source}</span>}
                  <span className="text-neutral-400">{new Date(t.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                {t.notes && <div className="mt-1 text-[12px] text-neutral-500 dark:text-neutral-400">{t.notes}</div>}
              </div>

              <button onClick={() => remove(t)} aria-label="delete"
                className="shrink-0 px-1 text-[14px] text-neutral-300 opacity-0 transition-opacity hover:text-rose-500 group-hover:opacity-100 dark:text-neutral-600">
                ×
              </button>
            </div>
          )
        })}
        {!shown.length && (
          <div className="rounded-lg border border-dashed border-neutral-300 px-3 py-6 text-center text-[13px] text-neutral-500 dark:border-white/15">
            {showDone ? 'Nothing ticked off yet.' : 'Nothing on the list. Add the first thing above.'}
          </div>
        )}
      </div>
    </div>
  )
}
