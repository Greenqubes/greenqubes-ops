import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

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

  // Use service client for the update (consistent with updateChat/saveChat pattern)
  const db = createServiceClient()
  const { error } = await db
    .from('asst_chats')
    .update({ topic: topic.trim() } as never)
    .eq('id', id)

  if (error) return new Response('Update failed', { status: 500 })
  return Response.json({ ok: true })
}
