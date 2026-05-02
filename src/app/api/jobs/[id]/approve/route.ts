import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJobRecipients } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobApproved } from '@/lib/telegram/templates'

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

  type JobRow = { client: string; date: string }
  const { data: job } = await supabase
    .from('jobs')
    .select('client, date')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }

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

  // Notify sales POC via Telegram
  const { salesPoc } = await getJobRecipients(jobId)
  if (salesPoc?.telegram_chat_id) {
    await sendTelegram(
      salesPoc.telegram_chat_id,
      tplJobApproved({
        jobClient:     job.client,
        jobDate:       job.date,
        schedulerName: profile.name,
      }),
    )
  }

  return NextResponse.json({ ok: true })
}
