import { NextRequest, NextResponse } from 'next/server'

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
    handleCallbackQuery(update.callback_query).catch(err =>
      console.error('[telegram webhook] callback_query handler error:', (err as Error).message)
    )
  }

  // Always 200 — Telegram retries on non-2xx
  return NextResponse.json({ ok: true })
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
