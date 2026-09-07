import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getSchedulers, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplNewJobCreated } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveRole = await getEffectiveRole(profile.role)
  if (!['sales', 'scheduler', 'coordinator', 'admin'].includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const newDate: string | undefined = typeof body.date === 'string' ? body.date : undefined

  // A completed job is never pushed back onto the schedule (Nic, 2026-09-07):
  // reopening is the Revert button's job (/revert-complete), which restores the
  // FCFS rank too. Without this guard the button reported success on a finished
  // job and Telegrammed every scheduler about a push that never happened.
  type StatusRow = { status: string }
  const { data: current } = await supabase
    .from('jobs')
    .select('status')
    .eq('id', jobId)
    .maybeSingle() as { data: StatusRow | null; error: unknown }
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (current.status === 'completed') {
    return NextResponse.json({ error: 'job_completed' }, { status: 409 })
  }

  // Workflow V2: no approval step — sales pushes directly onto the schedule.
  const patch: Record<string, unknown> = { status: 'scheduled' }
  if (newDate) patch.date = newDate

  // .select('id') so an UPDATE that RLS filters out cannot pass as success:
  // PostgREST returns 204 with no rows and NO error, so the bare
  // .throwOnError() that used to be here reported ok, wrote nothing, and still
  // fired the scheduler Telegrams below. Same trap as 0055/0056 fixed on the
  // client side.
  const { data: updated } = await supabase
    .from('jobs')
    .update(patch as never)
    .eq('id', jobId)
    .select('id')
    .throwOnError()
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'not_permitted' }, { status: 403 })
  }

  // Fetch after update so date reflects any change
  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const message = tplNewJobCreated({
    projectTitle: job.project_title,
    jobClient:    job.client,
    pocName:      job.client_poc_name,
    pocPhone:     job.client_poc_phone,
    jobDate:      job.date,
    timeStart:    job.time_start,
    timeEnd:      job.time_end,
    location:     job.location,
    salesName:    profile.name,
    jobUrl:       `${APP_URL}/jobs/${jobId}`,
  })

  const schedulers = await getSchedulers()
  await Promise.all(
    schedulers
      .filter(s => s.telegram_chat_id)
      .map(s => sendTelegram(s.telegram_chat_id!, message)),
  )

  return NextResponse.json({ ok: true })
}
