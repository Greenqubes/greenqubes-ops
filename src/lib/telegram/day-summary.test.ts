/**
 * Standalone test for the 6pm summary messages (no test framework).
 * Run: npx tsx src/lib/telegram/day-summary.test.ts
 * Exits 1 on any failure.
 */

import {
  tgEscape, formatDayDate, buildInstallerSummary,
  splitForTelegram, TELEGRAM_LIMIT, formatTimeRange, buildUnassignedSummary,
} from './day-summary'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
function contains(name: string, haystack: string, needle: string) {
  if (haystack.includes(needle)) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      missing: ${needle}\n      in: ${haystack}`); failures++ }
}
function absent(name: string, haystack: string, needle: string) {
  if (!haystack.includes(needle)) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      should not contain: ${needle}`); failures++ }
}

console.log('formatDayDate:')

// Static English tables, no toLocaleDateString: date labels are ALWAYS
// English in every language (CLAUDE.md hard rule), and a locale call here is
// what caused hydration error #418 on /schedule.
check('day name and DD/MM/YYYY', formatDayDate('2026-09-16'), '16/09/2026 (Wed)')
check('pads single digits',      formatDayDate('2026-01-05'), '05/01/2026 (Mon)')

console.log('tgEscape:')

// Messages go out as HTML. A job title is user text, so an unescaped angle
// bracket can inject formatting or a fake link into a Telegram message —
// the hardening item on the checklist since the 2026-08-13 audit.
check('angle brackets and ampersands are neutralised',
  tgEscape('A & B <b>bold</b>'),
  'A &amp; B &lt;b&gt;bold&lt;/b&gt;')
check('plain text is untouched', tgEscape('Tampines Optical'), 'Tampines Optical')

console.log('buildUnassignedSummary — the scheduler\'s 4pm check:')

const gaps = buildUnassignedSummary({
  dateLabel: '17/09/2026 (Thu)',
  appUrl:    'https://x.test',
  groups: [
    { salesName: 'Nicholas', jobs: [
      { id: 'g1', title: 'Big Oakley Tower', dateLabel: '21/09/2026 (Mon)', location: '2 Jurong East St 21', createdBy: 'Nicholas', daysAway: 4 },
      { id: 'g3', title: 'Later one',        dateLabel: '30/10/2026 (Fri)', location: '', createdBy: 'Nicholas', daysAway: 43 },
    ] },
    { salesName: 'Charles Ow', jobs: [
      { id: 'g2', title: 'Arnotts <b>GE</b>', dateLabel: '02/10/2026 (Fri)', location: '', createdBy: 'Charles Ow', daysAway: 15 },
    ] },
  ],
})

contains('counts across every group',     gaps, '3 jobs with nobody assigned')
// Grouped by the sales person (Nic, 2026-09-17) — the scheduler chases per
// person, so the message is ordered the way he works.
contains('the sales person heads their group', gaps, '<b>Nicholas</b>')
contains('and so does the next',          gaps, '<b>Charles Ow</b>')
check('Nicholas comes before Charles',    gaps.indexOf('<b>Nicholas</b>') < gaps.indexOf('<b>Charles Ow</b>'), true)
// Numbering restarts inside each group rather than running 1..3 across them.
check('each group numbers from 1',        (gaps.match(/\n1\. /g) ?? []).length, 2)
contains('names the job',                 gaps, 'Big Oakley Tower')
contains('gives the date',                gaps, '21/09/2026 (Mon)')
// "in 4 days" is what he acts on — a bare date makes him do the arithmetic.
contains('and how far away it is',        gaps, 'in 4 days')
contains('the address, to tell duplicates apart', gaps, '2 Jurong East St 21')
contains('links straight to the job',     gaps, 'https://x.test/jobs/g1')
// His rule: keep firing until it is filled. Saying so stops it reading as a
// one-off that can be ignored.
contains('says it will repeat',           gaps, 'again tomorrow')
absent('a job title cannot inject HTML',  gaps, '<b>GE</b>')

check('a job with no address simply omits the line',
  gaps.includes('   \n'), false)

// Today and tomorrow read as words — the two that matter most.
const one = (daysAway: number) => buildUnassignedSummary({ dateLabel: 'x', appUrl: 'https://x.test',
  groups: [{ salesName: 'N', jobs: [{ id: 'a', title: 'A', dateLabel: 'd', location: '', createdBy: 'N', daysAway }] }] })
