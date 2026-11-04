// How the bug bot handles one Telegram message from Nic — the order of the
// steps, kept apart from Telegram, the database and the model so it can be
// tested (Nic, 2026-11-05):
// - show "typing…" straight away, before the slow part (model + GitHub), so a
//   go-live never looks stuck;
// - a photo sent on its own is kept and joins his next message ("photo, then
//   'still cut off on my phone'") instead of being lost;
// - each Telegram update is handled once; anything that breaks tells Nic that
//   nothing changed.

import { isFromNic, type TgUpdate } from './telegram-auth'
import { escapeHtml } from './nightly-message'

export type ChatRow = { role: 'nic' | 'bot'; text: string; photos: string[]; created_at: string }

export type BugChatDeps = {
  nicChatId: string | undefined
  addChat(role: 'nic' | 'bot', text: string, updateId?: number, photos?: string[]): Promise<boolean>
  history(): Promise<ChatRow[]>
  reply(photos: string[]): Promise<string>
  send(html: string): Promise<unknown>
  typing(): Promise<unknown>
  now(): string
}

export const PHOTO_ONLY = '(photo)'
export const PHOTO_ACK = 'Got the photo. Tell me which fix it\'s about (for example "fix 12 still cut off") and I\'ll pass it on.'
const APOLOGY = 'Something went wrong on my side — nothing was changed.'
const PHOTO_WINDOW_MINUTES = 10

/**
 * Photos that belong with Nic's latest message (the last row): its own, plus
 * photos he sent on their own just before it, within 10 minutes, with nothing
 * else in between. Oldest first.
 */
export function photosForMessage(rows: ChatRow[], nowIso: string): string[] {
  const last = rows.at(-1)
  if (!last || last.role !== 'nic') return []
  const earlier: string[] = []
  const cutoff = new Date(nowIso).getTime() - PHOTO_WINDOW_MINUTES * 60_000
  for (let i = rows.length - 2; i >= 0; i--) {
    const r = rows[i]
    if (r.role !== 'nic' || r.text !== PHOTO_ONLY || new Date(r.created_at).getTime() < cutoff) break
    earlier.unshift(...r.photos)
  }
  return [...earlier, ...last.photos]
}

export type HandleResult = 'ignored' | 'empty' | 'duplicate' | 'photo-held' | 'replied' | 'failed'

export async function handleBugUpdate(update: TgUpdate, d: BugChatDeps): Promise<HandleResult> {
  if (!isFromNic(update, d.nicChatId)) return 'ignored'
  const m = update.message!
  const text = (m.text ?? m.caption ?? '').slice(0, 4000).trim()
  const largest = m.photo?.length
    ? m.photo.reduce((a, b) => (b.width * b.height > a.width * a.height ? b : a))
    : null
  const photos = largest ? [largest.file_id] : []
  if (!text && photos.length === 0) return 'empty'

  if (!(await d.addChat('nic', text || PHOTO_ONLY, update.update_id, photos))) return 'duplicate'

  // A photo on its own: keep it for his next message, no model call.
  if (!text) {
    await d.send(PHOTO_ACK)
    return 'photo-held'
  }

  await d.typing()
  try {
    const reply = await d.reply(photosForMessage(await d.history(), d.now()))
    await d.addChat('bot', reply)
    await d.send(escapeHtml(reply))
    return 'replied'
  } catch (e) {
    console.error('[bug-chat] reply failed', e)
    await d.send(APOLOGY)
    return 'failed'
  }
}
