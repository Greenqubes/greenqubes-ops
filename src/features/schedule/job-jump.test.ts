/**
 * Standalone test for jumping to a job from the My Jobs panel (no framework).
 * Run: npx tsx src/features/schedule/job-jump.test.ts
 * Exits 1 on any failure.
 */
import { viewAfterPick, jobCardSelector, scrollSettled, scheduleJumpHref, parseScheduleJump } from './job-jump'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// Nic, 2026-10-14: tap a shortcut → land on the job and blink it twice. Month
// has no job cards (only dots per day), so it must switch to the day's List —
// staying on Month would leave nothing to blink.
check('Month switches to List', viewAfterPick('month'), 'list')
check('List stays', viewAfterPick('list'), 'list')
check('Drivers board stays', viewAfterPick('board'), 'board')
check('Week stays (its columns hold cards)', viewAfterPick('week'), 'week')

// Every copy of the card — a job shared with an outside contractor shows twice
// on the Drivers board, and both blink.
check('selector finds a card by job id', jobCardSelector('abc-123'), '[data-job-card="abc-123"]')
// REVIEW #4 (2026-10-19): a crafted ?highlight= with a line break made
// querySelectorAll throw and crashed the Jobs tab. Every character outside
// [A-Za-z0-9_-] is CSS-escaped as a hex code, so no value can break out.
check('a real job id (uuid) is unchanged', jobCardSelector('18f90896-aa11-4b2c-9d3e-0123456789ab'), '[data-job-card="18f90896-aa11-4b2c-9d3e-0123456789ab"]')
check('selector escapes quotes', jobCardSelector('a"b'), '[data-job-card="a\\22 b"]')
check('selector escapes a line break', jobCardSelector('a\nb'), '[data-job-card="a\\a b"]')
check('selector escapes a backslash', jobCardSelector('a\\b'), '[data-job-card="a\\5c b"]')

// Nic, 2026-10-14: "it's blinking already when still scrolling". The blink
// waits until the page's scroll position has held still for a few frames.
check('still moving → not settled', scrollSettled([100, 180, 240, 280]), false)
check('slowing but still moving → not settled', scrollSettled([300, 301, 301, 302]), false)
check('held still for 4 frames → settled', scrollSettled([280, 300, 300, 300, 300]), true)
check('too few samples → not settled yet', scrollSettled([300, 300]), false)
// A smooth scroll can take a frame or two to START — those still frames must
// not count as "settled" when a scroll is on its way.
check('scroll needed but not started yet → not settled', scrollSettled([0, 0, 0, 0, 0], 4, true), false)
check('scroll needed, moved, then held → settled', scrollSettled([0, 0, 120, 300, 300, 300, 300], 4, true), true)
check('no scroll needed → still frames are settled', scrollSettled([0, 0, 0, 0], 4, false), true)

// Arriving on the Schedule page from another page's My Jobs panel (Nic,
// 2026-10-19): the link carries the job and its date; the page lands there.
check('jump link', scheduleJumpHref('2026-10-25', 'abc'), '/schedule?jump=abc&date=2026-10-25')
check('reads a jump link back', parseScheduleJump('?jump=abc&date=2026-10-25'), { jobId: 'abc', date: '2026-10-25' })
check('no jump in an ordinary visit', parseScheduleJump(''), null)
check('a jump without a date is ignored', parseScheduleJump('?jump=abc'), null)
check('an impossible date is ignored', parseScheduleJump('?jump=abc&date=2026-09-31'), null)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall job-jump checks passed')
