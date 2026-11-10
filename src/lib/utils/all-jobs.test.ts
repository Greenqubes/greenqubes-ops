/**
 * Standalone test for the installer All Jobs rules (no test framework).
 * Run: npx tsx src/lib/utils/all-jobs.test.ts
 * Exits 1 on any failure.
 */
import {
  parseDay, jobCoversDay, weekOf, shiftDay, toAllJobsCard, sortAllJobs,
  ALL_JOBS_CARD_KEYS, dayChipTone, type AllJobsRow, type AllJobsCard,
} from './all-jobs'
import { EMPTY_CREW, type Crew } from './installer-crew'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const T = '2026-11-10'

console.log('parseDay')
check('a real date passes through', parseDay('2026-11-10', T), '2026-11-10')
check('missing → today', parseDay(undefined, T), T)
check('impossible month → today', parseDay('2026-13-45', T), T)
check('31 Feb → today', parseDay('2026-02-31', T), T)
check('junk → today', parseDay('abc', T), T)
check('filter injection → today', parseDay('2026-11-10,status.eq.pending', T), T)
check('repeated param → today', parseDay(['2026-11-10', 'x'], T), T)

console.log('jobCoversDay')
check('single-day job on its day', jobCoversDay({ date: '2026-11-10', date_end: null }, '2026-11-10'), true)
check('single-day job another day', jobCoversDay({ date: '2026-11-09', date_end: null }, '2026-11-10'), false)
check('multi-day job, middle day', jobCoversDay({ date: '2026-11-09', date_end: '2026-11-11' }, '2026-11-10'), true)
check('multi-day job, last day', jobCoversDay({ date: '2026-11-09', date_end: '2026-11-11' }, '2026-11-11'), true)
check('multi-day job, day after', jobCoversDay({ date: '2026-11-09', date_end: '2026-11-11' }, '2026-11-12'), false)
check('multi-day job, day before', jobCoversDay({ date: '2026-11-09', date_end: '2026-11-11' }, '2026-11-08'), false)

console.log('weekOf / shiftDay')
check('Tuesday → its Monday..Sunday', weekOf('2026-11-10'),
  ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15'])
check('Sunday belongs to the week before it', weekOf('2026-11-15')[0], '2026-11-09')
check('Monday starts its own week', weekOf('2026-11-16')[0], '2026-11-16')
check('year rollover', weekOf('2026-12-31'),
  ['2026-12-28', '2026-12-29', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'])
check('shift forward a week', shiftDay('2026-11-10', 7), '2026-11-17')
check('shift back across a month', shiftDay('2026-11-03', -7), '2026-10-27')

console.log('toAllJobsCard')
const row: AllJobsRow = {
  id: 'j1', date: '2026-11-10', date_end: null, time_start: '09:00:00', time_end: '13:00:00',
  project_title: 'Fossil Mustafa Set Up', client: 'Fossil', location: '145 Syed Alwi Road', punctuality: 'strict',
}
const crewWithMe: Crew = { drivers: [{ name: 'Rintu', you: false }], support: [{ name: 'Firoz', you: true }], externals: [] }
const card = toAllJobsCard(row, crewWithMe)
check('title from the job title', card.title, 'Fossil Mustafa Set Up')
check('title falls back to the client', toAllJobsCard({ ...row, project_title: null }, EMPTY_CREW).title, 'Fossil')
check('mine when the viewer is in the crew', card.mine, true)
check('not mine otherwise', toAllJobsCard(row, { ...crewWithMe, support: [{ name: 'Firoz', you: false }] }).mine, false)
check('noDriver follows the driver-board rule (support only)',
  toAllJobsCard(row, { drivers: [], support: [{ name: 'Firoz', you: false }], externals: [] }).noDriver, true)
check('contractor only is crewed',
  toAllJobsCard(row, { drivers: [], support: [], externals: [{ name: 'Ah Huat', you: false }] }).noDriver, false)
const leaky = { ...row, description: 'secret brief', client_poc_phone: '+65 9123 4567', quote_amount: 12000 } as unknown as AllJobsRow
check('only allow-listed fields leave, even when the row carries more',
  Object.keys(toAllJobsCard(leaky, EMPTY_CREW)).sort(), [...ALL_JOBS_CARD_KEYS].sort())
check('client name is not on the card', 'client' in toAllJobsCard(leaky, EMPTY_CREW), false)

console.log('sortAllJobs')
const at = (id: string, time_start: string | null): AllJobsCard => ({ ...toAllJobsCard(row, EMPTY_CREW), id, time_start })
check('by start time, no-time jobs FIRST — the same as My Jobs (InstallerShell sorts time_start ?? "")',
  sortAllJobs([at('b', '14:00:00'), at('c', null), at('a', '09:00:00')]).map(c => c.id), ['c', 'a', 'b'])
check('does not change the list it was given', (() => { const l = [at('b', '14:00:00'), at('a', '09:00:00')]; sortAllJobs(l); return l.map(c => c.id) })(), ['b', 'a'])

console.log('dayChipTone')
check('the chosen day is on', dayChipTone('2026-11-10', '2026-11-10', '2026-11-10'), 'on')
check('today, while another day is chosen, is marked', dayChipTone('2026-11-10', '2026-11-12', '2026-11-10'), 'today')
check('any other day is plain', dayChipTone('2026-11-11', '2026-11-12', '2026-11-10'), 'plain')

if (failures) { console.error(`\n${failures} failing`); process.exit(1) }
console.log('\nall passing')
