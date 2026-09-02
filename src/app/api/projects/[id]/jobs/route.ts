import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { timingOnNest, timingOnUnnest } from '@/lib/utils/project-timing'
import type { Role } from '@/lib/supabase/types'

const MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params

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

  const { jobId, action } = await req.json() as { jobId?: string; action?: 'nest' | 'unnest' }
  if (!jobId || (action !== 'nest' && action !== 'unnest')) {
    return NextResponse.json({ error: 'jobId and action (nest|unnest) required' }, { status: 400 })
  }

  const service = createServiceClient()
  type JobRow = { id: string; project_id: string | null; time_start: string | null; time_end: string | null }
  const { data: job } = await service.from('jobs')
    .select('id, project_id, time_start, time_end').eq('id', jobId).maybeSingle() as
    { data: JobRow | null; error: unknown }
  if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

  if (action === 'nest') {
    if (job.project_id === projectId) return NextResponse.json({ ok: true }) // idempotent
    if (job.project_id) return NextResponse.json({ error: 'Job is already in another project' }, { status: 409 })
    type ProjectRow = { time_start: string | null; time_end: string | null }
    const { data: project } = await service.from('job_projects')
      .select('time_start, time_end').eq('id', projectId).maybeSingle() as
      { data: ProjectRow | null; error: unknown }
    if (!project) return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    const timing = timingOnNest(
      { time_start: job.time_start, time_end: job.time_end },
      { time_start: project.time_start, time_end: project.time_end },
    )
    const { error: nestError } = await service.from('jobs')
      .update({ project_id: projectId, ...(timing ?? {}) } as never).eq('id', jobId)
    if (nestError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  } else {
    if (job.project_id !== projectId) return NextResponse.json({ ok: true }) // idempotent
    const { error: unnestError } = await service.from('jobs')
      .update({ project_id: null, ...timingOnUnnest() } as never).eq('id', jobId)
    if (unnestError) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
