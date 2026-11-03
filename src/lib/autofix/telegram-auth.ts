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

/** Constant-time compare that REFUSES when the expected secret is unset. */
export function secretOk(given: string | null, expected: string | undefined): boolean {
  if (!expected || !given) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
