/**
 * Standalone test for the cron freshness rule shown on Admin → Health (no test framework).
 * Run: npx tsx src/lib/utils/cron-health.test.ts
 * Exits 1 on any failure.
 */

import { cronFreshness } from './cron-health'

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

const now = '2026-09-03T06:55:00Z' // 2:55 pm SGT

const OVERDUE = { maxGapHours: 16, expectation: 'runs twice daily, 9am + 6pm SGT' }
const DESIGN  = { maxGapHours: 26, expectation: 'runs daily, 8:30am SGT' }

// never run
check('never run → unknown',
  cronFreshness(null, now, OVERDUE.maxGapHours, OVERDUE.expectation),
  { status: 'unknown', detail: 'No cron run recorded yet' })

// the bug: overdue cron warned after 4h, but its longest normal gap is 15h (6pm → next 9am)
check('overdue ran 5h ago (9am run, seen mid-afternoon) → ok, not warn',
  cronFreshness('2026-09-03T01:00:00Z', now, OVERDUE.maxGapHours, OVERDUE.expectation).status,
  'ok')

check('overdue ran 15h ago (6pm run, seen next morning before 9am) → ok',
  cronFreshness('2026-09-02T16:00:00Z', '2026-09-03T07:00:00Z', OVERDUE.maxGapHours, OVERDUE.expectation).status,
  'ok')

check('overdue ran 17h ago → warn with the twice-daily expectation',
  cronFreshness('2026-09-02T13:55:00Z', now, OVERDUE.maxGapHours, OVERDUE.expectation),
  { status: 'warn', detail: 'Last run 17h ago (runs twice daily, 9am + 6pm SGT)' })

// design cron: daily 8:30am SGT
check('design ran 6h ago → ok',
  cronFreshness('2026-09-03T00:30:00Z', now, DESIGN.maxGapHours, DESIGN.expectation).status,
  'ok')

check('design ran 30h ago (missed a morning) → warn with the daily expectation',
  cronFreshness('2026-09-02T00:55:00Z', now, DESIGN.maxGapHours, DESIGN.expectation),
  { status: 'warn', detail: 'Last run 30h ago (runs daily, 8:30am SGT)' })

// boundary: exactly at the max gap is still ok — only a longer gap warns
check('gap exactly at the limit → ok',
  cronFreshness('2026-09-02T14:55:00Z', now, 16, 'x').status,
  'ok')

// ok result carries the last-run time for the route to format
check('ok result returns the last-run ISO timestamp',
  cronFreshness('2026-09-03T01:00:00Z', now, 16, 'x'),
  { status: 'ok', lastRunISO: '2026-09-03T01:00:00Z' })

if (failures) {
  console.error(`\n${failures} test(s) FAILED`)
  process.exit(1)
}
console.log('\nAll tests passed')
