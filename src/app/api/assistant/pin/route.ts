import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { pinChat } from '@/lib/supabase/queries/assistant'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const { id, pinned } = await req.json() as { id: string; pinned: boolean }
  if (!id || typeof pinned !== 'boolean') {
    return new Response('Bad request', { status: 400 })
  }

  // Enforce 5-pin cap when pinning
  if (pinned) {
    const { count } = await supabase
      .from('asst_chats')
      .select('id', { count: 'exact', head: true })
      .eq('pinned', true)
    if ((count ?? 0) >= 5) {
      return Response.json({ ok: false, reason: 'pin_cap' }, { status: 422 })
    }
  }

  await pinChat(id, pinned)
  return Response.json({ ok: true })
}
