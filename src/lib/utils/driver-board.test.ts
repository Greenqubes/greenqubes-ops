/**
 * Standalone test for the driver board rules (no test framework).
 * Run: npx tsx src/lib/utils/driver-board.test.ts
 * Exits 1 on any failure.
 */

import {
  MIXED, UNASSIGNED, driverBandId, externalBandId,
  mainCrew, primaryBand, mirrorBands, isMirror, isMirrorCard, buildBands, countRealJobs,
  sortByStartTime, planDrag, driverTint,
  type BoardJob, type DriverRef,
} from './driver-board'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const CK    = { id: 'ck',    name: 'CK'      }
const RINTU = { id: 'rintu', name: 'Rintu'   }
const XY    = { id: 'xy',    name: 'Xiao Yi' }
const RAZU  = { id: 'razu',  name: 'Razu'    }
const DRIVERS: DriverRef[] = [CK, RINTU, XY]

const main    = (u: DriverRef) => ({ users: { id: u.id, name: u.name }, is_sub_installer: false })
const support = (u: DriverRef) => ({ users: { id: u.id, name: u.name }, is_sub_installer: true  })
const sugg    = (u: DriverRef) => ({ users: { id: u.id, name: u.name }, is_sub_installer: false, is_suggestion: true })

/** An external installer link. Not a user — externals live in their own table. */
const ext = (id: string, name: string, isSuggestion = false) =>
  ({ is_suggestion: isSuggestion, external_contacts: { id, name } })

const job = (
  id: string,
  assignees: BoardJob['job_assignees'],
  time: string | null = '09:00:00',
  externals: NonNullable<BoardJob['job_external_contacts']> = [],
): BoardJob =>
  ({ id, time_start: time, job_assignees: assignees, job_external_contacts: externals })

console.log('mainCrew:')

check('formal non-support assignees only',
  mainCrew(job('j1', [main(CK), support(RINTU)])),
  [{ id: 'ck', name: 'CK' }])

// A suggestion is a tentative sales pick. It must never place a job in a
// driver's container — that would show an installer as booked when nobody
// has confirmed it (the rule behind migration 0037).
check('a suggestion is not crew',
  mainCrew(job('j2', [sugg(CK)])),
  [])

console.log('primaryBand — where the ONE draggable copy of a job lives:')

check('nobody on it → Unassigned',    primaryBand(job('p1', [])),                    UNASSIGNED)
check('one driver → their container', primaryBand(job('p2', [main(CK)])),            driverBandId('ck'))
check('two drivers → Mixed',          primaryBand(job('p3', [main(CK), main(RINTU)])), MIXED)
check('three drivers → Mixed',        primaryBand(job('p4', [main(CK), main(RINTU), main(XY)])), MIXED)
check('support crew alone does NOT place a job', primaryBand(job('p5', [support(CK)])), UNASSIGNED)

// Someone not flagged is_driver still gets their own container rather than
// vanishing. Old rows predate the 2026-09-07 Drivers bucket, and a job that
// is not on the board is a job the scheduler cannot find.
check('a lone non-driver still gets their own container',
  primaryBand(job('p6', [{ users: { id: 'zz', name: 'Ali Ramjan' }, is_sub_installer: false }])),
  driverBandId('zz'))

// A job with a driver AND an external belongs to the DRIVER (Nic): it is the
// driver's van and the driver's day. The external ALSO sees it — as a mirror,
// below — but the live, draggable card sits here.
check('a driver plus an external is still the driver\'s',
  primaryBand(job('p7', [main(CK)], '09:00:00', [ext('ahseng', 'Ah Seng')])),
  driverBandId('ck'))

// An external-only job has NO primary band: its external container is its only
// home, so that copy is the live one. null says "look in the mirrors".
check('external only → no primary band', primaryBand(job('p8', [], '09:00:00', [ext('ahseng', 'Ah Seng')])), null)

