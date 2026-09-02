import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { timingOnNest } from '@/lib/utils/project-timing'
import type { Role, Punctuality } from '@/lib/supabase/types'

const MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

// Same pattern as the jobs r2_folder trigger (0042), app-side: date + slug + code.
function projectFolder(name: string, id: string): string {
  const slug = (name || 'Untitled')
    .replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'Untitled'
  const today = new Date(Date.now() + 8 * 3_600_000).toISOString().slice(0, 10) // SGT
  return `${today}_${slug}_${id.slice(0, 8)}`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)
  if (!MANAGER_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await req.json() as {
    name?: string; client?: string; description?: string | null
    time_start?: string | null; time_end?: string | null
    default_punctuality?: Punctuality | null
    nestJobIds?: string[]
  }
  const name = (body.name ?? '').trim()
  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 })

  const service = createServiceClient()
  const { data: project, error } = await service
    .from('job_projects')
    .insert({
      name,
      client:              body.client ?? '',
      description:         body.description ?? null,
      time_start:          body.time_start || null,
      time_end:            body.time_end || null,
      default_punctuality: body.default_punctuality ?? null,
      created_by:          profile.id,
    } as never)
    .select('id')
    .single() as unknown as { data: { id: string } | null; error: Error | null }
  if (error || !project) return NextResponse.json({ error: 'Insert failed' }, { status: 500 })

  await service.from('job_projects')
    .update({ r2_folder: projectFolder(name, project.id) } as never)
    .eq('id', project.id)

  // Default buckets — same four as jobs (spec §2).
  await service.from('attachment_buckets').insert([
    { project_id: project.id, name: 'PERMIT-TO-WORK', position: 0 },
    { project_id: project.id, name: 'BCA',            position: 1 },
    { project_id: project.id, name: 'DESIGNER JO',    position: 2 },
    { project_id: project.id, name: 'OTHERS',         position: 3 },
  ] as never)

  // Nest the picker's selections (created-then-nested in one Save).
  const projectTimes = { time_start: body.time_start || null, time_end: body.time_end || null }
  for (const jobId of body.nestJobIds ?? []) {
    type JobRow = { id: string; project_id: string | null; time_start: string | null; time_end: string | null }
    const { data: job } = await service.from('jobs')
      .select('id, project_id, time_start, time_end').eq('id', jobId).maybeSingle() as
      { data: JobRow | null; error: unknown }
    if (!job || job.project_id) continue
    const timing = timingOnNest({ time_start: job.time_start, time_end: job.time_end }, projectTimes)
    await service.from('jobs')
      .update({ project_id: project.id, ...(timing ?? {}) } as never)
      .eq('id', jobId)
  }

  return NextResponse.json({ id: project.id })
}
