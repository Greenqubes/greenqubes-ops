/**
 * Standalone test for the job-stage rules (no test framework).
 * Run: npx tsx src/lib/utils/job-stage-rules.test.ts
 * Exits 1 on any failure.
 */
import {
  REQUIRED_FOR_STAGE, missingForStage, clearedForStage,
  isStageMoveValid, canMoveStage, canEditAtStage,
  designersAllowed, formalCrewAllowed, postponeNotifyNow,
} from './job-stage-rules'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const full = {
  project_title: 'Fossil', date: '2026-10-15', client: 'Fossil SG',
  client_poc_name: 'Marvin', client_poc_phone: '91234567', location: '313 Orchard Rd',
}
const noDate = { ...full, date: '' }

console.log('required fields per stage:')
// THE OLD RULE, kept first: before stages, every save that left the draft
// demanded all six fields, date included. A Pending job must NOT need a date —
// that is the whole point of the stage (sales colleague, 2026-10-08).
check('Pending does NOT require a date', missingForStage('pending', noDate), [])
check('Scheduled still requires the date', missingForStage('scheduled', noDate), ['date'])
check('a Draft requires nothing at all (Nic, 2026-10-09)', missingForStage('draft', {}), [])
check('Pending requires the other five', missingForStage('pending', {}),
  ['project_title', 'client', 'client_poc_name', 'client_poc_phone', 'location'])
check('Pending list has no date', REQUIRED_FOR_STAGE.pending.includes('date'), false)

console.log('cannot empty a required field at its stage:')
check('a Draft may empty anything', clearedForStage('draft', full, {}), [])
check('a Pending job may clear its date', clearedForStage('pending', full, noDate), [])
check('a Pending job may not empty its client', clearedForStage('pending', full, { ...full, client: ' ' }), ['client'])
check('a Scheduled job may not clear its date', clearedForStage('scheduled', full, noDate), ['date'])

console.log('valid moves:')
check('draft → pending', isStageMoveValid('draft', 'pending'), true)
check('draft → scheduled', isStageMoveValid('draft', 'scheduled'), true)
check('pending → scheduled', isStageMoveValid('pending', 'scheduled'), true)
check('pending → draft', isStageMoveValid('pending', 'draft'), true)
check('scheduled → pending (postponed)', isStageMoveValid('scheduled', 'pending'), true)
check('scheduled → draft is NOT a move', isStageMoveValid('scheduled', 'draft'), false)
check('completed → anything is NOT a move (Revert owns that)', isStageMoveValid('completed', 'scheduled'), false)
check('same stage is not a move', isStageMoveValid('pending', 'pending'), false)

const NIC = 'u-nic', OTHER = 'u-other', COORD = 'u-coord'
const draft   = { status: 'pending',       created_by: NIC, sales_poc_id: NIC, coordinatorIds: [COORD] }
const pending = { status: 'awaiting_date', created_by: NIC, sales_poc_id: NIC, coordinatorIds: [COORD] }
const sched   = { status: 'scheduled',     created_by: NIC, sales_poc_id: NIC, coordinatorIds: [] }

console.log('who may move a job:')
check('the PIC moves their draft to Pending', canMoveStage({ id: NIC, role: 'sales' }, draft, 'pending'), true)
check('another sales person may not', canMoveStage({ id: OTHER, role: 'sales' }, pending, 'draft'), false)
check('a coordinator ON the job may', canMoveStage({ id: COORD, role: 'coordinator' }, pending, 'draft'), true)
check('a coordinator NOT on the job may not', canMoveStage({ id: OTHER, role: 'coordinator' }, pending, 'draft'), false)
check('a scheduler may move any', canMoveStage({ id: OTHER, role: 'scheduler' }, sched, 'pending'), true)
check('admin may move any', canMoveStage({ id: OTHER, role: 'admin' }, pending, 'draft'), true)
check('a designer may never move a stage', canMoveStage({ id: NIC, role: 'designer' }, pending, 'draft'), false)
check('an invalid move is refused even for admin', canMoveStage({ id: NIC, role: 'admin' }, sched, 'draft'), false)

console.log('who may edit a Pending job:')
check('another sales person reads a Pending job only', canEditAtStage({ id: OTHER, role: 'sales' }, pending), false)
check('its PIC edits it', canEditAtStage({ id: NIC, role: 'sales' }, pending), true)
check('a scheduler edits it', canEditAtStage({ id: OTHER, role: 'scheduler' }, pending), true)
check('hr never edits', canEditAtStage({ id: OTHER, role: 'hr' }, pending), false)

console.log('guards:')
check('no designer on a Draft (they could not see it)', designersAllowed('pending'), false)
check('designer on a Pending job', designersAllowed('awaiting_date'), true)
check('designer on a Scheduled job', designersAllowed('scheduled'), true)
check('no formal crew on a Pending job (installers must never see one)', formalCrewAllowed('awaiting_date'), false)
check('formal crew on a Draft is unchanged (0062 hides drafts)', formalCrewAllowed('pending'), true)
check('formal crew on a Scheduled job', formalCrewAllowed('scheduled'), true)

console.log('postponing a job tells the crew now only if it was today:')
check('dated today → now', postponeNotifyNow('2026-10-09', '2026-10-09'), true)
check('dated tomorrow → 6pm summary', postponeNotifyNow('2026-10-10', '2026-10-09'), false)
check('no date → 6pm summary', postponeNotifyNow(null, '2026-10-09'), false)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall job-stage-rules checks passed')