console.log('mirrorBands — the extra copies, one per external:')

check('no externals → no mirrors', mirrorBands(job('m1', [main(CK)])), [])

// Nic, 2026-09-16: "i actually prefer having 2 duplicate copies of the job but
// linking to same job form — my driver gets 1 jobcard, external installer gets
// another, both the same thing. its for visibility purpose."
check('a driver + external job appears in the external\'s container too',
  mirrorBands(job('m2', [main(CK)], '09:00:00', [ext('ahseng', 'Ah Seng')])),
  [externalBandId('ahseng')])

check('two externals → a copy each',
  mirrorBands(job('m3', [main(CK)], '09:00:00', [ext('ahseng', 'Ah Seng'), ext('bl', 'Boon Leong')])),
  [externalBandId('ahseng'), externalBandId('bl')])

// A suggested external is a tentative sales pick that has not been confirmed
// — invisible on the contact's own link page (migration 0040), so it must not
// make the job look staffed here either.
check('a SUGGESTED external gets no copy',
  mirrorBands(job('m4', [main(CK)], '09:00:00', [ext('ahseng', 'Ah Seng', true)])),
  [])

console.log('isMirror — a copy is read-only only when the job has a real home:')

// The drag acts on the JOB, not on the container it was picked up from, so a
// mirror must not be draggable: two live cards for one job is how a board
// starts contradicting itself.
check('an external copy beside a driver copy is a mirror',
  isMirror(job('r1', [main(CK)], '09:00:00', [ext('ahseng', 'Ah Seng')])), true)

// With nobody internal on it, the external container IS the job's only home —
// so that card must stay draggable, or an external-only job could never be
// given to a driver.
check('an external-only job is NOT a mirror', isMirror(job('r2', [], '09:00:00', [ext('ahseng', 'Ah Seng')])), false)

console.log('buildBands — fixed order, drivers always present:')

const bands = buildBands(
  [job('a', [main(CK)]), job('b', [main(CK), main(RINTU)]), job('c', [])],
  DRIVERS,
)
check('order is Mixed, then every driver, then Unassigned',
  bands.map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), UNASSIGNED])
check('jobs land in the right bands',
  bands.map(b => b.jobs.map(j => j.id)),
  [['b'], ['a'], [], [], ['c']])

// An empty driver container must still render: "CK has nothing today" is
// information, and a band that appears only when full moves the others.
check('an idle driver keeps their container',
  buildBands([], DRIVERS).map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), UNASSIGNED])

check('a stray non-driver gets a container after the real drivers',
  buildBands([job('s', [{ users: { id: 'zz', name: 'Ali Ramjan' }, is_sub_installer: false }])], DRIVERS)
    .map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), driverBandId('zz'), UNASSIGNED])

// External containers sit BELOW the three main drivers and ABOVE Unassigned
// (Nic's words: "a new container below my 3 main driver… unassigned container
// always below all of these"). They appear ONLY when they hold a job — an
// external is an occasional contractor, not a standing column, so an empty
// one would be clutter. That is the deliberate difference from a driver,
// whose empty container is itself information.
check('an external container sits under the drivers, above Unassigned',
  buildBands([job('e', [], '09:00:00', [ext('ahseng', 'Ah Seng')])], DRIVERS).map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), externalBandId('ahseng'), UNASSIGNED])

check('no external jobs → no external containers',
  buildBands([job('n', [main(CK)])], DRIVERS).map(b => b.id),
  [MIXED, driverBandId('ck'), driverBandId('rintu'), driverBandId('xy'), UNASSIGNED])

check('an external container is named after the contact',
  buildBands([job('e', [], '09:00:00', [ext('ahseng', 'Ah Seng')])], DRIVERS)
    .find(b => b.id === externalBandId('ahseng'))?.driver?.name,
  'Ah Seng')

