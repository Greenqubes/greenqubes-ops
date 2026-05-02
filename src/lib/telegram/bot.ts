const TELEGRAM_API = 'https://api.telegram.org'

// Sends a message to a single Telegram chat.
// Silently no-ops if the bot token is missing (dev / CI environments).
export async function sendTelegram(chatId: string, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.warn('[telegram] TELEGRAM_BOT_TOKEN not set — skipping send')
    return
  }
  if (!chatId?.trim()) return

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error('[telegram] sendMessage failed', res.status, body)
  }
}
