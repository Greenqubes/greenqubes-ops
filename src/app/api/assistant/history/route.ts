import { createClient } from '@/lib/supabase/server'
import { getRecentChats } from '@/lib/supabase/queries/assistant'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  const chats = await getRecentChats(30)
  return Response.json(chats)
}