// The duplicate-copy rule (Nic, 2026-09-16). ONE job row, TWO cards, both
// opening the same job form — the driver sees their day complete and the
// external sees theirs, and neither has to know about the other's container.
const shared = buildBands(
  [job('sh', [main(CK)], '09:00:00', [ext('ahseng', 'Ah Seng')])],
  DRIVERS,
)
check('a shared job appears in BOTH containers',
  shared.filter(b => b.jobs.length > 0).map(b => b.id),
  [driverBandId('ck'), externalBandId('ahseng')])
check('and it is the same job, not a copy of the data',
  shared.filter(b => b.jobs.length > 0).map(b => b.jobs[0].id),
  ['sh', 'sh'])

// Per CARD, not per band: one external container can hold a mirror of a
// driver's job AND an external-only job that is live, side by side.
check('the driver copy is live, the external copy is a mirror',
  shared.filter(b => b.jobs.length > 0).map(b => isMirrorCard(b.jobs[0], b.id)),
  [false, true])
check('an external-only job in an external container is NOT a mirror',
  isMirrorCard(job('eo', [], '09:00:00', [ext('ahseng', 'Ah Seng')]), externalBandId('ahseng')),
  false)

// The count must not lie. Two cards for one job would otherwise read as two
// jobs, and a scheduler counting the day's work would be wrong.
check('the real job count ignores mirrors', countRealJobs(shared), 1)
check('and counts unshared jobs once each',
  countRealJobs(buildBands([job('x', [main(CK)]), job('y', [])], DRIVERS)), 2)

console.log('sortByStartTime — a driver\'s day runs in clock order:')

check('earliest first, no-time last',
  sortByStartTime([job('late', [], '14:00:00'), job('none', [], null), job('early', [], '08:30:00')])
    .map(j => j.id),
  ['early', 'late', 'none'])

console.log('planDrag:')

// Mixed → a driver. Nic, 2026-09-16: "CK + RINTU in mixed, if i drag into
// xiao yi container, drop BOTH driver and support then prompt who to include
// for support xiao yi."
check('mixed to a driver drops every other driver AND the support crew',
  planDrag(job('m', [main(CK), main(RINTU), support(RAZU)]), driverBandId('ck'), DRIVERS),
  {
    targetBand: driverBandId('ck'),
    driverIds: ['ck'], removedDriverIds: ['rintu'],
    supportIds: [], removedSupportIds: ['razu'],
    askSupport: true, askDrivers: false, destructive: false,
  })

check('three drivers in mixed → only the target survives',
  planDrag(job('m3', [main(CK), main(RINTU), main(XY)]), driverBandId('ck'), DRIVERS),
  {
    targetBand: driverBandId('ck'),
    driverIds: ['ck'], removedDriverIds: ['rintu', 'xy'],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: false, destructive: false,
  })

// Nic, 2026-09-16: "if moving from one driver container over to another
// driver container, drop support crew too. cuz its a different team
// altogether." The support crew belongs to the DRIVER, not to the job — so
// when the driver goes, their helpers go with them.
check('driver to driver DROPS the support crew — a different team',
  planDrag(job('d2', [main(CK), support(RAZU)]), driverBandId('rintu'), DRIVERS),
  {
    targetBand: driverBandId('rintu'),
    driverIds: ['rintu'], removedDriverIds: ['ck'],
    supportIds: [], removedSupportIds: ['razu'],
    askSupport: true, askDrivers: false, destructive: false,
  })

// The other side of the same rule: NO driver is removed here — CK is still on
// the job, so the people who ride with him stay, pre-ticked.
check('adding a second driver KEEPS the existing support crew',
  planDrag(job('d3', [main(CK), support(RAZU)]), MIXED, DRIVERS),
  {
    targetBand: MIXED,
    driverIds: ['ck'], removedDriverIds: [],
    supportIds: ['razu'], removedSupportIds: [],
    askSupport: true, askDrivers: true, destructive: false,
  })

