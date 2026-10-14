/**
 * Standalone test for which list the Jobs tab shows (no framework).
 * Run: npx tsx src/features/stages/stage-view.test.ts
 * Exits 1 on any failure.
 */
import { resolveStageView, jobListHref } from './stage-view'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// Nic, 2026-10-14: Drafts and Ongoing are one "Jobs" tab with a switch, and it
// opens on Ongoing.
check('no choice → Ongoing', resolveStageView(null, true), 'ongoing')
check('?view=drafts → Drafts', resolveStageView('drafts', true), 'drafts')
check('anything else → Ongoing', resolveStageView('banana', true), 'ongoing')
// Designers, production and HR have no drafts — a typed ?view=drafts must not
// show them an empty "Drafts" list with no switch to leave it.
check('a role without drafts always gets Ongoing', resolveStageView('drafts', false), 'ongoing')

console.log('jobListHref:')
check('Ongoing is the plain address', jobListHref('ongoing'), '/job-list')
check('Drafts', jobListHref('drafts'), '/job-list?view=drafts')
check('with a job to blink', jobListHref('drafts', 'abc'), '/job-list?view=drafts&highlight=abc')
check('Ongoing with a job to blink', jobListHref('ongoing', 'abc'), '/job-list?highlight=abc')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall stage-view checks passed')
