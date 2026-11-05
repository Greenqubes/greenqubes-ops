/**
 * Standalone test for how the bug bot handles one Telegram message
 * (Nic, 2026-11-05): show "typing…" straight away, and keep a photo sent on
 * its own so it joins his next message.
 * Run: npx tsx src/lib/autofix/bug-chat-flow.test.ts
 * Exits 1 on any failure.
 */

import { handleBugUpdate, photosForMessage, PHOTO_ACK, type BugChatDeps, type ChatRow } from './bug-chat-flow'
import type { TgUpdate } from './telegram-auth'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
    failures++
  }
}

const NOW = '2026-11-05T13:00:00.000Z'
const ago = (min: number) => new Date(new Date(NOW).getTime() - min * 60_000).toISOString()
const row = (role: 'nic' | 'bot', text: string, photos: string[], min: number): ChatRow => ({ role, text, photos, created_at: ago(min) })

// ── which photos go with a message ──
check('photo then text 2 min later → the photo joins it',
  photosForMessage([row('nic', '(photo)', ['P1'], 2), row('nic', 'fix 12 still cut off', [], 0)], NOW), ['P1'])
check('two photos then text → both, oldest first',
  photosForMessage([row('nic', '(photo)', ['P1'], 3), row('nic', '(photo)', ['P2'], 2), row('nic', 'still wrong', [], 0)], NOW), ['P1', 'P2'])
check('a photo with its own caption keeps its photo',
  photosForMessage([row('nic', 'still cut off', ['P9'], 0)], NOW), ['P9'])
check('a photo from 20 minutes ago → not joined',
  photosForMessage([row('nic', '(photo)', ['OLD'], 20), row('nic', 'fix 12 still cut off', [], 0)], NOW), [])
check('a bot reply in between → not joined',
  photosForMessage([row('nic', '(photo)', ['P1'], 3), row('bot', 'Got it', [], 2), row('nic', 'go live', [], 0)], NOW), [])
check('an earlier text message in between → not joined',
  photosForMessage([row('nic', '(photo)', ['P1'], 3), row('nic', 'what is waiting', [], 2), row('nic', 'fix 3', [], 0)], NOW), [])

// ── handling one update ──
const NIC = 555
const ADMIN = 1234567890 // the GreenqubesAI admin's Telegram — also on the list (Nic, 2026-11-05)
const upd = (text: string | undefined, photo?: string, id = 1, from = NIC): TgUpdate => ({
  update_id: id,
  message: {
    message_id: id, chat: { id: from, type: 'private' }, from: { id: from },
    ...(text !== undefined ? { text } : {}),
    ...(photo ? { photo: [{ file_id: `${photo}-small`, width: 90, height: 90 }, { file_id: photo, width: 1280, height: 960 }] } : {}),
  },
})

function fake(opts: { fresh?: boolean; history?: ChatRow[]; replyThrows?: boolean } = {}) {
  const log: string[] = []
  const saved: { role: string; text: string; photos: string[] }[] = []
  const sent: string[] = []
  let repliedWith: string[] | null = null
  const deps: BugChatDeps = {
    nicChatIds: `${ADMIN},${NIC}`,
    addChat: async (role, text, _updateId, photos = []) => { log.push(`save:${role}`); saved.push({ role, text, photos }); return opts.fresh ?? true },
    history: async () => opts.history ?? [],
    reply: async photos => { log.push('reply'); repliedWith = photos; if (opts.replyThrows) throw new Error('boom'); return 'Putting fix 12 live now <ok>' },
    send: async (chatId, text) => { log.push(`send:${chatId}`); sent.push(text) },
    typing: async chatId => { log.push(`typing:${chatId}`) },
    now: () => NOW,
  }
  return { deps, log, saved, sent, repliedWith: () => repliedWith }
}

async function main() {
  {
    const f = fake()
    const r = await handleBugUpdate({ update_id: 1, message: { message_id: 1, chat: { id: 999, type: 'private' }, from: { id: 999 }, text: 'go live' } }, f.deps)
    check('someone else → ignored, nothing done', [r, f.log], ['ignored', []])
  }
  {
    const f = fake({ fresh: false })
    const r = await handleBugUpdate(upd('fix 12 go live'), f.deps)
    check('Telegram re-sends the same update → handled once', [r, f.log], ['duplicate', ['save:nic']])
  }
  {
    const f = fake()
    const r = await handleBugUpdate(upd(undefined, 'PHOTO'), f.deps)
    check('photo on its own → kept, with the large version', f.saved[0], { role: 'nic', text: '(photo)', photos: ['PHOTO'] })
    check('…acknowledged without bothering the model', [r, f.log, f.sent], ['photo-held', ['save:nic', `send:${NIC}`], [PHOTO_ACK]])
  }
  {
    const f = fake({ history: [row('nic', '(photo)', ['P1'], 1), row('nic', 'fix 12 still cut off', [], 0)] })
    const r = await handleBugUpdate(upd('fix 12 still cut off'), f.deps)
    check('text → "typing…" shown BEFORE the slow part, in the chat that asked', f.log.slice(0, 3), ['save:nic', `typing:${NIC}`, 'reply'])
    check('…the earlier photo goes with it', f.repliedWith(), ['P1'])
    check('…reply saved and sent, escaped for Telegram', [r, f.saved[1], f.sent], ['replied', { role: 'bot', text: 'Putting fix 12 live now <ok>', photos: [] }, ['Putting fix 12 live now &lt;ok&gt;']])
  }
  {
    // Either listed chat may talk to the bot; the answer goes back to the one that asked.
    const f = fake()
    const r = await handleBugUpdate(upd('what is waiting', undefined, 7, ADMIN), f.deps)
    check('the admin Telegram (second on the list) is answered too', r, 'replied')
    check('…in its own chat, not the other one', f.log.filter(l => l.startsWith('send') || l.startsWith('typing')), [`typing:${ADMIN}`, `send:${ADMIN}`])
  }
  {
    const f = fake({ replyThrows: true })
    const r = await handleBugUpdate(upd('fix 12 go live'), f.deps)
    check('something breaks → Nic is told nothing changed', [r, f.sent], ['failed', ['Something went wrong on my side — nothing was changed.']])
  }

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll bug-chat checks passed')
}

main()
