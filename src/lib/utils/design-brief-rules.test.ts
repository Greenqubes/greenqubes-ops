/**
 * Standalone test for two-stage design brief requirement rule (no test framework).
 * Run: npx tsx src/lib/utils/design-brief-rules.test.ts
 * Exits 1 on any failure.
 */

import { briefRequiredError } from './design-brief-rules'

let failures = 0

function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  ✓ ${name}`)
  } else {
    console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`)
    failures++
  }
}

// pre-booking exempt: the New Job form NEVER requires a brief
check('new job, designer, no brief → allowed', briefRequiredError({ isNewJob: true, status: 'pending', designerCount: 1, briefText: '' }), false)
// edit form: scheduled + designer + empty text → blocked
check('edit scheduled + designer + empty → blocked', briefRequiredError({ isNewJob: false, status: 'scheduled', designerCount: 1, briefText: '' }), true)
check('whitespace does not count as text', briefRequiredError({ isNewJob: false, status: 'scheduled', designerCount: 1, briefText: '   ' }), true)
// any brief text satisfies it
check('brief text present → allowed', briefRequiredError({ isNewJob: false, status: 'scheduled', designerCount: 2, briefText: 'L3 atrium decals only' }), false)
// no designer → never required
check('no designer → allowed', briefRequiredError({ isNewJob: false, status: 'scheduled', designerCount: 0, briefText: '' }), false)
// pending edit (not yet scheduled) → not required
check('pending job → allowed', briefRequiredError({ isNewJob: false, status: 'pending', designerCount: 1, briefText: '' }), false)

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed')