contains('today is spelled out', one(0), '<b>TODAY</b>')
contains('tomorrow too',        one(1), '<b>tomorrow</b>')

// Silence would be indistinguishable from a broken bot — the failure that hid
// the vault sync for 57 days. An all-clear is one line and removes the doubt.
const clear = buildUnassignedSummary({ dateLabel: '17/09/2026 (Thu)', appUrl: 'https://x.test', groups: [] })
contains('all-clear when nothing is missing', clear, 'Every upcoming job has a driver')
check('and it is NOT empty', clear !== '', true)

console.log('formatTimeRange:')

check('start and end',   formatTimeRange('09:00:00', '18:00:00'), '9 AM – 6 PM')
check('minutes kept',    formatTimeRange('09:30:00', '11:15:00'), '9:30 AM – 11:15 AM')
check('start only',      formatTimeRange('14:00:00', null),       'from 2 PM')
// A job with no time is a whole-day floater — say so rather than leave a gap,
// matching the schedule card and the FCFS board.
check('no time at all',  formatTimeRange(null, null),             'All day')

console.log('buildInstallerSummary:')

const inst = buildInstallerSummary({
  dateLabel: '16/09/2026 (Wed)',
  name:      'CK',
  appUrl:    'https://x.test',
  tomorrowLabel: '17/09/2026 (Thu)',
  tomorrow: [],
  added:   [{ id: 'j1', title: 'Tampines Optical', dateLabel: '17/09/2026 (Thu)', role: 'driver',  location: '10 Tampines Central' }],
  removed: [{ id: 'j9', title: 'Fossil Bugis',     dateLabel: '18/09/2026 (Fri)', role: 'support', location: 'Bugis Junction' }],
})

contains('greets the person',        inst, 'CK')
contains('says what was added',      inst, '<u>ADDED TO YOUR JOBS</u>')
contains('names the job and day',    inst, 'Tampines Optical')
contains('says which day it is on',  inst, '17/09/2026 (Thu)')
contains('says what came off',       inst, '<u>TAKEN OFF</u>')
contains('names that job too',       inst, 'Fossil Bugis')
contains('marks a support role',     inst, 'support crew')
contains('links through',            inst, 'https://x.test/jobs/j1')

// Somebody with only removals must not be sent an empty "added" heading.
const removalsOnly = buildInstallerSummary({
  dateLabel: '16/09/2026 (Wed)', name: 'Rintu', appUrl: 'https://x.test',
  tomorrowLabel: '17/09/2026 (Thu)', tomorrow: [],
  added: [], removed: [{ id: 'j2', title: 'Bugis', dateLabel: '17/09/2026 (Thu)', role: 'driver', location: 'Bugis' }],
})
absent('no empty ADDED heading',    removalsOnly, 'ADDED TO YOUR JOBS')
contains('the removal still shows', removalsOnly, '<u>TAKEN OFF</u>')

console.log('buildInstallerSummary — tomorrow (Nic, 2026-09-17):')

// The hole this closes: with a pure change log, an installer whose schedule
// did not change today gets NO message — even with a 9am tomorrow assigned
// three weeks ago. Silence was indistinguishable from "nothing on".
const withTomorrow = buildInstallerSummary({
  dateLabel: '17/09/2026 (Thu)', name: 'Xiao Yi', appUrl: 'https://x.test',
  tomorrowLabel: '18/09/2026 (Fri)',
  tomorrow: [
    { id: 't1', title: 'Arnotts GE Delivery', timeLabel: '9 AM – 1 PM', location: 'Blk 825 Tampines St 81',
      role: 'driver',  driverNames: [], supportNames: ['Razu', 'Zhang Xing'], pocName: 'Nicholas' },
    { id: 't2', title: 'Fossil Bugis',        timeLabel: 'All day',     location: 'Bugis Junction #02-11',
      role: 'support', driverNames: ['CK'], supportNames: ['Hasan'], pocName: 'Charles Ow' },
  ],
  added: [], removed: [],
})

contains('tomorrow is named with its date', withTomorrow, '<u>TOMORROW — 18/09/2026 (Fri)</u>')
contains('the job is listed',               withTomorrow, 'Arnotts GE Delivery')
contains('with its time',                   withTomorrow, '9 AM – 1 PM')
// The address is what tells two identically-titled jobs apart — Nic's
// 18-duplicate order produced exactly that, and on a phone the title alone
// is useless.
contains('and its address',                 withTomorrow, 'Blk 825 Tampines St 81')

