import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { deleteObject } from '@/lib/storage/r2'
import type { Role, Punctuality } from '@/lib/supabase/types'

const MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

async function requireManager() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return null
  const role = await getEffectiveRole(profile.role)
  if (!MANAGER_ROLES.includes(role)) return null
  return { profile, role }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireManager()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as Partial<{
    name: string; client: string; description: string | null
    time_start: string | null; time_end: string | null
    default_punctuality: Punctuality | null
  }>

  const service = createServiceClient()
  type ProjectRow = { id: string; time_start: string | null; time_end: string | null }
  const { data: project } = await service.from('job_projects')
    .select('id, time_start, time_end').eq('id', id).maybeSingle() as
    { data: ProjectRow | null; error: unknown }
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if ('name' in body)                updates.name                = (body.name ?? '').trim() || 'Untitled'
  if ('client' in body)              updates.client              = body.client ?? ''
  if ('description' in body)         updates.description         = body.description ?? null
  if ('time_start' in body)          updates.time_start          = body.time_start || null
  if ('time_end' in body)            updates.time_end            = body.time_end || null
  if ('default_punctuality' in body) updates.default_punctuality = body.default_punctuality ?? null

  const { error } = await service.from('job_projects').update(updates as never).eq('id', id)
  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })

  // Timing fan-out (spec §5): a changed project time is written onto every
  // job still following it. Clash checks are NOT re-run here (documented).
  const timeTouched = 'time_start' in body || 'time_end' in body
  const newStart = 'time_start' in body ? (body.time_start || null) : project.time_start
  const newEnd   = 'time_end'   in body ? (body.time_end   || null) : project.time_end
  if (timeTouched && (newStart !== project.time_start || newEnd !== project.time_end)) {
    await service.from('jobs')
      .update({ time_start: newStart, time_end: newEnd } as never)
      .eq('project_id', id)
      .eq('time_inherited', true)
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const auth = await requireManager()
  if (!auth) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const service = createServiceClient()

  // 1. Un-nest every job — jobs are NEVER deleted (spec §3). Times stay.
  await service.from('jobs')
    .update({ project_id: null, time_inherited: false } as never)
    .eq('project_id', id)

  // 2. Delete the project's R2 objects, then rows (files → buckets → project).
  type FileRow = { id: string; kind: string; r2_key: string }
  const { data: files } = await service.from('files')
    .select('id, kind, r2_key').eq('project_id', id) as { data: FileRow[] | null; error: unknown }
  for (const f of files ?? []) {
    if (f.kind !== 'url_link' && f.r2_key) { try { await deleteObject(f.r2_key) } catch { /* row still goes */ } }
  }
  await service.from('files').delete().eq('project_id', id)
  await service.from('attachment_buckets').delete().eq('project_id', id)
  const { error } = await service.from('job_projects').delete().eq('id', id)
  if (error) return NextResponse.json({ error: 'Delete failed' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
