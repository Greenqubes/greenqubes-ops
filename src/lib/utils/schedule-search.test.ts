/**
 * Standalone test for the schedule page's search across all dates
 * (no test framework). Run: npx tsx src/lib/utils/schedule-search.test.ts
 * Exits 1 on any failure.
 */
import { matchesScheduleSearch, scheduleSearchResults, highlightParts, type ScheduleSearchJob } from './schedule-search'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const TODAY = '2026-10-26'
const job = (id: string, date: string, o: Partial<ScheduleSearchJob> = {}): ScheduleSearchJob & { id: string } => ({
  id, date, date_end: null, time_start: null,
  project_title: id, client: 'Fossil Singapore', client_poc_name: null, location: '',
  job_assignees: [], job_external_contacts: [], ...o,
})

console.log('matching (Nic, 2026-10-26: "like the job search filter", across all dates):')
const riser = job('IMM Fossil Wooden Riser Delivery', '2026-10-29', {
  client_poc_name: 'Marvin Tan', location: 'IMM Building, Jurong East',
  job_assignees: [{ users: { name: 'Xiao Yi' } }, { users: null }],
  job_external_contacts: [{ is_suggestion: false, external_contacts: { name: 'CK Contractor' } },
                          { is_suggestion: true,  external_contacts: { name: 'Suggested Sam' } }],
})
check('title, any order, part-words', matchesScheduleSearch(riser, 'rise foss'), true)
check('client name', matchesScheduleSearch(riser, 'marvin'), true)
check('location', matchesScheduleSearch(riser, 'jurong'), true)
check('crew name (driver / support crew)', matchesScheduleSearch(riser, 'xiao'), true)
check('confirmed outside contractor', matchesScheduleSearch(riser, 'ck contractor'), true)
check('a SUGGESTED contractor is not on the job — no match', matchesScheduleSearch(riser, 'sam'), false)
check('description is no longer searched (too loose)',
  matchesScheduleSearch({ ...riser, description: 'bring the ladder' } as ScheduleSearchJob, 'ladder'), false)
check('every word must appear', matchesScheduleSearch(riser, 'fossil backdrop'), false)

console.log('results across all dates (schedule):')
const jobs = [
  job('past-old',   '2026-10-10'),
  job('today-late', TODAY, { time_start: '15:00' }),
  job('today-am',   TODAY, { time_start: '09:00' }),
  job('later',      '2026-11-02'),
  job('past-recent','2026-10-20'),
  job('spanning',   '2026-10-24', { date_end: '2026-10-27' }),   // started before today, still running
  job('unrelated',  '2026-10-28', { project_title: 'Install Backdrop', client: 'Youth Floorball Academy' }),
]
const r = scheduleSearchResults(jobs, 'fossil', TODAY, 'upcoming')
check('THE BUG: a job on another date is found while you stand on today',
  r.some(d => d.jobs.some(j => j.id === 'later')), true)
check('upcoming first (soonest at top), then past (most recent first)',
  r.map(d => [d.date, d.past]),
  [['2026-10-24', false], [TODAY, false], ['2026-11-02', false], ['2026-10-20', true], ['2026-10-10', true]])
check('a multi-day job still running is NOT past, and shows once under its start date',
  r.filter(d => d.jobs.some(j => j.id === 'spanning')).map(d => d.date), ['2026-10-24'])
check('same day: by start time', r.find(d => d.date === TODAY)?.jobs.map(j => j.id), ['today-am', 'today-late'])
check('non-matching job left out', r.some(d => d.jobs.some(j => j.id === 'unrelated')), false)
check('empty search → no results list', scheduleSearchResults(jobs, '  ', TODAY, 'upcoming'), [])
check('nothing matches → empty', scheduleSearchResults(jobs, 'oakley', TODAY, 'upcoming'), [])

console.log('results (Completed tab):')
const c = scheduleSearchResults(jobs, 'fossil', TODAY, 'newest')
check('newest first, nothing labelled past', c.map(d => [d.date, d.past]),
  [['2026-11-02', false], [TODAY, false], ['2026-10-24', false], ['2026-10-20', false], ['2026-10-10', false]])

console.log('highlighting the searched words:')
check('marks each word, keeps the original capitals',
  highlightParts('IMM Fossil Wooden Riser', 'riser foss'),
  [{ text: 'IMM ', hit: false }, { text: 'Foss', hit: true }, { text: 'il Wooden ', hit: false }, { text: 'Riser', hit: true }])
check('overlapping words merge into one mark',
  highlightParts('Fossil', 'fos ossi'), [{ text: 'Fossi', hit: true }, { text: 'l', hit: false }])
check('every occurrence is marked', highlightParts('ASICS x asics', 'asics'),
  [{ text: 'ASICS', hit: true }, { text: ' x ', hit: false }, { text: 'asics', hit: true }])
check('empty search → plain text', highlightParts('Install Backdrop', ''), [{ text: 'Install Backdrop', hit: false }])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
