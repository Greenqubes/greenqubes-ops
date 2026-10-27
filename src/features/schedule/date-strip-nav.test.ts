/**
 * Standalone test for the date strip's month labels, the board's day word and
 * the header arrows (no framework).
 * Run: npx tsx src/features/schedule/date-strip-nav.test.ts
 * Exits 1 on any failure.
 */
import { adjacentMonths, dayWord, stepDate } from './date-strip-nav'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// Nic's screenshot, 2026-10-27: the strip on November 2026 shows "October 2026"
// above its left arrow and "December 2026" above its right one, bold.
console.log('adjacentMonths:')
const nov = adjacentMonths('2026-11-01', '2026-11-30')
check('a full month: the month before', nov.prev, { iso: '2026-10-01', long: 'October 2026', short: 'Oct 2026' })
check('a full month: the month after',  nov.next, { iso: '2026-12-01', long: 'December 2026', short: 'Dec 2026' })

// A week can straddle two months. The labels name the months OUTSIDE what is
// on screen, so a 26 Oct – 1 Nov week reads September … December, never
// "October" on the left while October is already showing.
const straddle = adjacentMonths('2026-10-26', '2026-11-01')
check('a straddling week: before its first month', straddle.prev.long, 'September 2026')
check('a straddling week: after its last month',   straddle.next.long, 'December 2026')

const plainWeek = adjacentMonths('2026-11-02', '2026-11-08')
check('a week inside one month: before', plainWeek.prev.long, 'October 2026')
check('a week inside one month: after',  plainWeek.next.long, 'December 2026')

// The year turns over at both ends.
check('January looks back to last December', adjacentMonths('2027-01-01', '2027-01-31').prev,
  { iso: '2026-12-01', long: 'December 2026', short: 'Dec 2026' })
check('December looks ahead to next January', adjacentMonths('2026-12-01', '2026-12-31').next,
  { iso: '2027-01-01', long: 'January 2027', short: 'Jan 2027' })
check('a week across New Year', adjacentMonths('2026-12-28', '2027-01-03'),
  { prev: { iso: '2026-11-01', long: 'November 2026', short: 'Nov 2026' },
    next: { iso: '2027-02-01', long: 'February 2027', short: 'Feb 2027' } })

// The tap target is always the 1st — a day that exists in every month, so
// "flip to February" from 31 January can never roll over into March.
check('the target is the 1st even from the 31st', adjacentMonths('2027-01-31', '2027-01-31').next.iso, '2027-02-01')

// Always English (CLAUDE.md hard rule) — there is no language argument at all.
check('September is spelt out in full', adjacentMonths('2026-10-05', '2026-10-11').prev.long, 'September 2026')
check('September short form', adjacentMonths('2026-10-05', '2026-10-11').prev.short, 'Sep 2026')

// "3 Jobs Today" on the Drivers board — Nic: "Any other day than today, it
// should be saying 'On This Day'". The OLD behaviour said "Today" on every day.
console.log('dayWord:')
check('THE BUG: another day no longer says Today', dayWord('2026-11-02', '2026-10-27'), 'On This Day')
check('a past day says On This Day too',           dayWord('2026-10-01', '2026-10-27'), 'On This Day')
check('today still says Today',                    dayWord('2026-10-27', '2026-10-27'), 'Today')

// The ‹ › beside the heading. On the Drivers board they did nothing at all —
// goBack/goForward had no case for 'board' (found 2026-10-27). The board shows
// one day, so they move one day, like List (Nic's pick).
console.log('stepDate:')
check('THE BUG: board back moves a day',     stepDate('board', '2026-11-02', -1), '2026-11-01')
check('THE BUG: board forward moves a day',  stepDate('board', '2026-11-02',  1), '2026-11-03')
check('board crosses a month end',           stepDate('board', '2026-11-30',  1), '2026-12-01')
check('list still moves a day',              stepDate('list',  '2026-11-02', -1), '2026-11-01')
check('week still moves seven days',         stepDate('week',  '2026-11-02',  1), '2026-11-09')
check('month still moves a month (to the 1st)', stepDate('month', '2026-11-30', 1), '2026-12-01')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed.`)
  process.exit(1)
}
console.log('\nAll checks passed.')
