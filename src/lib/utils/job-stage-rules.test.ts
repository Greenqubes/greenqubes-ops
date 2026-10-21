/**
 * Standalone test for the job-stage rules (no test framework).
 * Run: npx tsx src/lib/utils/job-stage-rules.test.ts
 * Exits 1 on any failure.
 */
import {
  REQUIRED_FOR_STAGE, missingForStage, clearedForStage,
  isStageMoveValid, canMoveStage, canEditAtStage,
  designersAllowed, formalCrewAllowed, postponeNotifyNow,
  pendingLocks, canDeleteAtStage, stageWriteVia, stageMoveBlocked, newJobPlan,
  schedulerCanPush, pushCrewPlan,
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
// demanded all six fields, date included. A Ongoing job must NOT need a date —
// that is the whole point of the stage (sales colleague, 2026-10-08).
check('Ongoing does NOT require a date', missingForStage('ongoing', noDate), [])
check('Scheduled still requires the date', missingForStage('scheduled', noDate), ['date'])
check('a Draft requires nothing at all (Nic, 2026-10-09)', missingForStage('draft', {}), [])
check('Ongoing requires the other five', missingForStage('ongoing', {}),
  ['project_title', 'client', 'client_poc_name', 'client_poc_phone', 'location'])
check('Ongoing list has no date', REQUIRED_FOR_STAGE.ongoing.includes('date'), false)

console.log('cannot empty a required field at its stage:')
check('a Draft may empty anything', clearedForStage('draft', full, {}), [])
check('a Ongoing job may clear its date', clearedForStage('ongoing', full, noDate), [])
check('a Ongoing job may not empty its client', clearedForStage('ongoing', full, { ...full, client: ' ' }), ['client'])
check('a Scheduled job may not clear its date', clearedForStage('scheduled', full, noDate), ['date'])

console.log('valid moves:')
check('draft → pending', isStageMoveValid('draft', 'ongoing'), true)
check('draft → scheduled', isStageMoveValid('draft', 'scheduled'), true)
check('pending → scheduled', isStageMoveValid('ongoing', 'scheduled'), true)
check('pending → draft', isStageMoveValid('ongoing', 'draft'), true)
check('scheduled → pending (postponed)', isStageMoveValid('scheduled', 'ongoing'), true)
check('scheduled → draft is NOT a move', isStageMoveValid('scheduled', 'draft'), false)
check('completed → anything is NOT a move (Revert owns that)', isStageMoveValid('completed', 'scheduled'), false)
check('same stage is not a move', isStageMoveValid('ongoing', 'ongoing'), false)

const NIC = 'u-nic', OTHER = 'u-other', COORD = 'u-coord'
const draft   = { status: 'pending',       created_by: NIC, sales_poc_id: NIC, coordinatorIds: [COORD] }
const pending = { status: 'awaiting_date', created_by: NIC, sales_poc_id: NIC, coordinatorIds: [COORD] }
const sched   = { status: 'scheduled',     created_by: NIC, sales_poc_id: NIC, coordinatorIds: [] }

console.log('who may move a job:')
check('the PIC moves their draft to Ongoing', canMoveStage({ id: NIC, role: 'sales' }, draft, 'ongoing'), true)
check('another sales person may not', canMoveStage({ id: OTHER, role: 'sales' }, pending, 'draft'), false)
check('a coordinator ON the job may', canMoveStage({ id: COORD, role: 'coordinator' }, pending, 'draft'), true)
check('a coordinator NOT on the job may not', canMoveStage({ id: OTHER, role: 'coordinator' }, pending, 'draft'), false)
check('a scheduler may move any', canMoveStage({ id: OTHER, role: 'scheduler' }, sched, 'ongoing'), true)
check('admin may move any', canMoveStage({ id: OTHER, role: 'admin' }, pending, 'draft'), true)
check('a designer may never move a stage', canMoveStage({ id: NIC, role: 'designer' }, pending, 'draft'), false)
check('an invalid move is refused even for admin', canMoveStage({ id: NIC, role: 'admin' }, sched, 'draft'), false)

console.log('who may edit a Ongoing job:')
check('another sales person reads a Ongoing job only', canEditAtStage({ id: OTHER, role: 'sales' }, pending), false)
check('its PIC edits it', canEditAtStage({ id: NIC, role: 'sales' }, pending), true)
check('a scheduler edits it', canEditAtStage({ id: OTHER, role: 'scheduler' }, pending), true)
check('hr never edits', canEditAtStage({ id: OTHER, role: 'hr' }, pending), false)

console.log('guards:')
check('no designer on a Draft (they could not see it)', designersAllowed('pending'), false)
check('designer on a Ongoing job', designersAllowed('awaiting_date'), true)
check('designer on a Scheduled job', designersAllowed('scheduled'), true)
check('no formal crew on a Ongoing job (installers must never see one)', formalCrewAllowed('awaiting_date'), false)
check('formal crew on a Draft is unchanged (0062 hides drafts)', formalCrewAllowed('pending'), true)
check('formal crew on a Scheduled job', formalCrewAllowed('scheduled'), true)

console.log('postponing a job tells the crew now only if it was today:')
check('dated today → now', postponeNotifyNow('2026-10-09', '2026-10-09'), true)
check('dated tomorrow → 6pm summary', postponeNotifyNow('2026-10-10', '2026-10-09'), false)
check('no date → 6pm summary', postponeNotifyNow(null, '2026-10-09'), false)

console.log('review fixes (2026-10-09):')
// #2: a designer is not a sharer, so the "read-only if not yours" lock caught
// them too — they could not upload the Designer JO on a Ongoing job, which is
// the whole reason the stage exists.
// Nic, 2026-10-19: ANY designer — not only the assigned one — adds, renames
// and deletes files on an Ongoing job, as they already could on Scheduled ones.
check('any designer may manage files on an Ongoing job',
  pendingLocks({ stage: 'ongoing', canEdit: false, isDesigner: true }).files, false)
check('…but not the core fields', pendingLocks({ stage: 'ongoing', canEdit: false, isDesigner: true }).form, true)
check('a sales person who is not on it gets neither', pendingLocks({ stage: 'ongoing', canEdit: false, isDesigner: false }), { form: true, files: true })
check('no lock on a Scheduled job from this rule', pendingLocks({ stage: 'scheduled', canEdit: false, isDesigner: false }), { form: false, files: false })
check('no lock for an editor', pendingLocks({ stage: 'ongoing', canEdit: true, isDesigner: false }), { form: false, files: false })

// #4: the delete route only bins raw 'pending' (Drafts) for sales/coordinator.
check('sales may delete a Draft', canDeleteAtStage('sales', 'draft'), true)
check('sales may NOT delete a Ongoing job (the route refuses it)', canDeleteAtStage('sales', 'ongoing'), false)
check('coordinator may NOT delete a Ongoing job', canDeleteAtStage('coordinator', 'ongoing'), false)
check('scheduler may delete a Ongoing job', canDeleteAtStage('scheduler', 'ongoing'), true)
check('designer never', canDeleteAtStage('designer', 'draft'), false)

// #5: once a job becomes a Draft, 0062 hides it from a non-sharer, and
// UPDATE … RETURNING on their own session fails. A move INTO Draft is
// written on the service key after the session read authorised it.
check('Ongoing → Draft is written on the service key', stageWriteVia('ongoing', 'draft'), 'service')
check('Draft → Ongoing stays on the session (RLS decides)', stageWriteVia('draft', 'ongoing'), 'session')
check('Scheduled → Ongoing stays on the session', stageWriteVia('scheduled', 'ongoing'), 'session')

// #6: a designer on a Draft cannot see it, so a job may not go back to
// Drafts while designers are on it.
check('Ongoing → Draft refused while a designer is on it', stageMoveBlocked('draft', 1), 'designers_assigned')
check('Ongoing → Draft fine with no designers', stageMoveBlocked('draft', 0), null)
check('other moves are not blocked by designers', stageMoveBlocked('ongoing', 2), null)

// #3: a New Job push inserts a Draft and /submit flips it, so designers must
// be attached AFTER the push — on the Draft the route refuses them (409) and
// the form never checked, silently dropping them.
check('push: insert a Draft, designers after the push', newJobPlan('push_to_schedule', false),
  { status: 'pending', crewAsSuggestion: false, designersAfterPush: true })
check('save as Ongoing: office stage, crew as suggestions, designers now', newJobPlan('ongoing', false),
  { status: 'awaiting_date', crewAsSuggestion: true, designersAfterPush: false })
check('draft: private, role decides crew, designers now (form refuses them)', newJobPlan('draft', true),
  { status: 'pending', crewAsSuggestion: true, designersAfterPush: false })

console.log('schedulers push forward; only their own jobs back to Drafts (Nic, 2026-10-21):')
// THE OLD RULES, kept first: only admin had Push to Schedule on the job page,
// so a scheduler could add an Ongoing job's date and then had no way to put it
// on the schedule; and a scheduler could send any sales job back to Drafts,
// hiding it from the office — "its sabotaging to push back to draft". Their
// OWN job is theirs to move (Nic, same day).
check('a scheduler can push an Ongoing job', schedulerCanPush('scheduler', false, 'ongoing'), true)
check('a scheduler may NOT move a sales job back to Drafts',
  canMoveStage({ id: OTHER, role: 'scheduler' }, pending, 'draft'), false)
check('a scheduler may move their OWN Ongoing job back to Drafts',
  canMoveStage({ id: OTHER, role: 'scheduler' }, { ...pending, created_by: OTHER }, 'draft'), true)
check('a scheduler still moves a Scheduled job back to Ongoing',
  canMoveStage({ id: OTHER, role: 'scheduler' }, sched, 'ongoing'), true)
check('a plain admin (who reads as scheduler) still may',
  canMoveStage({ id: OTHER, role: 'scheduler', isAdmin: true }, pending, 'draft'), true)
check('the sales PIC still may', canMoveStage({ id: NIC, role: 'sales' }, pending, 'draft'), true)
check('a scheduler can push their own Draft', schedulerCanPush('scheduler', false, 'draft'), true)
check('admin can push', schedulerCanPush('scheduler', true, 'ongoing'), true)
check('nothing to push once Scheduled', schedulerCanPush('scheduler', false, 'scheduled'), false)
check('or Completed', schedulerCanPush('scheduler', false, 'completed'), false)
check('production never pushes', schedulerCanPush('production', false, 'ongoing'), false)

console.log('a scheduler\'s crew picks are confirmed by the push (Nic, 2026-10-21):')
// THE OLD RULE, kept first: on an Ongoing job a scheduler's picks went in as
// yellow suggestions and the push left them that way, so every pick had to be
// confirmed again on the schedule — "his role should allow him to add
// installer and push to schedule straight away".
const picks = { assignsCrew: true, installerDirty: true, subDirty: false, installerCount: 2 }
check('picked crew is confirmed by the push', pushCrewPlan(picks).confirmCrew, true)
check('and checked for clashes first', pushCrewPlan(picks).checkPicks, true)
check('support crew alone is confirmed too',
  pushCrewPlan({ ...picks, installerDirty: false, subDirty: true, installerCount: 0 }),
  { confirmCrew: true, checkPicks: false })
check('no picks: the push keeps its own clash step',
  pushCrewPlan({ ...picks, installerDirty: false }), { confirmCrew: false, checkPicks: false })
check('sales picks stay suggestions',
  pushCrewPlan({ ...picks, assignsCrew: false }), { confirmCrew: false, checkPicks: false })

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall job-stage-rules checks passed')
