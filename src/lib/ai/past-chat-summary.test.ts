/**
 * Standalone test for the past-chat summary fallback (no test framework in this repo).
 * Run: npx tsx src/lib/ai/past-chat-summary.test.ts
 * Exits 1 on any failure.
 */

import { pastChatSummary } from './past-chat-summary'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// 1. A stored summary wins
check('summary preferred',
  pastChatSummary({ summary: 'Stored summary.', msgs: [{ role: 'user', content: 'raw' }] }),
  'Stored summary.')

// 2. Old rows (summary null) fall back to the first user message, capped at 200 chars
const long = 'x'.repeat(300)
check('fallback to first user msg', pastChatSummary({ summary: null, msgs: [{ role: 'assistant', content: 'hi' }, { role: 'user', content: long }] }), 'x'.repeat(200))

// 3. Empty-string summary also falls back (never recall an empty block)
check('empty summary falls back', pastChatSummary({ summary: '', msgs: [{ role: 'user', content: 'first question' }] }), 'first question')

// 4. Garbage msgs shapes return '' rather than crashing
check('non-array msgs', pastChatSummary({ summary: null, msgs: 'oops' }), '')
check('no user msg', pastChatSummary({ summary: null, msgs: [{ role: 'assistant', content: 'a' }] }), '')

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll past-chat-summary checks passed')
