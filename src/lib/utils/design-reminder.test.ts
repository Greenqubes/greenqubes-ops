/**
 * Standalone test for the 3-day design reminder eligibility rule (no test framework).
 * Run: npx tsx src/lib/utils/design-reminder.test.ts
 * Exits 1 on any failure.
 */

import { reminderDue } from './design-reminder'

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

const now = '2026-08-18T02:00:00Z'
check('no JO file → no reminder', reminderDue({ joUploadedAtISO: null, completedAtISO: null, lastReminderAtISO: null, nowISO: now }), false)
check('completed → no reminder', reminderDue({ joUploadedAtISO: '2026-08-10T02:00:00Z', completedAtISO: '2026-08-11T02:00:00Z', lastReminderAtISO: null, nowISO: now }), false)
check('JO fresh (2 days) → wait', reminderDue({ joUploadedAtISO: '2026-08-16T08:00:00Z', completedAtISO: null, lastReminderAtISO: null, nowISO: now }), false)
check('JO 3+ days, never reminded → remind', reminderDue({ joUploadedAtISO: '2026-08-14T02:00:00Z', completedAtISO: null, lastReminderAtISO: null, nowISO: now }), true)
check('reminded 1 day ago → snoozed', reminderDue({ joUploadedAtISO: '2026-08-10T02:00:00Z', completedAtISO: null, lastReminderAtISO: '2026-08-17T02:00:00Z', nowISO: now }), false)
check('reminded 3+ days ago → remind again', reminderDue({ joUploadedAtISO: '2026-08-10T02:00:00Z', completedAtISO: null, lastReminderAtISO: '2026-08-15T02:00:00Z', nowISO: now }), true)

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed')
