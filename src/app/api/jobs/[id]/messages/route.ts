import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJobById, insertMessage, insertVoiceMessage } from '@/lib/supabase/queries/jobs'
import { getJobRecipients, getJobNotifData } from '@/lib/supabase/queries/notifications'
import { sendTelegram } from '@/lib/telegram/bot'
import { tplJobMessage, tplJobVoiceNote } from '@/lib/telegram/templates'

const CHAT_OPEN_DAYS = 7
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

  // Fetch notification data (project title, POC fields)
  const notifData = await getJobNotifData(jobId)
  const jobUrl = `${APP_URL}/jobs/${jobId}`

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

    if (notifData) {
      await notifyParticipants(tplJobVoiceNote({
        projectTitle: notifData.project_title,
        jobClient:    notifData.client,
        pocName:      notifData.client_poc_name,
        pocPhone:     notifData.client_poc_phone,
        jobDate:      notifData.date,
        authorName,
        sentAt:       sgtTimeNow(),
        jobUrl,
      }))
    }

    return NextResponse.json({ message })
  }

  // ── Text message ──────────────────────────────────────────────────────────
  const content = body.content?.trim() ?? ''
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })

  const message = await insertMessage(jobId, authorId, content)

  if (notifData) {
    await notifyParticipants(tplJobMessage({
      projectTitle: notifData.project_title,
      jobClient:    notifData.client,
      pocName:      notifData.client_poc_name,
      pocPhone:     notifData.client_poc_phone,
      jobDate:      notifData.date,
      authorName,
      sentAt:       sgtTimeNow(),
      preview:      content.slice(0, 100),
      jobUrl,
    }))
  }

  return NextResponse.json({ message })
}
