import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendTelegram } from '@/lib/telegram/bot'
import { verifyLinkToken } from '@/lib/telegram/link-token'

export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const incoming = req.headers.get('x-telegram-bot-api-secret-token')
    if (incoming !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const update = await req.json() as TelegramUpdate

  if (update.message?.text && update.message.chat.type === 'private') {
    const chatId = String(update.message.chat.id)
    const text   = update.message.text.trim()
    console.log(`[telegram webhook] message chat=${chatId} text="${text}"`)

    if (text.startsWith('/start')) {
      const payload = text.split(/\s+/)[1] ?? ''
      await handleAccountLink(chatId, payload)
    } else {
      await sendTelegram(chatId, connectHelpText(chatId))
    }
  }

  if (update.callback_query) {
    handleCallbackQuery(update.callback_query).catch(err =>
      console.error('[telegram webhook] callback_query handler error:', (err as Error).message)
    )
  }

  // Always 200 — Telegram retries on non-2xx
  return NextResponse.json({ ok: true })
}

// Completes the Connect Telegram flow: the app's account-menu button sends the
// user here with a signed /start token; we write their chat id onto their row.
async function handleAccountLink(chatId: string, payload: string) {
  const userId = payload ? verifyLinkToken(payload) : null
  if (!userId) {
    await sendTelegram(chatId, connectHelpText(chatId))
    return
  }

  const db = createServiceClient()
  const { data: user, error } = await db
    .from('users')
    .update({ telegram_chat_id: chatId } as never)
    .eq('id', userId)
    .is('deleted_at', null)
    .select('name')
    .maybeSingle() as { data: { name: string } | null; error: { message: string } | null }

  if (error || !user) {
    if (error) console.error('[telegram webhook] account link failed:', error.message)
    await sendTelegram(chatId,
      'This connect link did not match an active Greenqubes account. ' +
      'Open the Greenqubes app and tap <b>Connect Telegram</b> in your account menu, or ask Nic for help.')
    return
  }

  console.log(`[telegram webhook] linked chat=${chatId} to user=${userId}`)
  await sendTelegram(chatId,
    `Hi ${escapeHtml(user.name)} — your Telegram is now connected to Greenqubes. ` +
    'Job assignments, chat messages and overdue alerts will arrive here.')
}

function connectHelpText(chatId: string): string {
  return 'To connect this chat to Greenqubes: open the Greenqubes app, tap your ' +
    'profile picture (top right), then tap <b>Connect Telegram</b>.\n\n' +
    `Your chat ID is <code>${chatId}</code> — only needed if Nic asks for it.`
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

async function handleCallbackQuery(cq: CallbackQuery) {
  const data = cq.data ?? ''
  console.log(`[telegram webhook] unhandled callback: ${data}`)
  // Future work callback types go here
}

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
