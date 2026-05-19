import Anthropic from '@anthropic-ai/sdk'
import { createServiceClient } from '@/lib/supabase/service'
import { sendDigestTelegramWithKeyboard } from '@/lib/telegram/bot'
import { tplDigestHeader, tplDigestItem } from '@/lib/telegram/templates'
import type { Json } from '@/lib/supabase/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

type ChatMsg = { role: string; content: string }

function parseMsgs(msgs: Json): ChatMsg[] {
  if (!Array.isArray(msgs)) return []
  return msgs.filter((m): m is ChatMsg =>
    typeof m === 'object' && m !== null &&
    typeof (m as Record<string, unknown>).role    === 'string' &&
    typeof (m as Record<string, unknown>).content === 'string',
  )
}

export async function summariseChatForDigest(
  msgs:  { role: string; content: string }[],
  topic: string | null,
): Promise<string> {
  const cleaned = msgs.map(m => ({
    ...m,
    content: m.content.replace(/D-Promote/g, '').trim(),
  }))
  return summarise(cleaned as unknown as Json, topic)
}

async function summarise(msgs: Json, topic: string | null): Promise<string> {
  const conversation = parseMsgs(msgs).map(m => `${m.role}: ${m.content}`).join('\n')
  if (!conversation.trim()) return topic ?? '[No content]'

  const res = await anthropic.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role:    'user',
      content: `Summarise this AI assistant conversation in one paragraph (max 120 words). Focus on useful learnings or decisions. No preamble.\n\n${conversation}`,
    }],
  })
  return res.content[0].type === 'text' ? res.content[0].text : '[Summary unavailable]'
}

export async function runDigest(): Promise<{ sent: number; skipped: string }> {
  const db = createServiceClient()

  const { data: schedulers, error: schedErr } = await db
    .from('users')
    .select('id, name, telegram_chat_id')
    .eq('role', 'scheduler')
    .not('telegram_chat_id', 'is', null)

  if (schedErr) throw schedErr

  const voters = (schedulers ?? []) as { id: string; name: string; telegram_chat_id: string }[]
  if (voters.length === 0) return { sent: 0, skipped: 'no schedulers with telegram_chat_id' }

  const { data: allChats, error: chatErr } = await db
    .from('asst_chats')
    .select('id, msgs, topic, tags, importance, ts')
    .gte('importance', 4)
    .order('importance', { ascending: false })

  if (chatErr) throw chatErr
  if (!allChats?.length) return { sent: 0, skipped: 'no important conversations' }

  const { data: allVotes, error: voteErr } = await db
    .from('digest_votes')
    .select('chat_id, voter_id, vote')

  if (voteErr) throw voteErr

  const voteMap = new Map<string, { yes: number; no: number }>()
  for (const v of allVotes ?? []) {
    const cur = voteMap.get(v.chat_id) ?? { yes: 0, no: 0 }
    if (v.vote === 'yes') cur.yes++
    else cur.no++
    voteMap.set(v.chat_id, cur)
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const toSend = allChats.filter(chat => {
    const votes   = voteMap.get(chat.id)
    const hasVotes = votes && (votes.yes + votes.no) > 0
    const isNew    = new Date(chat.ts) >= sevenDaysAgo
    return isNew || !hasVotes
  })

  if (toSend.length === 0) return { sent: 0, skipped: 'nothing new this week' }

  const weekOf = new Date().toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' })
  for (const voter of voters) {
    await sendDigestTelegramWithKeyboard(voter.telegram_chat_id, tplDigestHeader({ weekOf, count: toSend.length }), [])
  }

  let sent = 0
  for (let i = 0; i < toSend.length; i++) {
    const chat = toSend[i]
    try {
      const summary  = await summarise(chat.msgs, chat.topic)
      const chatDate = new Date(chat.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
      const text     = tplDigestItem({
        index:      i + 1,
        topic:      chat.topic ?? 'Untitled conversation',
        date:       chatDate,
        importance: chat.importance ?? 4,
        summary,
      })
      const keyboard = [[
        { text: '✅ Promote', callback_data: `digest_vote:yes:${chat.id}` },
        { text: '❌ Skip',    callback_data: `digest_vote:no:${chat.id}`  },
      ]]
      for (const voter of voters) {
        await sendDigestTelegramWithKeyboard(voter.telegram_chat_id, text, keyboard)
      }
      sent++
    } catch (err) {
      console.error(`[digest] chat ${chat.id} failed:`, (err as Error).message)
    }
  }

  return { sent, skipped: '' }
}
