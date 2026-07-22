import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getSchedulers, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplClashNeedsReview } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

// "Notify Scheduler" from the clash modal: the job is LEFT PENDING and all
// schedulers are flagged to resolve the clash and assign. No status change.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { name: string; role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Coordinator included since Phase 3: "Alert Scheduler" from the FCFS panel
  // and the job form's clash-on-edit prompt both land here.
  const effectiveRole = await getEffectiveRole(profile.role)
  if (!['sales', 'scheduler', 'coordinator', 'admin'].includes(effectiveRole)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const clashNames: string[] = Array.isArray(body.clashNames)
    ? body.clashNames.filter((x: unknown): x is string => typeof x === 'string')
    : []

  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const message = tplClashNeedsReview({
    projectTitle: job.project_title,
    jobClient:    job.client,
    jobDate:      job.date,
    timeStart:    job.time_start,
    timeEnd:      job.time_end,
    location:     job.location,
    clashNames,
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
