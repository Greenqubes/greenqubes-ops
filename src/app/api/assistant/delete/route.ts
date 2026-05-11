import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteChat } from '@/lib/supabase/queries/assistant'

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { id: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const { id } = body
  if (!id) return new Response('Bad request', { status: 400 })

  await deleteChat(id)
  return Response.json({ ok: true })
}
