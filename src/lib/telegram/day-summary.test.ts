/**
 * Standalone test for the 6pm summary messages (no test framework).
 * Run: npx tsx src/lib/telegram/day-summary.test.ts
 * Exits 1 on any failure.
 */

import {
  tgEscape, formatDayDate, buildSchedulerSummary, buildInstallerSummary,
  splitForTelegram, TELEGRAM_LIMIT, formatTimeRange,
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

console.log('buildSchedulerSummary:')

const sched = buildSchedulerSummary({
  dateLabel: '16/09/2026 (Wed)',
  appUrl:    'https://x.test',
  roster: [
    { name: 'Nicholas', jobs: [
      { id: 'j1', title: 'Tampines Optical', driverNames: ['CK'] },
      { id: 'j2', title: 'Arnotts <script>', driverNames: [] },
    ] },
    { name: 'Daniel',  jobs: [{ id: 'j3', title: 'Fossil Bugis', driverNames: ['Rintu', 'Xiao Yi'] }] },
    { name: 'Charles', jobs: [] },
  ],
})

contains('header carries the date',           sched, 'End of Day Summary')
contains('header is bold + underlined',       sched, '<b><u>End of Day Summary (16/09/2026 (Wed))</u></b>')
contains('each person is bold',               sched, '<b>Nicholas</b>')
contains('someone with jobs says JOBS ADDED', sched, '<u>JOBS ADDED</u>')
contains('a job shows its driver',            sched, 'Tampines Optical (CK)')
contains('two drivers are both named',        sched, 'Fossil Bugis (Rintu, Xiao Yi)')
contains('no driver reads Unassigned, bold',  sched, '<b>Unassigned</b>')
contains('every job carries a link',          sched, 'https://x.test/jobs/j1')
// Charles added nothing and must still appear — the sketch shows an unchanging
// roster, not just whoever was busy.
contains('an idle person is still listed',    sched, 'NO JOBS ADDED')
contains('and it is Charles',                 sched, '<b>Charles</b>')
contains('it ends',                           sched, 'END OF SUMMARY')
absent('a job title cannot inject HTML',      sched, '<script>')
contains('the title is escaped instead',      sched, 'Arnotts &lt;script&gt;')

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
    { id: 't1', title: 'Arnotts GE Delivery', timeLabel: '9 AM – 1 PM', location: 'Blk 825 Tampines St 81', role: 'driver' },
    { id: 't2', title: 'Fossil Bugis',        timeLabel: 'All day',     location: 'Bugis Junction #02-11', role: 'support' },
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
contains('a support job says so',           withTomorrow, 'support crew')
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
    tomorrow: [{ id: 't9', title: 'Jewel', timeLabel: 'All day', location: 'Jewel', role: 'driver' }],
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
