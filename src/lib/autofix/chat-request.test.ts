/**
 * Standalone test for the bug bot's model request (chat-request.ts).
 * Run: npx tsx src/lib/autofix/chat-request.test.ts
 * Exits 1 on any failure.
 *
 * 2026-11-05: Nic wrote "Look at this now" and the bot answered "Started a
 * fresh run right now" WITHOUT calling run_now — no run existed. Replaying
 * the real chat, Sonnet skipped the tool 2 times in 20. Forcing a tool on the
 * first round (with no_action for small talk) took it to 20 in 20.
 */

import { chatRequest, TOOLS, SYSTEM } from './chat-request'

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

const msgs = [{ role: 'user' as const, content: 'Look at this now' }]

// ── the bot must press a button before it may say anything ──
check('first round forces a tool', chatRequest(0, msgs).tool_choice, { type: 'any' })
check('later rounds are free to answer in words', chatRequest(1, msgs).tool_choice, undefined)
check('later rounds are free (round 3)', chatRequest(3, msgs).tool_choice, undefined)

// ── small talk needs a button too ──
const noAction = TOOLS.find(t => t.name === 'no_action')
check('no_action tool exists', !!noAction, true)
check('no_action is never for a request to look at something', /look at/i.test(noAction?.description ?? ''), true)

// ── the request carries everything the model needs ──
const r = chatRequest(0, msgs)
check('same messages passed through', r.messages, msgs)
check('all tools sent', r.tools.length, TOOLS.length)
check('system prompt sent', r.system, SYSTEM)

// ── "take a look now" starts a run (Nic wrote exactly this first) ──
check('prompt maps "take a look" to run_now', /take a look[^\n]*run_now/i.test(SYSTEM), true)

if (failures > 0) {
  console.error(`\n${failures} failure(s)`)
  process.exit(1)
}
console.log('\nall passed')
