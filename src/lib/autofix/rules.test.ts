/**
 * Standalone test for the auto-fixer's small rules: build ids, who may talk to
 * the bug bot, and when the cloud fixer may be woken.
 * Run: npx tsx src/lib/autofix/rules.test.ts
 * Exits 1 on any failure.
 */

import { buildIdOf, epochFromVercelId } from './build-id'
import { isFromNic, secretOk, goLiveNamed, type TgUpdate } from './telegram-auth'
import { canFire, isStale, crashFollowUp, fireFailureNotice, attemptsExhausted, attemptsAfterReport, MAX_ATTEMPTS, MAX_FIRES_PER_DAY } from './scheduling'

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

// ── go live only for the fix Nic named (final review 2026-11-04) ──
// The chat model picks the action, but report text it read could try to steer
// it; the number must come from Nic himself.
check('Nic names the fix → yes', goLiveNamed(12, 'fix 12 looks good, send it live', null), true)
check('Nic names a different fix → no', goLiveNamed(12, 'fix 13 go live', null), false)
check('number inside a bigger number → no', goLiveNamed(12, 'fix 123 go live', null), false)
check('no number, no question asked → no', goLiveNamed(12, 'looks good, push it', null), false)
check('"yes" to the bot asking about fix 12 → yes', goLiveNamed(12, 'yes', 'Shall I put fix 12 (Today button) live?'), true)
check('"ok go ahead" to that question → yes', goLiveNamed(12, 'ok go ahead', 'Put fix 12 live?'), true)
check('"yes" but the bot asked about fix 13 → no', goLiveNamed(12, 'yes', 'Shall I put fix 13 live?'), false)
check('a long message without the number → no', goLiveNamed(12, 'yes but first tell me what changed on the job page', 'Put fix 12 live?'), false)

// ── waking the cloud ──
check('no work → no fire', canFire({ pendingWork: 0, firesToday: 0, runInFlight: false }).fire, false)
check(`${MAX_FIRES_PER_DAY} fires today → no fire`, canFire({ pendingWork: 3, firesToday: MAX_FIRES_PER_DAY, runInFlight: false }).fire, false)
check('a run in flight → no fire', canFire({ pendingWork: 3, firesToday: 0, runInFlight: true }).fire, false)
check('work, room, idle → fire', canFire({ pendingWork: 1, firesToday: 4, runInFlight: false }).fire, true)

check('unfinished at 91 min → stale', isStale({ fired_at: '2026-11-05T00:00:00Z', finished_at: null }, '2026-11-05T01:31:00Z'), true)
check('unfinished at 89 min → not stale', isStale({ fired_at: '2026-11-05T00:00:00Z', finished_at: null }, '2026-11-05T01:29:00Z'), false)
check('finished → never stale', isStale({ fired_at: '2026-11-05T00:00:00Z', finished_at: '2026-11-05T00:20:00Z' }, '2026-11-06T00:00:00Z'), false)

// ── a crash that matches something the fixer already knows ──
// Final review 2026-11-04: build ids are hashes and cannot be ordered, so
// "a different build" is not "an older build". A crash well after the fix went
// live means the fix didn't hold, whatever build it came from.
const LIVE_AT = '2026-11-05T13:00:00Z'
const live = { verdict: 'fix', status: 'live', live_build_id: 'bbb', live_at: LIVE_AT }
const crash = (build_id: string | null, occurred_at: string) => ({ build_id, occurred_at })
check('noise → attach and resolve', crashFollowUp({ verdict: 'noise', status: 'closed', live_build_id: null, live_at: null }, crash('aaa', LIVE_AT)), 'attach-resolve')
check('known → attach and resolve', crashFollowUp({ verdict: 'known', status: 'closed', live_build_id: null, live_at: null }, crash(null, LIVE_AT)), 'attach-resolve')
check('live fix, crash on the fixed build → reopen', crashFollowUp(live, crash('bbb', '2026-11-05T13:01:00Z')), 'reopen')
check('live fix, crash 30 min later on a LATER build → reopen', crashFollowUp(live, crash('ccc', '2026-11-05T13:30:00Z')), 'reopen')
check('live fix, crash 30 min later with no build id → reopen', crashFollowUp(live, crash(null, '2026-11-05T13:30:00Z')), 'reopen')
check('live fix, crash 5 min after on another build (tab not refreshed yet) → attach and resolve', crashFollowUp(live, crash('aaa', '2026-11-05T13:05:00Z')), 'attach-resolve')
check('live fix, crash before it went live → attach and resolve', crashFollowUp(live, crash('aaa', '2026-11-05T12:00:00Z')), 'attach-resolve')
check('closed as already fixed, crashes again → reopen (it was not fixed)', crashFollowUp({ verdict: 'already_fixed', status: 'closed', live_build_id: null, live_at: null }, crash('aaa', LIVE_AT)), 'reopen')
check('awaiting Nic → attach', crashFollowUp({ verdict: 'fix', status: 'awaiting_nic', live_build_id: null, live_at: null }, crash('aaa', LIVE_AT)), 'attach')
check('dropped → attach (Nic said leave it)', crashFollowUp({ verdict: 'fix', status: 'dropped', live_build_id: null, live_at: null }, crash('aaa', LIVE_AT)), 'attach')

// ── stop after a few tries (Nic, 2026-11-05: "flag it instead and stop
//    fixing to not burn tokens") ──
check(`${MAX_ATTEMPTS - 1} tries → keep going`, attemptsExhausted(MAX_ATTEMPTS - 1), false)
check(`${MAX_ATTEMPTS} tries → stop`, attemptsExhausted(MAX_ATTEMPTS), true)
check('a fix tried 3 times crashes again → flag, not another round',
  crashFollowUp({ ...live, attempts: 3 }, crash('ccc', '2026-11-05T13:30:00Z')), 'flag')
check('"already fixed" tried 3 times crashes again → flag',
  crashFollowUp({ verdict: 'already_fixed', status: 'closed', live_build_id: null, live_at: null, attempts: 3 }, crash('aaa', LIVE_AT)), 'flag')
check('a fix tried once crashes again → still reopens',
  crashFollowUp({ ...live, attempts: 1 }, crash('ccc', '2026-11-05T13:30:00Z')), 'reopen')
// Every report that worked on an item counts as a try — a fix offered, or a
// "couldn't fix it" — so a fix that never passes its checks still stops.
check('a fix offered → +1 try', attemptsAfterReport(0, 'fix'), 1)
check('"needs a session" (couldn\'t get the checks to pass) → +1 try', attemptsAfterReport(2, 'needs_session'), 3)
check('just sorting (noise, wish…) → not a try', attemptsAfterReport(1, 'noise'), 1)
check('noise is never "flagged", however often it repeats',
  crashFollowUp({ verdict: 'noise', status: 'closed', live_build_id: null, live_at: null, attempts: 9 }, crash('aaa', LIVE_AT)), 'attach-resolve')

// ── a fixer that can't start must not go quiet (final review 2026-11-04) ──
check('nothing new (normal) → no message', fireFailureNotice({ ok: false, reason: 'nothing new to look at', broken: false }), null)
check('daily cap (normal) → no message', fireFailureNotice({ ok: false, reason: 'already ran 5 times today', broken: false }), null)
const broken = fireFailureNotice({ ok: false, reason: "Claude's cloud refused to start (401)", broken: true })
check('a broken start → Nic is told', typeof broken === 'string' && broken.includes('refused to start (401)'), true)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log('\nAll rule checks passed')
