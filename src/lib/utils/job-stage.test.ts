/**
 * Standalone test for the status ↔ stage translation (no test framework).
 * Run: npx tsx src/lib/utils/job-stage.test.ts
 * Exits 1 on any failure.
 */
import { stageOf, STAGE_STATUS, DRAFT_STATUSES, NOT_YET_SCHEDULED_STATUSES, statusesForStage } from './job-stage'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

console.log('stageOf:')
// THE TRAP this module exists to contain (Nic, 2026-10-09): in the database
// `pending` means a PRIVATE DRAFT. Reading it as the office Pending stage is
// how a draft leaks to the whole company.
check("raw 'pending' is a Draft, not Pending", stageOf('pending'), 'draft')
check('the legacy awaiting_approval is a Draft', stageOf('awaiting_approval'), 'draft')
// Renamed Pending → Ongoing on screen and in code (Nic, 2026-10-14).
check('awaiting_date is the office Ongoing stage', stageOf('awaiting_date'), 'ongoing')
check('scheduled', stageOf('scheduled'), 'scheduled')
check('completed', stageOf('completed'), 'completed')
// Unknown or missing must land on the MOST private stage.
check('unknown status is treated as a Draft', stageOf('something-new'), 'draft')
check('null is treated as a Draft', stageOf(null), 'draft')

console.log('STAGE_STATUS (what a move into each stage writes):')
check('into Draft writes pending', STAGE_STATUS.draft, 'pending')
check('into Ongoing writes awaiting_date', STAGE_STATUS.ongoing, 'awaiting_date')
check('into Scheduled writes scheduled', STAGE_STATUS.scheduled, 'scheduled')

console.log('lists:')
check('draft statuses', DRAFT_STATUSES, ['pending', 'awaiting_approval'])
check('not yet scheduled', NOT_YET_SCHEDULED_STATUSES, ['pending', 'awaiting_approval', 'awaiting_date'])

console.log('statusesForStage:')
// REVIEW FINDING #8: the assistant's 'pending' filter meant raw 'pending',
// which is now a Draft — office Pending jobs were unreachable.
check('Ongoing is awaiting_date', statusesForStage('ongoing'), ['awaiting_date'])
check('Draft is both draft statuses', statusesForStage('draft'), ['pending', 'awaiting_approval'])
check('Scheduled', statusesForStage('scheduled'), ['scheduled'])

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall job-stage checks passed')
