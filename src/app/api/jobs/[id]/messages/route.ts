import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJobById, insertMessage } from '@/lib/supabase/queries/jobs'
import { getJobRecipients } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobMessage } from '@/lib/telegram/templates'

const CHAT_OPEN_DAYS = 7

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: jobId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  type ProfileRow = { id: string; name: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, name')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: ProfileRow | null; error: unknown }
  if (!profile) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const job = await getJobById(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (job.status === 'completed' && job.completed_at) {
    const cutoff = new Date(job.completed_at)
    cutoff.setDate(cutoff.getDate() + CHAT_OPEN_DAYS)
    if (new Date() > cutoff) {
      return NextResponse.json({ error: 'Chat closed' }, { status: 403 })
    }
  }

  const { content } = await req.json() as { content: string }
  if (!content?.trim()) {
    return NextResponse.json({ error: 'content required' }, { status: 400 })
  }

  const message = await insertMessage(jobId, profile.id, content.trim())

  // ── Telegram: notify all job participants except the author ──
  const { salesPoc, installers } = await getJobRecipients(jobId)

  const recipients = [salesPoc, ...installers].filter(
    (r): r is NonNullable<typeof r> =>
      r !== null && r.id !== profile.id && r.telegram_chat_id !== null,
  )

  if (recipients.length > 0) {
    const msg = tplJobMessage({
      jobClient:  job.client,
      jobDate:    job.date,
      authorName: profile.name,
      preview:    content.trim().slice(0, 100),
    })
    for (const r of recipients) {
      await sendTelegram(r.telegram_chat_id!, msg)
    }
  }

  return NextResponse.json({ message })
}
