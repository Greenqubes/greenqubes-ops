const TELEGRAM_API = 'https://api.telegram.org'

// Sends a plain-text message to a single Telegram chat.
// Silently no-ops if the bot token is missing (dev / CI environments).
export async function sendTelegram(chatId: string, text: string): Promise<void> {
  await telegramPost(chatId, text)
}

// Sends a message with an inline keyboard (for voting buttons etc.).
// Returns the sent message_id so callers can edit it later.
export async function sendTelegramWithKeyboard(
  chatId:   string,
  text:     string,
  keyboard: InlineKeyboardButton[][],
): Promise<number | null> {
  const res = await telegramPost(chatId, text, keyboard)
  if (!res) return null
  try {
    const body = await res.json() as { ok: boolean; result?: { message_id: number } }
    return body.result?.message_id ?? null
  } catch {
    return null
  }
}

// Edits the text (and optionally keyboard) of a previously sent bot message.
export async function editTelegramMessage(
  chatId:    string,
  messageId: number,
  text:      string,
  keyboard?: InlineKeyboardButton[][],
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token || !chatId?.trim()) return

  const body: Record<string, unknown> = {
    chat_id:    chatId,
    message_id: messageId,
    text,
    parse_mode: 'HTML',
  }
  if (keyboard !== undefined) {
    body.reply_markup = { inline_keyboard: keyboard }
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/editMessageText`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.text()
    // 400 "message is not modified" is harmless — Telegram rejects no-op edits
    if (!err.includes('message is not modified')) {
      console.error('[telegram] editMessageText failed', res.status, err)
    }
  }
}

// Answers a callback_query to dismiss the loading spinner on the button.
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return

  const res = await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
  if (!res.ok) {
    console.error('[telegram] answerCallbackQuery failed', res.status, await res.text())
  }
}

// ── Internal ───────────────────────────────────────────────────────────────────

export type InlineKeyboardButton = { text: string; callback_data: string }

async function telegramPost(
  chatId:   string,
  text:     string,
  keyboard?: InlineKeyboardButton[][],
): Promise<Response | null> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping send')
    return null
  }
  if (!chatId?.trim()) return null

  const body: Record<string, unknown> = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (keyboard) body.reply_markup = { inline_keyboard: keyboard }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) {
    console.error('[telegram] sendMessage failed', res.status, await res.text())
    return null
  }
  return res
}
