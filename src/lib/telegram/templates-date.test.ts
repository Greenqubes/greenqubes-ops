/**
 * Standalone test: Telegram templates on a job with no date (no framework).
 * Run: npx tsx src/lib/telegram/templates-date.test.ts
 * Exits 1 on any failure.
 */
import { formatDate, tplJobPostponed, tplDesignAssigned } from './templates'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
function safe<T>(fn: () => T): T | string {
  try { return fn() } catch (e) { return `THREW: ${(e as Error).message}` }
}

// THE CRASH this prevents: formatDate(null) used to throw (null.split), and
// '' rendered "NaN undefined NaN". A Pending job has no date (2026-10-09).
check('a real date', formatDate('2026-10-15'), '15 Oct 2026')
check('no date reads "To be confirmed"', safe(() => formatDate(null)), 'To be confirmed')
check('empty string reads "To be confirmed"', safe(() => formatDate('')), 'To be confirmed')
check('design-assigned on a dateless job does not crash',
  safe(() => tplDesignAssigned({ projectTitle: 'X', client: 'C', date: null, assignedBy: 'Nic', jobUrl: 'u' }).includes('To be confirmed')), true)
const msg = safe(() => tplJobPostponed({ projectTitle: 'Fossil', jobClient: 'Fossil SG', oldDate: '2026-10-09', location: '313 Orchard', jobUrl: 'https://x/jobs/1' }))
check('postponed message names the old date', String(msg).includes('9 Oct 2026'), true)
check('postponed message says date TBC', String(msg).includes('To be confirmed'), true)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall templates-date checks passed')
