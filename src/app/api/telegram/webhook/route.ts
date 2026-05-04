import crypto from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  answerCallbackQuery,
  editTelegramMessage,
  sendTelegram,
  type InlineKeyboardButton,
} from '@/lib/telegram/bot'
import { tplVoteStatus } from '@/lib/telegram/templates'

// Register this webhook with Telegram once the app is deployed:
//   POST https://api.telegram.org/bot<TOKEN>/setWebhook
//   body: { url: "https://<your-domain>/api/telegram/webhook", secret_token: "<TELEGRAM_WEBHOOK_SECRET>" }
//
// Telegram passes the secret in the X-Telegram-Bot-Api-Secret-Token header.

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token')
    if (incoming !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const update = await req.json() as TelegramUpdate

  if (update.message?.text) {
    const chatId = String(update.message.chat.id)
    const text   = update.message.text.trim()
    console.log(`[telegram webhook] message chat=${chatId} text="${text}"`)
    // TODO: route commands — e.g. /jobs, /status <job-id>
  }

  if (update.callback_query) {
    // Fire-and-forget — always return 200 to Telegram quickly
    handleCallbackQuery(update.callback_query).catch(err =>
      console.error('[telegram webhook] callback_query handler error:', (err as Error).message)
    )
  }

  // Always 200 — Telegram retries on non-2xx
  return NextResponse.json({ ok: true })
}

// ── Callback query handler ────────────────────────────────────────────────────

async function handleCallbackQuery(cq: CallbackQuery) {
  const data = cq.data ?? ''

  if (data.startsWith('digest_vote:')) {
    await handleDigestVote(cq, data)
  }
  // Future callback types go here
}

async function handleDigestVote(cq: CallbackQuery, data: string) {
  // data format: digest_vote:yes|no:<chatId>
  const parts = data.split(':')
  if (parts.length !== 3) {
    await answerCallbackQuery(cq.id, 'Invalid vote data')
    return
  }
  const [, rawVote, chatId] = parts
  const vote = rawVote as 'yes' | 'no'

  if (vote !== 'yes' && vote !== 'no') {
    await answerCallbackQuery(cq.id, 'Invalid vote')
    return
  }

  const db = createServiceClient()
  const telegramUserId = String(cq.from.id)

  // Find voter by telegram_chat_id (for DMs, chat.id = user.id in Telegram)
  const { data: voterRow } = await db
    .from('users')
    .select('id, name')
    .eq('telegram_chat_id', telegramUserId)
    .single()

  if (!voterRow) {
    await answerCallbackQuery(cq.id, 'Your account is not registered in the system.')
    return
  }

  // Fetch the chat record to confirm it exists
  const { data: chat } = await db
    .from('asst_chats')
    .select('id, topic, tags, importance, ts, msgs')
    .eq('id', chatId)
    .single()

  if (!chat) {
    await answerCallbackQuery(cq.id, 'Conversation not found.')
    return
  }

  // Upsert vote — allows voter to change their mind
  const { error: voteErr } = await db
    .from('digest_votes')
    .upsert(
      { chat_id: chatId, voter_id: voterRow.id, vote },
      { onConflict: 'chat_id,voter_id' },
    )

  if (voteErr) {
    console.error('[webhook] vote upsert failed:', voteErr.message)
    await answerCallbackQuery(cq.id, 'Failed to record vote — please try again.')
    return
  }

  await answerCallbackQuery(cq.id, vote === 'yes' ? '✅ Vote recorded' : '❌ Vote recorded')

  // Fetch updated vote counts for this chat
  const { data: votes } = await db
    .from('digest_votes')
    .select('vote')
    .eq('chat_id', chatId)

  const yesCount = (votes ?? []).filter(v => v.vote === 'yes').length
  const noCount  = (votes ?? []).filter(v => v.vote === 'no').length

  // Fetch total voter count (all schedulers with telegram_chat_id)
  const { count: totalVoters } = await db
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'scheduler')
    .not('telegram_chat_id', 'is', null)

  const total = totalVoters ?? 1

  // Determine outcome
  const promoted  = yesCount / total > 0.5
  const dismissed = noCount / total >= 0.5
  const outcome   = promoted ? 'promoted' : dismissed ? 'dismissed' : 'pending'

  // Build common fields for the status template
  const chatDate = new Date(chat.ts).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' })
  const statusText = tplVoteStatus({
    index:       1, // position unknown in webhook context — generic display
    topic:       chat.topic ?? 'Untitled conversation',
    date:        chatDate,
    importance:  chat.importance ?? 4,
    summary:     '',  // no summary in status update — keeps message concise
    yesCount,
    noCount,
    totalVoters: total,
    outcome,
  })

  // Voting buttons — keep active while pending, remove when decided
  const keyboard: InlineKeyboardButton[][] = outcome === 'pending'
    ? [[
        { text: '✅ Promote', callback_data: `digest_vote:yes:${chatId}` },
        { text: '❌ Skip',    callback_data: `digest_vote:no:${chatId}`  },
      ]]
    : []

  // Edit the original message to show current vote status
  if (cq.message) {
    await editTelegramMessage(
      String(cq.message.chat.id),
      cq.message.message_id,
      statusText,
      keyboard,
    )
  }

  // If majority YES reached → send signed promote link to all voters
  if (promoted) {
    const promoteUrl = buildPromoteUrl(chatId)

    const { data: schedulers } = await db
      .from('users')
      .select('telegram_chat_id')
      .eq('role', 'scheduler')
      .not('telegram_chat_id', 'is', null)

    for (const s of schedulers ?? []) {
      if (s.telegram_chat_id) {
        await sendTelegram(
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

// ── Telegram update types ─────────────────────────────────────────────────────

type CallbackQuery = {
  id:       string
  data?:    string
  from:     { id: number }
  message?: { message_id: number; chat: { id: number } }
}

type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    chat:  { id: number; type: string }
    from?: { id: number; username?: string; first_name: string }
    text?: string
  }
  callback_query?: CallbackQuery
}
