import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { id: string; topic: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const { id, topic } = body
  if (!id || typeof topic !== 'string' || !topic.trim()) {
    return new Response('Bad request', { status: 400 })
  }

  // Use the RLS-respecting client: the "asst_chats: own update" policy scopes
  // this to the caller's own conversations, so passing another user's chat id
  // affects no rows (audit 2026-08-13, finding #4).
  const { count, error } = await supabase
    .from('asst_chats')
    .update({ topic: topic.trim() } as never, { count: 'exact' })
    .eq('id', id)

  if (error) return new Response('Update failed', { status: 500 })
  if (!count) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}
