import { NextRequest, NextResponse, after } from 'next/server'
import { secretOk, isFromNic, type TgUpdate } from '@/lib/autofix/telegram-auth'
import { addChat, chatHistory } from '@/lib/autofix/store'
import { replyToNic } from '@/lib/autofix/chat'
import { handleBugUpdate } from '@/lib/autofix/bug-chat-flow'
import { sendBugTelegramTo, sendBugTyping } from '@/lib/telegram/bot'

// The bug bot becomes a two-way chat (Nic, 2026-11-04). Same bot, same chat as
// the new-report pings. This chat can put a fix on the live app, so:
// - Telegram's secret header is required — refused when the secret is unset
//   (fail closed, unlike the older webhooks' `if (secret)`).
// - Only Nic, in one of his own private chats (TELEGRAM_BUG_CHAT_ID may list
//   more than one — 2026-11-05). Anyone else is ignored silently. A reply goes
//   back to the chat that asked.
// - Telegram gets its answer IMMEDIATELY; the reply (model + GitHub) runs
//   after, with "typing…" shown first (Nic, 2026-11-05) — so a slow go-live
//   never makes Telegram retry or the function time out mid-merge.
// - The steps themselves are bug-chat-flow.ts (tested).
export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(req: NextRequest) {
  if (!secretOk(req.headers.get('x-telegram-bot-api-secret-token'), process.env.TELEGRAM_BUG_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  let update: TgUpdate
  try { update = await req.json() as TgUpdate } catch { return NextResponse.json({ ok: true }) }
  if (!isFromNic(update, process.env.TELEGRAM_BUG_CHAT_ID)) return NextResponse.json({ ignored: true })

  after(async () => {
    await handleBugUpdate(update, {
      nicChatIds: process.env.TELEGRAM_BUG_CHAT_ID,
      addChat,
      history:   () => chatHistory(20),
      reply:     replyToNic,
      send:      sendBugTelegramTo,
      typing:    sendBugTyping,
      now:       () => new Date().toISOString(),
    })
  })
  return NextResponse.json({ ok: true })
}
