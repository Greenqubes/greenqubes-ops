/**
 * Standalone test for the + Add job picker's keyword matching (spec §4).
 * Run: npx tsx src/lib/utils/project-keywords.test.ts — exits 1 on any failure.
 */
import { extractKeywords, scoreJob } from './project-keywords'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual); const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

check('tokenises, lowers, drops stop-words + short words',
  extractKeywords('ABC Project — Visual Refresh', 'Luxottica'),
  ['abc', 'project', 'visual', 'refresh', 'luxottica'])
check('dedupes', extractKeywords('Fossil Fossil', 'Fossil'), ['fossil'])
check('empty in, empty out', extractKeywords('', ''), [])

const kw = extractKeywords('ABC Project — Visual Refresh', 'Luxottica')
check('full match scores high',
  scoreJob({ project_title: 'ABC Project — Jurong Point', client: 'Luxottica' }, kw), 3) // abc, project, luxottica
check('client-only match scores 1',
  scoreJob({ project_title: 'Ray-Ban window, Paragon', client: 'Luxottica' }, kw), 1)
check('no match scores 0',
  scoreJob({ project_title: 'Fossil pop-up', client: 'Fossil' }, kw), 0)
check('null title still scores client',
  scoreJob({ project_title: null, client: 'Luxottica' }, kw), 1)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll keyword checks passed')
