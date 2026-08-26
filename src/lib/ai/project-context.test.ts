/**
 * Standalone test for the project prompt-context builders.
 * Run: npx tsx src/lib/ai/project-context.test.ts
 * Exits 1 on any failure.
 */

import { projectSystemBlock, projectFilesLeadText } from './project-context'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// 1. System block always names the project
check('names the project',
  projectSystemBlock('Changi Site', null).includes('"Changi Site"'), true)
check('no instructions → single paragraph',
  projectSystemBlock('Changi Site', null).includes('Project instructions'), false)
check('blank instructions treated as none',
  projectSystemBlock('Changi Site', '   ').includes('Project instructions'), false)

// 2. Instructions included verbatim (trimmed)
const withIns = projectSystemBlock('Changi Site', '  Always answer in bullet points.  ')
check('instructions header present', withIns.includes('Project instructions from the user'), true)
check('instructions text verbatim', withIns.includes('Always answer in bullet points.'), true)
check('instructions trimmed', withIns.includes('  Always answer'), false)

// 3. Determinism — same input, byte-identical output (prompt-cache prefix)
check('deterministic', projectSystemBlock('A', 'B') === projectSystemBlock('A', 'B'), true)

// 4. Files lead text
check('no files → empty string', projectFilesLeadText([]), '')
const lead = projectFilesLeadText([
  { name: 'permit.pdf', mime: 'application/pdf' },
  { name: 'site.jpg',   mime: 'image/jpeg' },
])
check('lists names in order', lead.indexOf('permit.pdf') < lead.indexOf('site.jpg'), true)
check('pdf labelled', lead.includes('(pdf)'), true)
check('image labelled', lead.includes('(image)'), true)

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll project-context checks passed')
