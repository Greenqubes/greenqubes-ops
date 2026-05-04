import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSchedulers } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobSubmittedForApproval } from '@/lib/telegram/templates'

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

  if (!profile || profile.role !== 'sales') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await req.json().catch(() => ({}))
  const newDate: string | undefined = typeof body.date === 'string' ? body.date : undefined

  type JobRow = { client: string; date: string }
  const { data: job } = await supabase
    .from('jobs')
    .select('client, date')
    .eq('id', jobId)
    .maybeSingle() as { data: JobRow | null; error: unknown }

  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const patch: Record<string, unknown> = { status: 'awaiting_approval' }
  if (newDate) patch.date = newDate

  await supabase
    .from('jobs')
    .update(patch as never)
    .eq('id', jobId)
    .throwOnError()

  // Notify all schedulers via Telegram
  const schedulers = await getSchedulers()
  const message = tplJobSubmittedForApproval({
    jobClient: job.client,
    jobDate:   newDate ?? job.date,
    salesName: profile.name,
  })
  await Promise.all(
    schedulers
      .filter(s => s.telegram_chat_id)
      .map(s => sendTelegram(s.telegram_chat_id!, message)),
  )

  return NextResponse.json({ ok: true })
}
