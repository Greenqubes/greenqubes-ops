import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  listProjects, listProjectFiles, createProject, updateProject, deleteProject,
} from '@/lib/supabase/queries/assistant-projects'
import { deleteObject } from '@/lib/storage/r2'

// Assistant Projects (Phase 4). Every statement runs on the RLS client —
// owner-only policies (0047) are the enforcement, so a foreign id is a 404.

const MAX_NAME_LEN = 60

async function requireProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { id: string } | null; error: unknown }
  return profile
}

export async function GET() {
  const profile = await requireProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  const projects = await listProjects()
  const files    = await listProjectFiles(projects.map(p => p.id))
  return Response.json(projects.map(p => ({
    ...p,
    files: files.filter(f => f.project_id === p.id),
  })))
}

export async function POST(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  let body: { name?: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  const name = body.name?.trim()
  if (!name || name.length > MAX_NAME_LEN) return new Response('Bad request', { status: 400 })

  const project = await createProject(profile.id, name)
  if (!project) return new Response('Create failed', { status: 500 })
  return Response.json(project, { status: 201 })
}

export async function PATCH(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string; name?: string; instructions?: string | null }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!body.id) return new Response('Bad request', { status: 400 })

  const fields: { name?: string; instructions?: string | null } = {}
  if (body.name !== undefined) {
    const name = body.name.trim()
    if (!name || name.length > MAX_NAME_LEN) return new Response('Bad request', { status: 400 })
    fields.name = name
  }
  if (body.instructions !== undefined) {
    fields.instructions = body.instructions?.trim() || null
  }
  if (Object.keys(fields).length === 0) return new Response('Bad request', { status: 400 })

  const ok = await updateProject(body.id, fields)
  if (!ok) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return new Response('Unauthorized', { status: 401 })

  let body: { id?: string }
  try { body = await req.json() } catch { return new Response('Bad request', { status: 400 }) }
  if (!body.id) return new Response('Bad request', { status: 400 })

  // R2 objects first, then the row (delete-fix lesson, 2026-08-19). The RLS
  // read returns rows only for the owner, so a foreign id deletes nothing.
  // Chats are released by the ON DELETE SET NULL FK — never deleted.
  const files = await listProjectFiles([body.id])
  for (const f of files) {
    try { await deleteObject(f.r2_key) } catch { /* idempotent; row cascade still applies */ }
  }
  const ok = await deleteProject(body.id)
  if (!ok) return new Response('Not found', { status: 404 })
  return Response.json({ ok: true })
}