// Written from the READER's side (Nic, 2026-09-17). The old "— support crew"
// label told them what they already knew; who to follow is what they need.
absent('the support-crew label is gone',    withTomorrow, 'support crew')
contains('a driver is told who follows them', withTomorrow, 'With you: Razu, Zhang Xing')
contains('support crew are told who to follow', withTomorrow, 'Driver: CK')
// Who to call if something is wrong on site (Nic, 2026-09-17).
contains('the Person-in-Charge is named',       withTomorrow, 'PIC: Nicholas')
contains('per job, not per message',            withTomorrow, 'PIC: Charles Ow')

// A driver on their own gets no dangling "With you:" line.
absent('no empty With-you line',
  buildInstallerSummary({
    dateLabel: 'x', name: 'CK', appUrl: 'https://x.test', tomorrowLabel: 'y',
    tomorrow: [{ id: 'a', title: 'A', timeLabel: 'All day', location: '', role: 'driver', driverNames: [], supportNames: [], pocName: 'N' }],
    added: [], removed: [],
  }),
  'With you:')

// But support crew with NO driver must be told — that is a real problem for
// them at 6pm, not a blank to leave out.
contains('support crew with no driver is warned',
  buildInstallerSummary({
    dateLabel: 'x', name: 'Razu', appUrl: 'https://x.test', tomorrowLabel: 'y',
    tomorrow: [{ id: 'a', title: 'A', timeLabel: 'All day', location: '', role: 'support', driverNames: [], supportNames: [], pocName: '' }],
    added: [], removed: [],
  }),
  'Driver: <b>nobody assigned yet</b>')
// Tomorrow comes FIRST: it is the thing he acts on tonight.
check('tomorrow is above the changes',
  withTomorrow.indexOf('TOMORROW') < (withTomorrow.indexOf('ADDED') === -1 ? Infinity : withTomorrow.indexOf('ADDED')),
  true)

// Nothing tomorrow AND nothing changed = nothing worth sending.
check('a totally quiet day produces no message',
  buildInstallerSummary({
    dateLabel: '17/09/2026 (Thu)', name: 'Hasan', appUrl: 'https://x.test',
    tomorrowLabel: '18/09/2026 (Fri)', tomorrow: [], added: [], removed: [],
  }),
  '')

// But a quiet day with work tomorrow must still go out — that is the whole
// point of the change.
check('work tomorrow alone is enough to send',
  buildInstallerSummary({
    dateLabel: '17/09/2026 (Thu)', name: 'Hasan', appUrl: 'https://x.test',
    tomorrowLabel: '18/09/2026 (Fri)',
    tomorrow: [{ id: 't9', title: 'Jewel', timeLabel: 'All day', location: 'Jewel', role: 'driver', driverNames: [], supportNames: [], pocName: 'N' }],
    added: [], removed: [],
  }) !== '',
  true)

contains('a change-only day still sends', removalsOnly, 'TAKEN OFF')
absent('and shows no empty TOMORROW',     removalsOnly, 'TOMORROW —')

console.log('splitForTelegram:')

// Telegram rejects a message over 4096 characters outright. Measured against
// the REAL database on 2026-09-16, a week of jobs came to 6,374 characters —
// so without this the summary would silently fail on exactly the busiest
// days, which is when it matters most.
check('a short message is left whole', splitForTelegram('hello'), ['hello'])

const longMsg = Array.from({ length: 400 }, (_, i) => `<b>line ${i}</b>`).join('\n')
const split   = splitForTelegram(longMsg)
check('a long message is split',        split.length > 1, true)
check('every part fits the limit',      split.every(p => p.length <= TELEGRAM_LIMIT + 32), true)
contains('parts are numbered',          split[0], '(1/')

// Splitting mid-tag would make Telegram reject the part for bad markup
// instead of length — a worse failure than the one being fixed.
check('no part ends inside an HTML tag',
  split.every(p => (p.match(/<b>/g) ?? []).length === (p.match(/<\/b>/g) ?? []).length),
  true)

// Nothing may be dropped on the way through.
check('every original line survives',
  split.join('\n').includes('<b>line 399</b>'), true)

// A single unbreakable line longer than the limit still has to go somewhere.
const giant = 'x'.repeat(TELEGRAM_LIMIT + 500)
check('an over-long single line is hard-cut, not lost',
  splitForTelegram(giant).length > 1, true)

console.log(failures === 0 ? '\nAll day-summary checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
