/**
 * Standalone test for classifying an install-date edit (no framework).
 * Run: npx tsx src/lib/utils/design-date-change.test.ts
 * Exits 1 on any failure.
 */
import { designDateChange, designPatchBody } from './design-date-change'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}
// THE BUG this prevents: the auto-shift measured daysBetween(old, new). With a
// missing old date that is NaN, and the due date became "Invalid Date".
check('first date on a dateless Pending job is a SET, not a move', designDateChange(null, '2026-10-15'), 'set')
check('clearing the date', designDateChange('2026-10-15', null), 'cleared')
check('a real move', designDateChange('2026-10-15', '2026-10-20'), 'moved')
check('same date', designDateChange('2026-10-15', '2026-10-15'), 'none')
check('not sent', designDateChange('2026-10-15', undefined), 'none')
check('null to null', designDateChange(null, null), 'none')
check("'' counts as cleared", designDateChange('2026-10-15', ''), 'cleared')

// The job page's PATCH body for the design fields. Only a body carrying
// `date` makes the route shift the due date and tell the designers.
const fields = { brief: 'Brief', dueDate: '2026-11-10', dueManual: false }
check('a save that moves the date sends it',
  designPatchBody({ ...fields, newDate: '2026-11-20', jobDate: '2026-11-15' }),
  { design_brief: 'Brief', design_due_date: '2026-11-10', design_due_manual: false, date: '2026-11-20' })
check('an unchanged date is left out',
  designPatchBody({ ...fields, newDate: '2026-11-15', jobDate: '2026-11-15' }),
  { design_brief: 'Brief', design_due_date: '2026-11-10', design_due_manual: false })
check('a kept typed due date says so',
  designPatchBody({ ...fields, newDate: '2026-11-20', jobDate: '2026-11-15', keepManualDue: true }),
  { design_brief: 'Brief', design_due_date: '2026-11-10', design_due_manual: false, date: '2026-11-20', keepManualDue: true })
check('an empty brief is sent as null',
  designPatchBody({ ...fields, brief: '', newDate: null, jobDate: null }),
  { design_brief: null, design_due_date: '2026-11-10', design_due_manual: false })
// Nic 2026-11-04: the designers' due date is separate from a To arrange
// offer — a proposed date must not move it or message the designers.
check('a To arrange offer never sends the date',
  designPatchBody({ ...fields, newDate: '2026-11-20', jobDate: '2026-11-15', proposedDate: true }),
  { design_brief: 'Brief', design_due_date: '2026-11-10', design_due_manual: false })
check('a To arrange offer on a dateless job never sends the date',
  designPatchBody({ ...fields, newDate: '2026-11-20', jobDate: null, proposedDate: true }),
  { design_brief: 'Brief', design_due_date: '2026-11-10', design_due_manual: false })

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall design-date-change checks passed')
