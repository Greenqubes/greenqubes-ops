/**
 * Standalone test for the old-jobsheet link key (no test framework).
 * Run: npx tsx src/lib/utils/jobsheet-key.test.ts
 * Exits 1 on any failure.
 */
import { newSheetKey, keysMatch, sheetLink } from './jobsheet-key'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

const k = newSheetKey()
check('key length (32 bytes base64url)', k.length, 43)
check('key is url-safe', /^[A-Za-z0-9_-]+$/.test(k), true)
check('two keys differ', newSheetKey() !== k, true)
check('match', keysMatch(k, k), true)
check('wrong key', keysMatch(k.slice(0, -1) + (k.endsWith('A') ? 'B' : 'A'), k), false)
check('different length', keysMatch(k + 'x', k), false)
check('missing', keysMatch(undefined, k), false)
check('empty', keysMatch('', k), false)
check('nothing stored', keysMatch(k, null), false)
check('link', sheetLink('https://greenqubes-ops.vercel.app', 'abc'), 'https://greenqubes-ops.vercel.app/api/sheet/jobs?key=abc')

if (failures) { console.error(`\n${failures} failure(s)`); process.exit(1) }
console.log('\nAll jobsheet-key checks passed')
