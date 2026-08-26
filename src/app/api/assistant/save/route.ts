import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { tagConversation } from '@/lib/ai/tagger'
import { saveChat, updateChat } from '@/lib/supabase/queries/assistant'
import { getOwnProject } from '@/lib/supabase/queries/assistant-projects'
import { summariseChatForDigest } from '@/lib/digest/run'
import { sendDigestTelegramWithKeyboard } from '@/lib/telegram/bot'
import { tplDigestItem } from '@/lib/telegram/templates'
import type { Role } from '@/lib/supabase/types'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new Response('Unauthorized', { status: 401 })

  type Profile = { id: string; role: string }
  const { data: profile } = await supabase
    .from('users')
    .select('id, role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: Profile | null; error: unknown }
  if (!profile) return new Response('Not provisioned', { status: 403 })

  const { messages, existingId, projectId } = await req.json() as {
    messages:   { role: string; content: string }[]
    existingId?: string
    projectId?:  string | null
  }

  if (messages.length < 2) {
    return Response.json({ ok: true, skipped: true })
  }

  // Project filing (Phase 4): a foreign or stale project id degrades to
  // no-project rather than failing the save. undefined = leave as-is on
  // update (the floating panel never sends the field).
  let projectIdChecked = projectId
  if (typeof projectIdChecked === 'string' && !(await getOwnProject(projectIdChecked))) {
    projectIdChecked = null
  }

  const forcePromote = messages.some(m => m.content.includes('D-Promote'))

  const [tag] = await Promise.all([
    tagConversation(messages, profile.role as Role),
  ])

  let id: string | null
  if (existingId) {
    id = await updateChat(existingId, profile.id, messages, tag, projectIdChecked)
    if (!id) id = await saveChat(profile.id, messages, tag, projectIdChecked ?? null)  // fallback if row was deleted or not owned
  } else {
    id = await saveChat(profile.id, messages, tag, projectIdChecked ?? null)
  }

  if (forcePromote && id) {
    // Awaited on purpose: Vercel kills un-awaited work once the response
    // returns, so a fire-and-forget send can die before Telegram is called.
    try {
      await sendDigestNow(id, messages, tag.topic)
    } catch (err) {
      console.error('[save] D-Promote digest send failed:', (err as Error).message)
    }
  }

  return Response.json({ ok: true, id })
}

async function sendDigestNow(
  chatId:   string,
  messages: { role: string; content: string }[],
  topic:    string,
): Promise<void> {
  const db = createServiceClient()

  const { data: schedulers } = await db
    .from('users')
    .select('telegram_chat_id')
    .eq('digest_subscriber', true)
    .is('deleted_at', null)
    .not('telegram_chat_id', 'is', null)

  if (!schedulers?.length) return

  const summary  = await summariseChatForDigest(messages, topic)
  const chatDate = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
  const text     = tplDigestItem({
    index:      1,
    topic,
    date:       chatDate,
    importance: 5,
    summary,
  })
  const keyboard = [[
    { text: '✅ Promote', callback_data: `digest_vote:yes:${chatId}` },
    { text: '❌ Skip',    callback_data: `digest_vote:no:${chatId}`  },
  ]]

  for (const s of schedulers) {
    if (s.telegram_chat_id) {
      await sendDigestTelegramWithKeyboard(s.telegram_chat_id, text, keyboard)
    }
  }
}
