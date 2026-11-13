/**
 * Standalone test for which list the Jobs tab shows (no framework).
 * Run: npx tsx src/features/stages/stage-view.test.ts
 * Exits 1 on any failure.
 */
import { resolveStageView, jobListHref, defaultStageView, nextBlink } from './stage-view'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// Nic, 2026-10-14: Drafts and Ongoing are one "Jobs" tab with a switch, and it
// opens on Ongoing. Nic, 2026-11-04: a third list, To arrange, and the switch
// reads Drafts · Ongoing · To arrange. The scheduler opens on To arrange (it
// is his inbox); everyone else still opens on Ongoing.
console.log('the role default:')
// The My Jobs jump (scroll + blink) runs once per job per list, and again
// after the highlight was dropped (final review, 2026-11-12).
check('new highlight → blink', nextBlink(null, 'x', 'ongoing', true), { blink: true, last: 'ongoing:x' })
check('same highlight again → no second blink', nextBlink('ongoing:x', 'x', 'ongoing', true), { blink: false, last: 'ongoing:x' })
check('group not open yet → wait', nextBlink(null, 'x', 'ongoing', false), { blink: false, last: null })
check('highlight dropped → forget, so the same job blinks next time', nextBlink('ongoing:x', null, 'drafts', true), { blink: false, last: null })
check('same job on another list → blink', nextBlink('ongoing:x', 'x', 'drafts', true), { blink: true, last: 'drafts:x' })

check('scheduler opens on To arrange', defaultStageView('scheduler'), 'arrange')
check('sales opens on Ongoing', defaultStageView('sales'), 'ongoing')
check('designer opens on Ongoing', defaultStageView('designer'), 'ongoing')

console.log('resolveStageView:')
check('no choice → the role default', resolveStageView(null, true, 'arrange'), 'arrange')
check('no choice → Ongoing for sales', resolveStageView(null, true, 'ongoing'), 'ongoing')
check('?view=drafts → Drafts', resolveStageView('drafts', true, 'ongoing'), 'drafts')
check('?view=ongoing → Ongoing, even for the scheduler', resolveStageView('ongoing', true, 'arrange'), 'ongoing')
check('?view=arrange', resolveStageView('arrange', false, 'ongoing'), 'arrange')
check('anything else → the role default', resolveStageView('banana', true, 'ongoing'), 'ongoing')
// Designers, production and HR have no drafts — a typed ?view=drafts must not
// show them an empty "Drafts" list with no switch to leave it.
check('a role without drafts never gets Drafts', resolveStageView('drafts', false, 'ongoing'), 'ongoing')

console.log('jobListHref — the view is always in the address, since a bare /job-list is the role default:')
check('Ongoing carries its view', jobListHref('ongoing'), '/job-list?view=ongoing')
check('Drafts', jobListHref('drafts'), '/job-list?view=drafts')
check('To arrange', jobListHref('arrange'), '/job-list?view=arrange')
check('with a job to blink', jobListHref('drafts', 'abc'), '/job-list?view=drafts&highlight=abc')
check('To arrange with a job to blink', jobListHref('arrange', 'abc'), '/job-list?view=arrange&highlight=abc')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall stage-view checks passed')
