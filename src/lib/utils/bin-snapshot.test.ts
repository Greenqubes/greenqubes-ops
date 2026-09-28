/**
 * Standalone test for bin snapshots (no test framework).
 * Run: npx tsx src/lib/utils/bin-snapshot.test.ts
 * Exits 1 on any failure.
 */
import { BIN_CHILD_TABLES, snapshotUserIds, snapshotR2Keys, prepareRestore, type JobSnapshot } from './bin-snapshot'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

function emptyChildren() {
  return Object.fromEntries(BIN_CHILD_TABLES.map(t => [t, []])) as unknown as JobSnapshot['children']
}
const snap: JobSnapshot = {
  version: 1,
  job: { id: 'j1', status: 'scheduled', sales_poc_id: 'u-nic', approved_by: 'u-gone', created_by: 'u-nic' },
  children: {
    ...emptyChildren(),
    job_assignees:    [{ job_id: 'j1', user_id: 'u-ck', suggested_by: null }, { job_id: 'j1', user_id: 'u-gone', suggested_by: 'u-gone' }],
    job_coordinators: [{ job_id: 'j1', user_id: 'u-coord' }],
    job_external_contacts: [{ job_id: 'j1', contact_id: 'c-alive' }, { job_id: 'j1', contact_id: 'c-gone' }],
    files:    [{ id: 'f1', job_id: 'j1', r2_key: 'a/b.jpg', uploader_id: 'u-gone' }, { id: 'f2', job_id: 'j1', r2_key: '', uploader_id: 'u-nic' }],
    messages: [{ id: 'm1', job_id: 'j1', author_id: 'u-gone' }],
  },
  people: { 'u-nic': 'Nicholas', 'u-ck': 'CK', 'u-gone': 'Ali Ramjan', 'u-coord': 'Coord' },
}
const users = new Set(['u-nic', 'u-ck', 'u-coord'])
const contacts = new Set(['c-alive'])

console.log('order:')
check('buckets are inserted before files (files.bucket_id points at them)',
  BIN_CHILD_TABLES.indexOf('attachment_buckets') < BIN_CHILD_TABLES.indexOf('files'), true)

console.log('snapshot contents:')
check('every referenced person', snapshotUserIds(snap).sort(), ['u-ck', 'u-coord', 'u-gone', 'u-nic'])
check('only real R2 keys', snapshotR2Keys(snap), ['a/b.jpg'])

console.log('prepareRestore — someone on the job has since been removed:')
const { snapshot: out, leftOff } = prepareRestore(snap, users, contacts)
check('their crew row is left off', out.children.job_assignees.map(r => r.user_id), ['u-ck'])
check('they are named in the result', leftOff, ['Ali Ramjan'])
check('a removed outside contractor is left off', out.children.job_external_contacts.map(r => r.contact_id), ['c-alive'])
check('optional links to them are blanked, the row kept (file)', out.children.files[0].uploader_id, null)
check('optional links to them are blanked, the row kept (message)', out.children.messages[0].author_id, null)
check('approved_by on the job is blanked', out.job.approved_by, null)
check('people still here are untouched', out.job.sales_poc_id, 'u-nic')
check('the input snapshot is not mutated', snap.children.job_assignees.length, 2)
check('nobody removed → nothing left off', prepareRestore(snap, new Set([...users, 'u-gone']), new Set(['c-alive', 'c-gone'])).leftOff, [])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall bin-snapshot checks passed')
