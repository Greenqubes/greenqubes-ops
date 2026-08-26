/**
 * Standalone test for the completion rating trust check (no test framework).
 * Run: npx tsx src/lib/utils/design-rating-trust.test.ts
 * Exits 1 on any failure.
 */

import { ratingSuspect, impliedComplexityFromDays } from './design-rating-trust'

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

// time evidence: days taken → implied complexity band
check('half day implies 1', impliedComplexityFromDays(0.5), 1)
check('one day implies 2',  impliedComplexityFromDays(1), 2)
check('two days implies 3', impliedComplexityFromDays(2), 3)
check('four days implies 4', impliedComplexityFromDays(4), 4)
check('six days implies 5', impliedComplexityFromDays(6), 5)
// suspect only when the rating disagrees >=2 with BOTH witnesses
check('agrees with AI → trusted', ratingSuspect({ rating: 4, aiComplexity: 4, daysTaken: 0.5 }), false)
check('agrees with time → trusted', ratingSuspect({ rating: 4, aiComplexity: 2, daysTaken: 4 }), false)
check('disagrees with both (inflated) → suspect', ratingSuspect({ rating: 5, aiComplexity: 2, daysTaken: 0.5 }), true)
check('disagrees with both (sandbagged) → suspect', ratingSuspect({ rating: 1, aiComplexity: 4, daysTaken: 6 }), true)
check('no AI score → time is the only witness', ratingSuspect({ rating: 5, aiComplexity: null, daysTaken: 0.5 }), true)
check('no AI score but time agrees → trusted', ratingSuspect({ rating: 5, aiComplexity: null, daysTaken: 6 }), false)

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed')
