/**
 * Standalone test for the My Jobs panel's list (no test framework).
 * Run: npx tsx src/lib/utils/my-jobs.test.ts
 * Exits 1 on any failure.
 */
import { myJobs } from './my-jobs'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
const ME = 'u-me', OTHER = 'u-other'
const j = (id: string, status: string, date: string | null, o: Partial<{ created_by: string; sales_poc_id: string; coordinatorIds: string[]; designerIds: string[] }> = {}) => ({
  id, status, date, project_title: id, client: 'C',
  created_by: o.created_by ?? OTHER, sales_poc_id: o.sales_poc_id ?? OTHER, coordinatorIds: o.coordinatorIds ?? [],
  designerIds: o.designerIds ?? [],
})
const jobs = [
  j('made-by-me',  'scheduled', '2026-10-20', { created_by: ME }),
  j('my-pic',      'scheduled', '2026-10-12', { sales_poc_id: ME }),           // Nic's screenshot: "jobs that they are PIC"
  j('coord-on',    'awaiting_date', null,     { coordinatorIds: [ME] }),
  j('dated-pend',  'awaiting_date', '2026-11-01', { created_by: ME }),
  j('my-draft',    'pending', null,           { created_by: ME }),
  j('not-mine',    'scheduled', '2026-10-10'),
  j('done',        'completed', '2026-10-01', { created_by: ME }),
]
const g = myJobs(jobs, ME)
const ids = (xs: Array<{ id: string }>) => xs.map(x => x.id)

// THE TRAP: raw 'pending' is a Draft. Grouping by raw status would put
// my-draft under Ongoing.
check('raw pending lands in Drafts', ids(g.draft), ['my-draft'])
check('Ongoing: dated first, undated last', ids(g.ongoing), ['dated-pend', 'coord-on'])
check('Scheduled: soonest first, creator AND PIC included', ids(g.scheduled), ['my-pic', 'made-by-me'])
check("someone else's job is not mine", [...g.draft, ...g.ongoing, ...g.scheduled].some(x => x.id === 'not-mine'), false)
check('completed drops off', [...g.draft, ...g.ongoing, ...g.scheduled].some(x => x.id === 'done'), false)

console.log('designer mode:')
// Nic, 2026-10-19: a designer's panel lists the jobs ASSIGNED to them, Ongoing
// and Scheduled, until the job is completed — not what they created.
const D = 'u-designer'
const dJobs = [
  j('d-sched',   'scheduled',     '2026-10-25', { designerIds: [D] }),
  j('d-ongoing', 'awaiting_date', null,         { designerIds: [D] }),
  j('d-made',    'scheduled',     '2026-10-21', { created_by: D }),   // made it, not assigned
  j('d-done',    'completed',     '2026-10-01', { designerIds: [D] }),
  j('d-other',   'scheduled',     '2026-10-22', { designerIds: ['u-someone'] }),
]
const dg = myJobs(dJobs, D, 'designer')
check('assigned Ongoing job listed', ids(dg.ongoing), ['d-ongoing'])
check('assigned Scheduled job listed; creating a job is not being assigned', ids(dg.scheduled), ['d-sched'])
check('completed drops off', [...dg.draft, ...dg.ongoing, ...dg.scheduled].some(x => x.id === 'd-done'), false)
check('default mode is unchanged by designerIds', ids(myJobs(dJobs, D).scheduled), ['d-made'])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall my-jobs checks passed')
