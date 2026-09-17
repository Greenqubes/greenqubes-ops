import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/service'
import { sendSummaryTelegram } from '@/lib/telegram/bot'
import { verifySummaryLinkToken } from '@/lib/telegram/link-token'

/**
 * The summary bot's webhook. Its only job is to record that someone pressed
 * START, so the account menu can show a tick and the rollout stops needing a
 * chase list.
 *
 * Telegram refuses to let a bot message anyone who has not started it, and the
 * failure is SILENT — their summary simply never arrives. That is what bit the
 * digest bot in August 2026 and what left twelve people unreachable here.
 *
 * Deliberately NOT a second place that writes `telegram_chat_id`: a chat id is
 * the same for every bot, so the app already has it from the ops-bot link.
 * Writing it again from a second webhook would give two sources of truth for
 * one field.
 *
 * The "started" flag rides on the append-only `events` table rather than a new
 * column — no migration, and it doubles as a record of who connected when.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.TELEGRAM_SUMMARY_WEBHOOK_SECRET
  if (secret) {
    if (req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  type Update = {
    message?: { chat?: { id?: number }; text?: string; from?: { first_name?: string } }
  }
  const update = await req.json().catch(() => ({})) as Update
  const chatId = update.message?.chat?.id
  const text   = (update.message?.text ?? '').trim()

  if (!chatId) return NextResponse.json({ ok: true })

  // Telegram sends "/start <token>" for a deep link, or a bare "/start".
  const startMatch = /^\/start(?:\s+(\S+))?$/.exec(text)
  if (!startMatch) {
    await sendSummaryTelegram(String(chatId),
      'This bot only sends the daily job summaries. Open the Greenqubes app → your profile picture → <b>Connect Summary</b> to link it.')
    return NextResponse.json({ ok: true })
  }

  const token  = startMatch[1]
  const userId = token ? verifySummaryLinkToken(token) : null

  if (!userId) {
    // A bare /start still works for receiving messages — Telegram has now
    // allowed it — so say so rather than implying failure. It just cannot be
    // tied to an account without the signed link.
    await sendSummaryTelegram(String(chatId),
      '✅ You will now receive the daily job summaries.\n\n'
      + 'To tie this to your account, open the app → profile picture → <b>Connect Summary</b>.')
    return NextResponse.json({ ok: true })
  }

  const db = createServiceClient()
  const { data: person } = await db
    .from('users').select('id, name').eq('id', userId).is('deleted_at', null).maybeSingle() as
    { data: { id: string; name: string } | null }

  if (!person) {
    await sendSummaryTelegram(String(chatId), 'That link is no longer valid. Please try again from the app.')
    return NextResponse.json({ ok: true })
  }

  await db.from('events').insert({
    actor_id:     person.id,
    kind:         'summary_bot_started',
    target_id:    null,
    target_table: null,
    payload:      { chat_id: String(chatId) },
    visibility:   ['role:scheduler'],
  } as never)

  await sendSummaryTelegram(String(chatId),
    `✅ Connected, ${person.name}.\n\nYou will get your job summary here each evening — what you are on tomorrow, and anything that changed.`)

  return NextResponse.json({ ok: true })
}
