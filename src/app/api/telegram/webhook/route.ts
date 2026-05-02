import { NextRequest, NextResponse } from 'next/server'

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
    console.log(`[telegram webhook] chat=${chatId} text="${text}"`)
    // TODO: route commands — e.g. /jobs, /status <job-id>
  }

  if (update.callback_query) {
    const callbackId = update.callback_query.id
    console.log(`[telegram webhook] callback_query id=${callbackId} data="${update.callback_query.data ?? ''}"`)
    // TODO: handle inline keyboard button callbacks
  }

  // Always return 200 — Telegram will retry on non-2xx
  return NextResponse.json({ ok: true })
}

// Minimal Telegram Update shape — extend as command routing grows
type TelegramUpdate = {
  update_id: number
  message?: {
    message_id: number
    chat:  { id: number; type: string }
    from?: { id: number; username?: string; first_name: string }
    text?: string
  }
  callback_query?: {
    id:    string
    data?: string
    from:  { id: number }
  }
}
