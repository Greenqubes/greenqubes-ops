/**
 * Standalone test for the one "overdue" rule (schedule card + date strip,
 * the bell's overdue list, the 9am/6pm overdue Telegram).
 * Run: npx tsx src/lib/utils/overdue.test.ts
 * Exits 1 on any failure.
 *
 * Nic, 2026-11-18: "a job with multiple day shouldnt be flagged red as its a
 * ongoing job. only after completion" — every check compared today with the
 * job's START date, so day 2 of a 3-day install already showed red.
 * `oldIsOverdue` is that rule, kept so the test shows it catching the bug.
 */
import { isOverdue, lastDayOf } from './overdue'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const oldIsOverdue = (status: string, date: string, today: string) => status === 'scheduled' && date < today

const today = '2026-11-18'
const threeDay = { status: 'scheduled', date: '2026-11-17', date_end: '2026-11-19', time_end: '18:00' }

console.log('lastDayOf')
check('one-day job: its date', lastDayOf('2026-11-17', null), '2026-11-17')
check('multi-day job: the End Date', lastDayOf('2026-11-17', '2026-11-19'), '2026-11-19')
check('an End Date before the start is ignored', lastDayOf('2026-11-17', '2026-11-10'), '2026-11-17')

console.log('the reported bug')
check('old rule: day 2 of a 3-day job was red', oldIsOverdue(threeDay.status, threeDay.date, today), true)
check('day 2 of a 3-day job is NOT overdue', isOverdue(threeDay, today), false)
check('…not even after its daily end time', isOverdue(threeDay, today, 20 * 60), false)
check('the day after its last day it IS overdue', isOverdue(threeDay, '2026-11-20'), true)
check('on its last day, past the end time: overdue (bell / Telegram)', isOverdue(threeDay, '2026-11-19', 18 * 60), true)
check('on its last day, before the end time: not yet', isOverdue(threeDay, '2026-11-19', 17 * 60 + 59), false)

console.log('one-day jobs behave as before')
const oneDay = { status: 'scheduled', date: '2026-11-17', date_end: null, time_end: '17:00' }
check('yesterday, not completed: overdue', isOverdue(oneDay, today), true)
check('today, no clock given (schedule card): not yet', isOverdue({ ...oneDay, date: today }, today), false)
check('today, past its end time: overdue', isOverdue({ ...oneDay, date: today }, today, 17 * 60), true)
check('today, no end time: not until tomorrow', isOverdue({ ...oneDay, date: today, time_end: null }, today, 23 * 60), false)
check('completed jobs are never overdue', isOverdue({ ...oneDay, status: 'completed' }, today), false)
check('a job with no date is never overdue', isOverdue({ ...oneDay, date: null }, today), false)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall overdue checks passed')
