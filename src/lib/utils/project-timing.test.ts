/**
 * Standalone test for Workflow V3 timing inheritance (spec §5). No framework.
 * Run: npx tsx src/lib/utils/project-timing.test.ts — exits 1 on any failure.
 */
import { timingOnNest, timingOnJobTimeEdit, timingOnUnnest } from './project-timing'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const P  = { time_start: '09:00', time_end: '13:00' }
const P0 = { time_start: null, time_end: null }

// nest: empty job times + project has time → inherit
check('nest, empty job + project time → inherit', timingOnNest({ time_start: null, time_end: null }, P),
  { time_start: '09:00', time_end: '13:00', time_inherited: true })
// nest: job has ANY own time → untouched
check('nest, own start only → untouched', timingOnNest({ time_start: '10:00', time_end: null }, P), null)
check('nest, own both → untouched', timingOnNest({ time_start: '10:00', time_end: '12:00' }, P), null)
// nest: both empty, project has none → untouched (stays a floater)
check('nest, both empty → untouched', timingOnNest({ time_start: null, time_end: null }, P0), null)

// job time edit while nested: user typed a time → stops following
check('edit sets time → own', timingOnJobTimeEdit('14:00', '18:00', true, P),
  { time_start: '14:00', time_end: '18:00', time_inherited: false })
// cleared both while nested + project has a time → re-inherit (spec §5)
check('edit clears → re-inherit', timingOnJobTimeEdit(null, null, true, P),
  { time_start: '09:00', time_end: '13:00', time_inherited: true })
// cleared while nested but project has no time → floater, not inherited
check('edit clears, project timeless → floater', timingOnJobTimeEdit(null, null, true, P0),
  { time_start: null, time_end: null, time_inherited: false })
// not nested: whatever the user set, never inherited
check('edit, not nested → own', timingOnJobTimeEdit(null, null, false, null),
  { time_start: null, time_end: null, time_inherited: false })
// one-sided time counts as "own"
check('edit start only → own', timingOnJobTimeEdit('08:00', null, true, P),
  { time_start: '08:00', time_end: null, time_inherited: false })

// un-nest: times stay, flag drops
check('unnest → flag false', timingOnUnnest(), { time_inherited: false })

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll project-timing checks passed')
