/**
 * Standalone test for urgency scoring and bar geometry (no test framework).
 * Run: npx tsx src/lib/utils/design-urgency.test.ts
 * Exits 1 on any failure.
 */

import { computeUrgency, segmentHeightPx, daysBetween, addDaysISO } from './design-urgency'

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

// unscored → 0 (grey)
check('null complexity is unscored', computeUrgency({ complexity: null, daysToDue: 5, openCount: 1, maxOpenCount: 3 }), 0)
check('null due date is unscored',   computeUrgency({ complexity: 3, daysToDue: null, openCount: 1, maxOpenCount: 3 }), 0)
// base = complexity, clamped 1..5
check('relaxed job stays at base',   computeUrgency({ complexity: 2, daysToDue: 8, openCount: 1, maxOpenCount: 4 }), 2)
// due pressure: <=1 day +2, <=3 days +1, >=10 days -1
check('due tomorrow bumps +2',       computeUrgency({ complexity: 3, daysToDue: 1, openCount: 1, maxOpenCount: 4 }), 5)
check('due in 3 days bumps +1',      computeUrgency({ complexity: 3, daysToDue: 3, openCount: 1, maxOpenCount: 4 }), 4)
check('far-off due relaxes -1',      computeUrgency({ complexity: 3, daysToDue: 12, openCount: 1, maxOpenCount: 4 }), 2)
check('boundary at 10 days',         computeUrgency({ complexity: 3, daysToDue: 10, openCount: 1, maxOpenCount: 4 }), 2)
// load: busiest designer (>=75% of max, >=3 open) +1
check('overloaded designer bumps +1', computeUrgency({ complexity: 2, daysToDue: 8, openCount: 3, maxOpenCount: 4 }), 3)
// clamping
check('clamps at 5', computeUrgency({ complexity: 5, daysToDue: 0, openCount: 4, maxOpenCount: 4 }), 5)
check('clamps at 1', computeUrgency({ complexity: 1, daysToDue: 30, openCount: 0, maxOpenCount: 4 }), 1)
// heights: closer due = taller
check('height overdue/today', segmentHeightPx(0), 96)
check('height 3 days',        segmentHeightPx(3), 76)
check('height 7 days',        segmentHeightPx(7), 56)
check('height 14 days',       segmentHeightPx(14), 44)
check('height far',           segmentHeightPx(30), 32)
check('height unscored',      segmentHeightPx(null), 32)
// day maths (date-only, no TZ drift)
check('daysBetween', daysBetween('2026-08-18', '2026-08-21'), 3)
check('daysBetween negative when past', daysBetween('2026-08-18', '2026-08-16'), -2)
// due-date auto-shift (Nic's own example)
check('addDaysISO', addDaysISO('2026-09-15', -8), '2026-09-07')

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed')
