/**
 * Standalone test for the pending-job privacy rule (no test framework).
 * Run: npx tsx src/lib/auth/pending-privacy.test.ts
 * Exits 1 on any failure.
 */
import { isPendingStatus, pendingSharerIds, pendingJobHiddenFrom, type PendingJobShape } from './pending-privacy'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const NIC = 'u-nic', WEIQING = 'u-weiqing', COORD = 'u-coord', OTHER = 'u-other', ADMIN = 'u-admin'
const weiQingDraft: PendingJobShape = { status: 'pending', created_by: WEIQING, sales_poc_id: WEIQING, coordinatorIds: [] }

console.log('pendingJobHiddenFrom:')

// THE REPORT this exists to fix (Nic, 2026-09-28): "i think now i can see
// scheduler pending jobs which is weird". Before this rule, every sales,
// coordinator, scheduler and admin user could read every draft. If this ever
// returns false again, the leak is back.
check("sales cannot see a scheduler's draft", pendingJobHiddenFrom({ id: NIC, role: 'sales' }, weiQingDraft), true)
check("a scheduler cannot see someone else's draft", pendingJobHiddenFrom({ id: OTHER, role: 'scheduler' }, weiQingDraft), true)
check('a coordinator not on the draft cannot see it', pendingJobHiddenFrom({ id: COORD, role: 'coordinator' }, weiQingDraft), true)

// Who shares a draft.
check('the creator sees it', pendingJobHiddenFrom({ id: WEIQING, role: 'scheduler' }, weiQingDraft), false)
const onBehalf: PendingJobShape = { status: 'pending', created_by: COORD, sales_poc_id: NIC, coordinatorIds: [] }
check('the sales PIC sees a draft a coordinator made for them', pendingJobHiddenFrom({ id: NIC, role: 'sales' }, onBehalf), false)
check('the coordinator who made it still sees it', pendingJobHiddenFrom({ id: COORD, role: 'coordinator' }, onBehalf), false)
const withCoord: PendingJobShape = { status: 'pending', created_by: NIC, sales_poc_id: NIC, coordinatorIds: [COORD] }
check('a coordinator ON the draft sees it', pendingJobHiddenFrom({ id: COORD, role: 'coordinator' }, withCoord), false)
check('admin sees every draft ("admin is the safeguard")', pendingJobHiddenFrom({ id: ADMIN, role: 'admin' }, weiQingDraft), false)

// The legacy status is a draft too.
check('awaiting_approval is private like pending', pendingJobHiddenFrom({ id: NIC, role: 'sales' }, { ...weiQingDraft, status: 'awaiting_approval' }), true)

// Once scheduled, nothing changes from today.
check('a scheduled job is never hidden by this rule', pendingJobHiddenFrom({ id: NIC, role: 'sales' }, { ...weiQingDraft, status: 'scheduled' }), false)
check('a completed job is never hidden by this rule', pendingJobHiddenFrom({ id: NIC, role: 'sales' }, { ...weiQingDraft, status: 'completed' }), false)

// Pre-0050 jobs have created_by null and fall back to the PIC.
const legacy: PendingJobShape = { status: 'pending', created_by: null, sales_poc_id: NIC, coordinatorIds: [] }
check('a draft with no creator is still visible to its PIC', pendingJobHiddenFrom({ id: NIC, role: 'sales' }, legacy), false)

console.log('pendingSharerIds:')
check('lists creator, PIC and coordinators once each', pendingSharerIds({ status: 'pending', created_by: NIC, sales_poc_id: NIC, coordinatorIds: [COORD, COORD] }), [NIC, COORD])
check('skips nulls', pendingSharerIds(legacy), [NIC])

console.log('isPendingStatus:')
check('pending', isPendingStatus('pending'), true)
check('awaiting_approval', isPendingStatus('awaiting_approval'), true)
check('scheduled', isPendingStatus('scheduled'), false)
check('null', isPendingStatus(null), false)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall pending-privacy checks passed')
