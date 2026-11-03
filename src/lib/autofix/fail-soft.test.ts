/**
 * Standalone test: which database errors mean "migration 0069 isn't applied
 * yet" — the case every reader of the new columns/tables must survive, because
 * code can deploy (and the preview runs today) before Nic applies it.
 * Run: npx tsx src/lib/autofix/fail-soft.test.ts
 * Exits 1 on any failure.
 */

import { isMissingColumnOrTable, withoutBuildIdOnMissingColumn } from './fail-soft'

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

check('42703 undefined column → true', isMissingColumnOrTable({ code: '42703' }), true)
check('42P01 undefined table → true', isMissingColumnOrTable({ code: '42P01' }), true)
check('PGRST204 column not in schema cache → true', isMissingColumnOrTable({ code: 'PGRST204' }), true)
check('PGRST205 table not in schema cache → true', isMissingColumnOrTable({ code: 'PGRST205' }), true)
check('23505 unique violation → false', isMissingColumnOrTable({ code: '23505' }), false)
check('null → false', isMissingColumnOrTable(null), false)

async function main() {
  // The insert helper: first try with build_id, retry once without it only
  // when the column is missing — so a crash is never lost to the migration gap.
  const seen: Record<string, unknown>[] = []
  const missingThenOk = async (row: Record<string, unknown>) => {
    seen.push(row)
    return 'build_id' in row ? { error: { code: 'PGRST204' } } : { error: null }
  }
  const r1 = await withoutBuildIdOnMissingColumn({ route: '/x', build_id: 'abc' }, missingThenOk)
  check('missing column → retried without build_id', seen.map(r => 'build_id' in r), [true, false])
  check('missing column → final result ok', r1.error, null)

  const seen2: Record<string, unknown>[] = []
  const otherError = async (row: Record<string, unknown>) => { seen2.push(row); return { error: { code: '23505' } } }
  const r2 = await withoutBuildIdOnMissingColumn({ route: '/x', build_id: 'abc' }, otherError)
  check('other error → no retry', seen2.length, 1)
  check('other error → returned', r2.error, { code: '23505' })

  const seen3: Record<string, unknown>[] = []
  const fine = async (row: Record<string, unknown>) => { seen3.push(row); return { error: null } }
  await withoutBuildIdOnMissingColumn({ route: '/x', build_id: 'abc' }, fine)
  check('applied migration → one insert with build_id', seen3.map(r => r.build_id), ['abc'])

  if (failures > 0) {
    console.error(`\n${failures} check(s) failed`)
    process.exit(1)
  }
  console.log('\nAll fail-soft checks passed')
}

main()
