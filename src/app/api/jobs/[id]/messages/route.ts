import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJobById, insertMessage, insertVoiceMessage } from '@/lib/supabase/queries/jobs'
import { getJobRecipients } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobMessage, tplJobVoiceNote } from '@/lib/telegram/templates'

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

  const { id: authorId, name: authorName } = profile

  const job = await getJobById(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (job.status === 'completed' && job.completed_at) {
    const cutoff = new Date(job.completed_at)
    cutoff.setDate(cutoff.getDate() + CHAT_OPEN_DAYS)
    if (new Date() > cutoff) {
      return NextResponse.json({ error: 'Chat closed' }, { status: 403 })
    }
  }

  const body = await req.json() as { content?: string; kind?: string; voice_url?: string }
  const isVoice = body.kind === 'voice'

  // ── Telegram helpers ──────────────────────────────────────────────────────
  async function notifyParticipants(tgMessage: string) {
    const { salesPoc, installers } = await getJobRecipients(jobId)
    const recipients = [salesPoc, ...installers].filter(
      (r): r is NonNullable<typeof r> =>
        r !== null && r.id !== authorId && r.telegram_chat_id !== null,
    )
    await Promise.all(recipients.map(r => sendTelegram(r.telegram_chat_id!, tgMessage)))
  }

  // ── Voice note ────────────────────────────────────────────────────────────
  if (isVoice) {
    const voiceUrl = body.voice_url?.trim()
    if (!voiceUrl) return NextResponse.json({ error: 'voice_url required' }, { status: 400 })

    const message = await insertVoiceMessage(jobId, authorId, voiceUrl)

    await notifyParticipants(tplJobVoiceNote({
      jobClient:  job.client,
      jobDate:    job.date,
      authorName: authorName,
    }))

    return NextResponse.json({ message })
  }

  // ── Text message ──────────────────────────────────────────────────────────
  const content = body.content?.trim() ?? ''
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const message = await insertMessage(jobId, authorId, content)

  await notifyParticipants(tplJobMessage({
    jobClient:  job.client,
    jobDate:    job.date,
    authorName: authorName,
    preview:    content.slice(0, 100),
  }))

  return NextResponse.json({ message })
}
