import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getSchedulers } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplProjectPushed } from '@/lib/telegram/templates'
import { mergeDateRanges, formatRanges } from '@/lib/utils/date-ranges'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'
const MANAGER_ROLES: Role[] = ['sales', 'scheduler', 'coordinator', 'admin']

// Bulk push: transitions the given nested PENDING jobs to scheduled and sends
// ONE summary Telegram to schedulers (per-job tplNewJobCreated is deliberately
// NOT sent here — spec §7). The client has already run the per-job clash
// checks and only sends clean ids; this route re-verifies ownership/status.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: projectId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  type ProfileRow = { id: string; name: string; role: Role }
  const { data: profile } = await supabase
    .from('users').select('id, name, role').eq('auth_id', user.id).maybeSingle() as
    { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = await getEffectiveRole(profile.role)
  if (!MANAGER_ROLES.includes(role)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { jobIds } = await req.json() as { jobIds?: string[] }
  if (!Array.isArray(jobIds) || jobIds.length === 0) {
    return NextResponse.json({ error: 'jobIds required' }, { status: 400 })
  }

  const service = createServiceClient()
  type ProjectRow = { id: string; name: string; client: string }
  const { data: project } = await service.from('job_projects')
    .select('id, name, client').eq('id', projectId).maybeSingle() as
    { data: ProjectRow | null; error: unknown }
  if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  type JobRow = { id: string; status: string; project_id: string | null; sales_poc_id: string | null; created_by: string | null; date: string; date_end: string | null }
  const { data: jobs } = await service.from('jobs')
    .select('id, status, project_id, sales_poc_id, created_by, date, date_end')
    .in('id', jobIds) as { data: JobRow[] | null; error: unknown }

  const pushed: string[] = []
  const held: { id: string; reason: 'not-pending' | 'not-yours' | 'not-nested' }[] = []
  for (const job of jobs ?? []) {
    if (job.project_id !== projectId)   { held.push({ id: job.id, reason: 'not-nested' });  continue }
    if (job.status !== 'pending')       { held.push({ id: job.id, reason: 'not-pending' }); continue }
    // Sales push only their own jobs (the 0036 rule, mirrored here because
    // this runs on the service client). Scheduler/coordinator/admin push all
    // (spec §7 — coordinators hold sales-level job access).
    if (role === 'sales'
        && job.sales_poc_id !== profile.id && job.created_by !== profile.id) {
      held.push({ id: job.id, reason: 'not-yours' }); continue
    }
    const { error } = await service.from('jobs')
      .update({ status: 'scheduled' } as never).eq('id', job.id)
    if (error) held.push({ id: job.id, reason: 'not-pending' })
    else pushed.push(job.id)
  }

  if (pushed.length > 0) {
    const pushedRows = (jobs ?? []).filter(j => pushed.includes(j.id))
    const ranges = formatRanges(mergeDateRanges(pushedRows.map(j => ({ date: j.date, date_end: j.date_end }))))
    const message = tplProjectPushed({
      projectName: project.name,
      client:      project.client,
      count:       pushed.length,
      ranges,
      byName:      profile.name,
      projectUrl:  `${APP_URL}/projects/${projectId}`,
    })
    const schedulers = await getSchedulers()
    await Promise.all(
      schedulers.filter(s => s.telegram_chat_id).map(s => sendTelegram(s.telegram_chat_id!, message)),
    )
  }

  return NextResponse.json({ pushed, held })
}
