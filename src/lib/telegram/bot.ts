import { logApiUsage } from '@/lib/supabase/queries/admin'

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

// Sends a bug report to the dedicated bug-only Telegram bot.
// Silently no-ops if TELEGRAM_BUG_BOT_TOKEN or TELEGRAM_BUG_CHAT_ID is missing.
export async function sendBugTelegram(text: string): Promise<void> {
  const token  = process.env.TELEGRAM_BUG_BOT_TOKEN
  const chatId = process.env.TELEGRAM_BUG_CHAT_ID
  if (!token || !chatId?.trim()) {
    console.warn('[telegram-bug] TELEGRAM_BUG_BOT_TOKEN or TELEGRAM_BUG_CHAT_ID not set — skipping')
    return
  }

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })
  if (!res.ok) {
    console.error('[telegram-bug] sendMessage failed', res.status, await res.text())
  }
}

// ── Digest bot ─────────────────────────────────────────────────────────────────
// Mirror of main-bot functions but reads TELEGRAM_DIGEST_BOT_TOKEN.
// Used exclusively by the Monday digest and its webhook.

export async function sendDigestTelegram(chatId: string, text: string): Promise<void> {
  await digestPost(chatId, text)
}

export async function sendDigestTelegramWithKeyboard(
  chatId:   string,
  text:     string,
  keyboard: InlineKeyboardButton[][],
): Promise<number | null> {
  const res = await digestPost(chatId, text, keyboard)
  if (!res) return null
  try {
    const body = await res.json() as { ok: boolean; result?: { message_id: number } }
    return body.result?.message_id ?? null
  } catch {
    return null
  }
}

export async function editDigestTelegramMessage(
  chatId:    string,
  messageId: number,
  text:      string,
  keyboard?: InlineKeyboardButton[][],
): Promise<void> {
  const token = process.env.TELEGRAM_DIGEST_BOT_TOKEN
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
    if (!err.includes('message is not modified')) {
      console.error('[telegram-digest] editMessageText failed', res.status, err)
    }
  }
}

export async function answerDigestCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  const token = process.env.TELEGRAM_DIGEST_BOT_TOKEN
  if (!token) return

  const res = await fetch(`${TELEGRAM_API}/bot${token}/answerCallbackQuery`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ callback_query_id: callbackQueryId, text }),
  })
  if (!res.ok) {
    console.error('[telegram-digest] answerCallbackQuery failed', res.status, await res.text())
  }
}

async function digestPost(
  chatId:   string,
  text:     string,
  keyboard?: InlineKeyboardButton[][],
): Promise<Response | null> {
  const token = process.env.TELEGRAM_DIGEST_BOT_TOKEN
  if (!token) {
    console.warn('[telegram-digest] TELEGRAM_DIGEST_BOT_TOKEN not set — skipping send')
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
    console.error('[telegram-digest] sendMessage failed', res.status, await res.text())
    return null
  }
  void logApiUsage({ service: 'telegram', endpoint: 'sendMessage', estimated_cost: 0 })
  return res
}

// ── Internal ───────────────────────────────────────────────────────────────────

export type InlineKeyboardButton =
  | { text: string; callback_data: string }
  | { text: string; url: string }

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
  void logApiUsage({ service: 'telegram', endpoint: 'sendMessage', estimated_cost: 0 })
  return res
}
