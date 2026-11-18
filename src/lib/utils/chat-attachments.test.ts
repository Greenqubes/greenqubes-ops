/**
 * Standalone test for sending several files to job chat at once.
 * Run: npx tsx src/lib/utils/chat-attachments.test.ts
 * Exits 1 on any failure.
 *
 * Nic, 2026-11-18: "allow multiple attachements selection for job chat".
 * The chat picker took one file per tap. A batch now announces itself to the
 * server ONCE, carrying how many files went up, so the Telegram count stays
 * right ("4 new messages", not "1") without four throttled calls.
 */
import { attachmentNotifyCount, MAX_NOTIFY_COUNT } from './chat-attachments'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

console.log('attachmentNotifyCount — the count the browser sends is untrusted')
check('missing (an open tab on the old code) counts as one file', attachmentNotifyCount(undefined), 1)
check('a batch of four counts four', attachmentNotifyCount(4), 4)
check('zero is treated as one', attachmentNotifyCount(0), 1)
check('negative is treated as one', attachmentNotifyCount(-3), 1)
check('a fraction rounds down', attachmentNotifyCount(2.7), 2)
check('text is treated as one', attachmentNotifyCount('5'), 1)
check('NaN is treated as one', attachmentNotifyCount(Number.NaN), 1)
check('a huge number is capped', attachmentNotifyCount(10_000), MAX_NOTIFY_COUNT)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall chat-attachments checks passed')
