import { NextRequest, NextResponse } from 'next/server'
import { secretOk, isFromNic, type TgUpdate } from '@/lib/autofix/telegram-auth'
import { addChat } from '@/lib/autofix/store'
import { replyToNic } from '@/lib/autofix/chat'
import { escapeHtml } from '@/lib/autofix/nightly-message'
import { sendBugTelegramChunks } from '@/lib/telegram/bot'

// The bug bot becomes a two-way chat (Nic, 2026-11-04). Same bot, same chat as
// the new-report pings. This chat can put a fix on the live app, so:
// - Telegram's secret header is required — refused when the secret is unset
//   (fail closed, unlike the older webhooks' `if (secret)`).
// - Only Nic, in his own private chat. Anyone else is ignored silently.
// - Each Telegram update is handled once (Telegram retries ones it thinks failed).
// - Always answers 200 once past the secret check, so Telegram stops retrying.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!secretOk(req.headers.get('x-telegram-bot-api-secret-token'), process.env.TELEGRAM_BUG_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let update: TgUpdate
  try { update = await req.json() as TgUpdate } catch { return NextResponse.json({ ok: true }) }
  if (!isFromNic(update, process.env.TELEGRAM_BUG_CHAT_ID)) return NextResponse.json({ ignored: true })

  const m = update.message!
  const text = (m.text ?? m.caption ?? '').slice(0, 4000)
  const largest = m.photo?.length
    ? m.photo.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))
    : null
  const photos = largest ? [largest.file_id] : []
  if (!text && photos.length === 0) return NextResponse.json({ ok: true })

  const fresh = await addChat('nic', text || '(photo)', update.update_id)
  if (!fresh) return NextResponse.json({ duplicate: true })

  try {
    const reply = await replyToNic(photos)
    await addChat('bot', reply)
    await sendBugTelegramChunks(escapeHtml(reply))
  } catch (e) {
    console.error('[bug-webhook] reply failed', e)
    await sendBugTelegramChunks('Something went wrong on my side — nothing was changed.')
  }
  return NextResponse.json({ ok: true })
}
