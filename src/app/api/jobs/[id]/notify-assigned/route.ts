import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getEffectiveRole } from '@/lib/utils/role-override'
import { getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobAssigned } from '@/lib/telegram/templates'
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

  type ProfileRow = { role: Role }
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const effectiveRole = await getEffectiveRole(profile.role)
  if (effectiveRole !== 'scheduler') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { installerIds } = await req.json() as { installerIds: string[] }
  if (!Array.isArray(installerIds) || installerIds.length === 0) {
    return NextResponse.json({ ok: true })
  }

  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: installers } = await supabase
    .from('users')
    .select('telegram_chat_id')
    .in('id', installerIds) as { data: Array<{ telegram_chat_id: string | null }> | null }

  const jobUrl = `${APP_URL}/jobs/${jobId}`

  await Promise.all(
    (installers ?? [])
      .filter(i => i.telegram_chat_id)
      .map(i => sendTelegram(
        i.telegram_chat_id!,
        tplJobAssigned({
          projectTitle: job.project_title,
          jobClient:    job.client,
          pocName:      job.client_poc_name,
          pocPhone:     job.client_poc_phone,
          jobDate:      job.date,
          timeStart:    job.time_start,
          timeEnd:      job.time_end,
          location:     job.location,
          jobUrl,
        }),
      )),
  )

  return NextResponse.json({ ok: true })
}
