import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pinChat } from '@/lib/supabase/queries/assistant'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  type Profile = { id: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }
  if (!profile) return new Response('Not provisioned', { status: 403 })

  let body: { id: string; pinned: boolean }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const { id, pinned } = body
  if (!id || typeof pinned !== 'boolean') {
    return new Response('Bad request', { status: 400 })
  }

  // Enforce 5-pin cap when pinning (filtered by this user only)
  if (pinned) {
    const { count } = await supabase
      .from('asst_chats')
      .select('id', { count: 'exact', head: true })
      .eq('pinned', true)
      .eq('user_id', profile.id)
    if ((count ?? 0) >= 5) {
      return Response.json({ ok: false, reason: 'pin_cap' }, { status: 422 })
    }
  }

  await pinChat(id, pinned)
  return Response.json({ ok: true })
}
