/**
 * Standalone test for classifying an install-date edit (no framework).
 * Run: npx tsx src/lib/utils/design-date-change.test.ts
 * Exits 1 on any failure.
 */
import { designDateChange } from './design-date-change'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
// THE BUG this prevents: the auto-shift measured daysBetween(old, new). With a
// missing old date that is NaN, and the due date became "Invalid Date".
check('first date on a dateless Pending job is a SET, not a move', designDateChange(null, '2026-10-15'), 'set')
check('clearing the date', designDateChange('2026-10-15', null), 'cleared')
check('a real move', designDateChange('2026-10-15', '2026-10-20'), 'moved')
check('same date', designDateChange('2026-10-15', '2026-10-15'), 'none')
check('not sent', designDateChange('2026-10-15', undefined), 'none')
check('null to null', designDateChange(null, null), 'none')
check("'' counts as cleared", designDateChange('2026-10-15', ''), 'cleared')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall design-date-change checks passed')
