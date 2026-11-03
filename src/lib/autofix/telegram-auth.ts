import { timingSafeEqual } from 'node:crypto'

// Who may talk to the bug bot. Its chat can put a fix on the live app, so the
// answer is: Nic, in his own private chat, and nobody else — not a group he is
// in, not someone who found the bot. Anything else is ignored silently.

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

export function isFromNic(u: TgUpdate, nicChatId: string | undefined): boolean {
  const id = nicChatId?.trim()
  if (!id || !u.message) return false
  const m = u.message
  return m.chat.type === 'private'
    && String(m.chat.id) === id
    && String(m.from?.id ?? '') === id
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
