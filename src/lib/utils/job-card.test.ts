/**
 * Standalone test for job-card crew rules (no test framework).
 * Run: npx tsx src/lib/utils/job-card.test.ts
 * Exits 1 on any failure.
 */

import { splitCrew } from './job-card'

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

const driver  = (id: string, name: string) => ({ users: { id, name }, is_sub_installer: false })
const support = (id: string, name: string) => ({ users: { id, name }, is_sub_installer: true })

console.log('splitCrew:')

// The card shows Driver and Support Crew as two separate lines (Nic's
// annotated sketch, 2026-09-15). Which one a person is belongs to the JOB,
// not to them — is_sub_installer sits on job_assignees, so the same person
// drives one job and supports another.
check('a lone driver',
  splitCrew([driver('1', 'CK')]),
  { drivers: ['CK'], support: [] })

check('driver and support split apart',
  splitCrew([driver('1', 'CK'), support('2', 'Razu'), support('3', 'Thoa')]),
  { drivers: ['CK'], support: ['Razu', 'Thoa'] })

check('two drivers — this is what makes a job "Mixed"',
  splitCrew([driver('1', 'CK'), driver('2', 'Rintu')]),
  { drivers: ['CK', 'Rintu'], support: [] })

check('nobody assigned',
  splitCrew([]),
  { drivers: [], support: [] })

check('support only, no driver yet',
  splitCrew([support('2', 'Razu')]),
  { drivers: [], support: ['Razu'] })

// A missing flag is main crew. Older rows predate the sub-installer column.
check('a missing is_sub_installer counts as a driver',
  splitCrew([{ users: { id: '1', name: 'CK' } }]),
  { drivers: ['CK'], support: [] })

// STANDING RULE, and it has caused a real bug before: a suggestion is a
// tentative sales pick and must never render as a confirmed assignee. The
// schedule query already strips them; this is the second line of defence,
// because the installer views feed rows through a different path.
check('a suggested driver never appears',
  splitCrew([driver('1', 'CK'), { users: { id: '9', name: 'Hasan' }, is_sub_installer: false, is_suggestion: true }]),
  { drivers: ['CK'], support: [] })

check('a suggested support crew member never appears',
  splitCrew([support('2', 'Razu'), { users: { id: '9', name: 'Hasan' }, is_sub_installer: true, is_suggestion: true }]),
  { drivers: [], support: ['Razu'] })

check('a row with no user is skipped, not rendered blank',
  splitCrew([driver('1', 'CK'), { users: null, is_sub_installer: false }]),
  { drivers: ['CK'], support: [] })

check('order is kept as the query returned it',
  splitCrew([support('3', 'Thoa'), driver('1', 'CK'), support('2', 'Razu')]),
  { drivers: ['CK'], support: ['Thoa', 'Razu'] })

// THE OLD BEHAVIOUR, asserted so this test proves it catches the real thing:
// the compact meta row used name.split(' ')[0], which turns "Xiao Yi" into
// "Xiao" and collapses BOTH "Ali B" and "Ali Ramjan" to "Ali" — two different
// people rendering identically on the card. Pills carry the whole name.
check('a two-word name survives whole — "Xiao Yi", not "Xiao"',
  splitCrew([driver('1', 'Xiao Yi')]),
  { drivers: ['Xiao Yi'], support: [] })

check('two people who share a first name stay distinguishable',
  splitCrew([support('1', 'Ali B'), support('2', 'Ali Ramjan')]),
  { drivers: [], support: ['Ali B', 'Ali Ramjan'] })

console.log(failures === 0 ? '\nAll job-card checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
