import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJobRecipients, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobApproved, tplJobAssigned } from '@/lib/telegram/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string; role: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }

  if (!profile || profile.role !== 'scheduler') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase
    .from('jobs')
    .update({
      status:      'scheduled',
      approved_by: profile.id,
      approved_at: new Date().toISOString(),
    } as never)
    .eq('id', jobId)
    .throwOnError()

  const jobUrl = `${APP_URL}/jobs/${jobId}`
  const { salesPoc, installers } = await getJobRecipients(jobId)

  // Notify sales POC
  if (salesPoc?.telegram_chat_id) {
    await sendTelegram(
      salesPoc.telegram_chat_id,
      tplJobApproved({
        projectTitle:  job.project_title,
        jobClient:     job.client,
        pocName:       job.client_poc_name,
        pocPhone:      job.client_poc_phone,
        jobDate:       job.date,
        timeStart:     job.time_start,
        timeEnd:       job.time_end,
        schedulerName: profile.name,
        jobUrl,
      }),
    )
  }

  // Notify each assigned installer
  await Promise.all(
    installers
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
