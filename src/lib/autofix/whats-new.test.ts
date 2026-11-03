/**
 * Standalone test for auto-fix lines in What's new.
 * Nic, 2026-11-04: "when a major bug fix or crashes goes live, whats new should
 * pop up once. minor ones should appear once a week on monday morning."
 * Run: npx tsx src/lib/autofix/whats-new.test.ts
 * Exits 1 on any failure.
 */

import { autoLineFor, mergeChangelog, nextMondayAfter, seenMarker, sgtDate, sgtTime, todaySgt } from './whats-new'
import type { ChangelogEntry } from '@/lib/changelog/entries'

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

check('sgtDate rolls over at 16:00 UTC', sgtDate('2026-11-05T16:30:00Z'), '2026-11-06')
check('sgtTime', sgtTime('2026-11-05T13:14:00Z'), '21:14')
check('todaySgt', todaySgt(new Date('2026-11-04T17:00:00Z')), '2026-11-05')

// Major: the day it went live, with its time.
check('major → same SGT day + time',
  autoLineFor({ severity: 'major', liveAt: '2026-11-05T13:14:00Z', line: 'X' }),
  { date: '2026-11-05', time: '21:14', line: 'X' })
check('major after 16:00 UTC → next SGT day',
  autoLineFor({ severity: 'major', liveAt: '2026-11-05T17:30:00Z', line: 'X' }),
  { date: '2026-11-06', time: '01:30', line: 'X' })

// Minor: the next Monday strictly after.
check('Monday → the following Monday', nextMondayAfter('2026-11-09'), '2026-11-16')
check('Sunday → the next day', nextMondayAfter('2026-11-08'), '2026-11-09')
check('Wednesday → next Monday', nextMondayAfter('2026-11-04'), '2026-11-09')
check('minor → next Monday, no time',
  autoLineFor({ severity: 'minor', liveAt: '2026-11-04T05:00:00Z', line: 'Y' }),
  { date: '2026-11-09', line: 'Y' })
check('minor on a Monday evening SGT (still Monday) → +7',
  autoLineFor({ severity: 'minor', liveAt: '2026-11-09T12:00:00Z', line: 'Y' }),
  { date: '2026-11-16', line: 'Y' })

const handWritten: ChangelogEntry[] = [
  { date: '2026-11-05', time: '18:00', added: ['A session feature.'] },
  { date: '2026-10-30', time: '17:22', fixed: ['Older fix.'] },
]

// An auto line on a date with a hand-written entry joins its Fixed section.
const merged = mergeChangelog(handWritten, [{ date: '2026-11-05', time: '21:14', line: 'Auto fix.' }], '2026-11-05')
check('appended to the same date', merged[0].fixed, ['Auto fix.'])
check('hand-written time kept', merged[0].time, '18:00')
check('hand-written sections kept', merged[0].added, ['A session feature.'])
check('no new entry created', merged.length, 2)
check('hand-written entries not mutated', handWritten[0].fixed, undefined)

// An auto-only date gets its own entry, sorted in.
const own = mergeChangelog(handWritten, [
  { date: '2026-11-03', time: '09:05', line: 'One.' },
  { date: '2026-11-03', time: '14:40', line: 'Two.' },
], '2026-11-05')
check('own entry sorted between', own.map(e => e.date), ['2026-11-05', '2026-11-03', '2026-10-30'])
check('own entry lines', own[1].fixed, ['One.', 'Two.'])
check('own entry takes the latest time', own[1].time, '14:40')

const monday = mergeChangelog([], [{ date: '2026-11-09', line: 'Minor.' }], '2026-11-09')
check('Monday batch has no time', monday[0].time, undefined)

// Nothing dated after today is shown — that is what holds Monday's batch back.
check('future auto hidden', mergeChangelog(handWritten, [{ date: '2026-11-09', line: 'Later.' }], '2026-11-05').length, 2)
check('future hand-written hidden', mergeChangelog([{ date: '2026-11-09', fixed: ['x'] }, ...handWritten], [], '2026-11-05')[0].date, '2026-11-05')

// The "seen" marker: bare date stays compatible with what people stored before.
check('no auto → bare newest date', seenMarker(handWritten, []), '2026-11-05')
check('2 auto lines on the newest date → date+2',
  seenMarker(merged, [{ date: '2026-11-05', line: 'a' }, { date: '2026-11-05', line: 'b' }]), '2026-11-05+2')
check('auto lines only on older dates → bare newest date',
  seenMarker(handWritten, [{ date: '2026-10-30', line: 'a' }]), '2026-11-05')
check('empty → empty marker', seenMarker([], []), '')

if (failures > 0) {
  console.error(`\n${failures} check(s) failed`)
  process.exit(1)
}
console.log("\nAll what's-new checks passed")
