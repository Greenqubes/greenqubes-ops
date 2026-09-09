// Standalone test — run with: npx tsx src/lib/utils/leave-overlap.test.ts
// Exits 1 on failure (repo convention — no test framework).
import {
  addDays, leaveWindowOnDate, leaveBlocksJob, leaveRangesOverlap,
  leaveClashesForJobs, onLeaveIds, leaveDatesLabel, type LeaveRecord,
} from './leave-overlap'

let failed = 0
function check(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name}`) }
}
function eq<T>(name: string, got: T, want: T) {
  check(`${name} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}

const mk = (p: Partial<LeaveRecord>): LeaveRecord => ({
  id: 'l1', user_id: 'u1', date_start: '2026-09-10', date_end: '2026-09-12',
  start_portion: 'full', end_portion: 'full', ...p,
})

console.log('addDays')
eq('crosses month end', addDays('2026-09-30', 1), '2026-10-01')
eq('negative', addDays('2026-09-01', -1), '2026-08-31')

console.log('leaveWindowOnDate')
eq('before range → null', leaveWindowOnDate(mk({}), '2026-09-09'), null)
eq('after range → null', leaveWindowOnDate(mk({}), '2026-09-13'), null)
eq('middle day → full', leaveWindowOnDate(mk({}), '2026-09-11'), { start: '00:00', end: '24:00' })
eq('first day PM start', leaveWindowOnDate(mk({ start_portion: 'pm' }), '2026-09-10'), { start: '12:00', end: '24:00' })
eq('last day AM end', leaveWindowOnDate(mk({ end_portion: 'am' }), '2026-09-12'), { start: '00:00', end: '12:00' })
eq('single-day AM', leaveWindowOnDate(mk({ date_end: '2026-09-10', start_portion: 'am', end_portion: 'am' }), '2026-09-10'), { start: '00:00', end: '12:00' })
eq('single-day full', leaveWindowOnDate(mk({ date_end: '2026-09-10' }), '2026-09-10'), { start: '00:00', end: '24:00' })

console.log('leaveBlocksJob — the spec pass-case: AM leave, afternoon job')
check('AM leave does NOT block a 14:00 job', !leaveBlocksJob(
  mk({ date_end: '2026-09-10', start_portion: 'am', end_portion: 'am' }),
  '2026-09-10', null, '14:00', '17:00'))
check('AM leave DOES block a 09:00 job', leaveBlocksJob(
  mk({ date_end: '2026-09-10', start_portion: 'am', end_portion: 'am' }),
  '2026-09-10', null, '09:00', '11:00'))
check('full leave blocks a floater (no start time)', leaveBlocksJob(
  mk({}), '2026-09-11', null, null, null))
check('AM leave blocks a floater too (whole-day job overlaps any window)', leaveBlocksJob(
  mk({ date_end: '2026-09-10', start_portion: 'am', end_portion: 'am' }),
  '2026-09-10', null, null, null))
check('PM-start first day clears a morning job that day', !leaveBlocksJob(
  mk({ start_portion: 'pm' }), '2026-09-10', null, '08:00', '11:00'))
check('open-ended job starting inside the window blocks', leaveBlocksJob(
  mk({ date_end: '2026-09-10', start_portion: 'pm', end_portion: 'pm' }),
  '2026-09-10', null, '14:00', null))
check('HH:MM:SS times from the DB compare fine', leaveBlocksJob(
  mk({}), '2026-09-11', null, '09:00:00', '11:00:00'))
check('multi-day job overlapping only day 2 blocks', leaveBlocksJob(
  mk({ date_start: '2026-09-11', date_end: '2026-09-11' }),
  '2026-09-10', '2026-09-12', '09:00', '17:00'))
check('job entirely before the leave passes', !leaveBlocksJob(
  mk({}), '2026-09-08', '2026-09-09', '09:00', '17:00'))

console.log('leaveRangesOverlap')
check('touching ranges overlap', leaveRangesOverlap(mk({}), mk({ date_start: '2026-09-12', date_end: '2026-09-14' })))
check('disjoint ranges do not', !leaveRangesOverlap(mk({}), mk({ date_start: '2026-09-13', date_end: '2026-09-14' })))

console.log('leaveClashesForJobs')
const jobs = [
  { id: 'j1', date: '2026-09-11', date_end: null, time_start: '09:00', time_end: '12:00', people: [{ id: 'u1', name: 'Ali' }, { id: 'u2', name: 'Mei' }] },
  { id: 'j2', date: '2026-09-20', date_end: null, time_start: null, time_end: null, people: [{ id: 'u1', name: 'Ali' }] },
]
const out = leaveClashesForJobs(jobs, [mk({})])
eq('one conflict, right person/job', out.map(c => `${c.personId}:${c.jobId}`), ['u1:j1'])
eq('conflict carries the leave row', out[0].leave.id, 'l1')

console.log('onLeaveIds')
eq('set filters by time window', [...onLeaveIds(['u1', 'u2'], '2026-09-10', null, '14:00', '17:00',
  [mk({ date_end: '2026-09-10', start_portion: 'am', end_portion: 'am' })])], [])
eq('full-day leave flags', [...onLeaveIds(['u1', 'u2'], '2026-09-11', null, '14:00', '17:00', [mk({})])], ['u1'])

console.log('leaveDatesLabel')
const fmt = (iso: string) => iso
eq('single full day', leaveDatesLabel(mk({ date_end: '2026-09-10' }), fmt), '2026-09-10')
eq('single AM day', leaveDatesLabel(mk({ date_end: '2026-09-10', start_portion: 'am', end_portion: 'am' }), fmt), '2026-09-10 (AM only)')
eq('range with portions', leaveDatesLabel(mk({ start_portion: 'pm', end_portion: 'am' }), fmt), '2026-09-10 (from PM) – 2026-09-12 (until AM)')
eq('plain range', leaveDatesLabel(mk({}), fmt), '2026-09-10 – 2026-09-12')

if (failed > 0) { console.error(`\n${failed} check(s) failed`); process.exit(1) }
console.log('\nAll leave-overlap checks passed')
