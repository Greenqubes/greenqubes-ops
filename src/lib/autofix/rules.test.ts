/**
 * Standalone test for the auto-fixer's small rules: build ids, who may talk to
 * the bug bot, and when the cloud fixer may be woken.
 * Run: npx tsx src/lib/autofix/rules.test.ts
 * Exits 1 on any failure.
 */

import { buildIdOf, epochFromVercelId } from './build-id'
import { isFromNic, secretOk, type TgUpdate } from './telegram-auth'
import { canFire, isStale, crashFollowUp, MAX_FIRES_PER_DAY } from './scheduling'

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

// ── build ids — must match next.config.ts and /api/version byte for byte ──
check('buildIdOf matches the sha256 prefix', buildIdOf('0123456789abcdef0123456789abcdef01234567'), 'deb87fabd177')
check('x-vercel-id epoch (real production header)', epochFromVercelId('sin1::sin1::hq4b7-1793724495272-07c74ba24485'), 1793724495272)
check('x-vercel-id garbage → null', epochFromVercelId('nonsense'), null)
check('x-vercel-id null → null', epochFromVercelId(null), null)

// ── only Nic, only in his private chat ──
const NIC = '123456789'
const msg = (chatId: number, fromId: number, type = 'private'): TgUpdate => ({
  update_id: 1,
  message: { message_id: 1, chat: { id: chatId, type }, from: { id: fromId }, text: 'fix 1 go live' },
})
check('Nic in his own chat → true', isFromNic(msg(123456789, 123456789), NIC), true)
check('a group chat → false', isFromNic(msg(123456789, 123456789, 'group'), NIC), false)
check('someone else → false', isFromNic(msg(555, 555), NIC), false)
check('right chat, wrong sender → false', isFromNic(msg(123456789, 555), NIC), false)
check('chat id unset → false', isFromNic(msg(123456789, 123456789), undefined), false)
check('chat id blank → false', isFromNic(msg(123456789, 123456789), '  '), false)
check('no message (an edit or a button) → false', isFromNic({ update_id: 2 }, NIC), false)

check('secret matches', secretOk('abc', 'abc'), true)
check('secret wrong', secretOk('abd', 'abc'), false)
check('secret unset → refused (fail closed)', secretOk('abc', undefined), false)
check('secret empty → refused', secretOk('', ''), false)
check('header missing → refused', secretOk(null, 'abc'), false)

// ── waking the cloud ──
check('no work → no fire', canFire({ pendingWork: 0, firesToday: 0, runInFlight: false }).fire, false)
check(`${MAX_FIRES_PER_DAY} fires today → no fire`, canFire({ pendingWork: 3, firesToday: MAX_FIRES_PER_DAY, runInFlight: false }).fire, false)
check('a run in flight → no fire', canFire({ pendingWork: 3, firesToday: 0, runInFlight: true }).fire, false)
check('work, room, idle → fire', canFire({ pendingWork: 1, firesToday: 4, runInFlight: false }).fire, true)

check('unfinished at 91 min → stale', isStale({ fired_at: '2026-11-05T00:00:00Z', finished_at: null }, '2026-11-05T01:31:00Z'), true)
check('unfinished at 89 min → not stale', isStale({ fired_at: '2026-11-05T00:00:00Z', finished_at: null }, '2026-11-05T01:29:00Z'), false)
check('finished → never stale', isStale({ fired_at: '2026-11-05T00:00:00Z', finished_at: '2026-11-05T00:20:00Z' }, '2026-11-06T00:00:00Z'), false)

// ── a crash that matches something the fixer already knows ──
check('noise → attach and resolve', crashFollowUp({ verdict: 'noise', status: 'closed', live_build_id: null }, 'aaa'), 'attach-resolve')
check('known → attach and resolve', crashFollowUp({ verdict: 'known', status: 'closed', live_build_id: null }, null), 'attach-resolve')
check('live fix, crash on the fixed build → reopen', crashFollowUp({ verdict: 'fix', status: 'live', live_build_id: 'bbb' }, 'bbb'), 'reopen')
check('live fix, crash on an older build → attach and resolve', crashFollowUp({ verdict: 'fix', status: 'live', live_build_id: 'bbb' }, 'aaa'), 'attach-resolve')
check('live fix, crash with no build id → attach and resolve', crashFollowUp({ verdict: 'fix', status: 'live', live_build_id: 'bbb' }, null), 'attach-resolve')
check('awaiting Nic → attach', crashFollowUp({ verdict: 'fix', status: 'awaiting_nic', live_build_id: null }, 'aaa'), 'attach')
check('dropped → attach (Nic said leave it)', crashFollowUp({ verdict: 'fix', status: 'dropped', live_build_id: null }, 'aaa'), 'attach')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll rule checks passed')
