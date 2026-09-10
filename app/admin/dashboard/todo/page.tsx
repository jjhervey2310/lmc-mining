import type { Metadata } from 'next'
import { createServiceClient } from '@/lib/supabase'
import { Shell, Panel, Tile, checkAdmin } from '../ui'
import TodoList, { type Todo } from './todo-list'

// TO-DO — Jacob's list, stored in Supabase so it is the same list on the phone
// and the laptop. `source` means Claude and the desk loop can drop items on it
// too, which is why the tab exists rather than a notes app.

export const metadata: Metadata = { robots: { index: false, follow: false, nocache: true } }
export const dynamic = 'force-dynamic'

export default async function TodoPage({ searchParams }: { searchParams: Promise<{ secret?: string }> }) {
  const { secret = '' } = await searchParams
  checkAdmin(secret)
  const supabase = createServiceClient()

  const { data, error } = (await supabase?.from('todos').select('*')
    .order('done', { ascending: true })
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)) ?? { data: null, error: null }

  const todos = (data ?? []) as Todo[]
  const open = todos.filter((t) => !t.done)
  const now = open.filter((t) => t.priority === 1)
  // Ticked off in the last 7 days — a bit of "you did do things" evidence.
  const weekDone = todos.filter((t) => t.done && t.done_at && Date.parse(t.done_at) > Date.now() - 7 * 864e5)

  return (
    <Shell secret={secret} active="todo">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Tile accent="amber" label="Open" value={String(open.length)} sub="everything not ticked" />
        <Tile accent="rose" label="Needs doing now" value={String(now.length)} tone={now.length ? 'neg' : 'pos'} sub="priority NOW" />
        <Tile accent="green" label="Done this week" value={String(weekDone.length)} tone="pos" sub="last 7 days" />
        <Tile accent="purple" label="On the list" value={String(todos.length)} sub="open + done" />
      </div>

      <div className="mt-3">
        <Panel accent="amber" title="✅ To-do" right={<span className="text-[11px] text-neutral-500">tap the box to tick · × to delete</span>}>
          {error ? (
            // Never render an empty list as "nothing to do" when the read failed.
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-600 dark:text-rose-300">
              Could not load the list: {error.message}. Nothing has been lost — reload the page.
            </div>
          ) : (
            <TodoList initial={todos} secret={secret} />
          )}
        </Panel>
      </div>
    </Shell>
  )
}
