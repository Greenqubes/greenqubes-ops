/**
 * Standalone test for the assistant tool schemas + validators.
 * Run: npx tsx src/lib/ai/tool-schemas.test.ts
 * Exits 1 on any failure.
 */

import { TOOL_DEFINITIONS, TOOL_STATUS_KEYS, MAX_TOOL_ROUNDS, isIsoDate, validateRange } from './tool-schemas'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  if (JSON.stringify(actual) === JSON.stringify(expected)) { console.log(`  ✓ ${name}`) }
  else { console.error(`  ✗ ${name}\n      expected: ${JSON.stringify(expected)}\n      actual:   ${JSON.stringify(actual)}`); failures++ }
}

// 1. Every tool has a status key and vice versa (web_search is server-side, keyed separately)
const names = TOOL_DEFINITIONS.map(t => t.name).sort()
check('six tools defined', names, ['check_clashes', 'find_jobs', 'get_job', 'get_schedule', 'get_team_workload', 'search_knowledge'])
for (const n of names) check(`status key for ${n}`, typeof TOOL_STATUS_KEYS[n], 'string')
check('web_search status key', TOOL_STATUS_KEYS['web_search'], 'searching')

// 2. Round cap per spec
check('cap is 8', MAX_TOOL_ROUNDS, 8)

// 3. Date validation
check('valid date', isIsoDate('2026-08-28'), true)
check('rejects DD-MM', isIsoDate('28-08-2026'), false)
check('rejects impossible date', isIsoDate('2026-02-30'), false)
check('rejects non-string', isIsoDate(20260828), false)
check('rejects datetime', isIsoDate('2026-08-28T00:00:00Z'), false)

// 4. Range validation
check('good range', validateRange('2026-08-25', '2026-08-31'), null)
check('same-day range', validateRange('2026-08-25', '2026-08-25'), null)
check('end before start', typeof validateRange('2026-08-31', '2026-08-25'), 'string')
check('over 62 days', typeof validateRange('2026-01-01', '2026-06-01'), 'string')

// 5. Every input_schema declares its required fields
for (const t of TOOL_DEFINITIONS) {
  const schema = t.input_schema as { required?: string[] }
  check(`${t.name} has required[]`, Array.isArray(schema.required), true)
}

if (failures > 0) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll tool-schema checks passed')
