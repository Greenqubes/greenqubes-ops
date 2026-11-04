import { timingSafeEqual } from 'node:crypto'

// Who may talk to the bug bot. Its chat can put a fix on the live app, so the
// answer is: Nic, in his own private chat(s), and nobody else — not a group he
// is in, not someone who found the bot. Anything else is ignored silently.
//
// TELEGRAM_BUG_CHAT_ID may list more than one chat, comma-separated (Nic,
// 2026-11-05: "reach both user" — his own Telegram and the GreenqubesAI admin
// account he rarely opens). Every listed chat gets the bot's messages and may
// talk to it; a reply goes back to the chat that asked.

export type TgPhoto = { file_id: string; width: number; height: number }

export type TgUpdate = {
  update_id: number
  message?: {
    message_id: number
    chat:       { id: number; type: string }
    from?:      { id: number }
    text?:      string
    caption?:   string
    photo?:     TgPhoto[]
  }
}

/** The chat ids in TELEGRAM_BUG_CHAT_ID — one, or several comma-separated. */
export function bugChatIds(raw: string | undefined): string[] {
  return (raw ?? '').split(/[\s,]+/).filter(id => /^-?\d+$/.test(id))
}

export function isFromNic(u: TgUpdate, nicChatIds: string | undefined): boolean {
  if (!u.message) return false
  const m = u.message
  const chat = String(m.chat.id)
  return m.chat.type === 'private'
    && bugChatIds(nicChatIds).includes(chat)
    && String(m.from?.id ?? '') === chat
}

const AFFIRMATIVE = /^(y|yes|yep|yeah|yup|ok|okay|sure|go|go ahead|go live|do it|confirm|confirmed|proceed|push it|send it)([\s,.!]+(go ahead|go|do it|please|thanks|send it|push it))*[\s.!]*$/i

/**
 * A fix may only go live when Nic named it himself: its number in his own
 * message, or a plain "yes" straight after the bot asked about that exact fix.
 * The chat model chooses the action, but titles and summaries it reads came
 * from bug reports, so the number has to come from Nic (final review,
 * 2026-11-04).
 */
export function goLiveNamed(no: number, nicText: string, lastBotText: string | null): boolean {
  const n = new RegExp(`(^|\\D)${no}(\\D|$)`)
  if (n.test(nicText)) return true
  if (!lastBotText || !AFFIRMATIVE.test(nicText.trim())) return false
  return new RegExp(`\\bfix\\s+${no}(\\D|$)`, 'i').test(lastBotText)
}

/** Constant-time compare that REFUSES when the expected secret is unset. */
export function secretOk(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
