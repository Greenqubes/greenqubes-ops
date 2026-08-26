import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOwnProject, moveChatToProject } from '@/lib/supabase/queries/assistant-projects'

// Move a conversation into (or out of) a project. RLS scopes both sides:
// the chat update touches only the caller's own row, and getOwnProject
// returns null for a project the caller does not own.
export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string; projectId?: string | null }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!body.id || body.projectId === undefined) return new Response('Bad request', { status: 400 })

  if (body.projectId !== null) {
    const project = await getOwnProject(body.projectId)
    if (!project) return new Response('Not found', { status: 404 })
  }

  const ok = await moveChatToProject(body.id, body.projectId)
  if (!ok) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}
