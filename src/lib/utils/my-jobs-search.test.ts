/**
 * Standalone test for the My Jobs panel's search box and folded sections
 * (no test framework). Run: npx tsx src/lib/utils/my-jobs-search.test.ts
 * Exits 1 on any failure.
 */
import { matchesJobSearch, searchMyJobs, parseFolded, sectionOpen, type SearchableJob } from './my-jobs-search'

type Row = SearchableJob & { id: string }

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// Real rows from Nic's screenshot, 2026-10-26.
const riser: Row = {
  id: 'riser', project_title: 'IMM Fossil Wooden Riser Delivery', client: 'Fossil Singapore',
  client_poc_name: 'Marvin Tan', location: 'IMM Building, 2 Jurong East Street 21, Singapore 609601',
}
const harbour: Row = {
  id: 'harbour', project_title: "Install 'THE HARBOUR' Signage", client: 'Binjai Interior',
  client_poc_name: null, location: '',
}
const untitled: Row = { id: 'untitled', project_title: null, client: 'ASICS', client_poc_name: null, location: 'Paragon' }

console.log('matching (Nic: "closest wording" — company, client, title, location):')
check('empty search shows everything', matchesJobSearch(riser, ''), true)
check('spaces only shows everything', matchesJobSearch(riser, '   '), true)
check('title word', matchesJobSearch(riser, 'riser'), true)
check('company', matchesJobSearch(riser, 'fossil singapore'), true)
check('client name', matchesJobSearch(riser, 'marvin'), true)
check('location', matchesJobSearch(riser, 'jurong'), true)
check('capitals do not matter', matchesJobSearch(harbour, 'the harbour'), true)
check('part-words count, any order', matchesJobSearch(riser, 'rise foss'), true)
check('words may come from different fields', matchesJobSearch(riser, 'imm marvin'), true)
check('EVERY word must appear somewhere', matchesJobSearch(riser, 'fossil backdrop'), false)
check('no match', matchesJobSearch(harbour, 'oakley'), false)
check('missing client name / title is not a crash', matchesJobSearch(untitled, 'paragon'), true)

console.log('filtering the three lists:')
const groups: { draft: Row[]; ongoing: Row[]; scheduled: Row[] } = { draft: [untitled], ongoing: [riser, harbour], scheduled: [] }
const r = searchMyJobs(groups, 'fossil')
check('keeps only matches, per section', [r.draft.length, r.ongoing.map(j => j.id), r.scheduled.length], [0, ['riser'], 0])
check('empty search returns the lists untouched', searchMyJobs(groups, '') === groups, true)

console.log('folded sections (remembered per device — untrusted input):')
check('nothing saved → nothing folded', parseFolded(null), [])
check('saved list read back', parseFolded('["scheduled","draft"]'), ['scheduled', 'draft'])
check('junk ignored, not a crash', parseFolded('{not json'), [])
check('unknown names dropped', parseFolded('["scheduled","completed",3]'), ['scheduled'])
check('a non-list is ignored', parseFolded('"draft"'), [])
check('open section stays open', sectionOpen(false, false), true)
check('folded section stays shut', sectionOpen(true, false), false)
check('while searching a folded section opens, so no match is hidden', sectionOpen(true, true), true)

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall passed')
