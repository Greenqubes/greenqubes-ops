/**
 * Standalone test for the installer Team box crew rules (no test framework).
 * Run: npx tsx src/lib/utils/installer-crew.test.ts
 * Exits 1 on any failure.
 */
import { crewOf, noDriverYet, idBatches, EMPTY_CREW, type CrewSource } from './installer-crew'
import { primaryBand, UNASSIGNED, type BoardJob } from './driver-board'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const rintu = { id: 'u-rintu', name: 'Rintu' }
const xiao  = { id: 'u-xiao',  name: 'Xiao Yi' }
const firoz = { id: 'u-firoz', name: 'Firoz Ahmed' }
const ghost = { id: 'u-ghost', name: 'Suggested Sam' }

const full: CrewSource = {
  job_assignees: [
    { is_suggestion: false, is_sub_installer: false, users: rintu },
    { is_suggestion: false, is_sub_installer: true,  users: xiao },
    { is_suggestion: false, is_sub_installer: true,  users: firoz },
    { is_suggestion: true,  is_sub_installer: false, users: ghost },
    { is_suggestion: false, is_sub_installer: false, users: null },
  ],
  job_external_contacts: [
    { is_suggestion: false, external_contacts: { name: 'Ah Huat' } },
    { is_suggestion: true,  external_contacts: { name: 'Maybe Signs' } },
    { is_suggestion: false, external_contacts: null },
  ],
}

console.log('crewOf')
const c = crewOf(full, null)
check('drivers: confirmed non-support rows, whole names', c.drivers.map(p => p.name), ['Rintu'])
check('support: rows flagged is_sub_installer, whole names kept', c.support.map(p => p.name), ['Xiao Yi', 'Firoz Ahmed'])
check('externals: confirmed only, deleted contact skipped', c.externals.map(p => p.name), ['Ah Huat'])
check('suggested installer never appears', [...c.drivers, ...c.support].some(p => p.name === 'Suggested Sam'), false)
check('viewer null → nobody is "you"', [...c.drivers, ...c.support, ...c.externals].some(p => p.you), false)

const mine = crewOf(full, 'u-xiao')
check('viewer flagged as you', mine.support.find(p => p.name === 'Xiao Yi')?.you, true)
check('others not flagged', mine.drivers[0].you, false)
check('externals never "you"', mine.externals.every(p => !p.you), true)
check('empty job → EMPTY_CREW', crewOf({ job_assignees: [], job_external_contacts: [] }, 'u-xiao'), EMPTY_CREW)

console.log('noDriverYet')
const onlySupport: CrewSource  = { job_assignees: [{ is_sub_installer: true, users: xiao }], job_external_contacts: [] }
const onlyExternal: CrewSource = { job_assignees: [], job_external_contacts: [{ external_contacts: { name: 'Ah Huat' } }] }
const oneDriver: CrewSource    = { job_assignees: [{ users: rintu }], job_external_contacts: [] }
const nobody: CrewSource       = { job_assignees: [], job_external_contacts: [] }
const suggestedOnly: CrewSource = { job_assignees: [{ is_suggestion: true, users: ghost }], job_external_contacts: [{ is_suggestion: true, external_contacts: { name: 'Maybe Signs' } }] }
check('nobody → no driver yet', noDriverYet(crewOf(nobody, null)), true)
check('support crew only → no driver yet', noDriverYet(crewOf(onlySupport, null)), true)
check('outside contractor only → crewed', noDriverYet(crewOf(onlyExternal, null)), false)
check('one driver → crewed', noDriverYet(crewOf(oneDriver, null)), false)
check('suggestions only → no driver yet', noDriverYet(crewOf(suggestedOnly, null)), true)

console.log('agrees with the scheduler\'s driver board')
// Same fixtures as BoardJob rows (the board needs contact ids).
const asBoard = (src: CrewSource, id: string): BoardJob => ({
  id, time_start: null,
  job_assignees: src.job_assignees.map(a => ({ is_suggestion: a.is_suggestion, is_sub_installer: a.is_sub_installer, users: a.users ?? null })),
  job_external_contacts: src.job_external_contacts.map((e, i) => ({
    is_suggestion: e.is_suggestion,
    external_contacts: e.external_contacts ? { id: `c-${i}`, name: e.external_contacts.name } : null,
  })),
} as unknown as BoardJob)
for (const [name, src] of Object.entries({ full, onlySupport, onlyExternal, oneDriver, nobody, suggestedOnly })) {
  check(`${name}: noDriverYet matches the board's Unassigned`,
    noDriverYet(crewOf(src, null)), primaryBand(asBoard(src, name)) === UNASSIGNED)
}

console.log('idBatches')
// An admin previewing as installer can see every scheduled job; their ids go
// into the request URL, so they are sent in batches (review, 2026-11-10).
const many = Array.from({ length: 250 }, (_, i) => `id-${i}`)
check('250 ids → batches of at most 100', idBatches(many).map(b => b.length), [100, 100, 50])
check('every id kept, in order', idBatches(many).flat(), many)
check('no ids → no batches', idBatches([]), [])
check('duplicates sent once', idBatches(['a', 'b', 'a']), [['a', 'b']])

if (failures) { console.error(`\n${failures} failing`); process.exit(1) }
console.log('\nall passing')
