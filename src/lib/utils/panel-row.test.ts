/**
 * Standalone test for the side panel's job row lines (no test framework).
 * Run: npx tsx src/lib/utils/panel-row.test.ts
 * Exits 1 on any failure.
 */
import { oneLine, panelRowHead } from './panel-row'

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected)
  if (a === e) console.log(`  ✓ ${name}`)
  else { console.error(`  ✗ ${name}\n      expected: ${e}\n      actual:   ${a}`); failures++ }
}

console.log('oneLine')
check('multi-line description becomes one line', oneLine('Install 2 bays\n\nbring ladder'), 'Install 2 bays bring ladder')
check('only spaces → nothing', oneLine('   '), null)
check('null → nothing', oneLine(null), null)
check('undefined → nothing', oneLine(undefined), null)
check('inner runs of spaces collapse, ends trimmed', oneLine('  a  b '), 'a b')

console.log('panelRowHead')
check('date · client when the job has a title',
  panelRowHead('Mon 9 Nov', { project_title: 'Fossil Westgate Bay Swap', client: 'Fossil' }), 'Mon 9 Nov · Fossil')
check('no title → the title line already shows the client, so date only',
  panelRowHead('Mon 9 Nov', { project_title: null, client: 'Fossil' }), 'Mon 9 Nov')
check('no client → date only',
  panelRowHead('Mon 9 Nov', { project_title: 'X', client: '' }), 'Mon 9 Nov')

if (failures) { console.error(`\n${failures} failing`); process.exit(1) }
console.log('\nall passing')
