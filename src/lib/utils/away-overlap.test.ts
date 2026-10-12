// Standalone test — run with: npx tsx src/lib/utils/away-overlap.test.ts
// Exits 1 on failure (repo convention — no test framework).
import {
  awayWindowOnDate, awayBlocksJob, awayDates, awayConflictsForJobs, awayTripFor,
  awayWhenLabel, pairKey, newPairs, buildAwayByDate, type AwayTrip,
} from './away-overlap'

let failed = 0
function check(name: string, cond: boolean) {
  if (cond) { console.log(`  ✓ ${name}`) } else { failed++; console.error(`  ✗ ${name}`) }
}
function eq<T>(name: string, got: T, want: T) {
  check(`${name} (got ${JSON.stringify(got)})`, JSON.stringify(got) === JSON.stringify(want))
}

const mk = (p: Partial<AwayTrip>): AwayTrip => ({
  id: 't1', title: 'First Aid course', business: null, location: null, note: null,
  start_date: '2026-10-13', start_time: '14:00:00', end_date: '2026-10-15', end_time: '12:00:00',
  people: [{ id: 'u1', name: 'Halim' }], ...p,
})

console.log('awayWindowOnDate')
eq('before → null', awayWindowOnDate(mk({}), '2026-10-12'), null)
eq('after → null', awayWindowOnDate(mk({}), '2026-10-16'), null)
eq('first day from start', awayWindowOnDate(mk({}), '2026-10-13'), { start: '14:00', end: '24:00' })
eq('middle day whole', awayWindowOnDate(mk({}), '2026-10-14'), { start: '00:00', end: '24:00' })
eq('last day until end', awayWindowOnDate(mk({}), '2026-10-15'), { start: '00:00', end: '12:00' })
eq('one-day trip', awayWindowOnDate(mk({ end_date: '2026-10-13', end_time: '17:00' }), '2026-10-13'), { start: '14:00', end: '17:00' })
eq('ends at midnight → last day not covered', awayWindowOnDate(mk({ end_time: '00:00' }), '2026-10-15'), null)

console.log('awayBlocksJob')
check('job inside the window warns', awayBlocksJob(mk({}), '2026-10-14', null, '09:00', '11:00'))
check('job before the trip starts does not', !awayBlocksJob(mk({}), '2026-10-13', null, '09:00', '12:00'))
check('touching edge: trip ends 12:00, job starts 12:00 → no warning', !awayBlocksJob(mk({}), '2026-10-15', null, '12:00', '15:00'))
check('touching edge: job ends 14:00, trip starts 14:00 → no warning', !awayBlocksJob(mk({}), '2026-10-13', null, '10:00', '14:00'))
check('all-day job (no start) on first day warns', awayBlocksJob(mk({ start_time: '17:00' }), '2026-10-13', null, null, null))
check('open-ended job starting inside warns', awayBlocksJob(mk({}), '2026-10-13', null, '15:00', null))
check('open-ended job starting before does not', !awayBlocksJob(mk({}), '2026-10-13', null, '13:00', null))
check('multi-day job reaching into the trip warns', awayBlocksJob(mk({}), '2026-10-11', '2026-10-14', '09:00', '10:00'))
check('different day entirely does not', !awayBlocksJob(mk({}), '2026-10-20', null, null, null))

console.log('awayDates')
eq('covers three days', awayDates(mk({})), ['2026-10-13', '2026-10-14', '2026-10-15'])
eq('midnight end drops the last day', awayDates(mk({ end_time: '00:00' })), ['2026-10-13', '2026-10-14'])

console.log('awayConflictsForJobs / awayTripFor')
const trips = [mk({ people: [{ id: 'u1', name: 'Halim' }, { id: 'u2', name: 'Rintu' }] })]
const conflicts = awayConflictsForJobs([
  { id: 'j1', date: '2026-10-14', time_start: '09:00', time_end: '11:00', people: [{ id: 'u2', name: 'Rintu' }, { id: 'u3', name: 'CK' }] },
  { id: 'j2', date: '2026-10-20', time_start: '09:00', time_end: '11:00', people: [{ id: 'u1', name: 'Halim' }] },
], trips)
eq('only Rintu on j1', conflicts.map(c => `${c.personId}:${c.jobId}`), ['u2:j1'])
eq('awayTripFor hit', awayTripFor('u1', '2026-10-14', null, null, null, trips)?.id ?? null, 't1')
eq('awayTripFor miss', awayTripFor('u3', '2026-10-14', null, null, null, trips), null)

console.log('awayWhenLabel')
eq('multi-day', awayWhenLabel(mk({})), 'Tue 13 Oct 2026, 2:00pm → Thu 15 Oct 2026, 12:00pm')
eq('same day', awayWhenLabel(mk({ end_date: '2026-10-13', end_time: '17:30' })), 'Tue 13 Oct 2026, 2:00pm – 5:30pm')

console.log('buildAwayByDate — the strip shows a trip on every day it covers')
const byDate = buildAwayByDate([mk({ id: 'a' }), mk({ id: 'b', start_date: '2026-10-15', end_date: '2026-10-15', start_time: '13:00', end_time: '15:00' })])
eq('first day has trip a only', (byDate['2026-10-13'] ?? []).map(x => x.id), ['a'])
eq('shared day has both', (byDate['2026-10-15'] ?? []).map(x => x.id), ['a', 'b'])
eq('day after has none', byDate['2026-10-16'] ?? [], [])
eq('midnight end leaves the last day empty', buildAwayByDate([mk({ end_time: '00:00' })])['2026-10-15'] ?? [], [])

console.log('newPairs — only newly affected are re-notified')
const before = new Set([pairKey('u1', 'j1')])
const after  = new Set([pairKey('u1', 'j1'), pairKey('u2', 'j1')])
eq('new pair only', [...newPairs(before, after)], [pairKey('u2', 'j1')])
eq('unchanged edit → nothing', [...newPairs(after, after)], [])

if (failed > 0) { console.error(`\n${failed} failed`); process.exit(1) }
console.log('\nall passed')
