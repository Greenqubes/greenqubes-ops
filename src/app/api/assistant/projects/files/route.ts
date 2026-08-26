import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deleteObject } from '@/lib/storage/r2'
import { validateProjectFile, isOwnProjectKey } from '@/lib/ai/attachments'
import {
  getOwnProject, listProjectFiles, addProjectFile,
  getProjectFileRow, deleteProjectFileRow,
} from '@/lib/supabase/queries/assistant-projects'

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

// Register an uploaded project file. The key must sit in the caller's own
// prefix for this project — a forged key is rejected, so a row can never
// point at another user's object (or a job folder).
export async function POST(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as {
    projectId?: string; key?: string; name?: string; mime?: string; size?: number
  }
  const { projectId, key, name, mime, size } = body
  if (!projectId || !key || !name || !mime || typeof size !== 'number') {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  const project = await getOwnProject(projectId)
  if (!project) return NextResponse.json({ error: 'not_found' }, { status: 404 })
  if (!isOwnProjectKey(key, profile.id, projectId)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 })
  }

  // Caps re-checked at register time (upload-url checked too, but two uploads
  // could race past a single check).
  const existing = await listProjectFiles([projectId])
  const problem  = validateProjectFile(
    name, mime, size,
    existing.length,
    existing.reduce((s, f) => s + f.size, 0),
  )
  if (problem) return NextResponse.json({ error: problem }, { status: 400 })

  const row = await addProjectFile({ project_id: projectId, name, r2_key: key, mime, size })
  if (!row) return NextResponse.json({ error: 'insert_failed' }, { status: 500 })
  return NextResponse.json(row, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const profile = await requireProfile()
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json() as { id?: string }
  if (!body.id) return NextResponse.json({ error: 'bad_request' }, { status: 400 })

  // RLS read: null for anyone but the owner. R2 object first, then the row.
  const row = await getProjectFileRow(body.id)
  if (!row) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  await deleteObject(row.r2_key)
  const ok = await deleteProjectFileRow(body.id)
  if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
