import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getJobById, insertMessage, insertVoiceMessage } from '@/lib/supabase/queries/jobs'
import { getJobRecipients, getJobNotifData, getJobChatState, countUnseenMessages, upsertJobChatNotified } from '@/lib/supabase/queries/notifications'
import { sendTelegramWithKeyboard } from '@/lib/telegram/bot'
import { tplJobChatBatch } from '@/lib/telegram/templates'

const CHAT_OPEN_DAYS = 7
const THROTTLE_MS    = 1 * 60 * 1000
const APP_URL        = process.env.NEXT_PUBLIC_APP_URL ?? 'https://greenqubes-ops.vercel.app'

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

  const { id: authorId } = profile

  const job = await getJobById(jobId)
  if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (job.status === 'completed' && job.completed_at) {
    const cutoff = new Date(job.completed_at)
    cutoff.setDate(cutoff.getDate() + CHAT_OPEN_DAYS)
    if (new Date() > cutoff) {
      return NextResponse.json({ error: 'Chat closed' }, { status: 403 })
    }
  }

  const body = await req.json() as { content?: string; kind?: string; voice_url?: string; filename?: string }
  const isVoice      = body.kind === 'voice'
  const isAttachment = body.kind === 'attachment'

  const notifData = await getJobNotifData(jobId)
  const jobUrl    = `${APP_URL}/jobs/${jobId}`

  // ── Throttled Telegram notifications ─────────────────────────────────────────
  async function notifyParticipantsThrottled(isAttachmentMsg = false) {
    if (!notifData) return
    const { salesPoc, installers } = await getJobRecipients(jobId)
    const recipients = [salesPoc, ...installers].filter(
      (r): r is NonNullable<typeof r> =>
        r !== null && r.id !== authorId && r.telegram_chat_id !== null,
    )

    await Promise.all(recipients.map(async r => {
      // Throttle + count: best-effort. If DB queries fail, fire with count=1.
      let count = 1
      try {
        const state  = await getJobChatState(jobId, r.id)
        const lastMs = state?.last_notified_at ? new Date(state.last_notified_at).getTime() : 0
        if (Date.now() - lastMs < THROTTLE_MS) return

        const unseenInDb = await countUnseenMessages(jobId, r.id, state)
        count = Math.max(1, unseenInDb + (isAttachmentMsg ? 1 : 0))
      } catch (err) {
        console.error('[chat-notif] state/count lookup failed, sending with count=1', err)
      }

      const text = tplJobChatBatch({
        count,
        projectTitle: notifData!.project_title,
        jobClient:    notifData!.client,
        jobDate:      notifData!.date,
        timeStart:    notifData!.time_start,
        timeEnd:      notifData!.time_end,
        location:     notifData!.location,
      })
      await sendTelegramWithKeyboard(
        r.telegram_chat_id!,
        text,
        [[{ text: 'View in app →', url: jobUrl }]],
      )
      try { await upsertJobChatNotified(jobId, r.id) } catch { /* best-effort */ }
    }))
  }

  // ── Voice note ────────────────────────────────────────────────────────────────
  if (isVoice) {
    const voiceUrl = body.voice_url?.trim()
    if (!voiceUrl) return NextResponse.json({ error: 'voice_url required' }, { status: 400 })
    const message = await insertVoiceMessage(jobId, authorId, voiceUrl)
    await notifyParticipantsThrottled()
    return NextResponse.json({ message })
  }

  // ── File attachment (notification only — file record already inserted client-side) ──
  if (isAttachment) {
    await notifyParticipantsThrottled(true)
    return NextResponse.json({ ok: true })
  }

  // ── Text message ──────────────────────────────────────────────────────────────
  const content = body.content?.trim() ?? ''
  if (!content) return NextResponse.json({ error: 'content required' }, { status: 400 })
  const message = await insertMessage(jobId, authorId, content)
  await notifyParticipantsThrottled()
  return NextResponse.json({ message })
}
