import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getSchedulers, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobSubmittedForApproval } from '@/lib/telegram/templates'
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
  if (effectiveRole !== 'sales') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const newDate: string | undefined = typeof body.date === 'string' ? body.date : undefined

  const patch: Record<string, unknown> = { status: 'awaiting_approval' }
  if (newDate) patch.date = newDate

  await supabase
    .from('jobs')
    .update(patch as never)
    .eq('id', jobId)
    .throwOnError()

  // Fetch after update so date reflects any change
  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const message = tplJobSubmittedForApproval({
    projectTitle: job.project_title,
    jobClient:    job.client,
    pocName:      job.client_poc_name,
    pocPhone:     job.client_poc_phone,
    jobDate:      job.date,
    timeStart:    job.time_start,
    timeEnd:      job.time_end,
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
