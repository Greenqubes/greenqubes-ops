/**
 * Standalone test for the 6pm summary's change-line date (no framework).
 * Run: npx tsx src/lib/utils/day-summary-label.test.ts
 * Exits 1 on any failure.
 */
import { changeDateLabel } from './day-summary-label'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
const fmt = (iso: string) => `F(${iso})`
// A postponed job (Scheduled → Pending) has no date by 6pm; the line must
// still say something a person understands.
check('a dated job uses the formatter', changeDateLabel('2026-10-15', fmt), 'F(2026-10-15)')
check('a postponed job', changeDateLabel(null, fmt), 'Postponed, date to be confirmed')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall day-summary-label checks passed')
