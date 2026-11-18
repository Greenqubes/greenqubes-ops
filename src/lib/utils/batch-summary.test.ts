/**
 * Standalone test for the after-a-batch message (chat send, gallery download).
 * Run: npx tsx src/lib/utils/batch-summary.test.ts
 * Exits 1 on any failure.
 */
import { batchSummary } from './batch-summary'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

console.log('batchSummary — what the person is told after a batch')
check('every file went', batchSummary(3, []), { kind: 'all' })
check('some failed: say how many went and name the rest',
  batchSummary(3, [{ name: 'plan.pdf', reason: 'storage 500' }]),
  { kind: 'some', sent: 2, total: 3, names: 'plan.pdf' })
check('several failed: names joined in pick order',
  batchSummary(4, [{ name: 'a.jpg', reason: '' }, { name: 'b.jpg', reason: '' }]),
  { kind: 'some', sent: 2, total: 4, names: 'a.jpg, b.jpg' })
check('all failed: the first real reason is shown',
  batchSummary(2, [{ name: 'a.jpg', reason: '' }, { name: 'b.jpg', reason: 'storage 403' }]),
  { kind: 'none', reason: 'storage 403' })
check('all failed with no reason at all',
  batchSummary(1, [{ name: 'a.jpg', reason: '' }]),
  { kind: 'none', reason: '' })

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nall batch-summary checks passed')
