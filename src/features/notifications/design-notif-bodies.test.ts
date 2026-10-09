/**
 * Standalone test for the bell's design-notification readers (no framework).
 * Run: npx tsx src/features/notifications/design-notif-bodies.test.ts
 * Exits 1 on any failure.
 */
import {
  parseAssignedBody, parseDueShiftBody, parseInstallShiftBody, parseDueRemovedBody, parseDueSetBody,
} from './design-notif-bodies'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// REVIEW FINDING #7 (2026-10-09): a designer added to an undated Pending job
// got installDate: null, every reader demanded a string, and the bell fell
// back to printing the raw JSON blob.
const assigned = { projectTitle: 'Fossil', assignedBy: 'Nic', client: 'Fossil SG', installDate: null }
check('assignment on an undated job is read, not dumped as JSON',
  parseAssignedBody(JSON.stringify(assigned))?.client, 'Fossil SG')
check('install date set on a dateless job',
  parseInstallShiftBody(JSON.stringify({ projectTitle: 'F', oldInstallDate: null, installDate: '2026-10-15', dueDate: null, client: 'C' }))?.installDate, '2026-10-15')
check('install date removed',
  parseInstallShiftBody(JSON.stringify({ projectTitle: 'F', oldInstallDate: '2026-10-15', installDate: null, dueDate: null, client: 'C' }))?.oldInstallDate, '2026-10-15')
check('due removed on an undated job',
  parseDueRemovedBody(JSON.stringify({ projectTitle: 'F', oldDue: '2026-10-01', oldInstallDate: null, installDate: null, client: 'C' }))?.oldDue, '2026-10-01')
check('due set on an undated job',
  parseDueSetBody(JSON.stringify({ projectTitle: 'F', oldDue: null, newDue: '2026-10-01', oldInstallDate: null, installDate: null, client: 'C' }))?.newDue, '2026-10-01')
check('due shift still needs a real install date (a shift only happens on a move)',
  parseDueShiftBody(JSON.stringify({ projectTitle: 'F', oldDue: 'a', newDue: 'b', client: 'C', installDate: '2026-10-15' }))?.newDue, 'b')

// Unchanged behaviour: old plain-text rows still fall back.
check('plain-text row falls back', parseAssignedBody('Fossil'), null)
check('missing client is still rejected', parseAssignedBody(JSON.stringify({ ...assigned, client: undefined })), null)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall design-notif-bodies checks passed')
