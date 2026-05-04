import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { tagConversation } from '@/lib/ai/tagger'
import { saveChat } from '@/lib/supabase/queries/assistant'
import type { Role } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  type Profile = { id: string; role: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }
  if (!profile) return new Response('Not provisioned', { status: 403 })

  const { messages } = await req.json() as {
    messages: { role: string; content: string }[]
  }

  if (messages.length < 2) {
    return Response.json({ ok: true, skipped: true })
  }

  const [tag] = await Promise.all([
    tagConversation(messages, profile.role as Role),
  ])

  const id = await saveChat(profile.id, messages, tag)

  return Response.json({ ok: true, id })
}
