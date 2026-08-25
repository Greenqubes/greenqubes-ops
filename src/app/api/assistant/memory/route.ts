import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { embed } from '@/lib/ai/embed'

// The Memory manager (assistant upgrade Phase 2): everything the assistant
// remembers about the calling user — one row per meaningful chat's summary.
// All statements run on the RLS client, so they only ever touch the caller's
// own rows (asst_chats own-select since 0030; own-update per the rename route).

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { data, error } = await supabase
    .from('asst_chats')
    .select('id, topic, summary, ts')
    .not('summary', 'is', null)
    .order('ts', { ascending: false })
  if (error) return new Response('Fetch failed', { status: 500 })
  return Response.json(data ?? [])
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string; summary?: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const summary = body.summary?.trim()
  if (!body.id || !summary) return new Response('Bad request', { status: 400 })

  // Topic feeds the embedding input (same shape as save time: topic + summary)
  const { data: row } = await supabase
    .from('asst_chats')
    .select('topic')
    .eq('id', body.id)
    .maybeSingle() as { data: { topic: string | null } | null; error: unknown }
  if (!row) return new Response('Not found', { status: 404 })

  let embeddingStr: string | null = null
  try {
    const vec    = await embed(`${row.topic ?? ''}\n${summary}`, 'document')
    embeddingStr = `[${vec.join(',')}]`
  } catch { /* embedding optional — the corrected text still saves */ }

  const { count, error } = await supabase
    .from('asst_chats')
    .update({ summary, ...(embeddingStr ? { embedding: embeddingStr } : {}) } as never, { count: 'exact' })
    .eq('id', body.id)
  if (error) return new Response('Update failed', { status: 500 })
  if (!count) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!body.id) return new Response('Bad request', { status: 400 })

  // Forget = clear summary + embedding. The conversation itself stays in
  // history (deleting the chat already removes both — spec).
  const { count, error } = await supabase
    .from('asst_chats')
    .update({ summary: null, embedding: null } as never, { count: 'exact' })
    .eq('id', body.id)
  if (error) return new Response('Update failed', { status: 500 })
  if (!count) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}
