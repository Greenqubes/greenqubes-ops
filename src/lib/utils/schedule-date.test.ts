/**
 * Standalone test for the remembered-schedule-date rule (no test framework).
 * Run: npx tsx src/lib/utils/schedule-date.test.ts
 * Exits 1 on any failure.
 */

import { resolveScheduleDate, scheduleDateKey } from './schedule-date'

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

const TODAY = '2026-09-18'

console.log('resolveScheduleDate:')

// THE COMPLAINT this exists to fix (Nic, 2026-09-18): "i press oct 2 to edit
// arnotts, then either i press back to schedule or greenqubes logo to go
// schedule page, it jumps to today. very repetitive any annoying."
//
// THE OLD BEHAVIOUR, kept here on purpose so the test demonstrably catches the
// real bug: before this rule existed the page always opened on today, i.e. the
// stored value was ignored. If this line ever returns TODAY again, the bug is
// back.
check('a remembered date is what the schedule opens on', resolveScheduleDate('2026-10-02', TODAY), '2026-10-02')
check('a remembered date in the past is honoured too', resolveScheduleDate('2026-01-05', TODAY), '2026-01-05')
check('remembering today is a no-op, not a special case', resolveScheduleDate(TODAY, TODAY), TODAY)

// NOTHING REMEMBERED = today. This is the first visit, and it is also every
// visit after the tab was closed, because sessionStorage empties itself.
check('nothing stored opens on today', resolveScheduleDate(null, TODAY), TODAY)
check('an empty string is nothing stored', resolveScheduleDate('', TODAY), TODAY)
check('undefined is nothing stored', resolveScheduleDate(undefined, TODAY), TODAY)

// A STORED VALUE IS NOT TRUSTED. It comes from the browser, where anything can
// end up in it — an old format, a half-written value, someone editing it by
// hand. A bad value must land the user on today, never on a blank page: every
// view indexes jobsByDate[selectedDate], so a nonsense key renders an empty day
// with no explanation and no way back except the Today button.
check('a non-date string falls back to today', resolveScheduleDate('not-a-date', TODAY), TODAY)
check('a truncated date falls back to today', resolveScheduleDate('2026-10', TODAY), TODAY)
check('a slashed date falls back to today', resolveScheduleDate('02/10/2026', TODAY), TODAY)
check('a full timestamp falls back to today', resolveScheduleDate('2026-10-02T09:00:00Z', TODAY), TODAY)
check('whitespace falls back to today', resolveScheduleDate('   ', TODAY), TODAY)

// CALENDAR-SHAPED BUT NOT A REAL DAY. These pass a naive regex, so they are the
// cases a shape-only check would let through.
check('month 13 falls back to today', resolveScheduleDate('2026-13-01', TODAY), TODAY)
check('month 00 falls back to today', resolveScheduleDate('2026-00-10', TODAY), TODAY)
check('day 32 falls back to today', resolveScheduleDate('2026-10-32', TODAY), TODAY)
check('day 00 falls back to today', resolveScheduleDate('2026-10-00', TODAY), TODAY)
check('31 September falls back to today', resolveScheduleDate('2026-09-31', TODAY), TODAY)
check('29 February in a common year falls back to today', resolveScheduleDate('2026-02-29', TODAY), TODAY)
check('29 February in a leap year is a real day', resolveScheduleDate('2028-02-29', '2028-01-01'), '2028-02-29')

console.log('scheduleDateKey:')

// ONE KEY PER TAB OF THE APP. The same shell draws /schedule, /pending and
// /completed; sharing a key would make browsing Pending move the schedule's
// date under the user, which is the annoyance this whole change removes.
check('the schedule has its own key', scheduleDateKey('schedule'), 'gq-schedule-date:schedule')
check('pending has its own key', scheduleDateKey('pending'), 'gq-schedule-date:pending')
check('completed has its own key', scheduleDateKey('completed'), 'gq-schedule-date:completed')
check('the three keys are all different', new Set([scheduleDateKey('schedule'), scheduleDateKey('pending'), scheduleDateKey('completed')]).size, 3)

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
