import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { insertMessage } from '@/lib/supabase/queries/jobs'
import { getJobRecipients, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobSentBack } from '@/lib/telegram/templates'

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

function sgtTimeNow(): string {
  return new Date().toLocaleTimeString('en-SG', {
    hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'Asia/Singapore',
  })
}

export async function POST(
  req: NextRequest,
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

  const { note } = await req.json() as { note?: string }
  const trimmedNote = note?.trim() ?? ''

  const job = await getJobNotifData(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await supabase
    .from('jobs')
    .update({ status: 'pending' } as never)
    .eq('id', jobId)
    .throwOnError()

  if (trimmedNote) {
    await insertMessage(jobId, profile.id, `[Sent back] ${trimmedNote}`)
  }

  const { salesPoc } = await getJobRecipients(jobId)
  if (salesPoc?.telegram_chat_id) {
    await sendTelegram(
      salesPoc.telegram_chat_id,
      tplJobSentBack({
        projectTitle:  job.project_title,
        jobClient:     job.client,
        pocName:       job.client_poc_name,
        pocPhone:      job.client_poc_phone,
        jobDate:       job.date,
        schedulerName: profile.name,
        sentAt:        sgtTimeNow(),
        note:          trimmedNote || undefined,
        jobUrl:        `${APP_URL}/jobs/${jobId}`,
      }),
    )
  }

  return NextResponse.json({ ok: true })
}
