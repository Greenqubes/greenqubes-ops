import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  answerDigestCallbackQuery,
  editDigestTelegramMessage,
  sendDigestTelegram,
  type InlineKeyboardButton,
} from '@/lib/telegram/bot'
import { tplVoteStatus } from '@/lib/telegram/templates'

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_DIGEST_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token')
    if (incoming !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const update = await req.json() as TelegramUpdate

  if (update.callback_query) {
    await handleCallbackQuery(update.callback_query).catch(err =>
      console.error('[digest webhook] callback_query handler error:', (err as Error).message)
    )
  }

  return NextResponse.json({ ok: true })
}

async function handleCallbackQuery(cq: CallbackQuery) {
  const data = cq.data ?? ''
  if (data.startsWith('digest_vote:')) {
    await handleDigestVote(cq, data)
  }
}

async function handleDigestVote(cq: CallbackQuery, data: string) {
  const parts = data.split(':')
  if (parts.length !== 3) {
    await answerDigestCallbackQuery(cq.id, 'Invalid vote data')
    return
  }
  const [, rawVote, chatId] = parts
  const vote = rawVote as 'yes' | 'no'

  if (vote !== 'yes' && vote !== 'no') {
    await answerDigestCallbackQuery(cq.id, 'Invalid vote')
    return
  }

  const db = createServiceClient()
  const telegramUserId = String(cq.from.id)

  const { data: voterRow } = await db
    .from('users')
    .select('id, name')
    .eq('telegram_chat_id', telegramUserId)
    .single()

  if (!voterRow) {
    await answerDigestCallbackQuery(cq.id, 'Your account is not registered in the system.')
    return
  }

  const { data: chat } = await db
    .from('asst_chats')
    .select('id, topic, tags, importance, ts, msgs')
    .eq('id', chatId)
    .single()

  if (!chat) {
    await answerDigestCallbackQuery(cq.id, 'Conversation not found.')
    return
  }

  const { error: voteErr } = await db
    .from('digest_votes')
    .upsert(
      { chat_id: chatId, voter_id: voterRow.id, vote },
      { onConflict: 'chat_id,voter_id' },
    )

  if (voteErr) {
    console.error('[digest webhook] vote upsert failed:', voteErr.message)
    await answerDigestCallbackQuery(cq.id, 'Failed to record vote — please try again.')
    return
  }

  await answerDigestCallbackQuery(cq.id, vote === 'yes' ? '✅ Vote recorded' : '❌ Vote recorded')

  const { data: votes } = await db
    .from('digest_votes')
    .select('vote')
    .eq('chat_id', chatId)

  const yesCount = (votes ?? []).filter(v => v.vote === 'yes').length
  const noCount  = (votes ?? []).filter(v => v.vote === 'no').length

  const { count: totalVoters } = await db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'scheduler')
    .not('telegram_chat_id', 'is', null)

  const total = totalVoters ?? 1

  const promoted  = yesCount / total > 0.5
  const dismissed = noCount / total >= 0.5
  const outcome   = promoted ? 'promoted' : dismissed ? 'dismissed' : 'pending'

  const chatDate = new Date(chat.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
  const statusText = tplVoteStatus({
    index:       1,
    topic:       chat.topic ?? 'Untitled conversation',
    date:        chatDate,
    importance:  chat.importance ?? 4,
    summary:     '',
    yesCount,
    noCount,
    totalVoters: total,
    outcome,
  })

  const keyboard: InlineKeyboardButton[][] = outcome === 'pending'
    ? [[
        { text: '✅ Promote', callback_data: `digest_vote:yes:${chatId}` },
        { text: '❌ Skip',    callback_data: `digest_vote:no:${chatId}`  },
      ]]
    : []

  if (cq.message) {
    await editDigestTelegramMessage(
      String(cq.message.chat.id),
      cq.message.message_id,
      statusText,
      keyboard,
    )
  }

  if (promoted) {
    const promoteUrl = buildPromoteUrl(chatId)
    const { data: schedulers } = await db
      .from('users')
      .select('telegram_chat_id')
      .eq('role', 'scheduler')
      .not('telegram_chat_id', 'is', null)

    for (const s of schedulers ?? []) {
      if (s.telegram_chat_id) {
        await sendDigestTelegram(
          s.telegram_chat_id,
          `📝 <b>${chat.topic ?? 'Conversation'}</b> reached majority — tap to get your Obsidian note:\n${promoteUrl}`,
        )
      }
    }
  }
}

function buildPromoteUrl(chatId: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${process.env.VERCEL_URL ?? 'localhost:3001'}`
  const sig = crypto
    .createHmac('sha256', process.env.CRON_SECRET!)
    .update(chatId)
    .digest('hex')
    .slice(0, 16)
  return `${appUrl}/api/digest/promote/${chatId}?sig=${sig}`
}

type CallbackQuery = {
  id:       string
  data?:    string
  from:     { id: number }
  message?: { message_id: number; chat: { id: number } }
}

type TelegramUpdate = {
  update_id:       number
  callback_query?: CallbackQuery
}
