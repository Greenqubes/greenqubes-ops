/**
 * Standalone test for the bin's purge ordering (no test framework).
 * Run: npx tsx src/lib/utils/bin-purge.test.ts
 * Exits 1 on any failure.
 */
import { purgeClaimed } from './bin-purge'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

async function main() {
  console.log('purgeClaimed:')

  // THE BUG (final review, 2026-09-28): files were deleted BEFORE the bin row
  // was claimed, so a restore landing mid-purge brought a job back with every
  // file gone. The claim must come first; if it gets nothing, nothing is deleted.
  const log: string[] = []
  const r1 = await purgeClaimed(
    async () => { log.push('claim'); return ['a', 'b'] },
    async k => { log.push(`del ${k}`) },
  )
  check('the row is claimed before any file is deleted', log, ['claim', 'del a', 'del b'])
  check('reports what it deleted', r1, { filesDeleted: 2, filesFailed: 0 })

  const deleted: string[] = []
  const r2 = await purgeClaimed(async () => null, async k => { deleted.push(k) })
  check('already restored or emptied → nothing deleted', deleted, [])
  check('…and says so', r2, null)

  const r3 = await purgeClaimed(async () => ['ok', 'bad'], async k => { if (k === 'bad') throw new Error('R2 down') })
  check('a file that fails is counted, the rest still go', r3, { filesDeleted: 1, filesFailed: 1 })

  if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
  console.log('\nall bin-purge checks passed')
}
main()