// Nic's rule: ALWAYS asks, even with no support crew — no silent drags.
check('a driver-to-driver move still asks with no support crew',
  planDrag(job('d', [main(CK)]), driverBandId('rintu'), DRIVERS),
  {
    targetBand: driverBandId('rintu'),
    driverIds: ['rintu'], removedDriverIds: ['ck'],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: false, destructive: false,
  })

check('unassigned to a driver adds them and offers support crew',
  planDrag(job('u', []), driverBandId('xy'), DRIVERS),
  {
    targetBand: driverBandId('xy'),
    driverIds: ['xy'], removedDriverIds: [],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: false, destructive: false,
  })

// The most destructive drag on the board — it clears everybody.
check('to Unassigned clears everyone and is flagged destructive',
  planDrag(job('x', [main(CK), support(RAZU)]), UNASSIGNED, DRIVERS),
  {
    targetBand: UNASSIGNED,
    driverIds: [], removedDriverIds: ['ck'],
    supportIds: [], removedSupportIds: ['razu'],
    askSupport: false, askDrivers: false, destructive: true,
  })

check('to Mixed asks who should be on it',
  planDrag(job('y', [main(CK)]), MIXED, DRIVERS),
  {
    targetBand: MIXED,
    driverIds: ['ck'], removedDriverIds: [],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: true, destructive: false,
  })

// Dropping a card back where it already is must be a no-op, not a prompt.
check('a drag onto its own band is refused',
  planDrag(job('z', [main(CK)]), driverBandId('ck'), DRIVERS),
  null)

check('a mixed job dropped on Mixed is refused',
  planDrag(job('z2', [main(CK), main(RINTU)]), MIXED, DRIVERS),
  null)

check('an empty job dropped on Unassigned is refused',
  planDrag(job('z3', []), UNASSIGNED, DRIVERS),
  null)

// Nic's call: external containers are display-only. Assigning an outsider
// stays on the job form, where the suggest-then-confirm rules live. The board
// also never registers them as drop targets, so this is belt and braces —
// the rule is asserted here so it cannot be lost in a UI refactor.
check('dragging INTO an external container is refused',
  planDrag(job('e1', [main(CK)]), externalBandId('ahseng'), DRIVERS),
  null)

// Dragging a job OUT of an external's container onto a driver is allowed, and
// the external STAYS: they were phoned and agreed to this job, so a drag must
// not quietly drop a contractor who is expecting to turn up.
check('external to a driver adds the driver and keeps the external',
  planDrag(job('e2', [], '09:00:00', [ext('ahseng', 'Ah Seng')]), driverBandId('ck'), DRIVERS),
  {
    targetBand: driverBandId('ck'),
    driverIds: ['ck'], removedDriverIds: [],
    supportIds: [], removedSupportIds: [],
    askSupport: true, askDrivers: false, destructive: false,
  })

console.log('driverTint — one colour per driver (Nic, 2026-09-17):')

check('CK is purple',     driverTint('CK'),      'var(--driver-tint-purple)')
check('Xiao Yi is beige', driverTint('Xiao Yi'), 'var(--driver-tint-beige)')
check('Rintu is green',   driverTint('Rintu'),   'var(--driver-tint-green)')

// Matched loosely on purpose: a name typed with different case or a stray
// space is the same person, and losing their colour over it would look like
// a bug rather than a typo.
check('case does not matter',       driverTint('xiao yi'),   'var(--driver-tint-beige)')
check('stray whitespace is fine',   driverTint('  Rintu  '), 'var(--driver-tint-green)')
check('a double space still works', driverTint('Xiao  Yi'),  'var(--driver-tint-beige)')

// A fourth driver degrades quietly to the neutral board background rather
// than being handed an arbitrary colour.
check('an unlisted driver has no tint', driverTint('Ali Ramjan'), null)

console.log(failures === 0 ? '\nAll driver-board checks passed.' : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
