import { NextRequest, NextResponse } from 'next/server'
import Anthropic                    from '@anthropic-ai/sdk'
import { createClient }             from '@/lib/supabase/server'
import { createServiceClient }      from '@/lib/supabase/service'
import { getDigestItems, getDigestSubscribers } from '@/lib/supabase/queries/admin'
import { sendTelegramWithKeyboard } from '@/lib/telegram/bot'
import { tplDigestItem }            from '@/lib/telegram/templates'
import type { Json }                from '@/lib/supabase/types'

const anthropic  = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

async function guardAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('auth_id', user.id)
    .maybeSingle() as { data: { role: string } | null; error: unknown }
  return profile?.role === 'admin'
}

export async function GET() {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const [items, subscribers] = await Promise.all([
    getDigestItems(),
    getDigestSubscribers(),
  ])
  return NextResponse.json({ items, subscribers })
}

// POST /api/admin/digest — send specific digest item to selected subscribers
export async function POST(req: NextRequest) {
  const ok = await guardAdmin()
  if (!ok) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { chatId, subscriberIds } = await req.json() as {
    chatId: string; subscriberIds: string[]
  }
  if (!chatId || !subscriberIds?.length) {
    return NextResponse.json({ error: 'chatId and subscriberIds required' }, { status: 400 })
  }

  const db = createServiceClient()

  // Fetch the chat record
  const { data: chat, error: chatErr } = await db
    .from('asst_chats')
    .select('id, msgs, topic, importance, ts')
    .eq('id', chatId)
    .single()
  if (chatErr || !chat) {
    return NextResponse.json({ error: 'Chat not found' }, { status: 404 })
  }

  // Fetch the selected subscribers' telegram_chat_ids
  const { data: users, error: usersErr } = await db
    .from('users')
    .select('id, name, telegram_chat_id')
    .in('id', subscriberIds)
    .is('deleted_at', null)
    .not('telegram_chat_id', 'is', null)
  if (usersErr) return NextResponse.json({ error: usersErr.message }, { status: 500 })

  if (!users?.length) {
    return NextResponse.json({ error: 'No subscribers with a Telegram chat ID found' }, { status: 400 })
  }

  // Summarise the conversation
  type ChatMsg = { role: string; content: string }
  function parseMsgs(msgs: Json): ChatMsg[] {
    if (!Array.isArray(msgs)) return []
    return msgs.filter((m): m is ChatMsg =>
      typeof m === 'object' && m !== null &&
      typeof (m as Record<string, unknown>).role    === 'string' &&
      typeof (m as Record<string, unknown>).content === 'string',
    )
  }

  const conversation = parseMsgs(chat.msgs).map(m => `${m.role}: ${m.content}`).join('\n')
  let summary = chat.topic ?? '[No content]'

  if (conversation.trim()) {
    try {
      const res = await anthropic.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 200,
        messages: [{
          role: 'user',
          content: `Summarise this AI assistant conversation in one paragraph (max 120 words). Focus on useful learnings or decisions. No preamble.\n\n${conversation}`,
        }],
      })
      if (res.content[0].type === 'text') summary = res.content[0].text
    } catch {
      // Use topic as fallback
    }
  }

  const chatDate = new Date(chat.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
  const text = tplDigestItem({
    index:      1,
    topic:      chat.topic ?? 'Untitled conversation',
    date:       chatDate,
    importance: chat.importance ?? 4,
    summary,
  })

  const keyboard = [[
    { text: '✅ Promote', callback_data: `digest_vote:yes:${chat.id}` },
    { text: '❌ Skip',    callback_data: `digest_vote:no:${chat.id}`  },
  ]]

  let sent = 0
  for (const u of users) {
    if (!u.telegram_chat_id) continue
    try {
      await sendTelegramWithKeyboard(u.telegram_chat_id, text, keyboard)
      sent++
    } catch {
      // Continue sending to remaining subscribers
    }
  }

  return NextResponse.json({ sent, total: users.length })
}
