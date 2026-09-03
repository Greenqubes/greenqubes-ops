/**
 * Standalone test for the guided-tour engine (no test framework).
 * Run: npx tsx src/features/tour/engine.test.ts
 * Exits 1 on any failure.
 */
import { advance, parseTourState, serializeTourState, tourSeenKey } from './engine'
import { roleHome } from '../../lib/utils/roleHome'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

// roleHome — single source for the login redirect + tour auto-offer gate
check('installer home', roleHome('installer'), '/installer')
check('sales home', roleHome('sales'), '/schedule')
check('designer home', roleHome('designer'), '/schedule')

// seen key matches the localStorage pattern NotificationDrawer uses
check('seen key format', tourSeenKey('abc-123'), 'tour-seen:abc-123')

// state codec round-trip
check('round-trip', parseTourState(serializeTourState({ role: 'sales', step: 3 })), { role: 'sales', step: 3 })

// parse rejects garbage — a corrupted sessionStorage value must never crash or start a tour
check('parse null', parseTourState(null), null)
check('parse junk', parseTourState('not json'), null)
check('parse wrong role', parseTourState('{"role":"admin","step":0}'), null)
check('parse negative step', parseTourState('{"role":"sales","step":-1}'), null)
check('parse float step', parseTourState('{"role":"sales","step":1.5}'), null)
check('parse missing step', parseTourState('{"role":"sales"}'), null)

// advance — +1/-1 with clamped bottom and null (= finished) past the top
check('advance forward', advance({ role: 'sales', step: 0 }, 1, 3), { role: 'sales', step: 1 })
check('advance past end → finished', advance({ role: 'sales', step: 2 }, 1, 3), null)
check('back from step 1', advance({ role: 'sales', step: 1 }, -1, 3), { role: 'sales', step: 0 })
check('back from step 0 stays', advance({ role: 'sales', step: 0 }, -1, 3), { role: 'sales', step: 0 })

if (failures) { console.error(`\n${failures} test(s) FAILED`); process.exit(1) }
console.log('\nAll tests passed')
