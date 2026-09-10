import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase'

// The to-do list behind the TO-DO tab. Service-role only, secret-gated like
// every other admin endpoint. `source` lets Claude and the desk add items too,
// so the list is a shared inbox rather than just a notepad.

export const dynamic = 'force-dynamic'

function auth(secret: string | null) {
  return Boolean(process.env.ADMIN_SECRET) && secret === process.env.ADMIN_SECRET
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  if (!auth(searchParams.get('secret'))) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })
  const { data, error } = await supabase.from('todos').select('*')
    .order('done', { ascending: true })
    .order('priority', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ todos: data ?? [] })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!auth(body?.secret ?? null)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const supabase = createServiceClient()
  if (!supabase) return NextResponse.json({ error: 'db unavailable' }, { status: 503 })

  const action = String(body?.action || 'add')

  if (action === 'add') {
    const title = String(body?.title || '').trim()
    if (!title) return NextResponse.json({ error: 'need a title' }, { status: 400 })
    const priority = Number(body?.priority)
    const { data, error } = await supabase.from('todos').insert({
      title: title.slice(0, 500),
      notes: body?.notes ? String(body.notes).slice(0, 2000) : null,
      priority: priority >= 1 && priority <= 3 ? priority : 2,
      due_date: body?.due_date || null,
      source: String(body?.source || 'jacob').slice(0, 40),
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ todo: data })
  }

  if (action === 'toggle') {
    const id = String(body?.id || '')
    const done = Boolean(body?.done)
    if (!id) return NextResponse.json({ error: 'need an id' }, { status: 400 })
    const { data, error } = await supabase.from('todos')
      .update({ done, done_at: done ? new Date().toISOString() : null })
      .eq('id', id).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ todo: data })
  }

  if (action === 'delete') {
    const id = String(body?.id || '')
    if (!id) return NextResponse.json({ error: 'need an id' }, { status: 400 })
    const { error } = await supabase.from('todos').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (action === 'clear_done') {
    const { error } = await supabase.from('todos').delete().eq('done', true)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'unknown action' }, { status: 400 })
}
